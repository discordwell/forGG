import type { GhlIntegration } from './types';

export class GhlHttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly bodyText: string;

  constructor(args: { status: number; url: string; bodyText: string }, message?: string) {
    const snippet = (args.bodyText || '').trim().slice(0, 600);
    super(message ?? `GHL request failed (${args.status})${snippet ? `: ${snippet}` : ''}`);
    this.status = args.status;
    this.url = args.url;
    this.bodyText = args.bodyText;
  }
}

/**
 * A 2xx response whose body could not be parsed as JSON. Never retried: for
 * POST/PUT the server-side effect already happened, so retrying would
 * duplicate it. Subclasses GhlHttpError so generic handlers cover it.
 */
export class GhlParseError extends GhlHttpError {
  constructor(args: { status: number; url: string; bodyText: string }) {
    const snippet = (args.bodyText || '').trim().slice(0, 200);
    super(args, `GHL returned non-JSON response (${args.status})${snippet ? `: ${snippet}` : ''}`);
  }
}

const BASE_URL = 'https://backend.leadconnectorhq.com';

const REQUIRED_HEADERS: Record<string, string> = {
  version: '2021-07-28',
  channel: 'APP',
  source: 'WEB_USER',
};

// Some endpoints reject requests unless they resemble the web app.
// Values based on captured browser traffic; these are best-effort defaults.
const BROWSERISH_HEADERS: Record<string, string> = {
  'app-name': 'spm-ts',
  'route-name': 'agency_launchpad',
  'route-path': 'https://app.gohighlevel.com/agency_launchpad',
  'x-translations-lang': 'en-US',
  Referer: 'https://app.gohighlevel.com/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  'sec-ch-ua-platform': '"macOS"',
  'sec-ch-ua-mobile': '?0',
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

export interface GhlClientOpts {
  maxAttempts?: number;
  baseDelayMs?: number;
}

const MAX_RETRY_AFTER_MS = 15_000;

export class GhlClient {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(
    private readonly integration: GhlIntegration,
    opts?: GhlClientOpts
  ) {
    this.maxAttempts = Math.max(1, opts?.maxAttempts ?? 5);
    this.baseDelayMs = Math.max(1, opts?.baseDelayMs ?? 250);
  }

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
      ...BROWSERISH_HEADERS,
    };

    // Some core endpoints require the Firebase ID token as `token-id`.
    if (this.integration.tokenId) {
      headers['token-id'] = this.integration.tokenId;
    }

    let attempt = 0;
    let lastErr: unknown = null;
    const maxAttempts = this.maxAttempts;
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
            // Remember the response so exhausting retries reports the real
            // status instead of a generic error.
            lastErr = new GhlHttpError({ status: res.status, url: url.toString(), bodyText: text });
            if (attempt >= maxAttempts) break;
            const retryAfter = res.headers.get('retry-after');
            // Retry-After may be an HTTP date (or blank), which must fall
            // back to backoff rather than Number()-coercing to NaN/0.
            const retryAfterSec = retryAfter && retryAfter.trim() !== '' ? Number(retryAfter) : NaN;
            const baseDelay = Math.min(4000, this.baseDelayMs * 2 ** (attempt - 1));
            const waitMs =
              Number.isFinite(retryAfterSec) && retryAfterSec >= 0
                ? Math.min(retryAfterSec * 1000, MAX_RETRY_AFTER_MS)
                : jitter(baseDelay);
            await sleep(waitMs);
            continue;
          }
          throw new GhlHttpError({ status: res.status, url: url.toString(), bodyText: text });
        }

        let data: T;
        if (!text) {
          data = {} as T;
        } else {
          try {
            data = JSON.parse(text) as T;
          } catch {
            throw new GhlParseError({ status: res.status, url: url.toString(), bodyText: text });
          }
        }
        return { status: res.status, data, url: url.toString() };
      } catch (err) {
        lastErr = err;
        // GhlHttpError (and its GhlParseError subclass) are never retried here.
        if (err instanceof GhlHttpError) throw err;
        if (attempt >= maxAttempts) break;
        // Network errors and timeouts: retry with backoff.
        const baseDelay = Math.min(4000, this.baseDelayMs * 2 ** (attempt - 1));
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
