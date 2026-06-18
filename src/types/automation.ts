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
  injectLocationId?: boolean;
}

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export type Severity = 'info' | 'success' | 'warning' | 'error';

export interface AutomationStep {
  id: string;
  type: StepType;
  label: string;
  target?: string;
  value?: string;
  assertion?: string;
  /** Coordinates within the mock browser viewport for cursor animation */
  targetCoords?: { x: number; y: number };
  /** Which mock page this step operates on */
  page?: string;
  /** Duration override in ms */
  duration?: number;
  /** Data to "extract" for extract steps */
  extractedData?: Record<string, unknown>;
  api?: ApiStep;
  save?: Record<string, string | string[]>;
}

export interface AuditLogEntry {
  id: string;
  stepId: string;
  stepIndex: number;
  timestamp: Date;
  type: StepType;
  label: string;
  severity: Severity;
  message: string;
  duration?: number;
  screenshotUrl?: string;
  extractedData?: Record<string, unknown>;
  status: StepStatus;
}

export interface ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentStepIndex: number;
  stepStatuses: StepStatus[];
  auditLog: AuditLogEntry[];
  startTime: Date | null;
  endTime: Date | null;
  speed: number;
  currentPage: string;
  cursorPosition: { x: number; y: number };
  activeHighlight: { x: number; y: number; w: number; h: number } | null;
  showFlash: boolean;
  showRipple: { x: number; y: number } | null;
  showScanline: boolean;
  typingText: string;
  typingTarget: string;
}

import type { ScenarioId } from '../data/scenarios';

export type AutomationAction =
  | { type: 'SET_SCENARIO'; scenarioId: ScenarioId }
  | { type: 'SET_STEPS'; steps: AutomationStep[] }
  | { type: 'ADD_STEP'; step: AutomationStep }
  | { type: 'UPDATE_STEP'; id: string; updates: Partial<AutomationStep> }
  | { type: 'REMOVE_STEP'; id: string }
  | { type: 'REORDER_STEPS'; fromIndex: number; toIndex: number }
  | { type: 'START_EXECUTION' }
  | { type: 'PAUSE_EXECUTION' }
  | { type: 'RESUME_EXECUTION' }
  | { type: 'STOP_EXECUTION' }
  | { type: 'SET_STEP_INDEX'; index: number }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACK' }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'SET_STEP_STATUS'; index: number; status: StepStatus }
  | { type: 'ADD_AUDIT_ENTRY'; entry: AuditLogEntry }
  | { type: 'SET_CURRENT_PAGE'; page: string }
  | { type: 'SET_CURSOR_POSITION'; position: { x: number; y: number } }
  | { type: 'SET_HIGHLIGHT'; highlight: ExecutionState['activeHighlight'] }
  | { type: 'SET_FLASH'; show: boolean }
  | { type: 'SET_RIPPLE'; position: { x: number; y: number } | null }
  | { type: 'SET_SCANLINE'; show: boolean }
  | { type: 'SET_TYPING'; text: string; target: string }
  | { type: 'RESET_EXECUTION' }
  | { type: 'COMPLETE_EXECUTION' }
  | { type: 'FAIL_EXECUTION' };
