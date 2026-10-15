import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { proxyToVoma } from '../../api/_catalogProxy';

// STOR-012: chỉ upstream 200 được CDN cache; mọi nhánh khác no-store.
function makeRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json() { return this; },
    send() { return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
}
const req = (method = 'GET') => ({ method, query: { path: ['public', 'products'] }, url: '/api/pmi/public/products' });
const upstream = (status: number) => vi.fn().mockResolvedValue({
  status,
  headers: new Map([['content-type', 'application/json']]),
  text: () => Promise.resolve('{}'),
} as any);

describe('catalogProxy cache CDN (STOR-012)', () => {
  const ORIGINAL_ENV = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ s1: 'secret-token-xyz' });
    process.env.STOREFRONT_SELLER_ID = 's1';
  });
  afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

  test('proxy 200 gắn Vercel-CDN-Cache-Control', async () => {
    global.fetch = upstream(200);
    const res = makeRes();
    await proxyToVoma(req(), res, 'https://pmi.test');
    expect(res.headers['Vercel-CDN-Cache-Control']).toBe('max-age=60, stale-while-revalidate=300');
    expect(res.headers['Cache-Control']).toContain('max-age=0');
  });

  test.each([404, 500, 401])('proxy upstream lỗi gắn no-store (%i)', async (status) => {
    global.fetch = upstream(status);
    const res = makeRes();
    await proxyToVoma(req(), res, 'https://pmi.test');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Vercel-CDN-Cache-Control']).toBeUndefined();
  });

  test('proxy 405 gắn no-store', async () => {
    const res = makeRes();
    await proxyToVoma(req('POST'), res, 'https://pmi.test');
    expect(res.statusCode).toBe(405);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  test('proxy 500 misconfigured gắn no-store', async () => {
    const res = makeRes();
    await proxyToVoma(req(), res, undefined);
    expect(res.statusCode).toBe(500);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  test('proxy 502 gắn no-store', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'));
    const res = makeRes();
    await proxyToVoma(req(), res, 'https://pmi.test');
    expect(res.statusCode).toBe(502);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  test('header không chứa token', async () => {
    global.fetch = upstream(200);
    const res = makeRes();
    await proxyToVoma(req(), res, 'https://pmi.test');
    expect(JSON.stringify(res.headers)).not.toContain('secret-token-xyz');
  });
});
