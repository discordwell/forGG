import { nanoid } from 'nanoid';
import type { AutomationStep } from '../types/automation';

export const SCENARIO_ID = 'maxlevel-lead-intake';
export const SCENARIO_NAME = 'MaxLevel — Lead Intake (GoHighLevel)';
export const SCENARIO_DESCRIPTION =
  'Real workflow against your live GoHighLevel account: pull pipelines, create a contact, tag it, and open a new opportunity.';

export function createScenario(): AutomationStep[] {
  return [
    {
      id: nanoid(),
      type: 'api',
      label: 'GHL: Fetch pipelines',
      page: 'maxlevel-ops',
      targetCoords: { x: 520, y: 210 },
      api: {
        service: 'ghl',
        method: 'GET',
        path: '/opportunities/pipelines',
        timeoutMs: 20_000,
      },
      save: {
        pipelineId: ['/pipelines/0/id', '/pipelines/0/_id'],
        pipelineStageId: ['/pipelines/0/stages/0/id', '/pipelines/0/stages/0/_id'],
      },
    },
    {
      id: nanoid(),
      type: 'api',
      label: 'GHL: Create contact (unique email)',
      page: 'maxlevel-ops',
      targetCoords: { x: 360, y: 310 },
      api: {
        service: 'ghl',
        method: 'POST',
        path: '/contacts/',
        body: {
          firstName: 'MaxLevel',
          lastName: 'Demo',
          email: 'maxlevel+{{runKey}}@example.com',
          source: 'maxlevel_demo',
          tags: ['maxlevel-demo', 'forgg-runbook'],
        },
        timeoutMs: 25_000,
      },
      save: {
        contactId: ['/contact/id', '/contact/_id'],
        contactEmail: ['/contact/email'],
      },
    },
    {
      id: nanoid(),
      type: 'api',
      label: 'GHL: Ensure tags applied',
      page: 'maxlevel-ops',
      targetCoords: { x: 650, y: 310 },
      api: {
        service: 'ghl',
        method: 'PUT',
        path: '/contacts/{{contactId}}',
        body: {
          tags: ['maxlevel-demo', 'forgg-runbook', 'new-lead'],
        },
        injectLocationId: false,
        timeoutMs: 25_000,
      },
    },
    {
      id: nanoid(),
      type: 'api',
      label: 'GHL: Create opportunity in pipeline',
      page: 'maxlevel-ops',
      targetCoords: { x: 420, y: 420 },
      api: {
        service: 'ghl',
        method: 'POST',
        path: '/opportunities/',
        body: {
          pipelineId: '{{pipelineId}}',
          pipelineStageId: '{{pipelineStageId}}',
          contactId: '{{contactId}}',
          name: 'MaxLevel Demo Deal — {{runKey}}',
          monetaryValue: 0,
          status: 'open',
        },
        timeoutMs: 30_000,
      },
      save: {
        opportunityId: ['/opportunity/id', '/opportunity/_id'],
      },
    },
    {
      id: nanoid(),
      type: 'api',
      label: 'GHL: List workflows',
      page: 'maxlevel-ops',
      targetCoords: { x: 240, y: 470 },
      api: {
        service: 'ghl',
        method: 'GET',
        path: '/workflows/',
        timeoutMs: 20_000,
      },
      save: {
        workflowId: ['/workflows/0/id', '/workflows/0/_id'],
      },
    },
  ];
}
