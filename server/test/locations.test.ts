import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstLocationFromSearchResponse } from '../src/ghl/locations';

test('reads first location from a bare array', () => {
  assert.deepEqual(firstLocationFromSearchResponse([{ _id: 'loc1', name: 'HQ' }]), { id: 'loc1', name: 'HQ' });
});

test('falls back from _id to id', () => {
  assert.deepEqual(firstLocationFromSearchResponse([{ id: 'loc2' }]), { id: 'loc2', name: undefined });
});

test('unwraps { locations: [...] } envelopes', () => {
  assert.deepEqual(firstLocationFromSearchResponse({ locations: [{ _id: 'loc3' }] }), {
    id: 'loc3',
    name: undefined,
  });
});

test('returns null for shapes without a usable id', () => {
  assert.equal(firstLocationFromSearchResponse([]), null);
  assert.equal(firstLocationFromSearchResponse([{}]), null);
  assert.equal(firstLocationFromSearchResponse([{ _id: 42 }]), null);
  assert.equal(firstLocationFromSearchResponse('nope'), null);
  assert.equal(firstLocationFromSearchResponse({ locations: 'nope' }), null);
  assert.equal(firstLocationFromSearchResponse(null), null);
});
