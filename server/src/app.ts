import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { DEFAULT_RUN_LIMIT, type Db } from './db';
import type { RunSseHub } from './sse';
import type { AutomationStep } from './types';
import { CreateRunSchema } from './validate';
import { ghlBridgePage } from './ghl/bridgePage';
import {
  clearGhlIntegration,
  getGhlIntegration,
  redactGhlIntegration,
  setGhlIntegration,
} from './ghl/integration';
import { GhlClient, GhlHttpError } from './ghl/client';

const ALLOWED_GHL_ORIGINS = new Set(['https://app.gohighlevel.com', 'https://app.leadconnectorhq.com']);

const GhlTokenSchema = z.object({
  authToken: z.string().min(1),
  tokenId: z.string().optional(),
  companyId: z.string().optional(),
  userId: z.string().optional(),
  locationId: z.string().optional(),
});

const GhlLocationSchema = z.object({ locationId: z.string().min(1) });

function applyGhlTokenCors(reply: FastifyReply, origin: string | undefined) {
  if (origin && ALLOWED_GHL_ORIGINS.has(origin)) reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network');
  // Private Network Access (Chrome): allow https://app.gohighlevel.com -> http://localhost
  reply.header('Access-Control-Allow-Private-Network', 'true');
}

/** The subset of Runner the HTTP layer needs; tests can inject a fake. */
export interface RunnerLike {
  enqueue(runId: string, steps: AutomationStep[], speed: number): void;
  pause(runId: string): void;
  resume(runId: string): void;
  abort(runId: string): void;
}

export interface BuildAppOpts {
  db: Db;
  hub: RunSseHub;
  runner: RunnerLike;
  artifactsDir: string;
  sandboxDir: string;
  /** Fallback port for the bridge page when the Host header is missing. */
  defaultPort?: number;
}

export function buildApp(opts: BuildAppOpts): FastifyInstance {
  const { db, hub, runner, artifactsDir, sandboxDir } = opts;
  const defaultPort = opts.defaultPort ?? 8787;

  const app = Fastify({ logger: false });

  app.get('/healthz', async () => ({ ok: true }));

  // -------------------------------------------------------------------------
  // Integrations: GoHighLevel (GHL)
  // -------------------------------------------------------------------------

  app.get('/api/integrations/ghl/status', async () => {
    return redactGhlIntegration(getGhlIntegration(db));
  });

  app.get('/api/integrations/ghl/bridge', async (req, reply) => {
    const host = req.headers.host || `127.0.0.1:${defaultPort}`;
    const postUrl = `http://${host}/api/integrations/ghl/token`;
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(ghlBridgePage({ postUrl }));
  });

  app.options('/api/integrations/ghl/token', async (req, reply) => {
    applyGhlTokenCors(reply, req.headers.origin);
    return reply.code(204).send();
  });

  app.post('/api/integrations/ghl/token', async (req, reply) => {
    const parsed = GhlTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
    }

    const { authToken, tokenId, companyId, userId, locationId } = parsed.data;
    setGhlIntegration(db, {
      accessToken: authToken,
      // Empty strings from the bookmarklet mean "not found" — store undefined.
      tokenId: tokenId || undefined,
      companyId: companyId || undefined,
      userId: userId || undefined,
      locationId: locationId || undefined,
      capturedAt: Date.now(),
    });

    applyGhlTokenCors(reply, req.headers.origin);
    return reply.send({ ok: true });
  });

  app.get('/api/integrations/ghl/locations', async (_req, reply) => {
    const integration = getGhlIntegration(db);
    if (!integration?.companyId) return reply.code(400).send({ error: 'missing_company_id' });
    const ghl = new GhlClient(integration);
    try {
      const res = await ghl.request({ method: 'GET', path: '/locations/search', query: { companyId: integration.companyId } });
      return res.data;
    } catch (err) {
      if (err instanceof GhlHttpError) {
        return reply.code(502).send({ error: 'ghl_error', status: err.status, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/integrations/ghl/location', async (req, reply) => {
    const parsed = GhlLocationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
    const integration = getGhlIntegration(db);
    if (!integration) return reply.code(400).send({ error: 'not_connected' });
    setGhlIntegration(db, { ...integration, locationId: parsed.data.locationId });
    return reply.send({ ok: true });
  });

  app.delete('/api/integrations/ghl', async (_req, reply) => {
    clearGhlIntegration(db);
    return reply.send({ ok: true });
  });

  app.register(fastifyStatic, {
    root: artifactsDir,
    prefix: '/artifacts/',
    decorateReply: false,
  });

  app.register(fastifyStatic, {
    root: sandboxDir,
    prefix: '/sandbox/',
    decorateReply: false,
  });

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  app.post('/api/runs', async (req, reply) => {
    const parsed = CreateRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', issues: parsed.error.issues });
    }

    const runId = nanoid();
    const stepsJson = JSON.stringify(parsed.data.steps);
    db.createRun({ id: runId, stepsJson });

    runner.enqueue(runId, parsed.data.steps, parsed.data.speed ?? 1);
    return reply.code(201).send({ runId });
  });

  app.post('/api/runs/:runId/pause', async (req, reply) => {
    const runId = (req.params as { runId: string }).runId;
    const run = db.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'not_found' });
    runner.pause(runId);
    return { ok: true };
  });

  app.post('/api/runs/:runId/resume', async (req, reply) => {
    const runId = (req.params as { runId: string }).runId;
    const run = db.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'not_found' });
    runner.resume(runId);
    return { ok: true };
  });

  app.post('/api/runs/:runId/abort', async (req, reply) => {
    const runId = (req.params as { runId: string }).runId;
    const run = db.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'not_found' });
    runner.abort(runId);
    return { ok: true };
  });

  app.get('/api/runs', async (req) => {
    const limitRaw = (req.query as { limit?: string }).limit;
    // `db.listRuns` floors, clamps, and defaults a non-finite value, so any
    // query string (e.g. ?limit=2.5 or ?limit=abc) is safe to forward.
    return db.listRuns(limitRaw ? Number(limitRaw) : DEFAULT_RUN_LIMIT);
  });

  app.get('/api/runs/:runId', async (req, reply) => {
    const runId = (req.params as { runId: string }).runId;
    const run = db.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'not_found' });
    return run;
  });

  app.get('/api/runs/:runId/events.json', async (req, reply) => {
    const runId = (req.params as { runId: string }).runId;
    const run = db.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'not_found' });
    const events = db.listEvents(runId).map((e) => JSON.parse(e.payloadJson));
    return { runId, events };
  });

  app.get('/api/runs/:runId/events', async (req, reply) => {
    const runId = (req.params as { runId: string }).runId;
    const run = db.getRun(runId);
    if (!run) return reply.code(404).send({ error: 'not_found' });

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    // Flush headers for Node.
    reply.raw.write(`: connected\n\n`);

    // Register the client and replay history in the same synchronous block:
    // broadcasts also happen synchronously on this thread, so no live event
    // can interleave with (or be missed during) the replay.
    const clientId = nanoid();
    const client = { id: clientId, res: reply.raw };
    hub.add(runId, client);

    // Replay existing events so the UI can reconnect.
    const existing = db.listEvents(runId);
    for (const ev of existing) {
      try {
        reply.raw.write(`data: ${ev.payloadJson}\n\n`);
      } catch {
        // ignore
      }
    }

    const interval = setInterval(() => {
      try {
        reply.raw.write(`: ping\n\n`);
      } catch {
        // ignore
      }
    }, 15000);
    req.raw.on('close', () => {
      clearInterval(interval);
      hub.remove(runId, client);
    });

    return reply;
  });

  return app;
}
