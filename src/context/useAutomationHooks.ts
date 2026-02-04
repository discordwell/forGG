import { useContext } from 'react';
import { AutomationContext, AutomationDispatchContext } from './AutomationContext';

export function useAutomation() {
  return useContext(AutomationContext);
}

export function useAutomationDispatch() {
  return useContext(AutomationDispatchContext);
}
