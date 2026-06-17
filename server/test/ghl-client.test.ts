import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GhlClient, GhlHttpError, GhlParseError } from '../src/ghl/client';
import type { GhlIntegration } from '../src/ghl/types';

const integration: GhlIntegration = {
  accessToken: 'tok_test',
  tokenId: 'fb_token',
  companyId: 'co_1',
  capturedAt: 1,
};

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function mockFetch(handler: (call: FetchCall, attempt: number) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url;
    const call: FetchCall = { url, init };
    calls.push(call);
    return handler(call, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function json(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

test('successful GET parses JSON and sends auth headers', async () => {
  const fetchMock = mockFetch(() => json(200, { contacts: [1, 2] }));
  try {
    const client = new GhlClient(integration);
    const res = await client.request({
      method: 'GET',
      path: '/contacts/',
      query: { limit: 10, archived: false, skip: null, missing: undefined },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, { contacts: [1, 2] });
    assert.equal(fetchMock.calls.length, 1);

    const { url, init } = fetchMock.calls[0];
    assert.ok(url.startsWith('https://backend.leadconnectorhq.com/contacts/?'));
    assert.ok(url.includes('limit=10'));
    assert.ok(url.includes('archived=false'));
    assert.ok(!url.includes('skip='));
    assert.ok(!url.includes('missing='));

    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer tok_test');
    assert.equal(headers.version, '2021-07-28');
    assert.equal(headers['token-id'], 'fb_token');
  } finally {
    fetchMock.restore();
  }
});

test('token-id header is omitted when integration has no tokenId', async () => {
  const fetchMock = mockFetch(() => json(200, {}));
  try {
    const client = new GhlClient({ accessToken: 'tok', capturedAt: 1 });
    await client.request({ method: 'GET', path: '/x' });
    const headers = fetchMock.calls[0].init?.headers as Record<string, string>;
    assert.equal('token-id' in headers, false);
  } finally {
    fetchMock.restore();
  }
});

test('POST serializes the body once', async () => {
  const fetchMock = mockFetch(() => json(200, { ok: true }));
  try {
    const client = new GhlClient(integration);
    const body = { firstName: 'Ada', tags: ['a'] };
    await client.request({ method: 'POST', path: '/contacts/', body });
    assert.equal(fetchMock.calls[0].init?.body, JSON.stringify(body));
    assert.equal(fetchMock.calls[0].init?.method, 'POST');
  } finally {
    fetchMock.restore();
  }
});

test('empty 2xx body resolves to an empty object', async () => {
  const fetchMock = mockFetch(() => new Response('', { status: 200 }));
  try {
    const client = new GhlClient(integration);
    const res = await client.request({ method: 'DELETE', path: '/contacts/c1' });
    assert.deepEqual(res.data, {});
  } finally {
    fetchMock.restore();
  }
});

test('4xx fails immediately without retrying', async () => {
  const fetchMock = mockFetch(() => new Response('{"msg":"bad"}', { status: 400 }));
  try {
    const client = new GhlClient(integration, { baseDelayMs: 1 });
    await assert.rejects(
      client.request({ method: 'GET', path: '/x' }),
      (err: unknown) => err instanceof GhlHttpError && err.status === 400
    );
    assert.equal(fetchMock.calls.length, 1);
  } finally {
    fetchMock.restore();
  }
});

test('429 retries and then succeeds', async () => {
  const fetchMock = mockFetch((_call, attempt) =>
    attempt === 1 ? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }) : json(200, { ok: 1 })
  );
  try {
    const client = new GhlClient(integration, { baseDelayMs: 1 });
    const res = await client.request({ method: 'GET', path: '/x' });
    assert.deepEqual(res.data, { ok: 1 });
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test('Retry-After HTTP dates fall back to backoff instead of sleep(NaN)', async () => {
  const fetchMock = mockFetch((_call, attempt) =>
    attempt === 1
      ? new Response('', { status: 503, headers: { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' } })
      : json(200, { ok: 1 })
  );
  try {
    const client = new GhlClient(integration, { baseDelayMs: 1 });
    const res = await client.request({ method: 'GET', path: '/x' });
    assert.deepEqual(res.data, { ok: 1 });
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test('exhausted retries surface the last HTTP status, not a generic error', async () => {
  const fetchMock = mockFetch(() => new Response('busy', { status: 429, headers: { 'retry-after': '0' } }));
  try {
    const client = new GhlClient(integration, { maxAttempts: 3, baseDelayMs: 1 });
    await assert.rejects(
      client.request({ method: 'GET', path: '/x' }),
      (err: unknown) => err instanceof GhlHttpError && err.status === 429
    );
    assert.equal(fetchMock.calls.length, 3);
  } finally {
    fetchMock.restore();
  }
});

test('non-JSON 2xx response is NOT retried (no duplicate POST side effects)', async () => {
  const fetchMock = mockFetch(() => new Response('<html>login page</html>', { status: 200 }));
  try {
    const client = new GhlClient(integration, { baseDelayMs: 1 });
    await assert.rejects(
      client.request({ method: 'POST', path: '/contacts/', body: { firstName: 'Ada' } }),
      (err: unknown) =>
        err instanceof GhlParseError &&
        err.status === 200 &&
        // Subclasses GhlHttpError so generic GHL error handlers cover it.
        err instanceof GhlHttpError
    );
    // The critical assertion: the POST went out exactly once.
    assert.equal(fetchMock.calls.length, 1);
  } finally {
    fetchMock.restore();
  }
});

test('network errors are retried with backoff', async () => {
  const fetchMock = mockFetch((_call, attempt) => {
    if (attempt === 1) throw new TypeError('fetch failed');
    return json(200, { ok: 1 });
  });
  try {
    const client = new GhlClient(integration, { baseDelayMs: 1 });
    const res = await client.request({ method: 'GET', path: '/x' });
    assert.deepEqual(res.data, { ok: 1 });
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});
