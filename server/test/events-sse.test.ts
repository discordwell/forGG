import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp, type RunnerLike } from '../src/app';
import { openDb } from '../src/db';
import { RunSseHub } from '../src/sse';

const noopRunner: RunnerLike = {
  enqueue() {},
  pause() {},
  resume() {},
  abort() {},
};

function makeServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgg-sse-'));
  const artifactsDir = path.join(dir, 'artifacts');
  const sandboxDir = path.join(dir, 'sandbox');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(sandboxDir, { recursive: true });
  const db = openDb({ dataDir: dir });
  const hub = new RunSseHub();
  const app = buildApp({ db, hub, runner: noopRunner, artifactsDir, sandboxDir });
  return {
    app,
    db,
    hub,
    cleanup: async () => {
      await app.close();
      db.raw.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Open a raw SSE connection and accumulate the streamed text. */
async function openSse(port: number, urlPath: string) {
  const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'GET' });
  let buffer = '';
  let status = 0;
  const ready = new Promise<void>((resolve, reject) => {
    req.on('response', (res) => {
      status = res.statusCode ?? 0;
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
      });
      resolve();
    });
    req.on('error', reject);
  });
  req.end();
  await ready;

  return {
    get status() {
      return status;
    },
    get text() {
      return buffer;
    },
    async waitFor(needle: string, timeoutMs = 4000) {
      const start = Date.now();
      while (!buffer.includes(needle)) {
        if (Date.now() - start > timeoutMs) {
          throw new Error(`timed out waiting for ${JSON.stringify(needle)}; got ${JSON.stringify(buffer)}`);
        }
        await new Promise((r) => setTimeout(r, 10));
      }
    },
    close() {
      req.destroy();
    },
  };
}

test('GET /api/runs/:id/events replays history then streams live events in order', async () => {
  const ctx = makeServer();
  try {
    const base = await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(new URL(base).port);

    // Seed a run plus one persisted event — this is the history to replay.
    ctx.db.createRun({ id: 'run1', stepsJson: '[]' });
    ctx.db.addEvent({
      runId: 'run1',
      ts: 1,
      type: 'run_started',
      payloadJson: JSON.stringify({ type: 'run_started', runId: 'run1', ts: 1, marker: 'HISTORY' }),
    });

    const client = await openSse(port, '/api/runs/run1/events');
    assert.equal(client.status, 200);

    // Replay: the connected preamble and the historical event both arrive.
    await client.waitFor('HISTORY');
    assert.ok(client.text.includes(': connected'));

    // Live: a broadcast issued after the client connected is delivered too.
    ctx.hub.broadcast('run1', { type: 'audit_entry', runId: 'run1', ts: 2, marker: 'LIVE' });
    await client.waitFor('LIVE');

    const text = client.text;
    // History is delivered exactly once (no duplicate from a racing broadcast)...
    assert.equal(text.split('HISTORY').length - 1, 1);
    // ...and the replayed history precedes the live event.
    assert.ok(text.indexOf('HISTORY') < text.indexOf('LIVE'));

    client.close();
  } finally {
    await ctx.cleanup();
  }
});

test('GET /api/runs/:id/events returns 404 for an unknown run', async () => {
  const ctx = makeServer();
  try {
    const base = await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const port = Number(new URL(base).port);

    const client = await openSse(port, '/api/runs/nope/events');
    assert.equal(client.status, 404);
    client.close();
  } finally {
    await ctx.cleanup();
  }
});
