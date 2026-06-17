/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { AutomationAction } from '../types/automation';
import {
  automationReducer,
  initialState,
  type AutomationState,
} from './automationReducer';

export type { AutomationState } from './automationReducer';

export const AutomationContext = createContext<AutomationState>(initialState);
export const AutomationDispatchContext = createContext<Dispatch<AutomationAction>>(
  () => {}
);

export function AutomationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(automationReducer, initialState);

  return (
    <AutomationContext.Provider value={state}>
      <AutomationDispatchContext.Provider value={dispatch}>
        {children}
      </AutomationDispatchContext.Provider>
    </AutomationContext.Provider>
  );
}

// Re-export hooks from separate file for backwards compatibility
export { useAutomation, useAutomationDispatch } from './useAutomationHooks';
