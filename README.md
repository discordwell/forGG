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

## What Makes It “Real”

- Runs are persisted in `./data/forgg.sqlite`
- Screenshots are written to `./data/artifacts/<runId>/...`
- The UI is driven by server events (not a client-side simulation loop)

## Build

```bash
npm run build
npm run preview
```

