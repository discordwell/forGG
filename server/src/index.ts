import path from 'node:path';
import fs from 'node:fs';
import { openDb } from './db';
import { RunSseHub } from './sse';
import { Runner } from './runner';
import { buildApp } from './app';

const PORT = Number(process.env.PORT ?? '8787');
const HOST = process.env.HOST ?? '127.0.0.1';

const dataDir = path.join(process.cwd(), 'data');
const artifactsDir = path.join(dataDir, 'artifacts');
const sandboxDir = path.join(process.cwd(), 'server', 'sandbox');

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(sandboxDir, { recursive: true });

function originForHost(host: string, port: number) {
  const h = host === '0.0.0.0' ? '127.0.0.1' : host;
  return `http://${h}:${port}`;
}

const db = openDb({ dataDir });
const hub = new RunSseHub();
const runner = new Runner(db, hub, { artifactsDir, origin: originForHost(HOST, PORT) });
const app = buildApp({ db, hub, runner, artifactsDir, sandboxDir, defaultPort: PORT });

async function main() {
  await app.listen({ port: PORT, host: HOST });
  console.log(`api listening on ${originForHost(HOST, PORT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
