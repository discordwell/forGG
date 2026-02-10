export type StepType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'extract'
  | 'screenshot'
  | 'assert'
  | 'wait'
  | 'scroll'
  | 'select'
  | 'api';

export type ApiService = 'ghl';

export interface ApiStep {
  service: ApiService;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | null>;
  body?: unknown;
  timeoutMs?: number;
  /**
   * If true (default), runner will add `locationId` to query/body when missing
   * and the integration has a location selected.
   */
  injectLocationId?: boolean;
}

export interface AutomationStep {
  id: string;
  type: StepType;
  label: string;
  target?: string;
  value?: string;
  assertion?: string;
  targetCoords?: { x: number; y: number };
  page?: string;
  duration?: number;
  extractedData?: Record<string, unknown>;
  api?: ApiStep;
  /** Map varName -> JSON pointer(s) extracted from last API response. */
  save?: Record<string, string | string[]>;
}

export type Severity = 'info' | 'success' | 'warning' | 'error';
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface AuditLogEntry {
  id: string;
  stepId: string;
  stepIndex: number;
  timestamp: string; // ISO
  type: StepType;
  label: string;
  severity: Severity;
  message: string;
  duration?: number;
  screenshotUrl?: string;
  extractedData?: Record<string, unknown>;
  status: StepStatus;
}

export type RunEvent =
  | { type: 'run_started'; runId: string; ts: number }
  | { type: 'run_paused'; runId: string; ts: number }
  | { type: 'run_resumed'; runId: string; ts: number }
  | { type: 'run_aborted'; runId: string; ts: number }
  | { type: 'run_completed'; runId: string; ts: number }
  | { type: 'run_failed'; runId: string; ts: number; error: string }
  | { type: 'step_started'; runId: string; ts: number; index: number; step: AutomationStep }
  | { type: 'step_status'; runId: string; ts: number; index: number; status: StepStatus }
  | { type: 'audit_entry'; runId: string; ts: number; entry: AuditLogEntry }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'cursor'; position: { x: number; y: number } } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'page'; page: string } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'typing'; target: string; text: string } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'flash'; show: boolean } }
  | { type: 'ui'; runId: string; ts: number; action: { kind: 'scanline'; show: boolean } };
