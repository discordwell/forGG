import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGhlLocations } from './ghlLocations';

test('parses a bare array of _id locations', () => {
  assert.deepEqual(parseGhlLocations([{ _id: 'loc1', name: 'HQ', timezone: 'UTC' }]), [
    { id: 'loc1', name: 'HQ', timezone: 'UTC' },
  ]);
});

test('accepts id-only locations (matches the server tolerance)', () => {
  // Regression: the header used to require `_id`, so these were dropped from
  // the dropdown even though the server auto-selects them fine.
  assert.deepEqual(parseGhlLocations([{ id: 'loc2', name: 'Branch' }]), [
    { id: 'loc2', name: 'Branch', timezone: undefined },
  ]);
});

test('prefers _id over id when both are present', () => {
  assert.deepEqual(parseGhlLocations([{ _id: 'underscore', id: 'plain' }]), [
    { id: 'underscore', name: undefined, timezone: undefined },
  ]);
});

test('unwraps a { locations: [...] } envelope', () => {
  assert.deepEqual(parseGhlLocations({ locations: [{ _id: 'loc3' }, { id: 'loc4' }] }), [
    { id: 'loc3', name: undefined, timezone: undefined },
    { id: 'loc4', name: undefined, timezone: undefined },
  ]);
});

test('filters out entries without a usable string id', () => {
  assert.deepEqual(
    parseGhlLocations([{ _id: 'keep' }, {}, { _id: 42 }, { id: '' }, null, 'nope']),
    [{ id: 'keep', name: undefined, timezone: undefined }]
  );
});

test('ignores a non-string name or timezone', () => {
  assert.deepEqual(parseGhlLocations([{ _id: 'loc', name: 123, timezone: {} }]), [
    { id: 'loc', name: undefined, timezone: undefined },
  ]);
});

test('returns an empty list for non-location shapes', () => {
  assert.deepEqual(parseGhlLocations(null), []);
  assert.deepEqual(parseGhlLocations(undefined), []);
  assert.deepEqual(parseGhlLocations('nope'), []);
  assert.deepEqual(parseGhlLocations(42), []);
  assert.deepEqual(parseGhlLocations({}), []);
  assert.deepEqual(parseGhlLocations({ locations: 'nope' }), []);
  assert.deepEqual(parseGhlLocations([]), []);
});
