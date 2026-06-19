import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { chromium } from 'playwright';
import { openDb, type Db } from '../src/db';
import { RunSseHub } from '../src/sse';
import { Runner } from '../src/runner';
import type { AutomationStep, RunEvent, AuditLogEntry } from '../src/types';

// These tests drive the runner's *real* Playwright path (navigate / extract /
// assert / type / click / select / scroll / screenshot) against a local fixture
// page — coverage the wait-only and mocked-`api` runner tests can't give. They
// launch a headless Chromium, so they self-skip when no browser binary is
// installed, keeping the default suite runnable everywhere.
function chromiumAvailable(): boolean {
  try {
    const exe = chromium.executablePath();
    return Boolean(exe) && fs.existsSync(exe);
  } catch {
    return false;
  }
}

const SKIP: string | false = chromiumAvailable()
  ? false
  : 'Chromium binary not installed (run `npx playwright install chromium`)';

// Served at /sandbox/<page>.html for every navigate. A tall spacer pushes
// #footer off-screen so the `scroll` step has somewhere to scroll to.
const FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Runner Fixture</title></head>
  <body style="margin:0;font-family:sans-serif">
    <h1 id="title">Runbook Sandbox</h1>
    <div id="score">Score: 42</div>
    <input id="email" />
    <button id="go">Go</button>
    <select id="picker">
      <option value="alpha">Alpha</option>
      <option value="beta">Beta</option>
    </select>
    <div style="height:1600px"></div>
    <div id="footer">Footer marker</div>
  </body>
</html>`;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitFor(cond: () => boolean, what: string, timeoutMs = 30000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(25);
  }
}

interface Harness {
  db: Db;
  runner: Runner;
  artifactsDir: string;
  cleanup: () => Promise<void>;
}

async function makeHarness(): Promise<Harness> {
  // Tiny static server that returns the fixture for any /sandbox/* request, so
  // the runner can `navigate` to it like it would the real sandbox pages.
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith('/sandbox/')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(FIXTURE_HTML);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgg-browser-'));
  const db = openDb({ dataDir: dir });
  const hub = new RunSseHub();
  const artifactsDir = path.join(dir, 'artifacts');
  const runner = new Runner(db, hub, { artifactsDir, origin });

  return {
    db,
    runner,
    artifactsDir,
    cleanup: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.raw.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function parseEvents(db: Db, runId: string): RunEvent[] {
  return db.listEvents(runId).map((e) => JSON.parse(e.payloadJson) as RunEvent);
}

function auditEntries(db: Db, runId: string): AuditLogEntry[] {
  return parseEvents(db, runId)
    .filter((e): e is Extract<RunEvent, { type: 'audit_entry' }> => e.type === 'audit_entry')
    .map((e) => e.entry);
}

test('a full browser run drives every step type and writes a screenshot artifact', { skip: SKIP }, async () => {
  const ctx = await makeHarness();
  try {
    const steps: AutomationStep[] = [
      { id: 's1', type: 'navigate', label: 'Open fixture', page: 'fixture', value: 'Fixture' },
      { id: 's2', type: 'extract', label: 'Read title', target: '#title' },
      { id: 's3', type: 'assert', label: 'Title contains Sandbox', target: '#title', assertion: 'contains', value: 'Sandbox' },
      { id: 's4', type: 'assert', label: 'Score over 40', target: '#score', assertion: 'greaterThan', value: '40' },
      { id: 's5', type: 'type', label: 'Fill email', target: '#email', value: 'lead@example.com' },
      { id: 's6', type: 'click', label: 'Click go', target: '#go' },
      { id: 's7', type: 'select', label: 'Pick Beta', target: '#picker', value: 'Beta' },
      { id: 's8', type: 'scroll', label: 'Scroll to footer', target: '#footer' },
      { id: 's9', type: 'screenshot', label: 'Capture' },
    ];
    ctx.db.createRun({ id: 'run1', stepsJson: JSON.stringify(steps) });
    ctx.runner.enqueue('run1', steps, 8); // speed up the runner's artificial delays

    await waitFor(() => ctx.db.getRun('run1')?.status === 'completed', 'run1 to complete');

    const run = ctx.db.getRun('run1');
    assert.ok(run);
    assert.ok(run.startedAt && run.endedAt);
    assert.equal(run.error, null);

    const types = parseEvents(ctx.db, 'run1').map((e) => e.type);
    assert.equal(types[0], 'run_started');
    assert.equal(types[types.length - 1], 'run_completed');
    assert.equal(types.filter((t) => t === 'step_started').length, steps.length);

    const audits = auditEntries(ctx.db, 'run1');
    assert.equal(audits.length, steps.length);
    assert.ok(audits.every((a) => a.status === 'passed'), 'every step should pass');

    // The extract step pulled the live text out of the page.
    const extract = audits.find((a) => a.type === 'extract');
    assert.ok(extract);
    assert.deepEqual(extract.extractedData, { target: '#title', text: 'Runbook Sandbox' });

    // The screenshot step recorded an artifact URL and actually wrote the file.
    const shot = audits.find((a) => a.type === 'screenshot');
    assert.ok(shot);
    assert.equal(shot.screenshotUrl, '/artifacts/run1/screenshot_step_9.png');
    const shotPath = path.join(ctx.artifactsDir, 'run1', 'screenshot_step_9.png');
    assert.ok(fs.existsSync(shotPath), 'screenshot file should exist on disk');
    assert.ok(fs.statSync(shotPath).size > 0, 'screenshot file should be non-empty');
  } finally {
    await ctx.cleanup();
  }
});

test('a failed assertion in the browser fails the run with the real reason', { skip: SKIP }, async () => {
  const ctx = await makeHarness();
  try {
    const steps: AutomationStep[] = [
      { id: 's1', type: 'navigate', label: 'Open fixture', page: 'fixture' },
      // "Score: 42" is not greater than 100, so this step must fail the run.
      { id: 's2', type: 'assert', label: 'Score over 100', target: '#score', assertion: 'greaterThan', value: '100' },
      { id: 's3', type: 'screenshot', label: 'Never reached' },
    ];
    ctx.db.createRun({ id: 'run2', stepsJson: JSON.stringify(steps) });
    ctx.runner.enqueue('run2', steps, 8);

    await waitFor(() => ctx.db.getRun('run2')?.status === 'failed', 'run2 to fail');

    const run = ctx.db.getRun('run2');
    assert.ok(run);
    assert.match(run.error ?? '', /expected 42 > 100/);

    const types = parseEvents(ctx.db, 'run2').map((e) => e.type);
    assert.ok(types.includes('run_failed'));
    assert.ok(!types.includes('run_completed'));
    // The run stopped at the failing assert: the screenshot step never ran.
    assert.equal(types.filter((t) => t === 'step_started').length, 2);

    const audits = auditEntries(ctx.db, 'run2');
    const failed = audits.find((a) => a.status === 'failed');
    assert.ok(failed);
    assert.equal(failed.type, 'assert');
    assert.equal(failed.severity, 'error');
  } finally {
    await ctx.cleanup();
  }
});
