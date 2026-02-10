import { useMemo, type ReactNode } from 'react';
import { Activity, BadgeCheck, CircleDashed, DatabaseZap, Fingerprint, Layers3, Timer } from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';

function classForStatus(status: string | undefined) {
  switch (status) {
    case 'passed':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
    case 'failed':
      return 'bg-red-500/15 text-red-200 border-red-500/30';
    case 'running':
      return 'bg-blue-500/15 text-blue-200 border-blue-500/30';
    default:
      return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  }
}

function Pill(props: { status?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium ${classForStatus(props.status)}`}>
      <CircleDashed className="w-3 h-3" />
      {props.children}
    </span>
  );
}

function getSavedMap(extractedData: unknown): Record<string, unknown> | null {
  if (!extractedData || typeof extractedData !== 'object') return null;
  const saved = (extractedData as { saved?: unknown }).saved;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  return saved as Record<string, unknown>;
}

export function MaxLevelOpsPage() {
  const { steps, execution } = useAutomation();

  const saved = useMemo(() => {
    const out: Record<string, string> = {};
    for (let i = execution.auditLog.length - 1; i >= 0; i--) {
      const entry = execution.auditLog[i];
      const s = getSavedMap(entry.extractedData);
      if (!s) continue;
      for (const [k, v] of Object.entries(s)) {
        if (out[k]) continue;
        if (v === undefined || v === null) continue;
        out[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }
    return out;
  }, [execution.auditLog]);

  const durationSec =
    execution.startTime && execution.endTime
      ? Math.max(0, Math.round((execution.endTime.getTime() - execution.startTime.getTime()) / 1000))
      : null;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">MaxLevel</div>
            <h1 className="mt-1 text-lg font-bold tracking-tight">Ops Console</h1>
            <p className="mt-1 text-xs text-slate-300/80 max-w-xl">
              Live GoHighLevel runbook execution. This is not a mock: API calls are executed on the backend and audited step-by-step.
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Pill status={execution.status}>
                <span className="capitalize">{execution.status}</span>
              </Pill>
              {durationSec !== null && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-slate-500/20 bg-slate-500/10 text-[10px] text-slate-200">
                  <Timer className="w-3 h-3" />
                  {durationSec}s
                </span>
              )}
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-400">
              Step {Math.max(0, execution.currentStepIndex + 1)}/{steps.length}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-500/20 bg-slate-900/30 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <Activity className="w-4 h-4 text-cyan-300" />
              <div className="text-xs font-semibold">Live API</div>
            </div>
            <div className="mt-2 text-[11px] text-slate-300/85 leading-relaxed">
              Connect via the <span className="font-mono text-slate-200">Bridge</span> button, then execute. Location selection is automatic if only one location is found.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-500/20 bg-slate-900/30 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <DatabaseZap className="w-4 h-4 text-emerald-300" />
              <div className="text-xs font-semibold">Entities</div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[10px] font-mono text-slate-300/90">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">contactId</span>
                <span className="truncate">{saved.contactId || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">contactEmail</span>
                <span className="truncate">{saved.contactEmail || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">opportunityId</span>
                <span className="truncate">{saved.opportunityId || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-500/20 bg-slate-900/30 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <Fingerprint className="w-4 h-4 text-fuchsia-300" />
              <div className="text-xs font-semibold">Run Identity</div>
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-300/90">
              Tokens are stored locally on the backend. Audit entries never include the token.
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-500/20 bg-slate-900/30 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <Layers3 className="w-4 h-4 text-amber-300" />
              <div className="text-xs font-semibold">Steps</div>
            </div>
            <div className="mt-3 space-y-2">
              {steps.map((s, idx) => {
                const st = execution.stepStatuses[idx];
                return (
                  <div key={s.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-100/90 truncate">
                        <span className="text-slate-400 font-mono mr-2">{String(idx + 1).padStart(2, '0')}</span>
                        {s.label}
                      </div>
                      {s.type === 'api' && s.api && (
                        <div className="mt-0.5 text-[10px] text-slate-400 font-mono truncate">
                          {s.api.method} {s.api.path}
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] capitalize ${classForStatus(st)}`}>
                      {st || 'pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-500/20 bg-slate-900/30 p-4">
            <div className="flex items-center gap-2 text-slate-200">
              <BadgeCheck className="w-4 h-4 text-sky-300" />
              <div className="text-xs font-semibold">What To Show</div>
            </div>
            <div className="mt-2 text-[11px] text-slate-300/85 leading-relaxed space-y-2">
              <div>
                1. Open <span className="font-mono text-slate-200">Bridge</span> and capture your token from an active GoHighLevel session.
              </div>
              <div>
                2. Execute the runbook. Watch the audit trail on the right for raw request/response payloads.
              </div>
              <div>
                3. The created <span className="font-mono text-slate-200">contact</span> and <span className="font-mono text-slate-200">opportunity</span> IDs will appear here as soon as those steps pass.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
