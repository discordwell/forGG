# Claudepad

## Session Summaries

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
  stage it.
