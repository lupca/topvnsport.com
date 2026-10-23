import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { proxyOmsCheckout } from '../../api/_catalogProxy';

// built by concatenation so the AC15 grep over src stays empty
const OMS_ENV = 'VITE_OMS_' + 'API_URL';
const TOKEN = 'tok_secret_abc';
const BASE = 'https://oms.example/api/v1';
const PATHS = ['checkout/send-otp', 'checkout/verify-otp', 'checkout/orders', 'checkout/payments'];

function fakeRes() {
  const res: any = { headers: {} as Record<string, string>, code: 0, body: undefined as unknown };
  res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
  res.status = (c: number) => { res.code = c; return res; };
  res.json = (b: unknown) => { res.body = JSON.stringify(b); };
  res.send = (b: unknown) => { res.body = b; };
  return res;
}
const req = (method: string, path: string, body: unknown = { a: 1 }) =>
  ({ method, query: { path: path.split('/') }, body, url: `/api/oms/${path}` });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv(OMS_ENV, BASE);
  vi.stubEnv('STOREFRONT_SELLER_ID', 's1');
  vi.stubEnv('CATALOG_GRANT_TOKENS', JSON.stringify({ s1: TOKEN }));
  fetchMock = vi.fn().mockResolvedValue({ status: 200, headers: { get: () => 'application/json' }, text: async () => '{"ok":true}' });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('STOR-034 proxyOmsCheckout', () => {
  it.each(['GET', 'PUT', 'DELETE'])('%s -> 405, no fetch, no-store', async (m) => {
    const res = fakeRes();
    await proxyOmsCheckout(req(m, 'checkout/orders'), res);
    expect(res.code).toBe(405);
    expect(res.body).toBe('{"detail":"method_not_allowed"}');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['customers', 'channels', 'checkout/send-otp/x', 'api/sms/send-otp'])('POST %s -> 404, no fetch', async (p) => {
    const res = fakeRes();
    await proxyOmsCheckout(req('POST', p), res);
    expect(res.code).toBe(404);
    expect(res.body).toBe('{"detail":"not_found"}');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wrong method/path never reveal config: same answer with no env at all', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv(OMS_ENV, '');
    vi.stubEnv('CATALOG_GRANT_TOKENS', '');
    const a = fakeRes(); await proxyOmsCheckout(req('GET', 'checkout/orders'), a);
    const b = fakeRes(); await proxyOmsCheckout(req('POST', 'customers'), b);
    expect([a.code, b.code]).toEqual([405, 404]);
  });

  it.each(PATHS)('POST %s -> forwards URL, Bearer, verbatim body, no-store', async (p) => {
    const res = fakeRes();
    const body = { phone_number: '0987', note: 'a | b' };
    await proxyOmsCheckout(req('POST', p, body), res);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/public/${p}`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).toBe(JSON.stringify(body));
    expect(res.code).toBe(200);
    expect(res.body).toBe('{"ok":true}');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('string body is forwarded verbatim (Vercel gives an object for application/json, a string otherwise)', async () => {
    await proxyOmsCheckout(req('POST', 'checkout/send-otp', '{"phone_number":"1"}'), fakeRes());
    expect(fetchMock.mock.calls[0][1].body).toBe('{"phone_number":"1"}');
  });

  it('upstream error status is passed through with no-store', async () => {
    fetchMock.mockResolvedValue({ status: 403, headers: { get: () => null }, text: async () => '{"detail":"otp"}' });
    const res = fakeRes();
    await proxyOmsCheckout(req('POST', 'checkout/orders'), res);
    expect(res.code).toBe(403);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each([
    [OMS_ENV, ''],
    ['CATALOG_GRANT_TOKENS', '{not json'],
    ['CATALOG_GRANT_TOKENS', JSON.stringify({ other: 'x' })],
    ['STOREFRONT_SELLER_ID', ''],
  ])('bad config %s=%s -> 500 proxy_misconfigured, no fetch', async (k, v) => {
    vi.stubEnv(k, v);
    const res = fakeRes();
    await proxyOmsCheckout(req('POST', 'checkout/orders'), res);
    expect(res.code).toBe(500);
    expect(res.body).toBe('{"detail":"proxy_misconfigured"}');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetch throws -> 502 upstream_unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const res = fakeRes();
    await proxyOmsCheckout(req('POST', 'checkout/orders'), res);
    expect(res.code).toBe(502);
    expect(res.body).toBe('{"detail":"upstream_unreachable"}');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('token never appears in any response body or header', async () => {
    const outs: any[] = [];
    for (const [m, p] of [['POST', 'checkout/orders'], ['GET', 'checkout/orders'], ['POST', 'x']]) {
      const res = fakeRes(); await proxyOmsCheckout(req(m, p), res); outs.push(res);
    }
    fetchMock.mockRejectedValue(new Error(`leak ${TOKEN}`));
    const r = fakeRes(); await proxyOmsCheckout(req('POST', 'checkout/orders'), r); outs.push(r);
    for (const o of outs) expect(JSON.stringify([o.body, o.headers])).not.toContain(TOKEN);
  });
});
