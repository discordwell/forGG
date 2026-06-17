import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RunController,
  eventToActions,
  isTerminalEvent,
  type RunControllerDeps,
  type RunStream,
  type RunStreamHandlers,
} from './runController';
import type { AutomationAction, AutomationStep } from '../types/automation';

const STEPS: AutomationStep[] = [{ id: 's1', type: 'wait', label: 'Wait', value: '10' }];

class FakeStream implements RunStream {
  closed = false;
  constructor(readonly handlers: RunStreamHandlers) {}
  close() {
    this.closed = true;
  }
}

type UiStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

function harness(initialStatus: UiStatus = 'running') {
  const calls: string[] = [];
  const dispatched: AutomationAction[] = [];
  const streams: FakeStream[] = [];
  let runCounter = 0;

  const deps: RunControllerDeps = {
    dispatch: (action) => dispatched.push(action),
    postJson: async <T,>(url: string): Promise<T> => {
      calls.push(url);
      if (url === '/api/runs') {
        runCounter += 1;
        return { runId: `run_${runCounter}` } as T;
      }
      return {} as T;
    },
    openStream: (_runId, handlers) => {
      const s = new FakeStream(handlers);
      streams.push(s);
      return s;
    },
  };

  const controller = new RunController(deps);
  controller.syncStatus(initialStatus);

  return {
    controller,
    calls,
    dispatched,
    streams,
    lastStream: () => streams[streams.length - 1],
    runCount: () => calls.filter((u) => u === '/api/runs').length,
    setStatus: (s: UiStatus) => controller.syncStatus(s),
  };
}

test('start creates a run and opens a stream', async () => {
  const h = harness('running');
  await h.controller.start(STEPS, 1);
  assert.equal(h.runCount(), 1);
  assert.equal(h.calls[0], '/api/runs');
  assert.equal(h.controller.activeRunId, 'run_1');
  assert.equal(h.controller.isStarted, true);
  assert.equal(h.streams.length, 1);
});

test('start is guarded against creating a duplicate concurrent run', async () => {
  const h = harness('running');
  await Promise.all([h.controller.start(STEPS, 1), h.controller.start(STEPS, 1)]);
  assert.equal(h.runCount(), 1);
});

test('a run_completed event dispatches COMPLETE_EXECUTION and tears the run down', async () => {
  const h = harness('running');
  await h.controller.start(STEPS, 1);
  h.lastStream().handlers.onEvent({ type: 'run_completed', runId: 'run_1', ts: 0 });
  assert.deepEqual(h.dispatched.map((a) => a.type), ['COMPLETE_EXECUTION']);
  assert.equal(h.controller.isStarted, false);
  assert.equal(h.controller.activeRunId, null);
  assert.equal(h.lastStream().closed, true);
});

test('abort tears down synchronously and posts the abort request', async () => {
  const h = harness('running');
  await h.controller.start(STEPS, 1);
  h.controller.abort();
  assert.equal(h.controller.isStarted, false);
  assert.equal(h.controller.activeRunId, null);
  assert.equal(h.lastStream().closed, true);
  assert.ok(h.calls.includes('/api/runs/run_1/abort'));
});

test('a new run can be started after the previous run was stopped (regression)', async () => {
  // Before the fix, abort() left `started` set because closing the stream
  // meant the run_aborted event never arrived to reset it — so this second
  // start() was silently ignored and the UI hung in "running".
  const h = harness('running');
  await h.controller.start(STEPS, 1);
  h.controller.abort();
  assert.equal(h.controller.isStarted, false);

  await h.controller.start(STEPS, 1);
  assert.equal(h.runCount(), 2);
  assert.equal(h.controller.isStarted, true);
  assert.equal(h.controller.activeRunId, 'run_2');
});

test('stop + restart during the create round-trip aborts the first run, not the second (regression)', async () => {
  // Resetting `started` on stop re-opens the door to a new run; the generation
  // fence must ensure the stale first attempt cleans up instead of opening a
  // second concurrent stream.
  const calls: string[] = [];
  const openedFor: string[] = [];
  const releases: Array<() => void> = [];
  let runCounter = 0;

  const controller = new RunController({
    dispatch: () => {},
    postJson: async <T,>(url: string): Promise<T> => {
      calls.push(url);
      if (url === '/api/runs') {
        runCounter += 1;
        const runId = `run_${runCounter}`;
        await new Promise<void>((resolve) => releases.push(resolve)); // gate the create
        return { runId } as T;
      }
      return {} as T;
    },
    openStream: (runId) => {
      openedFor.push(runId);
      return { close: () => {} };
    },
  });

  controller.syncStatus('running');
  const p1 = controller.start(STEPS, 1); // create #1 hangs on releases[0]
  controller.syncStatus('idle');
  controller.abort(); // user stops while create #1 is still in flight
  controller.syncStatus('running');
  const p2 = controller.start(STEPS, 1); // create #2 hangs on releases[1]

  releases.forEach((release) => release()); // resolve both creates
  await Promise.all([p1, p2]);

  assert.equal(runCounter, 2);
  assert.ok(calls.includes('/api/runs/run_1/abort'));
  assert.deepEqual(openedFor, ['run_2']); // only the second run opened a stream
  assert.equal(controller.activeRunId, 'run_2');
  assert.equal(controller.isStarted, true);
});

test('run_failed and run_aborted both reset started so the UI can re-run', async () => {
  for (const type of ['run_failed', 'run_aborted'] as const) {
    const h = harness('running');
    await h.controller.start(STEPS, 1);
    const ev =
      type === 'run_failed'
        ? { type, runId: 'run_1', ts: 0, error: 'boom' }
        : { type, runId: 'run_1', ts: 0 };
    h.lastStream().handlers.onEvent(ev);
    assert.equal(h.controller.isStarted, false, type);
    assert.equal(h.lastStream().closed, true, type);
  }
});

test('a stream error tears the run down', async () => {
  const h = harness('running');
  await h.controller.start(STEPS, 1);
  h.lastStream().handlers.onError();
  assert.equal(h.controller.isStarted, false);
  assert.equal(h.controller.activeRunId, null);
  assert.equal(h.lastStream().closed, true);
});

test('a create-time failure leaves the controller ready to retry', async () => {
  let streamOpened = false;
  const failing = new RunController({
    dispatch: () => {},
    postJson: async () => {
      throw new Error('network down');
    },
    openStream: () => {
      streamOpened = true;
      return { close: () => {} };
    },
  });
  failing.syncStatus('running');
  await failing.start(STEPS, 1);
  assert.equal(failing.isStarted, false);
  assert.equal(failing.activeRunId, null);
  assert.equal(streamOpened, false);
});

test('stopping during the create round-trip aborts without opening a stream', async () => {
  const h = harness('idle'); // user already stopped by the time the run is created
  await h.controller.start(STEPS, 1);
  assert.equal(h.streams.length, 0);
  assert.equal(h.controller.isStarted, false);
  assert.ok(h.calls.includes('/api/runs/run_1/abort'));
});

test('pausing during the create round-trip pauses and still opens the stream', async () => {
  const h = harness('paused');
  await h.controller.start(STEPS, 1);
  assert.equal(h.streams.length, 1);
  assert.equal(h.controller.activeRunId, 'run_1');
  assert.ok(h.calls.includes('/api/runs/run_1/pause'));
});

test('pause and resume only hit the backend while a run is active', async () => {
  const h = harness('running');
  // No active run yet: these must be no-ops.
  h.controller.pause();
  h.controller.resume();
  assert.equal(h.calls.length, 0);

  await h.controller.start(STEPS, 1);
  h.controller.pause();
  h.controller.resume();
  assert.ok(h.calls.includes('/api/runs/run_1/pause'));
  assert.ok(h.calls.includes('/api/runs/run_1/resume'));
});

test('dispose closes the stream without aborting the backend run', async () => {
  const h = harness('running');
  await h.controller.start(STEPS, 1);
  h.controller.dispose();
  assert.equal(h.lastStream().closed, true);
  assert.ok(!h.calls.includes('/api/runs/run_1/abort'));
});

// ---------------------------------------------------------------------------
// eventToActions / isTerminalEvent (pure)
// ---------------------------------------------------------------------------

test('eventToActions maps step_started with page and coords', () => {
  const actions = eventToActions({
    type: 'step_started',
    runId: 'r',
    ts: 0,
    index: 2,
    step: { id: 's', type: 'click', label: 'c', page: 'pg', targetCoords: { x: 1, y: 2 } },
  });
  assert.deepEqual(actions.map((a) => a.type), ['SET_STEP_INDEX', 'SET_CURRENT_PAGE', 'SET_CURSOR_POSITION']);
});

test('eventToActions maps step_started without page or coords to just the index', () => {
  const actions = eventToActions({
    type: 'step_started',
    runId: 'r',
    ts: 0,
    index: 0,
    step: { id: 's', type: 'wait', label: 'w' },
  });
  assert.deepEqual(actions.map((a) => a.type), ['SET_STEP_INDEX']);
});

test('eventToActions converts the audit entry timestamp from ISO to a Date', () => {
  const iso = '2026-01-02T03:04:05.000Z';
  const actions = eventToActions({
    type: 'audit_entry',
    runId: 'r',
    ts: 0,
    entry: { id: 'e', stepId: 's', stepIndex: 0, type: 'wait', label: 'w', severity: 'info', message: 'm', status: 'passed', timestamp: iso },
  });
  assert.equal(actions.length, 1);
  const action = actions[0];
  assert.equal(action.type, 'ADD_AUDIT_ENTRY');
  if (action.type === 'ADD_AUDIT_ENTRY') {
    assert.ok(action.entry.timestamp instanceof Date);
    assert.equal(action.entry.timestamp.toISOString(), iso);
  }
});

test('eventToActions maps each ui hint to its setter', () => {
  const base = { runId: 'r', ts: 0 } as const;
  assert.deepEqual(eventToActions({ ...base, type: 'ui', action: { kind: 'cursor', position: { x: 1, y: 2 } } }).map((a) => a.type), ['SET_CURSOR_POSITION']);
  assert.deepEqual(eventToActions({ ...base, type: 'ui', action: { kind: 'page', page: 'p' } }).map((a) => a.type), ['SET_CURRENT_PAGE']);
  assert.deepEqual(eventToActions({ ...base, type: 'ui', action: { kind: 'typing', target: '#x', text: 'hi' } }).map((a) => a.type), ['SET_TYPING']);
  assert.deepEqual(eventToActions({ ...base, type: 'ui', action: { kind: 'flash', show: true } }).map((a) => a.type), ['SET_FLASH']);
  assert.deepEqual(eventToActions({ ...base, type: 'ui', action: { kind: 'scanline', show: false } }).map((a) => a.type), ['SET_SCANLINE']);
});

test('eventToActions marks completed and failed runs complete, and ignores other lifecycle events', () => {
  assert.deepEqual(eventToActions({ type: 'run_completed', runId: 'r', ts: 0 }).map((a) => a.type), ['COMPLETE_EXECUTION']);
  assert.deepEqual(eventToActions({ type: 'run_failed', runId: 'r', ts: 0, error: 'x' }).map((a) => a.type), ['COMPLETE_EXECUTION']);
  assert.deepEqual(eventToActions({ type: 'run_started', runId: 'r', ts: 0 }), []);
  assert.deepEqual(eventToActions({ type: 'run_paused', runId: 'r', ts: 0 }), []);
  assert.deepEqual(eventToActions({ type: 'run_aborted', runId: 'r', ts: 0 }), []);
});

test('isTerminalEvent flags exactly the run-ending events', () => {
  assert.equal(isTerminalEvent('run_completed'), true);
  assert.equal(isTerminalEvent('run_failed'), true);
  assert.equal(isTerminalEvent('run_aborted'), true);
  assert.equal(isTerminalEvent('run_started'), false);
  assert.equal(isTerminalEvent('step_status'), false);
  assert.equal(isTerminalEvent('ui'), false);
});
