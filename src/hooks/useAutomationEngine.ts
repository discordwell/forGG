import { useEffect, useRef } from 'react';
import type { AuditLogEntry, AutomationStep, StepStatus } from '../types/automation';
import { useAutomation, useAutomationDispatch } from '../context/AutomationContext';

type RunEvent =
  | { type: 'run_started'; runId: string; ts: number }
  | { type: 'run_paused'; runId: string; ts: number }
  | { type: 'run_resumed'; runId: string; ts: number }
  | { type: 'run_aborted'; runId: string; ts: number }
  | { type: 'run_completed'; runId: string; ts: number }
  | { type: 'run_failed'; runId: string; ts: number; error: string }
  | { type: 'step_started'; runId: string; ts: number; index: number; step: AutomationStep }
  | { type: 'step_status'; runId: string; ts: number; index: number; status: StepStatus }
  | { type: 'audit_entry'; runId: string; ts: number; entry: Omit<AuditLogEntry, 'timestamp'> & { timestamp: string } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'cursor'; position: { x: number; y: number } } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'page'; page: string } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'typing'; target: string; text: string } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'flash'; show: boolean } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'scanline'; show: boolean } };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export function useAutomationEngine() {
  const { steps, execution } = useAutomation();
  const dispatch = useAutomationDispatch();

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const statusRef = useRef(execution.status);
  statusRef.current = execution.status;

  const startedRef = useRef(false);
  const runIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function closeStream() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }

  async function abortRemoteRun() {
    const runId = runIdRef.current;
    if (!runId) return;
    try {
      await postJson(`/api/runs/${runId}/abort`, {});
    } catch {
      // ignore
    } finally {
      runIdRef.current = null;
      closeStream();
    }
  }

  function handleEvent(ev: RunEvent) {
    switch (ev.type) {
      case 'step_started': {
        dispatch({ type: 'SET_STEP_INDEX', index: ev.index });
        if (ev.step.page) dispatch({ type: 'SET_CURRENT_PAGE', page: ev.step.page });
        if (ev.step.targetCoords) dispatch({ type: 'SET_CURSOR_POSITION', position: ev.step.targetCoords });
        break;
      }
      case 'step_status': {
        dispatch({ type: 'SET_STEP_STATUS', index: ev.index, status: ev.status });
        break;
      }
      case 'audit_entry': {
        dispatch({
          type: 'ADD_AUDIT_ENTRY',
          entry: {
            ...ev.entry,
            timestamp: new Date(ev.entry.timestamp),
          },
        });
        break;
      }
      case 'ui': {
        const a = ev.action;
        if (a.kind === 'cursor') dispatch({ type: 'SET_CURSOR_POSITION', position: a.position });
        if (a.kind === 'page') dispatch({ type: 'SET_CURRENT_PAGE', page: a.page });
        if (a.kind === 'typing') dispatch({ type: 'SET_TYPING', text: a.text, target: a.target });
        if (a.kind === 'flash') dispatch({ type: 'SET_FLASH', show: a.show });
        if (a.kind === 'scanline') dispatch({ type: 'SET_SCANLINE', show: a.show });
        break;
      }
      case 'run_completed': {
        startedRef.current = false;
        runIdRef.current = null;
        closeStream();
        dispatch({ type: 'COMPLETE_EXECUTION' });
        break;
      }
      case 'run_failed': {
        startedRef.current = false;
        runIdRef.current = null;
        closeStream();
        // Step statuses already include failures; render summary.
        dispatch({ type: 'COMPLETE_EXECUTION' });
        break;
      }
      case 'run_aborted': {
        startedRef.current = false;
        runIdRef.current = null;
        closeStream();
        break;
      }
      default:
        break;
    }
  }

  // Start the backend run when the UI transitions into running state.
  useEffect(() => {
    if (execution.status !== 'running') return;
    if (execution.currentStepIndex !== 0) return;
    if (startedRef.current) return;

    startedRef.current = true;

    (async () => {
      const { runId } = await postJson<{ runId: string }>('/api/runs', {
        steps: stepsRef.current,
        speed: execution.speed,
      });

      runIdRef.current = runId;

      // Handle race: user paused/stopped before the runId existed.
      if (statusRef.current === 'paused') {
        postJson(`/api/runs/${runId}/pause`, {}).catch(() => {});
      }
      if (statusRef.current === 'idle') {
        postJson(`/api/runs/${runId}/abort`, {}).catch(() => {});
      }

      const es = new EventSource(`/api/runs/${runId}/events`);
      esRef.current = es;

      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as RunEvent;
          handleEvent(ev);
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        // If the stream errors, stop attempting to drive UI. User can re-run.
        closeStream();
        runIdRef.current = null;
        startedRef.current = false;
      };
    })().catch(() => {
      startedRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execution.status, execution.currentStepIndex]);

  // Pause / resume.
  useEffect(() => {
    const runId = runIdRef.current;
    if (!runId) return;

    if (execution.status === 'paused') {
      postJson(`/api/runs/${runId}/pause`, {}).catch(() => {});
    } else if (execution.status === 'running') {
      postJson(`/api/runs/${runId}/resume`, {}).catch(() => {});
    }
  }, [execution.status]);

  // Abort remote run if the UI is stopped.
  useEffect(() => {
    if (execution.status !== 'idle') return;
    if (!runIdRef.current) return;
    abortRemoteRun().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execution.status]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      closeStream();
    };
  }, []);
}
