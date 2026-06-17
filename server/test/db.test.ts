import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, type Db } from '../src/db';
import {
  clearGhlIntegration,
  getGhlIntegration,
  redactGhlIntegration,
  setGhlIntegration,
} from '../src/ghl/integration';

function withTempDb(fn: (db: Db) => void | Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgg-test-'));
  const db = openDb({ dataDir: dir });
  return Promise.resolve(fn(db)).finally(() => {
    db.raw.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test('createRun and getRun round-trip', () =>
  withTempDb((db) => {
    db.createRun({ id: 'r1', stepsJson: '[{"id":"s1"}]' });
    const run = db.getRun('r1');
    assert.ok(run);
    assert.equal(run.id, 'r1');
    assert.equal(run.status, 'queued');
    assert.equal(run.startedAt, null);
    assert.equal(run.endedAt, null);
    assert.equal(run.error, null);
    assert.equal(run.stepsJson, '[{"id":"s1"}]');
    assert.equal(db.getRun('missing'), null);
  }));

test('updateRun applies partial updates without clobbering', () =>
  withTempDb((db) => {
    db.createRun({ id: 'r1', stepsJson: '[]' });
    db.updateRun({ id: 'r1', status: 'running', startedAt: 111 });
    db.updateRun({ id: 'r1', status: 'failed', endedAt: 222, error: 'boom' });
    const run = db.getRun('r1');
    assert.ok(run);
    assert.equal(run.status, 'failed');
    assert.equal(run.startedAt, 111);
    assert.equal(run.endedAt, 222);
    assert.equal(run.error, 'boom');

    // Omitted fields are preserved.
    db.updateRun({ id: 'r1', status: 'completed' });
    const again = db.getRun('r1');
    assert.ok(again);
    assert.equal(again.startedAt, 111);
    assert.equal(again.error, 'boom');
  }));

test('listRuns respects and clamps the limit', () =>
  withTempDb((db) => {
    for (let i = 0; i < 5; i++) db.createRun({ id: `r${i}`, stepsJson: '[]' });
    assert.equal(db.listRuns(3).length, 3);
    assert.equal(db.listRuns(0).length, 1); // clamped to >= 1
    assert.equal(db.listRuns(-10).length, 1); // negatives clamp to >= 1
    assert.equal(db.listRuns(500).length, 5); // upper clamp of 200 still returns all rows
    // A non-integer LIMIT used to reach SQLite verbatim and throw a "datatype
    // mismatch"; it must now floor (2.9 -> 2) instead of throwing.
    assert.equal(db.listRuns(2.9).length, 2);
    assert.equal(db.listRuns(Number.NaN).length, 5); // non-finite falls back to the 25 default -> all 5 rows
  }));

test('addEvent and listEvents preserve insertion order', () =>
  withTempDb((db) => {
    db.createRun({ id: 'r1', stepsJson: '[]' });
    db.createRun({ id: 'r2', stepsJson: '[]' });
    db.addEvent({ runId: 'r1', ts: 3, type: 'b', payloadJson: '{"n":2}' });
    db.addEvent({ runId: 'r1', ts: 1, type: 'a', payloadJson: '{"n":1}' });
    db.addEvent({ runId: 'r2', ts: 2, type: 'x', payloadJson: '{}' });

    // Events for unknown runs are rejected (FK enforcement is on by default
    // in better-sqlite3).
    assert.throws(() => db.addEvent({ runId: 'ghost', ts: 1, type: 'x', payloadJson: '{}' }));
    const events = db.listEvents('r1');
    assert.deepEqual(
      events.map((e) => e.type),
      ['b', 'a'] // insertion order, not ts order
    );
    assert.equal(db.listEvents('nope').length, 0);
  }));

test('kv set/get/delete', () =>
  withTempDb((db) => {
    assert.equal(db.getKv('k'), null);
    db.setKv('k', '"v1"');
    assert.equal(db.getKv('k'), '"v1"');
    db.setKv('k', '"v2"'); // upsert
    assert.equal(db.getKv('k'), '"v2"');
    db.deleteKv('k');
    assert.equal(db.getKv('k'), null);
  }));

test('GHL integration store round-trips and validates', () =>
  withTempDb((db) => {
    assert.equal(getGhlIntegration(db), null);

    setGhlIntegration(db, {
      accessToken: 'tok_secret',
      tokenId: 'fb_id',
      companyId: 'co_1',
      userId: 'u_1',
      locationId: 'loc_1',
      capturedAt: 1234,
    });
    const integration = getGhlIntegration(db);
    assert.ok(integration);
    assert.equal(integration.accessToken, 'tok_secret');
    assert.equal(integration.locationId, 'loc_1');

    clearGhlIntegration(db);
    assert.equal(getGhlIntegration(db), null);
  }));

test('GHL integration store rejects malformed payloads', () =>
  withTempDb((db) => {
    db.setKv('integration:ghl', 'not json');
    assert.equal(getGhlIntegration(db), null);
    db.setKv('integration:ghl', JSON.stringify({ accessToken: '' , capturedAt: 1 }));
    assert.equal(getGhlIntegration(db), null);
    db.setKv('integration:ghl', JSON.stringify({ accessToken: 'x' })); // missing capturedAt
    assert.equal(getGhlIntegration(db), null);
  }));

test('redactGhlIntegration never exposes tokens', () => {
  assert.deepEqual(redactGhlIntegration(null), { connected: false });
  const redacted = redactGhlIntegration({
    accessToken: 'tok_secret',
    tokenId: 'fb_id',
    companyId: 'co_1',
    userId: 'u_1',
    locationId: 'loc_1',
    capturedAt: 1234,
  });
  assert.deepEqual(redacted, {
    connected: true,
    companyId: 'co_1',
    userId: 'u_1',
    locationId: 'loc_1',
    hasTokenId: true,
    capturedAt: 1234,
  });
  const json = JSON.stringify(redacted);
  assert.ok(!json.includes('tok_secret'));
  assert.ok(!json.includes('fb_id'));
});
