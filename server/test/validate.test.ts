import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AutomationStepSchema, CreateRunSchema } from '../src/validate';

const waitStep = { id: 's1', type: 'wait', label: 'Wait a bit', value: '100' };

test('accepts a minimal wait step', () => {
  const res = AutomationStepSchema.safeParse(waitStep);
  assert.equal(res.success, true);
});

test('accepts an api step with config and save mappings', () => {
  const res = AutomationStepSchema.safeParse({
    id: 's2',
    type: 'api',
    label: 'Create contact',
    api: {
      service: 'ghl',
      method: 'POST',
      path: '/contacts/',
      query: { limit: 10, dry: false, q: 'x', n: null },
      body: { firstName: '{{name}}' },
      timeoutMs: 5000,
      injectLocationId: false,
    },
    save: { contactId: ['/contact/id', '/id'], single: '/x' },
  });
  assert.equal(res.success, true);
});

test('rejects an api step missing api config', () => {
  const res = AutomationStepSchema.safeParse({ id: 's3', type: 'api', label: 'Broken' });
  assert.equal(res.success, false);
  if (!res.success) {
    assert.ok(res.error.issues.some((i) => i.path.join('.') === 'api'));
  }
});

test('rejects unknown step types and empty labels', () => {
  assert.equal(AutomationStepSchema.safeParse({ id: 's4', type: 'dance', label: 'x' }).success, false);
  assert.equal(AutomationStepSchema.safeParse({ id: 's5', type: 'wait', label: '' }).success, false);
  assert.equal(AutomationStepSchema.safeParse({ id: '', type: 'wait', label: 'x' }).success, false);
});

test('CreateRunSchema requires at least one step', () => {
  assert.equal(CreateRunSchema.safeParse({ steps: [] }).success, false);
  assert.equal(CreateRunSchema.safeParse({ steps: [waitStep] }).success, true);
});

test('CreateRunSchema validates speed', () => {
  assert.equal(CreateRunSchema.safeParse({ steps: [waitStep], speed: 2 }).success, true);
  assert.equal(CreateRunSchema.safeParse({ steps: [waitStep], speed: 0 }).success, false);
  assert.equal(CreateRunSchema.safeParse({ steps: [waitStep], speed: -1 }).success, false);
});
