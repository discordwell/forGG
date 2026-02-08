import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { openDb } from './db';
import { RunSseHub } from './sse';
import { Runner } from './runner';
import { CreateRunSchema } from './validate';

const PORT = Number(process.env.PORT ?? '8787');
const HOST = process.env.HOST ?? '127.0.0.1';

const dataDir = path.join(process.cwd(), 'data');
const artifactsDir = path.join(dataDir, 'artifacts');
const sandboxDir = path.join(process.cwd(), 'server', 'sandbox');

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(sandboxDir, { recursive: true });

const db = openDb({ dataDir });
const hub = new RunSseHub();

function originForHost(host: string, port: number) {
  const h = host === '0.0.0.0' ? '127.0.0.1' : host;
  return `http://${h}:${port}`;
}

const runner = new Runner(db, hub, { artifactsDir, origin: originForHost(HOST, PORT) });

const app = Fastify({ logger: false });

app.get('/healthz', async () => ({ ok: true }));

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
  const limit = limitRaw ? Number(limitRaw) : 25;
  return db.listRuns(Number.isFinite(limit) ? limit : 25);
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

async function main() {
  await app.listen({ port: PORT, host: HOST });
  console.log(`api listening on ${originForHost(HOST, PORT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
