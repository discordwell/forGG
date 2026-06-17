import { useEffect, useRef, useState } from 'react';
import { useAutomation, useAutomationDispatch } from '../context/AutomationContext';
import { RunController, type RunEvent, type RunStream, type RunStreamHandlers } from './runController';

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

function openSse(runId: string, handlers: RunStreamHandlers): RunStream {
  const es = new EventSource(`/api/runs/${runId}/events`);
  es.onmessage = (msg) => {
    try {
      handlers.onEvent(JSON.parse(msg.data) as RunEvent);
    } catch {
      // ignore malformed frames
    }
  };
  es.onerror = () => handlers.onError();
  return { close: () => es.close() };
}

export function useAutomationEngine() {
  const { steps, execution } = useAutomation();
  const { status, currentStepIndex, speed } = execution;
  const dispatch = useAutomationDispatch();

  // Latest-value refs, written only inside effects (never during render) so the
  // long-lived controller can read current data when its start effect fires.
  const stepsRef = useRef(steps);
  const speedRef = useRef(speed);

  // Create the controller exactly once (lazy state initializer); `dispatch` is
  // stable across renders.
  const [controller] = useState(
    () =>
      new RunController({
        dispatch,
        postJson,
        openStream: openSse,
      })
  );

  // Keep value refs and the controller's status mirror current after each commit.
  useEffect(() => {
    stepsRef.current = steps;
    speedRef.current = speed;
    controller.syncStatus(status);
  });

  // Start the backend run when the UI transitions into running at step 0.
  useEffect(() => {
    if (status !== 'running') return;
    if (currentStepIndex !== 0) return;
    controller.start(stepsRef.current, speedRef.current);
  }, [controller, status, currentStepIndex]);

  // Pause / resume mirror the UI status onto the backend run.
  useEffect(() => {
    if (status === 'paused') controller.pause();
    else if (status === 'running') controller.resume();
  }, [controller, status]);

  // Abort the backend run when the UI is stopped.
  useEffect(() => {
    if (status !== 'idle') return;
    controller.abort();
  }, [controller, status]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => controller.dispose();
  }, [controller]);
}
