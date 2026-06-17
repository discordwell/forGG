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
    // Self-heal: drop clients whose socket is gone so a dead connection stops
    // getting writes even if its route 'close' handler never fired, and can't
    // wedge delivery to the healthy clients on the run. On a dead socket
    // `write()` returns false rather than throwing, so `destroyed` is the
    // reliable signal — `write() === false` alone is NOT (that is also normal
    // backpressure on a live client). The catch still covers the rarer
    // synchronous throw (e.g. writing after the stream ended). Collect the dead
    // and remove them after iterating so the Set isn't mutated mid-iteration.
    let dead: SseClient[] | null = null;
    for (const client of set) {
      if (client.res.destroyed) {
        (dead ??= []).push(client);
        continue;
      }
      try {
        client.res.write(payload);
      } catch {
        (dead ??= []).push(client);
      }
    }
    if (dead) for (const client of dead) this.remove(runId, client);
  }
}

