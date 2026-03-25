import type { AutomationStep } from '../types/automation';
import {
  SCENARIO_ID as MAXLEVEL_ID,
  SCENARIO_NAME as MAXLEVEL_NAME,
  SCENARIO_DESCRIPTION as MAXLEVEL_DESCRIPTION,
  createScenario as createMaxLevelScenario,
} from './maxlevel-scenario';

export type ScenarioId = typeof MAXLEVEL_ID;

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  description: string;
  create: () => AutomationStep[];
  defaultPage: string;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: MAXLEVEL_ID,
    name: MAXLEVEL_NAME,
    description: MAXLEVEL_DESCRIPTION,
    create: createMaxLevelScenario,
    defaultPage: 'maxlevel-ops',
  },
];

export const DEFAULT_SCENARIO_ID: ScenarioId = MAXLEVEL_ID;

export const SCENARIO_BY_ID: Record<ScenarioId, ScenarioDef> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s])
) as Record<ScenarioId, ScenarioDef>;
