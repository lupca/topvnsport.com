import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { proxyToVoma } from '../../api/_catalogProxy';

function makeRes() {
  return {
    statusCode: 0,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
  };
}

function makeReq(path: string[] = ['public', 'products']) {
  return { method: 'GET', query: { path }, url: `/api/pmi/${path.join('/')}` };
}

describe('catalogProxy seller resolution (CATALOG_GRANT_TOKENS + STOREFRONT_SELLER_ID)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('forwards Authorization with the token selected for STOREFRONT_SELLER_ID', async () => {
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-a': 'token-a', 'seller-b': 'token-b' });
    process.env.STOREFRONT_SELLER_ID = 'seller-b';

    let capturedInit: any;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      capturedInit = init;
      return Promise.resolve({
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve('{}'),
      } as any);
    });

    const res = makeRes();
    await proxyToVoma(makeReq(), res, 'https://pmi.example.test');

    expect(capturedInit.headers.Authorization).toBe('Bearer token-b');
    expect(res.statusCode).toBe(200);
  });

  test('malformed CATALOG_GRANT_TOKENS JSON -> 500 proxy_misconfigured', async () => {
    process.env.CATALOG_GRANT_TOKENS = '{not valid json';
    process.env.STOREFRONT_SELLER_ID = 'seller-a';
    global.fetch = vi.fn();

    const res = makeRes();
    await proxyToVoma(makeReq(), res, 'https://pmi.example.test');

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ detail: 'proxy_misconfigured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('STOREFRONT_SELLER_ID missing from the map -> 500 proxy_misconfigured', async () => {
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-a': 'token-a' });
    process.env.STOREFRONT_SELLER_ID = 'seller-does-not-exist';
    global.fetch = vi.fn();

    const res = makeRes();
    await proxyToVoma(makeReq(), res, 'https://pmi.example.test');

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ detail: 'proxy_misconfigured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('STOREFRONT_SELLER_ID unset -> 500 proxy_misconfigured', async () => {
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-a': 'token-a' });
    delete process.env.STOREFRONT_SELLER_ID;
    global.fetch = vi.fn();

    const res = makeRes();
    await proxyToVoma(makeReq(), res, 'https://pmi.example.test');

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ detail: 'proxy_misconfigured' });
  });
});
