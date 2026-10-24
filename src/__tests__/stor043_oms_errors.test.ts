import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sportApi } from '../services/sportApi';

const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => { if (body === undefined) throw new SyntaxError('x'); return body; } });
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const CALLS: Record<string, () => Promise<unknown>> = {
  sendOtp: () => sportApi.sendOtp('0912345678'),
  verifyOtp: () => sportApi.verifyOtp('0912345678', '123456'),
  createOrder: () => sportApi.createOrder({} as any),
  createSepayCheckout: () => sportApi.createSepayCheckout('ORD-1'),
  getAdminUnits: () => sportApi.getAdminUnits('province'),
  getShippingQuote: () => sportApi.getShippingQuote({} as any),
};
const viet = (m: unknown) => typeof m === 'string' && /[ăâđêôơưáàảãạéèíìóòúùý]/i.test(m) && !/Failed|Unknown|upstream|object Object|undefined/.test(m);
const caught = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { return e as any; } throw new Error('không ném'); };

describe.each(Object.keys(CALLS))('STOR-043 %s', (name) => {
  const call = CALLS[name];
  it('mạng -> kind network, tiếng Việt, status undefined', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const e = await caught(call);
    expect(e.kind).toBe('network'); expect(e.status).toBeUndefined(); expect(e.body).toBeNull(); expect(viet(e.message)).toBe(true);
  });
  it('timeout -> kind timeout, tiếng Việt', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: any) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))));
    const p = caught(call);
    await vi.advanceTimersByTimeAsync(20_001);
    const e = await p;
    expect(e.kind).toBe('timeout'); expect(e.status).toBeUndefined(); expect(viet(e.message)).toBe(true);
  });
  it('4xx message chuỗi -> lấy nguyên', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(409, { message: 'Số điện thoại bị khoá tạm.' })));
    const e = await caught(call);
    expect(e).toMatchObject({ kind: 'http', status: 409, message: 'Số điện thoại bị khoá tạm.', body: { message: 'Số điện thoại bị khoá tạm.' } });
  });
  it('4xx detail chuỗi -> lấy nguyên', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(400, { detail: 'Mã OTP sai.' })));
    expect((await caught(call)).message).toBe('Mã OTP sai.');
  });
  it('422 detail mảng -> câu cố định, giữ body', async () => {
    const body = { detail: [{ loc: ['body'], msg: 'field required' }] };
    vi.stubGlobal('fetch', vi.fn(async () => res(422, body)));
    const e = await caught(call);
    expect(e.status).toBe(422); expect(e.body).toEqual(body); expect(viet(e.message)).toBe(true);
  });
  it.each([500, 502, 503])('%i -> tiếng Việt, giữ status', async (s) => {
    vi.stubGlobal('fetch', vi.fn(async () => res(s, s === 502 ? { error: 'upstream_unreachable' } : undefined)));
    const e = await caught(call);
    expect(e.kind).toBe('http'); expect(e.status).toBe(s); expect(viet(e.message)).toBe(true);
  });
  it.each([
    [502, { detail: 'upstream_unreachable' }],
    [500, { detail: 'proxy_misconfigured' }],
    [500, { detail: 'Internal Server Error' }],
  ])('%i body proxy thật %j -> không lộ chữ server', async (s, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => res(s, body)));
    const e = await caught(call);
    expect(e.message).not.toBe(body.detail); expect(viet(e.message)).toBe(true); expect(e.body).toEqual(body);
  });
  it('503 có code OMS + message tiếng Việt -> dùng lời OMS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(503, { code: 'SHIPPING_UNAVAILABLE', message: 'Chưa báo giá được phí ship.' })));
    expect((await caught(call)).message).toBe('Chưa báo giá được phí ship.');
  });
  it('200 body không phải JSON -> invalid_response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, undefined)));
    const e = await caught(call);
    expect(e.kind).toBe('invalid_response'); expect(viet(e.message)).toBe(true);
  });
});

describe('STOR-043 hết giờ huỷ POST', () => {
  it('signal.aborted === true sau timeout', async () => {
    vi.useFakeTimers();
    let sig: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_u: string, init: any) => { sig = init.signal; return new Promise(() => {}); }));
    const p = caught(CALLS.createOrder);
    await vi.advanceTimersByTimeAsync(20_001);
    await p;
    expect(sig?.aborted).toBe(true);
  });
});

describe('STOR-043 createSepayCheckout kiểm body', () => {
  const ok = (b: unknown) => vi.stubGlobal('fetch', vi.fn(async () => res(200, b)));
  it('hợp lệ -> trả nguyên', async () => {
    const b = { action: 'https://pay.sepay.vn/v1/checkout/init', fields: { a: '1' } };
    ok(b); expect(await sportApi.createSepayCheckout('X')).toEqual(b);
  });
  it.each([
    ['thiếu action', { fields: { a: '1' } }],
    ['thiếu fields', { action: 'https://pay.sepay.vn/x' }],
    ['action http', { action: 'http://pay.sepay.vn/x', fields: {} }],
    ['action javascript', { action: 'javascript:alert(1)', fields: {} }],
    ['action rác', { action: 'khong-phai-url', fields: {} }],
    ['fields là mảng', { action: 'https://pay.sepay.vn/x', fields: [] }],
    ['field không phải chuỗi', { action: 'https://pay.sepay.vn/x', fields: { a: 1 } }],
    ['body null', null],
  ])('%s -> invalid_response', async (_n, b) => {
    ok(b);
    const e = await caught(CALLS.createSepayCheckout);
    expect(e.kind).toBe('invalid_response'); expect(viet(e.message)).toBe(true);
  });
});
