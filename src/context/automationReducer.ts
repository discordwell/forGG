import type {
  AutomationStep,
  AutomationAction,
  ExecutionState,
  StepStatus,
} from '../types/automation';
import { DEFAULT_SCENARIO_ID, SCENARIO_BY_ID, type ScenarioId } from '../data/scenarios';

export interface AutomationState {
  scenarioId: ScenarioId;
  steps: AutomationStep[];
  execution: ExecutionState;
}

const FALLBACK_PAGE = 'maxlevel-ops';

function defaultPageFor(scenarioId: ScenarioId): string {
  return SCENARIO_BY_ID[scenarioId]?.defaultPage || FALLBACK_PAGE;
}

export function createInitialExecution(steps: AutomationStep[], currentPage: string): ExecutionState {
  return {
    status: 'idle',
    currentStepIndex: -1,
    stepStatuses: steps.map(() => 'pending' as StepStatus),
    auditLog: [],
    startTime: null,
    endTime: null,
    speed: 1,
    currentPage,
    cursorPosition: { x: 400, y: 300 },
    activeHighlight: null,
    showFlash: false,
    showRipple: null,
    showScanline: false,
    typingText: '',
    typingTarget: '',
  };
}

function buildInitialState(): AutomationState {
  const scenarioId: ScenarioId = DEFAULT_SCENARIO_ID;
  const scenario = SCENARIO_BY_ID[scenarioId];
  const steps = scenario.create();
  return {
    scenarioId,
    steps,
    execution: createInitialExecution(steps, scenario.defaultPage),
  };
}

export const initialState: AutomationState = buildInitialState();

export function automationReducer(
  state: AutomationState,
  action: AutomationAction
): AutomationState {
  switch (action.type) {
    case 'SET_SCENARIO': {
      const scenario = SCENARIO_BY_ID[action.scenarioId];
      const steps = scenario.create();
      return {
        scenarioId: action.scenarioId,
        steps,
        execution: {
          ...createInitialExecution(steps, scenario.defaultPage),
          speed: state.execution.speed,
        },
      };
    }

    case 'SET_STEPS':
      return {
        ...state,
        steps: action.steps,
        execution: {
          ...state.execution,
          stepStatuses: action.steps.map(() => 'pending'),
        },
      };

    case 'ADD_STEP':
      return {
        ...state,
        steps: [...state.steps, action.step],
        execution: {
          ...state.execution,
          stepStatuses: [...state.execution.stepStatuses, 'pending'],
        },
      };

    case 'UPDATE_STEP':
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s
        ),
      };

    case 'REMOVE_STEP': {
      const idx = state.steps.findIndex((s) => s.id === action.id);
      return {
        ...state,
        steps: state.steps.filter((s) => s.id !== action.id),
        execution: {
          ...state.execution,
          stepStatuses: state.execution.stepStatuses.filter((_, i) => i !== idx),
        },
      };
    }

    case 'REORDER_STEPS': {
      const newSteps = [...state.steps];
      const [moved] = newSteps.splice(action.fromIndex, 1);
      newSteps.splice(action.toIndex, 0, moved);
      const newStatuses = [...state.execution.stepStatuses];
      const [movedStatus] = newStatuses.splice(action.fromIndex, 1);
      newStatuses.splice(action.toIndex, 0, movedStatus);
      return {
        ...state,
        steps: newSteps,
        execution: { ...state.execution, stepStatuses: newStatuses },
      };
    }

    case 'START_EXECUTION':
      return {
        ...state,
        execution: {
          ...createInitialExecution(state.steps, defaultPageFor(state.scenarioId)),
          speed: state.execution.speed,
          status: 'running',
          currentStepIndex: 0,
          stepStatuses: state.steps.map(() => 'pending'),
          startTime: new Date(),
          currentPage: state.steps[0]?.page || defaultPageFor(state.scenarioId),
        },
      };

    case 'PAUSE_EXECUTION':
      return {
        ...state,
        execution: { ...state.execution, status: 'paused' },
      };

    case 'RESUME_EXECUTION':
      return {
        ...state,
        execution: { ...state.execution, status: 'running' },
      };

    case 'STOP_EXECUTION':
      return {
        ...state,
        execution: {
          ...state.execution,
          status: 'idle',
          currentStepIndex: -1,
          activeHighlight: null,
          showFlash: false,
          showRipple: null,
          showScanline: false,
          typingText: '',
          typingTarget: '',
        },
      };

    case 'SET_STEP_INDEX':
      return {
        ...state,
        execution: {
          ...state.execution,
          currentStepIndex: action.index,
          currentPage:
            state.steps[action.index]?.page || state.execution.currentPage,
        },
      };

    case 'STEP_FORWARD': {
      const next = Math.min(
        state.execution.currentStepIndex + 1,
        state.steps.length - 1
      );
      return {
        ...state,
        execution: {
          ...state.execution,
          currentStepIndex: next,
          currentPage: state.steps[next]?.page || state.execution.currentPage,
        },
      };
    }

    case 'STEP_BACK': {
      const prev = Math.max(state.execution.currentStepIndex - 1, 0);
      return {
        ...state,
        execution: {
          ...state.execution,
          currentStepIndex: prev,
          currentPage: state.steps[prev]?.page || state.execution.currentPage,
        },
      };
    }

    case 'SET_SPEED':
      return {
        ...state,
        execution: { ...state.execution, speed: action.speed },
      };

    case 'SET_STEP_STATUS': {
      const statuses = [...state.execution.stepStatuses];
      statuses[action.index] = action.status;
      return {
        ...state,
        execution: { ...state.execution, stepStatuses: statuses },
      };
    }

    case 'ADD_AUDIT_ENTRY':
      return {
        ...state,
        execution: {
          ...state.execution,
          auditLog: [...state.execution.auditLog, action.entry],
        },
      };

    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        execution: { ...state.execution, currentPage: action.page },
      };

    case 'SET_CURSOR_POSITION':
      return {
        ...state,
        execution: { ...state.execution, cursorPosition: action.position },
      };

    case 'SET_HIGHLIGHT':
      return {
        ...state,
        execution: { ...state.execution, activeHighlight: action.highlight },
      };

    case 'SET_FLASH':
      return {
        ...state,
        execution: { ...state.execution, showFlash: action.show },
      };

    case 'SET_RIPPLE':
      return {
        ...state,
        execution: { ...state.execution, showRipple: action.position },
      };

    case 'SET_SCANLINE':
      return {
        ...state,
        execution: { ...state.execution, showScanline: action.show },
      };

    case 'SET_TYPING':
      return {
        ...state,
        execution: {
          ...state.execution,
          typingText: action.text,
          typingTarget: action.target,
        },
      };

    case 'RESET_EXECUTION':
      return {
        ...state,
        execution: {
          ...createInitialExecution(state.steps, defaultPageFor(state.scenarioId)),
          speed: state.execution.speed,
          stepStatuses: state.steps.map(() => 'pending'),
        },
      };

    case 'COMPLETE_EXECUTION':
      return {
        ...state,
        execution: {
          ...state.execution,
          status: 'completed',
          endTime: new Date(),
        },
      };

    default:
      return state;
  }
}
