import type { GhlIntegration } from './types';

export class GhlHttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly bodyText: string;

  constructor(args: { status: number; url: string; bodyText: string }) {
    const snippet = (args.bodyText || '').trim().slice(0, 600);
    super(`GHL request failed (${args.status})${snippet ? `: ${snippet}` : ''}`);
    this.status = args.status;
    this.url = args.url;
    this.bodyText = args.bodyText;
  }
}

const BASE_URL = 'https://backend.leadconnectorhq.com';

const REQUIRED_HEADERS: Record<string, string> = {
  version: '2021-07-28',
  channel: 'APP',
  source: 'WEB_USER',
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 599);
}

function jitter(ms: number) {
  const j = Math.floor(Math.random() * Math.min(250, ms));
  return ms + j;
}

function isAbortError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

export interface GhlRequestArgs {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
}

export class GhlClient {
  constructor(private readonly integration: GhlIntegration) {}

  async request<T = unknown>(args: GhlRequestArgs): Promise<{ status: number; data: T; url: string }> {
    const url = new URL(args.path.startsWith('/') ? `${BASE_URL}${args.path}` : `${BASE_URL}/${args.path}`);
    for (const [k, v] of Object.entries(args.query ?? {})) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.integration.accessToken}`,
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      ...REQUIRED_HEADERS,
    };

    let attempt = 0;
    let lastErr: unknown = null;
    const maxAttempts = 5;
    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timeoutMs = args.timeoutMs ?? 30_000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: args.method,
          headers,
          body: args.body === undefined ? undefined : JSON.stringify(args.body),
          signal: controller.signal,
        });

        const text = await res.text().catch(() => '');
        if (!res.ok) {
          if (isRetryableStatus(res.status)) {
            const retryAfter = res.headers.get('retry-after');
            const baseDelay = Math.min(4000, 250 * 2 ** (attempt - 1));
            const waitMs = retryAfter ? Number(retryAfter) * 1000 : jitter(baseDelay);
            await sleep(waitMs);
            continue;
          }
          throw new GhlHttpError({ status: res.status, url: url.toString(), bodyText: text });
        }

        const data = (text ? (JSON.parse(text) as T) : ({} as T));
        return { status: res.status, data, url: url.toString() };
      } catch (err) {
        lastErr = err;
        if (err instanceof GhlHttpError) throw err;
        if (attempt >= maxAttempts) break;
        // Network errors and timeouts: retry with backoff.
        const baseDelay = Math.min(4000, 250 * 2 ** (attempt - 1));
        // For abort errors, don't wait long; it was already a timeout.
        await sleep(isAbortError(err) ? Math.min(250, baseDelay) : jitter(baseDelay));
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastErr instanceof Error) throw lastErr;
    throw new Error('GHL request failed');
  }
}
