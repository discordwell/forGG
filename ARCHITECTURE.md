# Architecture

forGG is a full-stack "runbook execution" demo: a React UI authors step-based
automations, a Fastify backend executes them for real (Playwright for browser
steps, GoHighLevel API calls for `api` steps), and the UI is driven entirely by
server events streamed over SSE.

```
┌────────────────────┐  POST /api/runs   ┌─────────────────────────┐
│ React UI (Vite)    │ ────────────────► │ Fastify API (:8787)     │
│ src/               │  SSE /events      │ server/src/app.ts       │
│  AutomationContext │ ◄──────────────── │                         │
└────────────────────┘                   │  ┌───────────────────┐  │
                                         │  │ Runner (queue)    │  │
        Vite dev proxy: /api, /artifacts │  │ server/src/runner │  │
                                         │  └──┬──────────┬─────┘ │
                                         └─────┼──────────┼───────┘
                                       Playwright      GhlClient
                                       (sandbox pages)  (GHL REST)
                                               │
                                  SQLite event store + artifacts
                                  ./data/forgg.sqlite, ./data/artifacts/
```

## Backend (`server/`)

- **`src/index.ts`** — entrypoint only: env (`PORT`, `HOST`), data dirs, wires
  `openDb` + `RunSseHub` + `Runner` into `buildApp()` and listens.
- **`src/app.ts`** — `buildApp()` constructs the Fastify app from injected
  dependencies (`db`, `hub`, `runner`, dirs). The runner is typed as the
  minimal `RunnerLike` interface so tests inject a fake. Routes:
  - `POST /api/runs` (zod-validated), `GET /api/runs`, `GET /api/runs/:id`
  - `POST /api/runs/:id/pause|resume|abort`
  - `GET /api/runs/:id/events` (SSE; replays history, then live) and
    `GET /api/runs/:id/events.json`
  - `GET|POST|DELETE /api/integrations/ghl/*` (status / token capture /
    location selection / bridge page), `GET /healthz`
  - static: `/artifacts/*` (screenshots), `/sandbox/*` (local pages)
- **`src/runner.ts`** — serial in-process queue. Each run: emits
  `run_started`, executes steps (`navigate`/`click`/`type`/... via Playwright
  against `/sandbox/*` pages; `api` via `GhlClient`), appends every event to
  SQLite **and** broadcasts it, then `run_completed`/`run_failed`. Pause is
  honored between steps; abort marks the run and stops before the next step
  (a run aborted while still queued is never started).
- **`src/template.ts`** — pure helpers: `{{var}}` interpolation (dotted
  paths), RFC-6901-style JSON pointer lookup, and `save` mappings that copy
  values from API responses into run variables.
- **`src/steps.ts`** — pure step helpers lifted out of the runner so they are
  unit-testable without Playwright: sandbox-page path, default audit severity,
  `wait` duration parsing (explicit `0` honored, negatives clamped), and
  assert-step evaluation (`equals`/`contains`/`greaterThan`; the numeric
  comparison parses decimals on both sides).
- **`src/db.ts`** — better-sqlite3 (WAL). Tables: `runs`, `events`
  (append-only log, FK to runs, enforced), `kv` (integration store).
- **`src/sse.ts`** — `RunSseHub`, a per-run set of connected SSE clients.
- **`src/ghl/`** — GoHighLevel integration:
  - `client.ts` — `GhlClient.request()` against
    `backend.leadconnectorhq.com` with browser-like headers. Retry policy:
    429/5xx and network errors retry with exponential backoff (honors numeric
    `Retry-After`, capped; HTTP-date values fall back to backoff); 4xx fail
    immediately; a 2xx body that isn't JSON throws `GhlParseError` and is
    **never** retried (a successful POST must not be re-sent). Exhausted
    retries rethrow the last `GhlHttpError` so callers see the real status.
  - `integration.ts` — token storage in `kv` plus `redactGhlIntegration`
    (status endpoint never returns tokens).
  - `bridgePage.ts` — the `/api/integrations/ghl/bridge` page with a
    bookmarklet that captures the operator's own GHL session token and POSTs
    it to the local server (dev/demo only; CORS-restricted to GHL origins).
  - `locations.ts` — parses `/locations/search` responses for
    auto-selecting a location.

### Run lifecycle

`queued → running ⇄ paused → completed | failed | aborted`

All state transitions are persisted to `runs` and mirrored as events in
`events`, so an SSE reconnect can replay the full history (`/events` replays
then streams; registration and replay happen in one synchronous block, so no
event is lost or duplicated in between).

## Frontend (`src/`)

React 19 + Vite + Tailwind. State is split so the logic is testable without a
DOM:

- **`context/automationReducer.ts`** — the pure reducer + initial state. Holds
  steps and the derived `ExecutionState` (status, per-step statuses, audit log,
  cursor/typing/flash hints). `context/AutomationContext.tsx` is now just the
  React glue (contexts + provider) around it.
- **`hooks/runController.ts`** — `RunController`, a framework-agnostic object
  that owns one backend run's imperative lifecycle (create → stream →
  pause/resume → abort). Its network/stream dependencies are injected, so it is
  unit-tested with fakes. `eventToActions`/`isTerminalEvent` are the pure
  SSE-event → reducer-action translation. Invariant: every teardown path
  (terminal event, stream error, **and** explicit abort) resets the internal
  `started` guard — otherwise the next run is silently blocked.
- **`hooks/useAutomationEngine.ts`** — the thin React adapter: creates the
  controller once, mirrors UI status onto it, and supplies the real `fetch`
  (`POST /api/runs`, pause/resume/abort) and `EventSource` stream.

Components: step builder (left), simulated browser viewport (center), audit
trail (right). Scenarios live in `src/data/` (currently the MaxLevel GHL
lead-intake workflow).

## Testing

`npm test` runs `node:test` via tsx (no extra test framework) over both
`server/test/**` and `src/**/*.test.ts`:

- **Server:** pure helpers (`template`, and `steps` — the `wait` parsing and
  the assert-step `equals`/`contains`/`greaterThan` evaluation), the SQLite
  layer, zod schemas, `GhlClient` retry behavior (mocked `fetch`), HTTP routes
  (`app.inject()` with a fake runner) plus the SSE `/events` route against a
  live server (history replays, then live broadcasts stream, in order, with no
  duplication), and real `Runner` lifecycle tests using wait-only steps (no
  browser needed).
- **Frontend:** the full `automationReducer` action surface, and the
  `RunController` lifecycle (incl. the regression where stopping a run wedged
  the next "Execute") plus `eventToActions`/`isTerminalEvent` — all with fakes,
  no DOM.

Type-checking is split across `tsc -b` project references:
`tsconfig.server.json` (server src + tests), `tsconfig.app.json` (UI, excluding
tests), and `tsconfig.test.json` (the frontend `*.test.ts`, which need node
types). All are part of `npm run build`.

## Conventions

- The server is ESM TypeScript executed by `tsx`; no emit.
- `data/` (SQLite, artifacts, captured tokens) is gitignored and must stay so.
- Events are append-only; UI state is derived from the event stream, never
  simulated client-side.
