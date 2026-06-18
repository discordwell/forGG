import type {
  AuditLogEntry,
  AutomationAction,
  AutomationStep,
  ExecutionState,
  StepStatus,
} from '../types/automation';

/**
 * Events streamed by the backend over SSE. Mirrors the server's `RunEvent`
 * union, except `audit_entry` carries an ISO-string timestamp on the wire
 * (the UI converts it to a `Date`).
 */
export type RunEvent =
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

/** A run is over once the backend emits any of these. */
export function isTerminalEvent(type: RunEvent['type']): boolean {
  return type === 'run_completed' || type === 'run_failed' || type === 'run_aborted';
}

/**
 * Pure translation of a single backend event into the reducer actions that
 * drive the UI. Kept separate from the controller so it can be unit-tested
 * without any network/React machinery.
 */
export function eventToActions(ev: RunEvent): AutomationAction[] {
  switch (ev.type) {
    case 'step_started': {
      const actions: AutomationAction[] = [{ type: 'SET_STEP_INDEX', index: ev.index }];
      if (ev.step.page) actions.push({ type: 'SET_CURRENT_PAGE', page: ev.step.page });
      if (ev.step.targetCoords) actions.push({ type: 'SET_CURSOR_POSITION', position: ev.step.targetCoords });
      return actions;
    }
    case 'step_status':
      return [{ type: 'SET_STEP_STATUS', index: ev.index, status: ev.status }];
    case 'audit_entry':
      return [{ type: 'ADD_AUDIT_ENTRY', entry: { ...ev.entry, timestamp: new Date(ev.entry.timestamp) } }];
    case 'ui': {
      const a = ev.action;
      if (a.kind === 'cursor') return [{ type: 'SET_CURSOR_POSITION', position: a.position }];
      if (a.kind === 'page') return [{ type: 'SET_CURRENT_PAGE', page: a.page }];
      if (a.kind === 'typing') return [{ type: 'SET_TYPING', text: a.text, target: a.target }];
      if (a.kind === 'flash') return [{ type: 'SET_FLASH', show: a.show }];
      if (a.kind === 'scanline') return [{ type: 'SET_SCANLINE', show: a.show }];
      return [];
    }
    // Both terminal states render a summary (per-step statuses already carry the
    // outcome), but a failure lands in a distinct 'error' status so the UI shows
    // it as failed instead of as a successful completion.
    case 'run_completed':
      return [{ type: 'COMPLETE_EXECUTION' }];
    case 'run_failed':
      return [{ type: 'FAIL_EXECUTION' }];
    case 'run_started':
    case 'run_paused':
    case 'run_resumed':
    case 'run_aborted':
      return [];
  }
}

export interface RunStream {
  close(): void;
}

export interface RunStreamHandlers {
  onEvent(ev: RunEvent): void;
  onError(): void;
}

export interface RunControllerDeps {
  dispatch(action: AutomationAction): void;
  postJson<T>(url: string, body: unknown): Promise<T>;
  openStream(runId: string, handlers: RunStreamHandlers): RunStream;
}

/**
 * Owns the imperative lifecycle of a single backend run (create, stream,
 * pause/resume, abort) independent of React. The hook is a thin adapter that
 * forwards UI status transitions to these methods.
 *
 * Invariant: `started` is the single guard that prevents a duplicate run from
 * being created. Every teardown path — terminal event, stream error, and
 * explicit abort — must reset it, or the next "Execute" is silently blocked.
 * (The abort path previously left it set, which wedged the UI in "running".)
 *
 * Because resetting `started` re-opens the door to a new run, a `generation`
 * counter fences each in-flight `start()`: if a teardown or a newer `start()`
 * lands while the create request is still in flight, the stale attempt aborts
 * the run it created instead of opening a second concurrent stream.
 */
export class RunController {
  private started = false;
  private runId: string | null = null;
  private stream: RunStream | null = null;
  private uiStatus: ExecutionState['status'] = 'idle';
  private generation = 0;
  private readonly deps: RunControllerDeps;

  constructor(deps: RunControllerDeps) {
    this.deps = deps;
  }

  get isStarted(): boolean {
    return this.started;
  }

  get activeRunId(): string | null {
    return this.runId;
  }

  /** The UI mirrors its run status here so post-async hops see a fresh value. */
  syncStatus(status: ExecutionState['status']): void {
    this.uiStatus = status;
  }

  async start(steps: AutomationStep[], speed: number): Promise<void> {
    if (this.started) return;
    this.started = true;
    const gen = ++this.generation;

    let runId: string;
    try {
      ({ runId } = await this.deps.postJson<{ runId: string }>('/api/runs', { steps, speed }));
    } catch {
      // Create failed: stay torn down so the user can retry — but only if this
      // attempt is still the current one (a newer start() may own `started`).
      if (this.generation === gen) this.started = false;
      return;
    }

    // A teardown (stop/abort) or a newer start() landed during the create
    // round-trip: this attempt is stale, so abort the run it created and bail
    // rather than opening a second concurrent stream.
    if (this.generation !== gen) {
      this.deps.postJson(`/api/runs/${runId}/abort`, {}).catch(() => {});
      return;
    }

    // The user may have paused or stopped during the create round-trip.
    const status = this.uiStatus;
    if (status === 'idle') {
      // Stopped before the run existed: abort it and do not open a stream.
      this.deps.postJson(`/api/runs/${runId}/abort`, {}).catch(() => {});
      this.teardown();
      return;
    }

    this.runId = runId;
    if (status === 'paused') {
      this.deps.postJson(`/api/runs/${runId}/pause`, {}).catch(() => {});
    }

    this.stream = this.deps.openStream(runId, {
      onEvent: (ev) => this.handleEvent(ev),
      onError: () => this.teardown(),
    });
  }

  pause(): void {
    if (this.runId) this.deps.postJson(`/api/runs/${this.runId}/pause`, {}).catch(() => {});
  }

  resume(): void {
    if (this.runId) this.deps.postJson(`/api/runs/${this.runId}/resume`, {}).catch(() => {});
  }

  /**
   * Stop the active run. Tears down local state synchronously (so a subsequent
   * `start()` is not blocked) before firing the best-effort abort request.
   */
  abort(): void {
    const runId = this.runId;
    this.teardown();
    if (runId) this.deps.postJson(`/api/runs/${runId}/abort`, {}).catch(() => {});
  }

  /** Release the stream on unmount without aborting the backend run. */
  dispose(): void {
    this.closeStream();
  }

  private handleEvent(ev: RunEvent): void {
    for (const action of eventToActions(ev)) this.deps.dispatch(action);
    if (isTerminalEvent(ev.type)) this.teardown();
  }

  private teardown(): void {
    // Bump the generation so any start() awaiting its create request sees that
    // this attempt is no longer current.
    this.generation++;
    this.started = false;
    this.runId = null;
    this.closeStream();
  }

  private closeStream(): void {
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
  }
}
