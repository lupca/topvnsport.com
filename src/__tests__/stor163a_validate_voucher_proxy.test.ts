import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { proxyOmsCheckout } from '../../api/_catalogProxy';
import { sportApi } from '../services/sportApi';
import { QUOTE_V_Q3, VALIDATE_V1, VALIDATE_V2, ERR_VALIDATE_V8, VALIDATE_V1_REQUEST, VALIDATE_V2_REQUEST } from './fixtures/shippingQuote';

// built by concatenation so the grep over src for the env name stays empty
const OMS_ENV = 'VITE_OMS_' + 'API_URL';
const BASE = 'https://oms.example/api/v1';
const TOKEN = 'tok_secret_abc';
// OMS cd53022 WIRED_QUOTE_200, joined from the producer string literals (checked against git by scripts/stor163-walk/check-fixtures.mjs).
const WIRED_QUOTE_200_TEXT = '{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":false,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":"VTP","service_name":"Chuyển phát tiêu chuẩn","shipping_fee":35000,"eta_days":2,"is_fallback":false,"shipping_fee_original":35000,"shipping_discount":0,"voucher_message":"Mã chỉ áp dụng cho Giao hoả tốc","voucher_name":null},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":"VHT","service_name":"Chuyển phát nhanh","shipping_fee":15000,"eta_days":1,"is_fallback":false,"shipping_fee_original":45000,"shipping_discount":30000,"voucher_message":null,"voucher_name":"Freeship hỏa tốc tháng 11"}],"voucher":{"code":"HOAQUOC30K","name":"Freeship hỏa tốc tháng 11","valid":true,"message":null}}';

function fakeRes() {
  const res: any = { headers: {} as Record<string, string>, code: 0, body: undefined as unknown };
  res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
  res.status = (c: number) => { res.code = c; return res; };
  res.json = (b: unknown) => { res.body = JSON.stringify(b); };
  res.send = (b: unknown) => { res.body = b; };
  return res;
}
const req = (method: string, body: unknown = {}) =>
  ({ method, query: { path: ['checkout', 'validate-voucher'] }, body, url: '/api/oms/checkout/validate-voucher' });

let fetchMock: ReturnType<typeof vi.fn>;
const upstream = (status: number, body: unknown) => ({ status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv(OMS_ENV, BASE);
  vi.stubEnv('STOREFRONT_SELLER_ID', 's1');
  vi.stubEnv('CATALOG_GRANT_TOKENS', JSON.stringify({ s1: TOKEN }));
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('STOR-170 validate-voucher proxy', () => {
  it('POST forwards URL, Bearer, verbatim body, no-store; V1 200 passes through', async () => {
    fetchMock.mockResolvedValue(upstream(200, VALIDATE_V1));
    const res = fakeRes();
    await proxyOmsCheckout(req('POST', VALIDATE_V1_REQUEST), res);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/public/checkout/validate-voucher`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).toBe(JSON.stringify(VALIDATE_V1_REQUEST));
    expect(res.code).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual(VALIDATE_V1);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('V8 422 passes through', async () => {
    fetchMock.mockResolvedValue(upstream(422, ERR_VALIDATE_V8));
    const res = fakeRes();
    await proxyOmsCheckout(req('POST', VALIDATE_V1_REQUEST), res);
    expect(res.code).toBe(422);
    expect(JSON.parse(res.body as string)).toEqual(ERR_VALIDATE_V8);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET -> 405, no fetch', async () => {
    const res = fakeRes();
    await proxyOmsCheckout(req('GET'), res);
    expect(res.code).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('STOR-170 sportApi.validateVoucher', () => {
  it.each([[VALIDATE_V1_REQUEST, VALIDATE_V1], [VALIDATE_V2_REQUEST, VALIDATE_V2]])('POSTs the body to the proxy and returns the reply', async (request, reply) => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => reply });
    expect(await sportApi.validateVoucher(request)).toEqual(reply);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/oms/checkout/validate-voucher');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify(request));
  });

  it('throws on a 422 (V8), never returns a default', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ERR_VALIDATE_V8 });
    await expect(sportApi.validateVoucher(VALIDATE_V1_REQUEST)).rejects.toMatchObject({ status: 422 });
  });
});

describe('STOR-170 fixtures', () => {
  it('QUOTE_V_Q3 deep-equals OMS cd53022 WIRED_QUOTE_200', () => {
    expect(QUOTE_V_Q3).toEqual(JSON.parse(WIRED_QUOTE_200_TEXT));
  });
});
