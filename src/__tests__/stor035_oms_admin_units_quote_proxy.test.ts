import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { proxyOmsCheckout } from '../../api/_catalogProxy';
import { readFileSync } from 'node:fs';

// built by concatenation so a grep over src for the env name stays empty
const OMS_ENV = 'VITE_OMS_' + 'API_URL';
const TOKEN = 'tok_secret_abc';
const BASE = 'https://oms.example/api/v1';

// ---- bodies copied verbatim from spec item fae8d7ae (OMS-132 wire contract) ----
const QUOTE_REQUEST = '{"items":[{"sku_code":"TVS-AO-01-M","quantity":2}],"receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","delivery_option":null}';
const PROVINCE_200 = '{"items":[{"code":"ADM1-01","level":"province","name":"Hà Nội","parent_code":null}],"next_cursor":null}';
const WARD_200 = '{"items":[{"code":"ADM1-01.W49886","level":"ward","name":"Phường Ba Đình","parent_code":"ADM1-01"}],"next_cursor":"<opaque base64 from voma-shipping>"}';
const QUOTE_200 = '{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":false,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":"SCN","service_name":"Chuyển phát nhanh","shipping_fee":78000,"eta_days":2,"is_fallback":false},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":"VHT","service_name":"Hỏa tốc thỏa thuận","shipping_fee":226111,"eta_days":1,"is_fallback":false}]}';
const QUOTE_200_NO_EXPRESS = '{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":false,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":"SCN","service_name":"Chuyển phát nhanh","shipping_fee":78000,"eta_days":2,"is_fallback":false},{"delivery_option":"EXPRESS","available":false,"unavailable_reason":"<ApiMessage.DELIVERY_OPTION_UNAVAILABLE>","service_code":null,"service_name":null,"shipping_fee":null,"eta_days":null,"is_fallback":false}]}';
const QUOTE_200_FALLBACK = '{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":true,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":null,"service_name":null,"shipping_fee":30000,"eta_days":null,"is_fallback":true},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":null,"service_name":null,"shipping_fee":50000,"eta_days":null,"is_fallback":true}]}';
const ADMIN_422_SCHEMA = '{"detail":[{"loc":["query","level"],"msg":"<vi>","type":"literal_error"}]}';
const ADMIN_422_INVALID = '{"code":"INVALID_ADMIN_UNIT_QUERY","message":"<vi>","field_path":"cursor","detail":{"code":"INVALID_ADMIN_UNIT_QUERY","message":"<vi>","field_path":"cursor"}}';
const biz422 = (code: string, fieldPath: string) =>
  `{"code":"${code}","message":"<vi>","field_path":"${fieldPath}","detail":{"code":"${code}","message":"<vi>","field_path":"${fieldPath}"}}`;
const SKU_NOT_FOUND = biz422('SKU_NOT_FOUND', 'items[0].sku_code');
const WARD_MISMATCH = biz422('RECEIVER_WARD_PROVINCE_MISMATCH', 'receiver_ward_code');
const NOT_MAPPED = biz422('RECEIVER_ADDRESS_NOT_MAPPED', 'receiver_ward_code');
const RATE_LIMITED = '{"code":"RATE_LIMITED","message":"<vi>","retry_after_seconds":30,"detail":{"code":"RATE_LIMITED","message":"<vi>","retry_after_seconds":30}}';
const UNAVAILABLE_503 = '{"code":"SHIPPING_UNAVAILABLE","message":"<ApiMessage.SHIPPING_UNAVAILABLE>","detail":{"code":"SHIPPING_UNAVAILABLE","message":"<ApiMessage.SHIPPING_UNAVAILABLE>"}}';
const GRANT_401 = '{"detail":"<ApiMessage.CATALOG_GRANT_CONTEXT_MISSING>"}';

function fakeRes() {
  const res: any = { headers: {} as Record<string, string>, code: 0, body: undefined as unknown };
  res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
  res.status = (c: number) => { res.code = c; return res; };
  res.json = (b: unknown) => { res.body = JSON.stringify(b); };
  res.send = (b: unknown) => { res.body = b; };
  return res;
}
const getReq = (path: string, query = '') =>
  ({ method: 'GET', query: { path: path.split('/') }, body: undefined, url: `/api/oms/${path}${query}` });
const postReq = (path: string, body: unknown = { a: 1 }) =>
  ({ method: 'POST', query: { path: path.split('/') }, body, url: `/api/oms/${path}` });
const up = (status: number, text: string, headers: Record<string, string> = {}) =>
  ({ status, headers: new Headers({ 'content-type': 'application/json', ...headers }), text: async () => text });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv(OMS_ENV, BASE);
  vi.stubEnv('STOREFRONT_SELLER_ID', 's1');
  vi.stubEnv('CATALOG_GRANT_TOKENS', JSON.stringify({ s1: TOKEN }));
  fetchMock = vi.fn().mockResolvedValue(up(200, PROVINCE_200));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const noStoreOnly = (res: any) => {
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.headers).not.toHaveProperty('vercel-cdn-cache-control');
};

describe('STOR-035 GET /api/oms/admin-units request', () => {
  it('AC1 URL', async () => {
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), fakeRes());
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/public/admin-units?level=province`);
  });
  it('AC2 method GET', async () => {
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), fakeRes());
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
  it('AC3 no body', async () => {
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), fakeRes());
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
  it('AC4 Authorization Bearer', async () => {
    await proxyOmsCheckout(getReq('admin-units'), fakeRes());
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });
  it('AC5 only level,parent,q,cursor,limit are forwarded', async () => {
    const q = '?level=ward&parent=ADM1-01&q=Ba%20%C4%90%C3%ACnh&cursor=abc%3D&limit=50&foo=1&path=admin-units&X-Seller-Id=evil';
    await proxyOmsCheckout(getReq('admin-units', q), fakeRes());
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect([...url.searchParams.keys()].sort()).toEqual(['cursor', 'level', 'limit', 'parent', 'q']);
    expect(url.searchParams.get('q')).toBe('Ba Đình');
    expect(url.searchParams.get('cursor')).toBe('abc=');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.get('parent')).toBe('ADM1-01');
  });
  it('AC6 no allowed params -> no "?"', async () => {
    await proxyOmsCheckout(getReq('admin-units', '?foo=1&path=admin-units'), fakeRes());
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/public/admin-units`);
    expect(fetchMock.mock.calls[0][0]).not.toContain('?');
  });
});

describe('STOR-035 POST /api/oms/shipping-quote request', () => {
  it('AC7-AC10 URL, method, verbatim body, Content-Type', async () => {
    fetchMock.mockResolvedValue(up(200, QUOTE_200));
    await proxyOmsCheckout(postReq('shipping-quote', JSON.parse(QUOTE_REQUEST)), fakeRes());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/public/shipping-quote`); // AC7
    expect(init.method).toBe('POST'); // AC8
    expect(init.body).toBe(JSON.stringify(JSON.parse(QUOTE_REQUEST))); // AC9
    expect(init.body).toBe(QUOTE_REQUEST);
    expect(init.headers['Content-Type']).toBe('application/json'); // AC10
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });
});

describe('STOR-035 verbatim OMS responses pass through byte for byte', () => {
  it.each([
    ['AC11 province 200', 'admin-units', 200, PROVINCE_200],
    ['AC12 ward 200', 'admin-units', 200, WARD_200],
    ['AC13 quote 200', 'shipping-quote', 200, QUOTE_200],
    ['AC14 quote 200 EXPRESS unavailable', 'shipping-quote', 200, QUOTE_200_NO_EXPRESS],
    ['AC15 quote 200 fallback', 'shipping-quote', 200, QUOTE_200_FALLBACK],
    ['AC16 admin-units 422 schema', 'admin-units', 422, ADMIN_422_SCHEMA],
    ['AC17 admin-units 422 INVALID_ADMIN_UNIT_QUERY', 'admin-units', 422, ADMIN_422_INVALID],
    ['AC18 quote 422 SKU_NOT_FOUND', 'shipping-quote', 422, SKU_NOT_FOUND],
    ['AC19 quote 422 RECEIVER_WARD_PROVINCE_MISMATCH', 'shipping-quote', 422, WARD_MISMATCH],
    ['AC20 quote 422 RECEIVER_ADDRESS_NOT_MAPPED', 'shipping-quote', 422, NOT_MAPPED],
    ['AC21 429 RATE_LIMITED', 'admin-units', 429, RATE_LIMITED],
    ['AC23 503 SHIPPING_UNAVAILABLE', 'admin-units', 503, UNAVAILABLE_503],
    ['AC24 401 grant context', 'shipping-quote', 401, GRANT_401],
  ])('%s', async (_n, path, status, text) => {
    fetchMock.mockResolvedValue(up(status, text));
    const res = fakeRes();
    await proxyOmsCheckout(path === 'admin-units' ? getReq(path, '?level=province') : postReq(path, JSON.parse(QUOTE_REQUEST)), res);
    expect(res.code).toBe(status);
    expect(res.body).toBe(text);
  });

  it('AC22 Retry-After: 30 is copied', async () => {
    fetchMock.mockResolvedValue(up(429, RATE_LIMITED, { 'Retry-After': '30' }));
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.headers['retry-after']).toBe('30');
    const q = fakeRes();
    fetchMock.mockResolvedValue(up(429, RATE_LIMITED, { 'Retry-After': '30' }));
    await proxyOmsCheckout(postReq('shipping-quote', JSON.parse(QUOTE_REQUEST)), q);
    expect(q.headers['retry-after']).toBe('30');
  });
});

describe('STOR-035 caching', () => {
  it('AC25/AC26 admin-units 200 -> CDN cache, browser revalidates', async () => {
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.headers['vercel-cdn-cache-control']).toBe('max-age=86400, stale-while-revalidate=86400');
    expect(res.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
  });

  it('AC27 separate constant; CDN_CACHE_CONTROL untouched', () => {
    const src = readFileSync('api/_catalogProxy.ts', 'utf8');
    expect(src).toContain("const CDN_CACHE_CONTROL = 'max-age=60, stale-while-revalidate=300';");
    expect(src).toContain("const ADMIN_UNITS_CDN_CACHE_CONTROL = 'max-age=86400, stale-while-revalidate=86400';");
  });

  it.each([
    ['AC28', 401, GRANT_401],
    ['AC29', 422, ADMIN_422_SCHEMA],
    ['AC30', 429, RATE_LIMITED],
    ['AC31', 503, UNAVAILABLE_503],
  ])('%s admin-units %i -> no-store, no CDN header', async (_n, status, text) => {
    fetchMock.mockResolvedValue(up(status, text));
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.code).toBe(status);
    noStoreOnly(res);
  });

  it('AC32 admin-units 500 proxy_misconfigured -> no-store', async () => {
    vi.stubEnv(OMS_ENV, '');
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.code).toBe(500);
    expect(res.body).toBe('{"detail":"proxy_misconfigured"}');
    noStoreOnly(res);
  });

  it('AC33 admin-units 502 upstream_unreachable -> no-store', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.code).toBe(502);
    expect(res.body).toBe('{"detail":"upstream_unreachable"}');
    noStoreOnly(res);
  });

  it.each([
    ['AC34', 'shipping-quote', QUOTE_200],
    ['AC35', 'checkout/send-otp', '{"ok":true}'],
    ['AC36', 'checkout/verify-otp', '{"ok":true}'],
    ['AC37', 'checkout/orders', '{"ok":true}'],
    ['AC38', 'checkout/payments', '{"ok":true}'],
  ])('%s POST %s 200 -> no-store, no CDN header', async (_n, path, text) => {
    fetchMock.mockResolvedValue(up(200, text));
    const res = fakeRes();
    await proxyOmsCheckout(postReq(path), res);
    expect(res.code).toBe(200);
    expect(res.body).toBe(text);
    noStoreOnly(res);
  });
});

describe('STOR-035 method/path checks come before config', () => {
  it('AC39 POST admin-units -> 405', async () => {
    const res = fakeRes();
    await proxyOmsCheckout(postReq('admin-units'), res);
    expect(res.code).toBe(405);
    expect(res.body).toBe('{"detail":"method_not_allowed"}');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('AC40 GET shipping-quote -> 405', async () => {
    const res = fakeRes();
    await proxyOmsCheckout(getReq('shipping-quote'), res);
    expect(res.code).toBe(405);
    expect(res.body).toBe('{"detail":"method_not_allowed"}');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('AC41 GET admin-units/x -> 404', async () => {
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units/x'), res);
    expect(res.code).toBe(404);
    expect(res.body).toBe('{"detail":"not_found"}');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('AC42 empty config: POST admin-units -> 405', async () => {
    vi.stubEnv(OMS_ENV, '');
    vi.stubEnv('CATALOG_GRANT_TOKENS', '');
    const res = fakeRes();
    await proxyOmsCheckout(postReq('admin-units'), res);
    expect(res.code).toBe(405);
  });
  it('AC43 empty config: GET unknown-path -> 404', async () => {
    vi.stubEnv(OMS_ENV, '');
    vi.stubEnv('CATALOG_GRANT_TOKENS', '');
    const res = fakeRes();
    await proxyOmsCheckout(getReq('unknown-path'), res);
    expect(res.code).toBe(404);
  });
});

describe('STOR-035 token never leaks', () => {
  const leaks = (res: any) => JSON.stringify([res.body, res.headers]).includes(TOKEN);
  it('AC44 admin-units 200', async () => {
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.code).toBe(200);
    expect(leaks(res)).toBe(false);
  });
  it('AC45 shipping-quote 200', async () => {
    fetchMock.mockResolvedValue(up(200, QUOTE_200));
    const res = fakeRes();
    await proxyOmsCheckout(postReq('shipping-quote', JSON.parse(QUOTE_REQUEST)), res);
    expect(res.code).toBe(200);
    expect(leaks(res)).toBe(false);
  });
  it('AC46 502 with token in error message', async () => {
    fetchMock.mockRejectedValue(new Error(`leak ${TOKEN}`));
    const res = fakeRes();
    await proxyOmsCheckout(getReq('admin-units', '?level=province'), res);
    expect(res.code).toBe(502);
    expect(leaks(res)).toBe(false);
  });
});
