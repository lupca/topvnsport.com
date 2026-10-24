import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sportApi } from '../services/sportApi';
import { PROVINCE_BODY, WARD_BODY, ERR_422_QUERY, ERR_429, ERR_503, ERR_422_SCHEMA, ERR_401, CURSOR_A } from './fixtures/adminUnits';

const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('STOR-036 sportApi.getAdminUnits (hợp đồng OMS (A) nguyên văn)', () => {
  it('AC1 province: URL + items', async () => {
    const f = vi.fn(async () => res(200, PROVINCE_BODY));
    vi.stubGlobal('fetch', f);
    expect(await sportApi.getAdminUnits('province')).toEqual(PROVINCE_BODY.items);
    expect(f).toHaveBeenCalledWith('/api/oms/admin-units?level=province&limit=500');
  });

  it('AC2 ward: URL có parent', async () => {
    const f = vi.fn(async () => res(200, WARD_BODY));
    vi.stubGlobal('fetch', f);
    await sportApi.getAdminUnits('ward', 'ADM1-01');
    expect(f).toHaveBeenCalledWith('/api/oms/admin-units?level=ward&parent=ADM1-01&limit=500');
  });

  it('AC3 cursor-loop: đi hết next_cursor, gộp mọi trang', async () => {
    const page1 = { items: [WARD_BODY.items[0]], next_cursor: CURSOR_A };
    const page2 = { items: [WARD_BODY.items[1]], next_cursor: null };
    const f = vi.fn(async (url: string) => res(200, url.includes('cursor=') ? page2 : page1));
    vi.stubGlobal('fetch', f);
    expect(await sportApi.getAdminUnits('ward', 'ADM1-01')).toEqual(WARD_BODY.items);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[1][0]).toBe(`/api/oms/admin-units?level=ward&parent=ADM1-01&limit=500&cursor=${encodeURIComponent(CURSOR_A)}`);
  });

  it('AC4 trang 2 lỗi -> ném, không trả danh sách cụt', async () => {
    const f = vi.fn(async (url: string) => (url.includes('cursor=') ? res(503, ERR_503) : res(200, { items: [WARD_BODY.items[0]], next_cursor: 'c2' })));
    vi.stubGlobal('fetch', f);
    await expect(sportApi.getAdminUnits('ward', 'ADM1-01')).rejects.toMatchObject({ status: 503 });
  });

  it.each([
    ['422 INVALID_ADMIN_UNIT_QUERY', 422, ERR_422_QUERY],
    ['422 schema', 422, ERR_422_SCHEMA],
    ['401', 401, ERR_401],
    ['429', 429, ERR_429],
    ['503', 503, ERR_503],
  ])('AC5/7/8 %s: console.error(url,status); error mang status + body', async (_n, status, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => res(status, body)));
    await expect(sportApi.getAdminUnits('province')).rejects.toMatchObject({ status, body });
    expect(errorSpy).toHaveBeenCalledWith('/api/oms/admin-units?level=province&limit=500', status);
  });

  it('AC8 body không phải JSON -> body null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error('x'); } })));
    await expect(sportApi.getAdminUnits('province')).rejects.toMatchObject({ status: 502, body: null });
  });

  it('AC6 fetch reject -> console.error(url, err) rồi ném', async () => {
    const boom = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn(async () => { throw boom; }));
    await expect(sportApi.getAdminUnits('province')).rejects.toBe(boom);
    expect(errorSpy).toHaveBeenCalledWith('/api/oms/admin-units?level=province&limit=500', boom);
  });
});
