import type { ServerResponse } from 'node:http';

export interface SseClient {
  id: string;
  res: ServerResponse;
}

export class RunSseHub {
  private readonly byRunId = new Map<string, Set<SseClient>>();

  add(runId: string, client: SseClient) {
    const set = this.byRunId.get(runId) ?? new Set<SseClient>();
    set.add(client);
    this.byRunId.set(runId, set);
  }

  remove(runId: string, client: SseClient) {
    const set = this.byRunId.get(runId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) this.byRunId.delete(runId);
  }

  broadcast(runId: string, data: unknown) {
    const set = this.byRunId.get(runId);
    if (!set) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of set) {
      try {
        client.res.write(payload);
      } catch {
        // ignore
      }
    }
  }
}

