import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, type Db } from '../src/db';
import { RunSseHub } from '../src/sse';
import { Runner } from '../src/runner';
import { setGhlIntegration } from '../src/ghl/integration';
import type { AutomationStep } from '../src/types';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitFor(cond: () => boolean, what: string, timeoutMs = 8000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}

function wait(id: string, ms: number): AutomationStep {
  return { id, type: 'wait', label: `Wait ${ms}ms`, value: String(ms) };
}

function makeRunner() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgg-runner-'));
  const db = openDb({ dataDir: dir });
  const hub = new RunSseHub();
  const runner = new Runner(db, hub, {
    artifactsDir: path.join(dir, 'artifacts'),
    origin: 'http://127.0.0.1:0',
  });
  return {
    db,
    runner,
    cleanup: () => {
      db.raw.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function eventTypes(db: Db, runId: string): string[] {
  return db.listEvents(runId).map((e) => (JSON.parse(e.payloadJson) as { type: string }).type);
}

test('a wait-only run completes and records the full event trail', async () => {
  const ctx = makeRunner();
  try {
    // Includes an explicit 0ms wait: it must be honored, not coerced to 1s.
    const steps = [wait('s1', 60), wait('s2', 0)];
    ctx.db.createRun({ id: 'run1', stepsJson: JSON.stringify(steps) });
    ctx.runner.enqueue('run1', steps, 1);

    await waitFor(() => ctx.db.getRun('run1')?.status === 'completed', 'run1 to complete');

    const run = ctx.db.getRun('run1');
    assert.ok(run);
    assert.ok(run.startedAt);
    assert.ok(run.endedAt);
    assert.equal(run.error, null);

    const types = eventTypes(ctx.db, 'run1');
    assert.equal(types[0], 'run_started');
    assert.equal(types[types.length - 1], 'run_completed');
    assert.equal(types.filter((t) => t === 'step_started').length, 2);
    assert.equal(types.filter((t) => t === 'audit_entry').length, 2);

    const audits = ctx.db
      .listEvents('run1')
      .map((e) => JSON.parse(e.payloadJson) as { type: string; entry?: { status: string; message: string } })
      .filter((e) => e.type === 'audit_entry');
    for (const a of audits) {
      assert.equal(a.entry?.status, 'passed');
    }
    assert.deepEqual(
      audits.map((a) => a.entry?.message),
      ['Waited 60ms', 'Waited 0ms']
    );
  } finally {
    ctx.cleanup();
  }
});

test('aborting a queued run does not flip it back to running (regression)', async () => {
  const ctx = makeRunner();
  try {
    const longSteps = [wait('s1', 250)];
    const queuedSteps = [wait('s1', 30)];
    ctx.db.createRun({ id: 'busy', stepsJson: JSON.stringify(longSteps) });
    ctx.db.createRun({ id: 'queued', stepsJson: JSON.stringify(queuedSteps) });

    ctx.runner.enqueue('busy', longSteps, 1); // occupies the runner
    ctx.runner.enqueue('queued', queuedSteps, 1); // sits in the queue
    ctx.runner.abort('queued'); // aborted before it ever starts

    assert.equal(ctx.db.getRun('queued')?.status, 'aborted');

    await waitFor(() => ctx.db.getRun('busy')?.status === 'completed', 'busy run to complete');
    // Give the runner a beat to dequeue (and, pre-fix, wrongly start) 'queued'.
    await sleep(150);

    const queued = ctx.db.getRun('queued');
    assert.ok(queued);
    assert.equal(queued.status, 'aborted');
    assert.deepEqual(eventTypes(ctx.db, 'queued'), ['run_aborted']);
  } finally {
    ctx.cleanup();
  }
});

test('aborting mid-run ends the run without a run_completed event', async () => {
  const ctx = makeRunner();
  try {
    const steps = [wait('s1', 200), wait('s2', 200)];
    ctx.db.createRun({ id: 'run1', stepsJson: JSON.stringify(steps) });
    ctx.runner.enqueue('run1', steps, 1);

    await sleep(50); // let step 1 get going
    ctx.runner.abort('run1');

    // Wait long enough for the in-flight step to drain.
    await sleep(500);

    const run = ctx.db.getRun('run1');
    assert.ok(run);
    assert.equal(run.status, 'aborted');
    assert.ok(run.endedAt);
    const types = eventTypes(ctx.db, 'run1');
    assert.ok(types.includes('run_aborted'));
    assert.ok(!types.includes('run_completed'));
    assert.ok(!types.includes('run_failed'));
  } finally {
    ctx.cleanup();
  }
});

test('a step failing after abort does not overwrite the aborted status (regression)', async () => {
  const ctx = makeRunner();
  const originalFetch = globalThis.fetch;
  try {
    // Connected integration with a location, so the api step goes straight
    // to the (mocked) GHL request.
    setGhlIntegration(ctx.db, { accessToken: 'tok', locationId: 'loc_1', capturedAt: 1 });
    globalThis.fetch = (async () => {
      await sleep(150); // resolves only after the abort below has landed
      return new Response('denied', { status: 400 });
    }) as typeof fetch;

    const steps: AutomationStep[] = [
      { id: 's1', type: 'api', label: 'GHL call', api: { service: 'ghl', method: 'GET', path: '/x' } },
    ];
    ctx.db.createRun({ id: 'run1', stepsJson: JSON.stringify(steps) });
    ctx.runner.enqueue('run1', steps, 1);

    await sleep(50); // abort while the GHL request is in flight
    ctx.runner.abort('run1');

    await sleep(400); // let the in-flight request fail and the run drain

    const run = ctx.db.getRun('run1');
    assert.ok(run);
    assert.equal(run.status, 'aborted');
    const types = eventTypes(ctx.db, 'run1');
    assert.ok(types.includes('run_aborted'));
    assert.ok(!types.includes('run_failed'));
  } finally {
    globalThis.fetch = originalFetch;
    ctx.cleanup();
  }
});

test('pause holds the run between steps and resume completes it', async () => {
  const ctx = makeRunner();
  try {
    const steps = [wait('s1', 150), wait('s2', 40)];
    ctx.db.createRun({ id: 'run1', stepsJson: JSON.stringify(steps) });
    ctx.runner.enqueue('run1', steps, 1);

    await sleep(30); // pause while step 1 is still sleeping
    ctx.runner.pause('run1');
    assert.equal(ctx.db.getRun('run1')?.status, 'paused');

    await sleep(400); // step 1 drains; the run must now be held before step 2
    assert.equal(ctx.db.getRun('run1')?.status, 'paused');
    assert.ok(!eventTypes(ctx.db, 'run1').includes('run_completed'));

    ctx.runner.resume('run1');
    await waitFor(() => ctx.db.getRun('run1')?.status === 'completed', 'run1 to complete after resume');

    const types = eventTypes(ctx.db, 'run1');
    assert.ok(types.includes('run_paused'));
    assert.ok(types.includes('run_resumed'));
    assert.equal(types[types.length - 1], 'run_completed');
  } finally {
    ctx.cleanup();
  }
});
