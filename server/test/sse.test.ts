import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ServerResponse } from 'node:http';
import { RunSseHub, type SseClient } from '../src/sse';

/**
 * The hub only reads `res.destroyed` and calls `res.write(...)`, so a recording
 * fake is enough to exercise it without a real socket. `destroyed` models the
 * common dead-client case (a destroyed socket whose `write` returns false, not
 * throws); `throwOnWrite` models the rarer synchronous write-after-end throw.
 */
function fakeClient(
  id: string,
  opts: { destroyed?: boolean; throwOnWrite?: boolean } = {}
): SseClient & { writes: string[] } {
  const writes: string[] = [];
  const res = {
    destroyed: opts.destroyed ?? false,
    write(chunk: string) {
      if (opts.throwOnWrite) throw new Error('write after end');
      writes.push(chunk);
      return true;
    },
  } as unknown as ServerResponse;
  return { id, res, writes };
}

test('broadcast delivers the SSE-framed JSON payload to every client on the run', () => {
  const hub = new RunSseHub();
  const a = fakeClient('a');
  const b = fakeClient('b');
  hub.add('run1', a);
  hub.add('run1', b);

  hub.broadcast('run1', { type: 'run_started', runId: 'run1', ts: 7 });

  const expected = `data: ${JSON.stringify({ type: 'run_started', runId: 'run1', ts: 7 })}\n\n`;
  assert.deepEqual(a.writes, [expected]);
  assert.deepEqual(b.writes, [expected]);
});

test('broadcast only reaches clients registered for that run', () => {
  const hub = new RunSseHub();
  const onRun1 = fakeClient('a');
  const onRun2 = fakeClient('b');
  hub.add('run1', onRun1);
  hub.add('run2', onRun2);

  hub.broadcast('run1', { hello: 'world' });

  assert.equal(onRun1.writes.length, 1);
  assert.deepEqual(onRun2.writes, []);
});

test('broadcast to a run with no connected clients is a no-op (does not throw)', () => {
  const hub = new RunSseHub();
  assert.doesNotThrow(() => hub.broadcast('ghost', { type: 'audit_entry' }));
});

test('the same client object is not double-registered (Set semantics)', () => {
  const hub = new RunSseHub();
  const a = fakeClient('a');
  hub.add('run1', a);
  hub.add('run1', a);

  hub.broadcast('run1', { n: 1 });
  assert.equal(a.writes.length, 1);
});

test('remove stops delivery, and removing the last client tears down the run set', () => {
  const hub = new RunSseHub();
  const a = fakeClient('a');
  const b = fakeClient('b');
  hub.add('run1', a);
  hub.add('run1', b);

  hub.remove('run1', a);
  hub.broadcast('run1', { n: 1 });
  assert.equal(a.writes.length, 0, 'removed client receives nothing');
  assert.equal(b.writes.length, 1);

  // Removing the last client drops the run entirely; a later broadcast is a
  // clean no-op rather than touching a stale empty set.
  hub.remove('run1', b);
  assert.doesNotThrow(() => hub.broadcast('run1', { n: 2 }));
  assert.equal(b.writes.length, 1, 'no delivery after the last client left');
});

test('remove is idempotent and safe for unknown runs/clients', () => {
  const hub = new RunSseHub();
  const a = fakeClient('a');
  hub.add('run1', a);
  assert.doesNotThrow(() => {
    hub.remove('run1', a);
    hub.remove('run1', a); // already gone
    hub.remove('nope', a); // unknown run
  });
});

test('a destroyed client is skipped and pruned without blocking the healthy clients', () => {
  const hub = new RunSseHub();
  // A destroyed socket: write() returns false rather than throwing, so the hub
  // must detect it via `res.destroyed` (the real dead-client case).
  const dead = fakeClient('dead', { destroyed: true });
  const live = fakeClient('live');
  hub.add('run1', dead);
  hub.add('run1', live);

  // The destroyed client is never written to; the live client still gets it...
  hub.broadcast('run1', { n: 1 });
  assert.deepEqual(dead.writes, []);
  assert.equal(live.writes.length, 1);

  // ...and the destroyed client was pruned, so the run set is down to the live
  // client (a second broadcast still only delivers to it).
  hub.broadcast('run1', { n: 2 });
  assert.deepEqual(dead.writes, []);
  assert.equal(live.writes.length, 2);
});

test('a client whose write throws synchronously is pruned without blocking others', () => {
  const hub = new RunSseHub();
  const dead = fakeClient('dead', { throwOnWrite: true });
  const live = fakeClient('live');
  hub.add('run1', dead);
  hub.add('run1', live);

  // First broadcast: the dead client throws but the live client still gets it...
  hub.broadcast('run1', { n: 1 });
  assert.equal(live.writes.length, 1);

  // ...and the dead client was pruned, so a second broadcast no longer touches
  // it (write would throw again if it were still registered).
  assert.doesNotThrow(() => hub.broadcast('run1', { n: 2 }));
  assert.equal(live.writes.length, 2);
});
