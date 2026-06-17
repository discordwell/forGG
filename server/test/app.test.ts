import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp, type RunnerLike } from '../src/app';
import { openDb } from '../src/db';
import { RunSseHub } from '../src/sse';

const waitStep = { id: 's1', type: 'wait', label: 'Wait a bit', value: '50' };

interface RunnerCall {
  method: 'enqueue' | 'pause' | 'resume' | 'abort';
  runId: string;
  speed?: number;
}

function makeApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgg-app-'));
  const artifactsDir = path.join(dir, 'artifacts');
  const sandboxDir = path.join(dir, 'sandbox');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(sandboxDir, { recursive: true });

  const db = openDb({ dataDir: dir });
  const hub = new RunSseHub();
  const calls: RunnerCall[] = [];
  const runner: RunnerLike = {
    enqueue: (runId, _steps, speed) => calls.push({ method: 'enqueue', runId, speed }),
    pause: (runId) => calls.push({ method: 'pause', runId }),
    resume: (runId) => calls.push({ method: 'resume', runId }),
    abort: (runId) => calls.push({ method: 'abort', runId }),
  };
  const app = buildApp({ db, hub, runner, artifactsDir, sandboxDir });

  return {
    app,
    db,
    calls,
    sandboxDir,
    cleanup: async () => {
      await app.close();
      db.raw.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('GET /healthz', async () => {
  const ctx = makeApp();
  try {
    const res = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  } finally {
    await ctx.cleanup();
  }
});

test('POST /api/runs rejects invalid payloads and does not enqueue', async () => {
  const ctx = makeApp();
  try {
    const bad = await ctx.app.inject({ method: 'POST', url: '/api/runs', payload: { steps: [] } });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.json().error, 'invalid_request');

    const wrongType = await ctx.app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { steps: [{ id: 'x', type: 'fly', label: 'Nope' }] },
    });
    assert.equal(wrongType.statusCode, 400);
    assert.equal(ctx.calls.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('POST /api/runs persists the run and enqueues it', async () => {
  const ctx = makeApp();
  try {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/runs', payload: { steps: [waitStep] } });
    assert.equal(res.statusCode, 201);
    const { runId } = res.json() as { runId: string };
    assert.ok(runId);

    const run = ctx.db.getRun(runId);
    assert.ok(run);
    assert.equal(run.status, 'queued');
    assert.deepEqual(JSON.parse(run.stepsJson), [waitStep]);

    assert.deepEqual(ctx.calls, [{ method: 'enqueue', runId, speed: 1 }]); // speed defaults to 1

    const withSpeed = await ctx.app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { steps: [waitStep], speed: 2.5 },
    });
    assert.equal(withSpeed.statusCode, 201);
    assert.equal(ctx.calls[1].speed, 2.5);
  } finally {
    await ctx.cleanup();
  }
});

test('run detail, listing and events.json', async () => {
  const ctx = makeApp();
  try {
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/runs/nope' })).statusCode, 404);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/runs/nope/events.json' })).statusCode, 404);

    const created = await ctx.app.inject({ method: 'POST', url: '/api/runs', payload: { steps: [waitStep] } });
    const { runId } = created.json() as { runId: string };

    const detail = await ctx.app.inject({ method: 'GET', url: `/api/runs/${runId}` });
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().id, runId);

    const list = await ctx.app.inject({ method: 'GET', url: '/api/runs?limit=10' });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().length, 1);

    // A non-integer limit must not 500 (it would crash SQLite's LIMIT binding
    // with a "datatype mismatch" before the floor was added).
    const floatLimit = await ctx.app.inject({ method: 'GET', url: '/api/runs?limit=2.5' });
    assert.equal(floatLimit.statusCode, 200);
    assert.equal(floatLimit.json().length, 1);

    // A non-numeric limit falls back to the default rather than erroring.
    const junkLimit = await ctx.app.inject({ method: 'GET', url: '/api/runs?limit=abc' });
    assert.equal(junkLimit.statusCode, 200);
    assert.equal(junkLimit.json().length, 1);

    ctx.db.addEvent({ runId, ts: 1, type: 'run_started', payloadJson: '{"type":"run_started"}' });
    const events = await ctx.app.inject({ method: 'GET', url: `/api/runs/${runId}/events.json` });
    assert.equal(events.statusCode, 200);
    assert.deepEqual(events.json(), { runId, events: [{ type: 'run_started' }] });
  } finally {
    await ctx.cleanup();
  }
});

test('pause/resume/abort forward to the runner and 404 on unknown runs', async () => {
  const ctx = makeApp();
  try {
    for (const action of ['pause', 'resume', 'abort'] as const) {
      const missing = await ctx.app.inject({ method: 'POST', url: `/api/runs/nope/${action}` });
      assert.equal(missing.statusCode, 404);
    }

    const created = await ctx.app.inject({ method: 'POST', url: '/api/runs', payload: { steps: [waitStep] } });
    const { runId } = created.json() as { runId: string };
    ctx.calls.length = 0;

    for (const action of ['pause', 'resume', 'abort'] as const) {
      const res = await ctx.app.inject({ method: 'POST', url: `/api/runs/${runId}/${action}` });
      assert.equal(res.statusCode, 200);
    }
    assert.deepEqual(
      ctx.calls.map((c) => c.method),
      ['pause', 'resume', 'abort']
    );
  } finally {
    await ctx.cleanup();
  }
});

test('GHL connect/status/disconnect lifecycle never leaks tokens', async () => {
  const ctx = makeApp();
  try {
    const before = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/status' });
    assert.deepEqual(before.json(), { connected: false });

    const badToken = await ctx.app.inject({ method: 'POST', url: '/api/integrations/ghl/token', payload: {} });
    assert.equal(badToken.statusCode, 400);

    const token = await ctx.app.inject({
      method: 'POST',
      url: '/api/integrations/ghl/token',
      payload: { authToken: 'tok_secret', tokenId: 'fb_1', companyId: 'co_1', userId: 'u_1', locationId: '' },
      headers: { origin: 'https://app.gohighlevel.com' },
    });
    assert.equal(token.statusCode, 200);
    assert.equal(token.headers['access-control-allow-origin'], 'https://app.gohighlevel.com');

    const status = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/status' });
    const body = status.json();
    assert.equal(body.connected, true);
    assert.equal(body.companyId, 'co_1');
    assert.equal(body.hasTokenId, true);
    assert.equal(body.locationId, null); // empty string normalized away
    assert.ok(!status.payload.includes('tok_secret'));
    assert.ok(!status.payload.includes('fb_1'));

    const setLocation = await ctx.app.inject({
      method: 'POST',
      url: '/api/integrations/ghl/location',
      payload: { locationId: 'loc_9' },
    });
    assert.equal(setLocation.statusCode, 200);
    const after = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/status' });
    assert.equal(after.json().locationId, 'loc_9');

    const del = await ctx.app.inject({ method: 'DELETE', url: '/api/integrations/ghl' });
    assert.equal(del.statusCode, 200);
    const finalStatus = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/status' });
    assert.deepEqual(finalStatus.json(), { connected: false });
  } finally {
    await ctx.cleanup();
  }
});

test('POST /api/integrations/ghl/location requires a connection', async () => {
  const ctx = makeApp();
  try {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/integrations/ghl/location',
      payload: { locationId: 'loc_1' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'not_connected');
  } finally {
    await ctx.cleanup();
  }
});

test('CORS preflight only allows known GHL origins', async () => {
  const ctx = makeApp();
  try {
    const allowed = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/api/integrations/ghl/token',
      headers: { origin: 'https://app.gohighlevel.com' },
    });
    assert.equal(allowed.statusCode, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.gohighlevel.com');

    const denied = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/api/integrations/ghl/token',
      headers: { origin: 'https://evil.example.com' },
    });
    assert.equal(denied.statusCode, 204);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  } finally {
    await ctx.cleanup();
  }
});

test('bridge page renders with the token post URL', async () => {
  const ctx = makeApp();
  try {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/integrations/ghl/bridge',
      headers: { host: 'localhost:9999' },
    });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /text\/html/);
    assert.ok(res.payload.includes('http://localhost:9999/api/integrations/ghl/token'));
  } finally {
    await ctx.cleanup();
  }
});

test('GET /api/integrations/ghl/locations maps upstream failures to 502', async () => {
  const ctx = makeApp();
  const originalFetch = globalThis.fetch;
  try {
    const noCompany = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/locations' });
    assert.equal(noCompany.statusCode, 400);

    await ctx.app.inject({
      method: 'POST',
      url: '/api/integrations/ghl/token',
      payload: { authToken: 'tok', companyId: 'co_1' },
    });

    globalThis.fetch = (async () => new Response('unauthorized', { status: 401 })) as typeof fetch;
    const res = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/locations' });
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().error, 'ghl_error');
    assert.equal(res.json().status, 401);

    // A 2xx with a non-JSON body (GhlParseError) is mapped the same way.
    globalThis.fetch = (async () => new Response('<html>login</html>', { status: 200 })) as typeof fetch;
    const parseFail = await ctx.app.inject({ method: 'GET', url: '/api/integrations/ghl/locations' });
    assert.equal(parseFail.statusCode, 502);
    assert.equal(parseFail.json().error, 'ghl_error');
    assert.equal(parseFail.json().status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    await ctx.cleanup();
  }
});

test('serves sandbox pages statically', async () => {
  const ctx = makeApp();
  try {
    fs.writeFileSync(path.join(ctx.sandboxDir, 'blank.html'), '<html><body>blank</body></html>');
    const res = await ctx.app.inject({ method: 'GET', url: '/sandbox/blank.html' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.payload.includes('blank'));
  } finally {
    await ctx.cleanup();
  }
});
