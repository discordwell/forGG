import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRun } from './auditSummary.logic';

test('counts passed/failed and reports PASSED when nothing failed', () => {
  const summary = summarizeRun({
    stepStatuses: ['passed', 'passed', 'passed'],
    stepCount: 3,
    startTime: new Date('2026-06-18T00:00:00Z'),
    endTime: new Date('2026-06-18T00:00:05Z'),
  });
  assert.deepEqual(summary, { passed: 3, failed: 0, total: 3, allPassed: true, durationSec: 5 });
});

test('any failure flips allPassed to false', () => {
  const summary = summarizeRun({
    stepStatuses: ['passed', 'failed', 'pending'],
    stepCount: 3,
    startTime: null,
    endTime: null,
  });
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.allPassed, false);
});

test('a run with no failures still passes even if some steps did not pass', () => {
  // skipped/pending steps must not be counted as failures.
  const summary = summarizeRun({
    stepStatuses: ['passed', 'skipped', 'pending'],
    stepCount: 3,
    startTime: null,
    endTime: null,
  });
  assert.equal(summary.failed, 0);
  assert.equal(summary.allPassed, true);
  assert.equal(summary.passed, 1);
});

test('total comes from the step count, not the status array length', () => {
  // stepStatuses can briefly lag the step list; total tracks the steps.
  const summary = summarizeRun({
    stepStatuses: ['passed'],
    stepCount: 4,
    startTime: null,
    endTime: null,
  });
  assert.equal(summary.total, 4);
});

test('durationSec rounds to whole seconds', () => {
  const summary = summarizeRun({
    stepStatuses: [],
    stepCount: 0,
    startTime: new Date('2026-06-18T00:00:00.000Z'),
    endTime: new Date('2026-06-18T00:00:02.400Z'),
  });
  assert.equal(summary.durationSec, 2);
});

test('durationSec is 0 when timing is incomplete', () => {
  assert.equal(
    summarizeRun({ stepStatuses: [], stepCount: 0, startTime: new Date(), endTime: null }).durationSec,
    0
  );
  assert.equal(
    summarizeRun({ stepStatuses: [], stepCount: 0, startTime: null, endTime: new Date() }).durationSec,
    0
  );
});

test('durationSec never goes negative', () => {
  const summary = summarizeRun({
    stepStatuses: [],
    stepCount: 0,
    startTime: new Date('2026-06-18T00:00:05Z'),
    endTime: new Date('2026-06-18T00:00:00Z'),
  });
  assert.equal(summary.durationSec, 0);
});
