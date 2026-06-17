# forGG

Full-stack “runbook execution” web app:

- React UI to author/run step-based automations
- Fastify API + SQLite event store
- Background runner (Playwright) that executes against local sandbox pages
- Live run events streamed over SSE (audit log + artifacts)

## Dev

```bash
npm install
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:8787`

The Vite dev server proxies `/api/*` and `/artifacts/*` to the API server.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the pieces fit together.

## Test

```bash
npm test          # server unit + API tests (node:test via tsx, no browser needed)
npm run typecheck # type-check UI, server, and tests (also part of `npm run build`)
npm run lint
```

## What Makes It “Real”

- Runs are persisted in `./data/forgg.sqlite`
- Screenshots are written to `./data/artifacts/<runId>/...`
- The UI is driven by server events (not a client-side simulation loop)

## GoHighLevel (MaxLevel) Demo Workflow

This repo includes a **real** GoHighLevel workflow (API calls executed server-side) to demo MaxLevel-style interoperability.

1. Start dev: `npm run dev`
2. Open the web UI: `http://localhost:5173`
3. In the header, click `Bridge` (opens `/api/integrations/ghl/bridge`).
4. Drag the bookmarklet to your bookmarks bar.
5. Log into `https://app.gohighlevel.com` (your own account) and click the bookmarklet.
6. Run the `MaxLevel — Lead Intake (GoHighLevel)` scenario.

Notes:
- The captured session token is stored locally in `./data/forgg.sqlite` (dev/demo only).
- You can disconnect via the `X` button in the header.

## Build

```bash
npm run build
npm run preview
```
