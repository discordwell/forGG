import type { AutomationStep, Severity } from './types';

/** Map a step's `page` key to the local sandbox page the runner navigates to. */
export function sandboxPathForPageKey(pageKey: string | undefined): string {
  if (!pageKey) return '/sandbox/blank.html';
  return `/sandbox/${pageKey}.html`;
}

/** Default audit severity for a step type (data-producing steps read as success). */
export function severityForStep(stepType: string): Severity {
  switch (stepType) {
    case 'extract':
    case 'assert':
    case 'api':
      return 'success';
    default:
      return 'info';
  }
}

/**
 * Resolve a `wait` step's duration in ms. `value` wins over `duration`; both
 * default to 1000ms. An explicit `0` is honored (only a non-numeric value
 * falls back to 1s) and negatives clamp to 0.
 */
export function parseWaitMs(step: Pick<AutomationStep, 'value' | 'duration'>): number {
  const parsed = parseInt(step.value || String(step.duration ?? '1000'), 10);
  // An explicit 0 is a valid wait; only NaN falls back to 1s.
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 1000;
}

/** Pull a number out of loose text, keeping digits and the decimal point. */
export function cleanNumber(s: string): number {
  return Number(s.replace(/[^0-9.]/g, ''));
}

export interface AssertionResult {
  ok: boolean;
  /** Failure detail (used as the audit message); empty when `ok`. */
  reason: string;
}

/**
 * Pure evaluation of an assert step's condition against the text pulled from a
 * page. Supported assertions: `equals` (default), `contains`, `greaterThan`;
 * anything else is reported as unsupported.
 *
 * `greaterThan` parses both sides with {@link cleanNumber}, so a decimal
 * threshold like `"> 2.5"` is read as 2.5. (It previously stripped the
 * threshold's decimal point — turning `"> 2.5"` into 25 — while keeping the
 * actual value's, so `2 > 1.5` wrongly failed as `2 > 15`.)
 */
export function evaluateAssertion(assertion: string, expected: string, actual: string): AssertionResult {
  if (assertion === 'contains') {
    return actual.includes(expected)
      ? { ok: true, reason: '' }
      : { ok: false, reason: `Assertion failed: expected "${actual}" to contain "${expected}"` };
  }

  if (assertion === 'equals') {
    return actual === expected
      ? { ok: true, reason: '' }
      : { ok: false, reason: `Assertion failed: expected "${actual}" to equal "${expected}"` };
  }

  if (assertion === 'greaterThan') {
    const threshold = cleanNumber(expected);
    const actualNum = cleanNumber(actual);
    if (!Number.isFinite(threshold) || !Number.isFinite(actualNum)) {
      return { ok: false, reason: `Assertion failed: unable to compare "${actual}" > "${expected}"` };
    }
    return actualNum > threshold
      ? { ok: true, reason: '' }
      : { ok: false, reason: `Assertion failed: expected ${actualNum} > ${threshold}` };
  }

  return { ok: false, reason: `Unsupported assertion: ${assertion}` };
}
