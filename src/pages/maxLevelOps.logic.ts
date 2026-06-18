/**
 * Pure presentation/derivation helpers for {@link MaxLevelOpsPage}, kept out of
 * the component so they can be unit-tested without React (mirrors the
 * reducer/runController split).
 */

/** Tailwind classes for a status pill, shared by the run pill and step pills. */
export function statusPillClass(status: string | undefined): string {
  switch (status) {
    case 'passed':
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
    case 'failed':
    case 'error':
      return 'bg-red-500/15 text-red-200 border-red-500/30';
    case 'running':
      return 'bg-blue-500/15 text-blue-200 border-blue-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  }
}

/** The `saved` map an `api` audit entry carries, or null if the shape is off. */
function getSavedMap(extractedData: unknown): Record<string, unknown> | null {
  if (!extractedData || typeof extractedData !== 'object') return null;
  const saved = (extractedData as { saved?: unknown }).saved;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  return saved as Record<string, unknown>;
}

/**
 * Collapse every `save` mapping recorded across a run's audit log into a single
 * flat string map for display. Entries are walked newest → oldest so the most
 * recent value for a given key wins; null/undefined values are skipped and
 * non-strings are JSON-stringified.
 *
 * The "newest wins" guard is a key-presence check (not a truthiness check), so
 * an explicit empty-string value from the newest step is not silently replaced
 * by an older entry's value.
 */
export function deriveSavedEntities(
  auditLog: ReadonlyArray<{ extractedData?: unknown }>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = auditLog.length - 1; i >= 0; i--) {
    const saved = getSavedMap(auditLog[i].extractedData);
    if (!saved) continue;
    for (const [key, value] of Object.entries(saved)) {
      if (Object.prototype.hasOwnProperty.call(out, key)) continue;
      if (value === undefined || value === null) continue;
      out[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  return out;
}
