/**
 * Pure run-summary derivation for {@link AuditSummary}, lifted out of the
 * component so the PASSED/FAILED + counts + duration math is unit-testable
 * without React.
 */
export interface RunSummary {
  /** Steps that finished with status `passed`. */
  passed: number;
  /** Steps that finished with status `failed`. */
  failed: number;
  /** Total steps in the runbook. */
  total: number;
  /** A run "passes" when nothing failed (skipped/pending steps don't fail it). */
  allPassed: boolean;
  /** Wall-clock duration in whole seconds (0 when timing is unavailable). */
  durationSec: number;
}

export function summarizeRun(args: {
  stepStatuses: ReadonlyArray<string>;
  stepCount: number;
  startTime: Date | null;
  endTime: Date | null;
}): RunSummary {
  const passed = args.stepStatuses.filter((s) => s === 'passed').length;
  const failed = args.stepStatuses.filter((s) => s === 'failed').length;
  const durationSec =
    args.startTime && args.endTime
      ? Math.max(0, Math.round((args.endTime.getTime() - args.startTime.getTime()) / 1000))
      : 0;
  return { passed, failed, total: args.stepCount, allPassed: failed === 0, durationSec };
}
