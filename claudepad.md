# Claudepad

## Session Summaries

### 2026-06-17 ~14:06 UTC — Runner step-logic extraction; greaterThan bug fix; SSE route test
- Extracted the runner's pure step helpers into `server/src/steps.ts` (mirrors
  `template.ts`/`locations.ts`): `sandboxPathForPageKey`, `severityForStep`,
  `parseWaitMs`, `cleanNumber`, and `evaluateAssertion`. `runner.ts` now imports
  them; `assertForStep` does the page I/O then delegates the comparison. Pure,
  behavior-preserving refactor — all 96 prior tests stayed green.
- **Bug fixed (with regression test):** the `greaterThan` assert stripped the
  decimal point from the *threshold* only (`/[^0-9]/g`) while keeping it in the
  *actual* (`/[^0-9.]/g`), so `"> 1.5"` became `15` and `2 > 1.5` wrongly
  failed. `cleanNumber` now parses decimals on both sides. Reachable via the
  public `POST /api/runs` (schema allows any `assertion` string).
- Added `server/test/steps.test.ts` (10 tests): sandbox path, severity, wait
  parsing (explicit 0 / negatives / units / fallbacks), `cleanNumber`, and all
  three assertion modes incl. the decimal regression and the unsupported path.
- Added `server/test/events-sse.test.ts` (2 tests) — the previously-untested
  `GET /api/runs/:id/events` route, against a **live** `app.listen({port:0})`
  server with a raw HTTP SSE reader: history replays, a post-connect
  `hub.broadcast` streams live, ordering is history-before-live, history is not
  duplicated; plus the 404 path. Verified stable across 5 back-to-back runs.
- Verified: typecheck (4 projects), lint, 108/108 tests, full build.

### 2026-06-17 ~04:40 UTC — Landed test-suite WIP; frontend testability + run-lifecycle bugfix
- Committed the prior uncommitted WIP (server test suite + testability refactor
  + GhlClient/Runner bug fixes) as its own clean commit after verifying it
  (55 tests, typecheck, lint).
- Extended testing to the frontend (previously 0 frontend tests):
  - Extracted the pure `automationReducer` (+ `createInitialExecution`,
    `initialState`) into `src/context/automationReducer.ts`; `AutomationContext`
    is now thin React glue. Added 24 reducer tests (every action; index/status
    sync on add/remove/reorder; clamping; speed preservation; no-mutation).
  - Extracted the imperative run lifecycle out of `useAutomationEngine` into a
    pure, dependency-injected `RunController` (`src/hooks/runController.ts`)
    plus pure `eventToActions`/`isTerminalEvent`. Added 21 controller/event
    tests.
- **Bug fixed (with regression test):** the Stop path (`abortRemoteRun`) closed
  the SSE stream but never reset the `started` guard — and since the stream was
  closed, the `run_aborted` event that would have reset it never arrived. Result:
  after Stop, the next "Execute" was silently ignored and the UI hung in
  "running". `RunController.abort()` now tears down (incl. `started`)
  synchronously before firing the abort POST; the create-gap race is handled too.
- Wired `src/**/*.test.ts` into `npm test` and added `tsconfig.test.json` to the
  `tsc -b` references (app tsconfig now excludes `*.test.ts`). 95 tests total.
- Verified: typecheck (4 projects), lint, 95/95 tests, full build, and a browser
  wet test (Playwright, headless) against a **token-free temp data dir** so the
  real GHL account was never touched: app renders with 0 console/page errors,
  Execute drives `POST /api/runs` + SSE, run reaches terminal, and a second
  Execute starts a fresh run (re-run path).

### 2026-06-11 ~04:55 UTC — Test suite, server testability refactor, bug fixes
- Added the repo's first test suite: 54 `node:test` tests run via `npm test`
  (`node --import tsx --test`), no new runtime deps. Covers template helpers,
  SQLite layer, zod schemas, GhlClient retry policy (mocked fetch), HTTP routes
  (`app.inject` + fake runner), and real Runner lifecycle with wait-only steps.
- Refactored for testability: `server/src/app.ts` (`buildApp()` with injected
  deps, `RunnerLike` interface), `server/src/template.ts` (pure helpers out of
  runner.ts), `server/src/ghl/locations.ts`. `index.ts` is now a thin entrypoint.
- Wired server type-checking into the build (`tsconfig.server.json` in `tsc -b`
  references; added `@types/better-sqlite3`); fixed the latent strict-mode
  errors it surfaced (closure narrowing for `step.target` / `step.api`).
- Bug fixes (each with a regression test):
  - Runner: aborting a still-queued run no longer flips it back to `running`.
  - GhlClient: non-JSON 2xx response no longer retried (was re-sending POSTs →
    duplicate contacts); throws `GhlParseError` instead.
  - GhlClient: HTTP-date `Retry-After` no longer becomes `sleep(NaN)`; numeric
    values capped at 15s.
  - GhlClient: exhausted 429/5xx retries now rethrow the last `GhlHttpError`
    (real status) instead of a generic error.
  - `/api/integrations/ghl/locations` maps upstream GHL failures to 502 instead
    of a raw 500.
- Removed dead `RunSseHub.keepAlive`. Added ARCHITECTURE.md, README test docs.
- Verified: lint, typecheck, full build, 54/54 tests, and a live boot smoke
  test (healthz/bridge/status/run-create on PORT=18787).

## Key Findings

- Assert-step semantics live in `server/src/steps.ts::evaluateAssertion`
  (`equals` default, `contains`, `greaterThan`). The `assertion` field is only
  settable via the API (`POST /api/runs`) — the StepCard UI exposes type/label/
  target/value but not the assertion selector. `greaterThan` extracts a number
  with `cleanNumber` (digits + `.`), so no-digit text → `0` (comparable, not an
  error) and only a malformed number like `"1.2.3"` → NaN → "unable to compare".
- The server runs via `tsx` (no type checking at runtime); before this session
  `tsc -b` covered only `src/` and `vite.config.ts`. Server type-checking now
  lives in `tsconfig.server.json` — keep it in the root references.
- `tsconfig.server.json` deliberately omits `erasableSyntaxOnly` (server uses
  constructor parameter properties) and includes `DOM` lib (Playwright
  `page.evaluate` callbacks).
- better-sqlite3 enforces foreign keys by default: `events.run_id` must
  reference an existing run, so always `createRun` before `addEvent`.
- Runner steps only launch Chromium for browser step types; `wait`-only runs
  never touch Playwright — that's what makes the Runner tests fast/headless.
- The GHL integration (token in `data/forgg.sqlite` kv table) is the
  operator's own session token; `/api/integrations/ghl/status` must keep using
  `redactGhlIntegration` so tokens never leave the box.
- `data/` holds local capture scripts and the sqlite db — gitignored, never
  stage it. It also holds the operator's **live** GHL session token, so never
  execute the runbook against the default data dir in a test; point a throwaway
  API at a fresh temp cwd (token-free → the `api` step fails fast before any
  fetch) when wet-testing the run lifecycle.
- eslint-plugin-react-hooks v7 enables the React-Compiler `react-hooks/refs`
  rule: no reading/writing `ref.current` during render. Keep "latest value"
  refs updated inside an effect, and create once-only instances with a lazy
  `useState(() => …)` initializer (not a `ref.current ??=` assignment, which the
  rule rejects). Don't close a `ref` into a constructor either — have the object
  expose a setter the hook calls from an effect (see `RunController.syncStatus`).
- Frontend logic is tested without a DOM by keeping it framework-free: the
  reducer is pure, and `RunController` takes injected `postJson`/`openStream`
  deps. Tests run under `tsconfig.test.json` (node types + DOM lib).
