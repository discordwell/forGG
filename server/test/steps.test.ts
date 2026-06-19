import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanNumber,
  evaluateAssertion,
  parseWaitMs,
  sandboxPathForPageKey,
  severityForStep,
} from '../src/steps';

test('sandboxPathForPageKey maps a page key (and blank fallback) to a sandbox URL', () => {
  assert.equal(sandboxPathForPageKey('maxlevel-ops'), '/sandbox/maxlevel-ops.html');
  assert.equal(sandboxPathForPageKey(undefined), '/sandbox/blank.html');
  assert.equal(sandboxPathForPageKey(''), '/sandbox/blank.html');
});

test('severityForStep flags data-producing steps as success and the rest as info', () => {
  for (const t of ['extract', 'assert', 'api']) assert.equal(severityForStep(t), 'success');
  for (const t of ['navigate', 'click', 'type', 'wait', 'scroll', 'select', 'screenshot']) {
    assert.equal(severityForStep(t), 'info');
  }
});

test('parseWaitMs prefers value, honors an explicit 0, and falls back to 1s on junk', () => {
  assert.equal(parseWaitMs({ value: '250' }), 250);
  // value wins over duration
  assert.equal(parseWaitMs({ value: '50', duration: 9999 }), 50);
  // an explicit 0 must not be coerced to the 1s default
  assert.equal(parseWaitMs({ value: '0' }), 0);
  assert.equal(parseWaitMs({ value: '', duration: 0 }), 0);
  // negatives clamp to 0
  assert.equal(parseWaitMs({ value: '-5' }), 0);
  // trailing units are tolerated (parseInt stops at the first non-digit)
  assert.equal(parseWaitMs({ value: '300ms' }), 300);
  // no value: fall back to duration, then to 1000
  assert.equal(parseWaitMs({ duration: 1234 }), 1234);
  assert.equal(parseWaitMs({}), 1000);
  // non-numeric value falls back to 1s
  assert.equal(parseWaitMs({ value: 'soon' }), 1000);
});

test('cleanNumber keeps digits and the decimal point', () => {
  assert.equal(cleanNumber('> 50'), 50);
  assert.equal(cleanNumber('> 2.5'), 2.5);
  assert.equal(cleanNumber('$1,200.50'), 1200.5);
  assert.equal(cleanNumber('42 leads'), 42);
  assert.ok(Number.isNaN(cleanNumber('1.2.3')));
});

test('cleanNumber preserves a leading minus for negative numbers (regression)', () => {
  // The sign used to be stripped (kept only [0-9.]), turning -3 into 3.
  assert.equal(cleanNumber('-3.5'), -3.5);
  assert.equal(cleanNumber('> -5'), -5);
  assert.equal(cleanNumber('-$1,200.50'), -1200.5);
  assert.equal(cleanNumber('Balance: -42'), -42);
  // A minus *after* the first digit (e.g. a range) is not a sign.
  assert.equal(cleanNumber('5-3'), 53);
  // Unchanged positive / no-digit behavior.
  assert.equal(cleanNumber('> 50'), 50);
  assert.equal(cleanNumber('none'), 0);
});

test('evaluateAssertion: equals (default) compares the strings exactly', () => {
  assert.deepEqual(evaluateAssertion('equals', 'Active', 'Active'), { ok: true, reason: '' });

  const fail = evaluateAssertion('equals', 'Active', 'Inactive');
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, 'Assertion failed: expected "Inactive" to equal "Active"');

  // Comparison is exact: trimming is the caller's job (the runner trims the
  // page text before calling), so untrimmed input here does not match.
  assert.equal(evaluateAssertion('equals', 'Active', ' Active ').ok, false);
});

test('evaluateAssertion: contains checks substring membership', () => {
  assert.equal(evaluateAssertion('contains', 'lead', 'new-lead-2026').ok, true);

  const fail = evaluateAssertion('contains', 'won', 'open opportunity');
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, 'Assertion failed: expected "open opportunity" to contain "won"');
});

test('evaluateAssertion: greaterThan parses a decimal threshold correctly (regression)', () => {
  // The decimal point used to be stripped from the threshold only, so 2 > 1.5
  // was evaluated as 2 > 15 and wrongly failed.
  assert.equal(evaluateAssertion('greaterThan', '> 1.5', '2').ok, true);
  assert.equal(evaluateAssertion('greaterThan', '> 2.5', '3').ok, true);

  const fail = evaluateAssertion('greaterThan', '> 2.5', '2');
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, 'Assertion failed: expected 2 > 2.5');
});

test('evaluateAssertion: greaterThan compares negative numbers correctly (regression)', () => {
  // -3 > -5 is true; with the sign stripped this was evaluated as 3 > 5 (false).
  assert.equal(evaluateAssertion('greaterThan', '-5', '-3').ok, true);
  // -1 > 0 is false; stripping the sign evaluated 1 > 0 (true).
  const fail = evaluateAssertion('greaterThan', '0', '-1');
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, 'Assertion failed: expected -1 > 0');
  // Mixed sign: 2 > -5 holds.
  assert.equal(evaluateAssertion('greaterThan', '-5', '2').ok, true);
});

test('evaluateAssertion: greaterThan still handles whole numbers and equality boundary', () => {
  assert.equal(evaluateAssertion('greaterThan', '> 50', '75').ok, true);
  // strictly greater: equal values fail
  assert.equal(evaluateAssertion('greaterThan', '> 50', '50').ok, false);
});

test('evaluateAssertion: greaterThan reports a malformed number as uncomparable', () => {
  // A string that survives cleaning but is not a valid number (two decimal
  // points) is NaN, which is the only way to reach the uncomparable branch.
  // Text with no digits cleans to '' -> 0 (a finite, comparable value), which
  // preserves the historical behavior.
  const res = evaluateAssertion('greaterThan', '> 50', '3.1.4');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'Assertion failed: unable to compare "3.1.4" > "> 50"');

  // No-digit text is treated as 0, not an error (matches prior runner behavior).
  assert.equal(evaluateAssertion('greaterThan', '> 50', 'none').reason, 'Assertion failed: expected 0 > 50');
});

test('evaluateAssertion: unknown assertion kinds are reported as unsupported', () => {
  const res = evaluateAssertion('startsWith', 'x', 'xyz');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'Unsupported assertion: startsWith');
});
