import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSavedEntities, statusPillClass } from './maxLevelOps.logic';

test('statusPillClass buckets each status into its color', () => {
  assert.match(statusPillClass('passed'), /emerald/);
  assert.match(statusPillClass('completed'), /emerald/);
  assert.match(statusPillClass('failed'), /red/);
  assert.match(statusPillClass('error'), /red/);
  assert.match(statusPillClass('running'), /blue/);
  // pending / unknown / undefined fall back to the neutral slate pill.
  assert.match(statusPillClass('pending'), /slate/);
  assert.match(statusPillClass(undefined), /slate/);
  assert.match(statusPillClass('something-else'), /slate/);
});

test('deriveSavedEntities flattens saved maps across the audit log', () => {
  const log = [
    { extractedData: { saved: { contactId: 'c1', contactEmail: 'a@b.com' } } },
    { extractedData: { saved: { opportunityId: 'o1' } } },
  ];
  assert.deepEqual(deriveSavedEntities(log), {
    contactId: 'c1',
    contactEmail: 'a@b.com',
    opportunityId: 'o1',
  });
});

test('the most recent value for a key wins (newest entry is last in the log)', () => {
  const log = [
    { extractedData: { saved: { contactId: 'old' } } },
    { extractedData: { saved: { contactId: 'new' } } },
  ];
  assert.deepEqual(deriveSavedEntities(log), { contactId: 'new' });
});

test('an explicit empty-string value from the newest step is not overwritten', () => {
  // Presence check (not truthiness): the newest "" wins over an older value.
  const log = [
    { extractedData: { saved: { contactId: 'older' } } },
    { extractedData: { saved: { contactId: '' } } },
  ];
  assert.deepEqual(deriveSavedEntities(log), { contactId: '' });
});

test('skips null/undefined values and falls back to an older real value', () => {
  const log = [
    { extractedData: { saved: { contactId: 'real' } } },
    { extractedData: { saved: { contactId: null } } },
  ];
  assert.deepEqual(deriveSavedEntities(log), { contactId: 'real' });
});

test('JSON-stringifies non-string saved values', () => {
  const log = [
    { extractedData: { saved: { count: 3, meta: { a: 1 }, list: [1, 2] } } },
  ];
  assert.deepEqual(deriveSavedEntities(log), {
    count: '3',
    meta: '{"a":1}',
    list: '[1,2]',
  });
});

test('ignores entries whose extractedData has no usable saved map', () => {
  const log = [
    { extractedData: undefined },
    { extractedData: { service: 'ghl' } },
    { extractedData: { saved: 'not-an-object' } },
    { extractedData: { saved: ['arrays', 'rejected'] } },
    { extractedData: { saved: { keep: 'yes' } } },
  ];
  assert.deepEqual(deriveSavedEntities(log), { keep: 'yes' });
});

test('returns an empty map for an empty log', () => {
  assert.deepEqual(deriveSavedEntities([]), {});
});
