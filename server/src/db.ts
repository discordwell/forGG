import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

/** Default `listRuns` page size when no (or a non-numeric) limit is given. */
export const DEFAULT_RUN_LIMIT = 25;
/** Hard cap on `listRuns` page size, regardless of the requested limit. */
const MAX_RUN_LIMIT = 200;

export type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';

export interface DbRun {
  id: string;
  createdAt: number;
  status: RunStatus;
  startedAt: number | null;
  endedAt: number | null;
  stepsJson: string;
  error: string | null;
}

export interface DbEvent {
  id: number;
  runId: string;
  ts: number;
  type: string;
  payloadJson: string;
}

export interface Db {
  raw: Database.Database;
  createRun: (args: { id: string; stepsJson: string }) => void;
  updateRun: (args: { id: string; status?: RunStatus; startedAt?: number | null; endedAt?: number | null; error?: string | null }) => void;
  addEvent: (args: { runId: string; ts: number; type: string; payloadJson: string }) => number;
  listEvents: (runId: string) => DbEvent[];
  listRuns: (limit: number) => DbRun[];
  getRun: (runId: string) => DbRun | null;
  getKv: (key: string) => string | null;
  setKv: (key: string, valueJson: string) => void;
  deleteKv: (key: string) => void;
}

export function openDb(opts?: { dataDir?: string }) : Db {
  const dataDir = opts?.dataDir ?? path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'forgg.sqlite');
  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');

  raw.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER,
      ended_at INTEGER,
      steps_json TEXT NOT NULL,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs (id)
    );
    CREATE INDEX IF NOT EXISTS idx_events_run_id ON events (run_id, id);

    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const createRunStmt = raw.prepare(`
    INSERT INTO runs (id, created_at, status, started_at, ended_at, steps_json, error)
    VALUES (@id, @createdAt, @status, NULL, NULL, @stepsJson, NULL)
  `);

  const updateRunStmt = raw.prepare(`
    UPDATE runs
    SET
      status = COALESCE(@status, status),
      started_at = COALESCE(@startedAt, started_at),
      ended_at = COALESCE(@endedAt, ended_at),
      error = COALESCE(@error, error)
    WHERE id = @id
  `);

  const addEventStmt = raw.prepare(`
    INSERT INTO events (run_id, ts, type, payload_json)
    VALUES (@runId, @ts, @type, @payloadJson)
  `);

  const listEventsStmt = raw.prepare(`
    SELECT id, run_id as runId, ts, type, payload_json as payloadJson
    FROM events
    WHERE run_id = ?
    ORDER BY id ASC
  `);

  const getRunStmt = raw.prepare(`
    SELECT
      id,
      created_at as createdAt,
      status,
      started_at as startedAt,
      ended_at as endedAt,
      steps_json as stepsJson,
      error
    FROM runs
    WHERE id = ?
  `);

  const listRunsStmt = raw.prepare(`
    SELECT
      id,
      created_at as createdAt,
      status,
      started_at as startedAt,
      ended_at as endedAt,
      steps_json as stepsJson,
      error
    FROM runs
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const getKvStmt = raw.prepare(`
    SELECT value_json as valueJson
    FROM kv
    WHERE key = ?
  `);

  const setKvStmt = raw.prepare(`
    INSERT INTO kv (key, value_json, updated_at)
    VALUES (@key, @valueJson, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `);

  const deleteKvStmt = raw.prepare(`
    DELETE FROM kv WHERE key = ?
  `);

  return {
    raw,
    createRun: ({ id, stepsJson }) => createRunStmt.run({ id, createdAt: Date.now(), status: 'queued', stepsJson }),
    updateRun: ({ id, status, startedAt, endedAt, error }) => {
      updateRunStmt.run({ id, status: status ?? null, startedAt: startedAt ?? null, endedAt: endedAt ?? null, error: error ?? null });
    },
    addEvent: ({ runId, ts, type, payloadJson }) => {
      const res = addEventStmt.run({ runId, ts, type, payloadJson });
      return Number(res.lastInsertRowid);
    },
    listEvents: (runId) => listEventsStmt.all(runId) as DbEvent[],
    listRuns: (limit) => {
      // SQLite's LIMIT must bind an integer — a non-integer (or NaN) throws a
      // "datatype mismatch", so floor and clamp before binding; a non-finite
      // limit falls back to the default page size.
      const n = Number.isFinite(limit) ? Math.floor(limit) : DEFAULT_RUN_LIMIT;
      return listRunsStmt.all(Math.max(1, Math.min(n, MAX_RUN_LIMIT))) as DbRun[];
    },
    getRun: (runId) => (getRunStmt.get(runId) as DbRun | undefined) ?? null,
    getKv: (key) => {
      const row = getKvStmt.get(key) as { valueJson?: string } | undefined;
      return row?.valueJson ?? null;
    },
    setKv: (key, valueJson) => {
      setKvStmt.run({ key, valueJson, updatedAt: Date.now() });
    },
    deleteKv: (key) => {
      deleteKvStmt.run(key);
    },
  };
}
