import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, PlugZap, Workflow, X, Zap } from 'lucide-react';
import { useAutomation, useAutomationDispatch } from '../context/AutomationContext';
import { ProgressBar } from './shared/ProgressBar';
import { PlaybackControls } from './playback/PlaybackControls';
import { SCENARIO_BY_ID, SCENARIOS, type ScenarioId } from '../data/scenarios';

type GhlStatus =
  | { connected: false }
  | {
      connected: true;
      companyId: string | null;
      userId: string | null;
      locationId: string | null;
      hasTokenId: boolean;
      capturedAt: number;
    };

type GhlLocation = { _id: string; name?: string; timezone?: string };

function isGhlLocation(v: unknown): v is GhlLocation {
  return Boolean(v) && typeof v === 'object' && typeof (v as { _id?: unknown })._id === 'string';
}

function parseGhlLocations(data: unknown): GhlLocation[] {
  if (Array.isArray(data)) return data.filter(isGhlLocation);
  if (data && typeof data === 'object') {
    const locs = (data as { locations?: unknown }).locations;
    if (Array.isArray(locs)) return locs.filter(isGhlLocation);
  }
  return [];
}

export function Header() {
  const { scenarioId, steps, execution } = useAutomation();
  const dispatch = useAutomationDispatch();
  const completedCount = execution.stepStatuses.filter((s) => s === 'passed').length;
  const isRunning = execution.status === 'running' || execution.status === 'paused';

  const scenario = SCENARIO_BY_ID[scenarioId];

  const [ghlStatus, setGhlStatus] = useState<GhlStatus>({ connected: false });
  const [locations, setLocations] = useState<GhlLocation[] | null>(null);

  const connected = ghlStatus.connected;
  const companyId = connected ? ghlStatus.companyId : null;
  const locationId = connected ? ghlStatus.locationId : null;

  const shortLocation = useMemo(() => {
    if (!locationId) return null;
    return locationId.length > 10 ? `${locationId.slice(0, 6)}…${locationId.slice(-4)}` : locationId;
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/integrations/ghl/status');
        if (!res.ok) return;
        const data = (await res.json()) as GhlStatus;
        if (!cancelled) setGhlStatus(data);
      } catch {
        // ignore
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!connected) return;
    if (!companyId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/integrations/ghl/locations');
        if (!res.ok) return;
        const data = (await res.json()) as unknown;
        const list = parseGhlLocations(data);
        if (!cancelled) setLocations(list);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, companyId]);

  return (
    <header className="bg-white border-b border-surface-200 px-4 py-2.5 flex items-center gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 bg-forge-600 rounded-lg flex items-center justify-center">
          <Workflow className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-surface-900">Forge</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-forge-100 text-forge-700 rounded font-medium">
              Runbook
            </span>
          </div>
          <div className="mt-0.5">
            {SCENARIOS.length > 1 ? (
              <select
                value={scenarioId}
                disabled={isRunning}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_SCENARIO',
                    scenarioId: e.target.value as ScenarioId,
                  })
                }
                className="text-[10px] text-surface-600 bg-transparent border border-surface-200 rounded px-1.5 py-0.5 max-w-[280px] disabled:opacity-50 disabled:cursor-not-allowed"
                title={scenario.description}
              >
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-surface-600" title={scenario.description}>
                {scenario.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex-1 max-w-md">
        <ProgressBar current={completedCount} total={steps.length} />
      </div>

      {/* Integration: GoHighLevel */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium ${
            connected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-surface-200 bg-surface-50 text-surface-600'
          }`}
          title={connected ? `Connected${locationId ? ` (location ${locationId})` : ''}` : 'Not connected'}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-surface-400'}`} />
          <PlugZap className="w-3.5 h-3.5" />
          <span>GHL</span>
          {connected && shortLocation && (
            <span className="font-mono text-[10px] opacity-80">({shortLocation})</span>
          )}
        </div>

        <a
          href="/api/integrations/ghl/bridge"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
          title="Open token bridge in a new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Bridge
        </a>

        {connected && locations && locations.length > 0 && (
          <select
            value={locationId || ''}
            disabled={isRunning}
            onChange={async (e) => {
              const newId = e.target.value;
              if (!newId) return;
              await fetch('/api/integrations/ghl/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId: newId }),
              }).catch(() => {});
              // Force a status refresh next tick.
              setTimeout(() => {
                fetch('/api/integrations/ghl/status')
                  .then((r) => r.json())
                  .then((d) => setGhlStatus(d as GhlStatus))
                  .catch(() => {});
              }, 250);
            }}
            className="text-[10px] text-surface-700 bg-white border border-surface-200 rounded px-2 py-1 max-w-[220px] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Select GoHighLevel location"
          >
            {locations.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name ? `${l.name} (${l._id})` : l._id}
              </option>
            ))}
          </select>
        )}

        {connected && (
          <button
            onClick={async () => {
              await fetch('/api/integrations/ghl', { method: 'DELETE' }).catch(() => {});
              setGhlStatus({ connected: false });
              setLocations(null);
            }}
            disabled={isRunning}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-surface-500"
            title="Disconnect"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status */}
      {execution.status !== 'idle' && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Zap className={`w-3.5 h-3.5 ${
            execution.status === 'running' ? 'text-forge-500 animate-pulse' :
            execution.status === 'paused' ? 'text-amber-500' :
            execution.status === 'completed' ? 'text-green-500' :
            execution.status === 'error' ? 'text-red-500' :
            'text-surface-400'
          }`} />
          <span className="text-xs font-medium text-surface-600 capitalize">
            {execution.status}
          </span>
          <span className="text-[10px] text-surface-400 font-mono">
            Step {execution.currentStepIndex + 1}/{steps.length}
          </span>
        </div>
      )}

      {/* Playback */}
      <PlaybackControls />
    </header>
  );
}
