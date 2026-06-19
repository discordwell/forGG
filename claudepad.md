# Claudepad

## Session Summaries

### 2026-06-19 ~06:34 UTC — Real browser-step runner coverage + greaterThan negative-number bugfix
- **Bug fixed (with regression tests):** the `greaterThan` assert stripped a
  leading minus sign (`cleanNumber` kept only `[0-9.]`), so `-3 > -5` was
  evaluated as `3 > 5` and wrongly failed, and `-1 > 0` wrongly passed.
  Reachable via the public `POST /api/runs` (any `assertion`/`value` string).
  Fix: `cleanNumber` now detects a minus *before the first digit*
  (`s.split(/[0-9]/, 1)[0].includes('-')`) and negates the magnitude. All
  prior behavior is preserved — thousands collapse (`"$1,200.50"`→1200.5),
  no-digit→0, malformed→NaN (still hits the "uncomparable" branch). Same
  `greaterThan` feature a prior session fixed for decimals; this closes the
  negative case. 2 new `steps.test.ts` tests (cleanNumber signs + a negative
  `evaluateAssertion` comparison).
- **Biggest test gap closed:** the runner's *entire* Playwright step path
  (navigate/extract/assert/type/click/select/scroll/screenshot) — the literal
  heart of the product — had **zero** coverage (only wait-only and mocked-`api`
  runs were tested). New `server/test/runner-browser.test.ts` drives a real
  headless Chromium against a self-contained fixture page served by a throwaway
  `node:http` server (Runner `origin` pointed at it), asserting the full event
  trail, all-passed step statuses, the extracted DOM text, and that the
  screenshot artifact is actually written to disk — plus a failed-assert run
  that ends `run_failed` (real reason `expected 42 > 100`) and never reaches the
  trailing step. Self-skips (node:test `{ skip }`) when no Chromium binary is
  present, so the fast default suite stays runnable everywhere. Stable across 5
  back-to-back runs; full run ~1.3s, failure path ~0.2s.
- **Verified:** typecheck (4 projects), lint, **143/143 tests** (was 139; +4),
  full build. An adversarial code-review subagent **monkeypatched
  `chromium.launch`** to prove the failure test genuinely launches a browser
  (called exactly once; the `42` in the error can only come from reading the
  live DOM) and confirmed the skip guard *skips* rather than silently passing —
  no issues found. Docs updated (ARCHITECTURE testing + steps note, README test
  note that browser tests auto-skip).

### 2026-06-18 ~13:00 UTC — GHL location-shape bugfix + component-logic extraction (UI now tested without a DOM)
- **Bug fixed (with regression test):** the header's GHL location dropdown
  silently dropped any location that arrived with `id` instead of `_id`. The
  client's local `isGhlLocation` required a string `_id`, but the **server**
  (`firstLocationFromSearchResponse`) accepts either `_id` or `id` and will
  happily auto-select an `id`-only location — so a connected user could see a
  location auto-selected yet have an empty/incomplete dropdown and be unable to
  switch. Fix: new `src/lib/ghlLocations.ts::parseGhlLocations` mirrors the
  server's tolerance (`_id` **or** `id`, bare array **or** `{ locations: [...] }`
  envelope), normalizes every entry to a single `id`, and rejects non-string
  name/timezone. `Header.tsx` imports it and renders `l.id`. 7 new tests incl.
  the previously-broken `id`-only case.
- **Component logic extracted + tested (no new deps, no DOM)** — same
  "pure logic out, `.tsx` stays thin glue" pattern as the reducer/runController:
  - `pages/maxLevelOps.logic.ts`: `statusPillClass` + `deriveSavedEntities`
    (collapses `save` mappings across the audit log, newest-wins). Hardened the
    newest-wins guard from a **truthiness** check (`if (out[k])`) to a
    **key-presence** check, so an explicit `""` from the newest step is no longer
    silently replaced by an older value (no change for real GHL IDs/emails; the
    display coalesces `''` to `—` either way). 8 tests.
  - `components/audit-trail/auditSummary.logic.ts`: `summarizeRun` →
    passed/total/allPassed/durationSec. Added a `Math.max(0, …)` duration clamp
    (matches `MaxLevelOpsPage`; only affects impossible end-before-start). 7 tests.
- **Verified:** typecheck (4 projects), lint, **139/139 tests** (was 117; +22),
  full build. Two independent adversarial code-review subagents found **no
  issues** (confirmed: no stale `_id`/old-symbol consumers; the two behavior
  tweaks are intentional + tested; the client and server `GhlLocation` types
  intentionally diverge — separate modules, no shared import).

### 2026-06-17 ~21:30 UTC — Failed runs now render as "error" (red), not green "completed"
- **Bug fixed (with tests + browser wet test):** a failed backend run displayed
  as a successful green "completed" in the Header and Ops Console. The `'error'`
  member of `ExecutionState['status']` existed in the type but was never set:
  `eventToActions` mapped BOTH `run_completed` and `run_failed` to
  `COMPLETE_EXECUTION` → `status: 'completed'`. Only `AuditSummary` (which derives
  PASSED/FAILED from per-step statuses) showed the failure; the top-level status
  read as success.
- **Fix:** added a distinct `FAIL_EXECUTION` action (reducer → `status: 'error'`,
  `endTime`); `run_failed` now maps to it. Wired `'error'` through every
  `execution.status` consumer that special-cased `'completed'`: Header icon
  (red), `PlaybackControls.isIdle` (so Execute/re-run reappears), `AuditSummary`
  + `AuditTrailPanel` render gates, and `MaxLevelOpsPage.classForStatus`
  (`error`→red, `completed`→emerald). Also hardened `AuditSummary`'s `endTime!`
  into a real `startTime && endTime` guard and relabeled its timestamp
  "Completed"→"Finished" (accurate for both terminal states).
- Tests: new `FAIL_EXECUTION` reducer test (status `error`, end time, preserves
  stepStatuses + auditLog); updated the `eventToActions` test to expect
  `run_failed` → `FAIL_EXECUTION`. 117/117 pass.
- **Wet test (token-free, isolated):** ran `buildApp` on a throwaway temp data
  dir (no GHL token → the first `api` step fails fast, real account untouched)
  on :8787 + vite on :5173, drove it headless with Playwright. A failed run
  renders header status "Error" with `text-red-500` (and zero `text-green-500`),
  red Ops-Console pill, "Runbook FAILED" summary, the Execute button returns for
  re-run, and **0 console/page errors**.
- Verified: typecheck (4 projects), lint, 117/117 tests, full build, a 3-finder
  Explore pass + a 1-vote adversarial code-review subagent (no findings).

### 2026-06-17 ~20:26 UTC — listRuns non-integer-limit 500 fix; SSE hub tests + correct dead-client pruning
- Landed the prior WIP first (steps.ts extraction + greaterThan fix + SSE route
  test) as its own commit, and removed a stray root-level `leak_probe.test.ts`
  debug file (always asserted true; not in any test/tsconfig glob).
- **Bug fixed (with regression tests):** `GET /api/runs?limit=<non-integer>`
  returned 500. `db.listRuns` clamped but never floored, so a float `LIMIT`
  (e.g. `2.5`) reached SQLite and threw `datatype mismatch`. Confirmed via a
  raw better-sqlite3 probe (float/NaN LIMIT throws; negatives/0 were already
  absorbed by the clamp). Fix: `listRuns` now `Math.floor`s and falls back to
  the default page size for a non-finite value. Extracted `DEFAULT_RUN_LIMIT`
  (25) / `MAX_RUN_LIMIT` (200) constants; the route imports the default and
  drops its now-redundant `Number.isFinite` re-guard (db owns floor+clamp+NaN).
- Added `server/test/sse.test.ts` (8 tests) — the first **direct** `RunSseHub`
  coverage (was only exercised indirectly): SSE wire format, per-run fan-out,
  Set-dedup, idempotent `remove`, last-client teardown, and dead-client pruning.
- **SSE robustness (code-review driven):** `broadcast` now self-heals by
  pruning dead clients — but keyed on `res.destroyed`, NOT a thrown write. A
  first attempt pruned on a `write()` throw; a runtime probe (Node 25.8.1)
  proved `write()` on a dead socket returns `false` (no throw), so that catch
  never fired. `write() === false` alone is unusable (it's also backpressure);
  `destroyed` is the reliable signal. The `catch` is kept for the rarer
  write-after-end throw. Dead clients are collected and removed after iterating
  (no mutate-during-iteration).
- Verified: typecheck (4 projects), lint, 116/116 tests, full build. A 3-angle
  code-review subagent pass caught the prune-on-throw no-op before commit.

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

- `db.listRuns` binds its argument to a SQLite `LIMIT`, which **requires an
  integer** — a float or `NaN` throws "datatype mismatch" (negatives/0 are fine,
  SQLite treats <0 as no-limit but the `Math.max(1, …)` clamp handles that). The
  query-param route must therefore floor before binding. `DEFAULT_RUN_LIMIT`/
  `MAX_RUN_LIMIT` live in `server/src/db.ts`; the db owns floor+clamp+NaN-default
  so the route just forwards `Number(limitRaw)`.
- Node `ServerResponse.write()` on a **dead/destroyed** socket returns `false`
  and does **not** throw (verified on Node 25.8.1); it only throws for things
  like write-after-end. So to reap dead SSE clients in `RunSseHub.broadcast`,
  check `res.destroyed` — never treat `write() === false` as dead (that is also
  normal backpressure on a healthy client). The route's `req.raw.on('close')`
  handler is still the primary reaper; broadcast pruning is belt-and-suspenders.

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
  reducer is pure, `RunController` takes injected `postJson`/`openStream` deps,
  and per-component derivations live in sibling `*.logic.ts` modules
  (`pages/maxLevelOps.logic.ts`, `components/audit-trail/auditSummary.logic.ts`)
  with the `.tsx` as thin glue. Tests run under `tsconfig.test.json` (node types
  + DOM lib). The `npm test` glob is `src/**/*.test.ts` (note: `.ts`, not
  `.tsx`), so keep extracted logic + its test in `.ts` files.
- GHL `/locations/search` responses are parsed in TWO places that must stay in
  sync: the server (`server/src/ghl/locations.ts::firstLocationFromSearchResponse`,
  used for auto-selecting a location) and the client (`src/lib/ghlLocations.ts::
  parseGhlLocations`, used for the header dropdown). Both must tolerate a
  location id as either `_id` (captured internal `backend.leadconnectorhq.com`
  shape) **or** `id` (public v2 shape), and a bare array **or** a
  `{ locations: [...] }` envelope. They are separate modules (no cross-boundary
  import) with intentionally divergent return types — the server returns just
  the first `{ id, name }`; the client normalizes the whole list to `{ id }`.
- A run has TWO distinct terminal statuses: `completed` (`COMPLETE_EXECUTION`,
  from `run_completed`) and `error` (`FAIL_EXECUTION`, from `run_failed`). Both
  set `endTime` and preserve per-step statuses + the audit log. Any UI that
  special-cases `completed` (terminal-ness, "Execute"/re-run gating, summary
  rendering, success styling) must handle `error` too. Consumers that only branch
  on `running`/`paused` (keyboard shortcuts, `isRunning` disables, the engine's
  start/pause/abort effects) need no `error` branch — `error` is non-running and
  non-idle, so they behave like they did for `completed`. The backend guarantees
  a `step_status:'failed'` precedes every `run_failed`, so the FAILED summary is
  always correct (never a green PASSED on a failed run).
- The runner's browser-step path is covered by `server/test/runner-browser.test.ts`
  WITHOUT the rest of the app: a throwaway `node:http` server returns a fixture
  page for any `/sandbox/*` request, and a `Runner` is constructed with its
  `origin` pointed at that server (so `navigate` builds
  `http://127.0.0.1:<port>/sandbox/<page>.html`). No Fastify needed — sidesteps
  the chicken-and-egg of "Runner needs the origin, which needs the listen port."
  The browser is owned by `Runner.runOne`'s `finally`, so it's already closed
  by the time a terminal DB status is observed; the test's own `finally` only
  tears down the http server, db, and temp dir. The test `{ skip }`s when
  `chromium.executablePath()` doesn't exist on disk, so the default `npm test`
  stays browser-free where no binary is installed but gains real coverage where
  one is. Keep speed high (e.g. `enqueue(..., 8)`) to shrink the runner's
  artificial per-step `delay()`s.
