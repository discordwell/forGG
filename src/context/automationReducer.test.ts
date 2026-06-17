import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  automationReducer,
  createInitialExecution,
  initialState,
  type AutomationState,
} from './automationReducer';
import type { AuditLogEntry, AutomationStep } from '../types/automation';

function step(id: string, extra: Partial<AutomationStep> = {}): AutomationStep {
  return { id, type: 'wait', label: `Step ${id}`, ...extra };
}

function stateWith(steps: AutomationStep[]): AutomationState {
  return {
    scenarioId: initialState.scenarioId,
    steps,
    execution: createInitialExecution(steps, 'maxlevel-ops'),
  };
}

function audit(id: string): AuditLogEntry {
  return {
    id,
    stepId: id,
    stepIndex: 0,
    timestamp: new Date(0),
    type: 'wait',
    label: id,
    severity: 'info',
    message: id,
    status: 'passed',
  };
}

test('initialState is idle with one pending status per step', () => {
  assert.equal(initialState.execution.status, 'idle');
  assert.equal(initialState.execution.currentStepIndex, -1);
  assert.equal(initialState.execution.speed, 1);
  assert.equal(initialState.execution.stepStatuses.length, initialState.steps.length);
  assert.ok(initialState.execution.stepStatuses.every((s) => s === 'pending'));
});

test('the reducer never mutates the input state', () => {
  const state = stateWith([step('a'), step('b')]);
  const snapshot = JSON.parse(JSON.stringify(state));
  automationReducer(state, { type: 'ADD_STEP', step: step('c') });
  automationReducer(state, { type: 'REMOVE_STEP', id: 'a' });
  automationReducer(state, { type: 'START_EXECUTION' });
  assert.deepEqual(JSON.parse(JSON.stringify(state)), snapshot);
});

test('SET_STEPS replaces steps and resets every status to pending', () => {
  let state = stateWith([step('a'), step('b')]);
  state = automationReducer(state, { type: 'SET_STEP_STATUS', index: 0, status: 'passed' });
  const next = automationReducer(state, { type: 'SET_STEPS', steps: [step('x'), step('y'), step('z')] });
  assert.deepEqual(next.steps.map((s) => s.id), ['x', 'y', 'z']);
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'pending', 'pending']);
});

test('ADD_STEP appends the step and a matching pending status', () => {
  const state = stateWith([step('a')]);
  const next = automationReducer(state, { type: 'ADD_STEP', step: step('b') });
  assert.deepEqual(next.steps.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'pending']);
});

test('UPDATE_STEP merges updates into the matching step only', () => {
  const state = stateWith([step('a'), step('b')]);
  const next = automationReducer(state, { type: 'UPDATE_STEP', id: 'b', updates: { label: 'renamed', value: '5' } });
  assert.equal(next.steps[1].label, 'renamed');
  assert.equal(next.steps[1].value, '5');
  assert.equal(next.steps[0].label, 'Step a');
});

test('REMOVE_STEP drops the step and keeps statuses aligned by index', () => {
  let state = stateWith([step('a'), step('b'), step('c')]);
  // Distinguish each status so a misaligned filter is observable.
  state = automationReducer(state, { type: 'SET_STEP_STATUS', index: 0, status: 'passed' });
  state = automationReducer(state, { type: 'SET_STEP_STATUS', index: 2, status: 'failed' });
  const next = automationReducer(state, { type: 'REMOVE_STEP', id: 'b' });
  assert.deepEqual(next.steps.map((s) => s.id), ['a', 'c']);
  assert.deepEqual(next.execution.stepStatuses, ['passed', 'failed']);
});

test('REMOVE_STEP with an unknown id is a no-op for statuses', () => {
  const state = stateWith([step('a'), step('b')]);
  const next = automationReducer(state, { type: 'REMOVE_STEP', id: 'nope' });
  assert.deepEqual(next.steps.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'pending']);
});

test('REORDER_STEPS moves a step and its status together', () => {
  let state = stateWith([step('a'), step('b'), step('c')]);
  state = automationReducer(state, { type: 'SET_STEP_STATUS', index: 0, status: 'passed' });
  // Move 'a' (passed) from index 0 to index 2.
  const next = automationReducer(state, { type: 'REORDER_STEPS', fromIndex: 0, toIndex: 2 });
  assert.deepEqual(next.steps.map((s) => s.id), ['b', 'c', 'a']);
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'pending', 'passed']);
});

test('START_EXECUTION begins at step 0, sets a start time, and preserves speed', () => {
  let state = stateWith([step('first', { page: 'page-one' }), step('second')]);
  state = automationReducer(state, { type: 'SET_SPEED', speed: 4 });
  const next = automationReducer(state, { type: 'START_EXECUTION' });
  assert.equal(next.execution.status, 'running');
  assert.equal(next.execution.currentStepIndex, 0);
  assert.equal(next.execution.speed, 4);
  assert.equal(next.execution.currentPage, 'page-one');
  assert.ok(next.execution.startTime instanceof Date);
  assert.equal(next.execution.endTime, null);
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'pending']);
});

test('START_EXECUTION falls back to the scenario default page when step 0 has none', () => {
  const state = stateWith([step('a')]);
  const next = automationReducer(state, { type: 'START_EXECUTION' });
  assert.equal(next.execution.currentPage, 'maxlevel-ops');
});

test('PAUSE_EXECUTION and RESUME_EXECUTION only flip status', () => {
  let state = automationReducer(stateWith([step('a')]), { type: 'START_EXECUTION' });
  state = automationReducer(state, { type: 'PAUSE_EXECUTION' });
  assert.equal(state.execution.status, 'paused');
  state = automationReducer(state, { type: 'RESUME_EXECUTION' });
  assert.equal(state.execution.status, 'running');
});

test('STOP_EXECUTION resets to idle and clears transient effects but keeps the audit log', () => {
  let state = automationReducer(stateWith([step('a'), step('b')]), { type: 'START_EXECUTION' });
  state = automationReducer(state, { type: 'ADD_AUDIT_ENTRY', entry: audit('e1') });
  state = automationReducer(state, { type: 'SET_SCANLINE', show: true });
  state = automationReducer(state, { type: 'SET_TYPING', text: 'hi', target: '#x' });
  const next = automationReducer(state, { type: 'STOP_EXECUTION' });
  assert.equal(next.execution.status, 'idle');
  assert.equal(next.execution.currentStepIndex, -1);
  assert.equal(next.execution.showScanline, false);
  assert.equal(next.execution.typingText, '');
  assert.equal(next.execution.typingTarget, '');
  assert.equal(next.execution.auditLog.length, 1);
});

test('SET_STEP_INDEX updates the index and follows the step page', () => {
  const state = stateWith([step('a', { page: 'p0' }), step('b', { page: 'p1' })]);
  const next = automationReducer(state, { type: 'SET_STEP_INDEX', index: 1 });
  assert.equal(next.execution.currentStepIndex, 1);
  assert.equal(next.execution.currentPage, 'p1');
});

test('SET_STEP_INDEX out of range keeps the current page', () => {
  const state = stateWith([step('a', { page: 'p0' })]);
  const next = automationReducer(state, { type: 'SET_STEP_INDEX', index: 9 });
  assert.equal(next.execution.currentStepIndex, 9);
  assert.equal(next.execution.currentPage, 'maxlevel-ops');
});

test('STEP_FORWARD advances but clamps at the last step', () => {
  let state = automationReducer(stateWith([step('a'), step('b')]), { type: 'START_EXECUTION' });
  state = automationReducer(state, { type: 'STEP_FORWARD' });
  assert.equal(state.execution.currentStepIndex, 1);
  state = automationReducer(state, { type: 'STEP_FORWARD' });
  assert.equal(state.execution.currentStepIndex, 1);
});

test('STEP_BACK retreats but clamps at zero', () => {
  let state = automationReducer(stateWith([step('a'), step('b')]), { type: 'START_EXECUTION' });
  state = automationReducer(state, { type: 'STEP_FORWARD' });
  state = automationReducer(state, { type: 'STEP_BACK' });
  assert.equal(state.execution.currentStepIndex, 0);
  state = automationReducer(state, { type: 'STEP_BACK' });
  assert.equal(state.execution.currentStepIndex, 0);
});

test('SET_STEP_STATUS updates a single index without disturbing the others', () => {
  const state = stateWith([step('a'), step('b'), step('c')]);
  const next = automationReducer(state, { type: 'SET_STEP_STATUS', index: 1, status: 'running' });
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'running', 'pending']);
});

test('ADD_AUDIT_ENTRY appends in order', () => {
  let state = stateWith([step('a')]);
  state = automationReducer(state, { type: 'ADD_AUDIT_ENTRY', entry: audit('e1') });
  state = automationReducer(state, { type: 'ADD_AUDIT_ENTRY', entry: audit('e2') });
  assert.deepEqual(state.execution.auditLog.map((e) => e.id), ['e1', 'e2']);
});

test('COMPLETE_EXECUTION marks completed and records an end time', () => {
  const state = automationReducer(stateWith([step('a')]), { type: 'START_EXECUTION' });
  const next = automationReducer(state, { type: 'COMPLETE_EXECUTION' });
  assert.equal(next.execution.status, 'completed');
  assert.ok(next.execution.endTime instanceof Date);
});

test('RESET_EXECUTION returns to idle pending state while preserving speed', () => {
  let state = automationReducer(stateWith([step('a'), step('b')]), { type: 'SET_SPEED', speed: 2 });
  state = automationReducer(state, { type: 'START_EXECUTION' });
  state = automationReducer(state, { type: 'SET_STEP_STATUS', index: 0, status: 'passed' });
  const next = automationReducer(state, { type: 'RESET_EXECUTION' });
  assert.equal(next.execution.status, 'idle');
  assert.equal(next.execution.currentStepIndex, -1);
  assert.equal(next.execution.speed, 2);
  assert.deepEqual(next.execution.stepStatuses, ['pending', 'pending']);
});

test('SET_SCENARIO loads the scenario steps fresh and preserves speed', () => {
  const state = automationReducer(stateWith([step('a')]), { type: 'SET_SPEED', speed: 0.5 });
  const next = automationReducer(state, { type: 'SET_SCENARIO', scenarioId: initialState.scenarioId });
  assert.equal(next.scenarioId, initialState.scenarioId);
  assert.equal(next.execution.status, 'idle');
  assert.equal(next.execution.speed, 0.5);
  assert.equal(next.steps.length, initialState.steps.length);
  assert.equal(next.execution.stepStatuses.length, next.steps.length);
});

test('transient setters update only their slice of execution state', () => {
  const base = stateWith([step('a')]);
  assert.deepEqual(
    automationReducer(base, { type: 'SET_CURSOR_POSITION', position: { x: 1, y: 2 } }).execution.cursorPosition,
    { x: 1, y: 2 }
  );
  assert.deepEqual(
    automationReducer(base, { type: 'SET_HIGHLIGHT', highlight: { x: 1, y: 2, w: 3, h: 4 } }).execution.activeHighlight,
    { x: 1, y: 2, w: 3, h: 4 }
  );
  assert.equal(automationReducer(base, { type: 'SET_FLASH', show: true }).execution.showFlash, true);
  assert.deepEqual(
    automationReducer(base, { type: 'SET_RIPPLE', position: { x: 5, y: 6 } }).execution.showRipple,
    { x: 5, y: 6 }
  );
  assert.equal(automationReducer(base, { type: 'SET_CURRENT_PAGE', page: 'other' }).execution.currentPage, 'other');
});
