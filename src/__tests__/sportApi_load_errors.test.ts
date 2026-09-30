import { describe, test, expect, vi, beforeEach } from 'vitest';
import { sportApi } from '../services/sport-api/index';

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const item = (id: number) => ({ id, name: `P${id}`, variants: [] });
const pageOf = (n: number, total: number, pages: number, from: number) => ({
  items: Array.from({ length: n }, (_, i) => item(from + i)),
  total,
  page: 1,
  limit: 100,
  pages
});

function route(handlers: Record<string, (url: string) => Promise<unknown>>) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    for (const key of Object.keys(handlers)) if (url.includes(key)) return handlers[key](url);
    return ok({ stock: {} });
  }) as any;
}

describe('sportApi lỗi tải danh mục/sản phẩm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('getCategories ném + console.error kèm URL và status khi non-ok', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    route({ '/public/voma-categories': () => Promise.resolve({ ok: false, status: 503 }) });
    await expect(sportApi.getCategories()).rejects.toThrow();
    expect(err.mock.calls.flat().join(' ')).toMatch(/\/public\/voma-categories.*503/);
  });

  test('getCategories ném + console.error kèm URL khi fetch lỗi mạng', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    route({ '/public/voma-categories': () => Promise.reject(new Error('net down')) });
    await expect(sportApi.getCategories()).rejects.toThrow('net down');
    expect(err.mock.calls.flat().map(String).join(' ')).toMatch(/\/public\/voma-categories/);
    expect(err.mock.calls.flat().map(String).join(' ')).toMatch(/net down/);
  });

  test('getProducts ném khi một trang non-ok, console.error kèm URL + status', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    route({
      '/public/voma-categories': () => ok([]),
      'page=1': () => ok(pageOf(100, 150, 2, 1)),
      'page=2': () => Promise.resolve({ ok: false, status: 500 })
    });
    await expect(sportApi.getProducts()).rejects.toThrow();
    expect(err.mock.calls.flat().join(' ')).toMatch(/page=2&limit=100.*500/);
  });

  test('getProducts ném + console.error kèm URL khi fetch lỗi mạng', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    route({ '/public/voma-categories': () => ok([]), '/public/products': () => Promise.reject(new Error('boom')) });
    await expect(sportApi.getProducts()).rejects.toThrow('boom');
    expect(err.mock.calls.flat().map(String).join(' ')).toMatch(/\/public\/products\?page=1&limit=100/);
  });

  test('getProducts lỗi danh mục cũng ném (không map sản phẩm với danh mục rỗng)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    route({
      '/public/voma-categories': () => Promise.resolve({ ok: false, status: 500 }),
      '/public/products': () => ok(pageOf(1, 1, 1, 1))
    });
    await expect(sportApi.getProducts()).rejects.toThrow();
  });

  test('phân trang: total=150, pages=2 -> lấy page=1 và page=2 (limit=100), đủ 150 món', async () => {
    route({
      '/public/voma-categories': () => ok([]),
      'page=1&limit=100': () => ok(pageOf(100, 150, 2, 1)),
      'page=2&limit=100': () => ok(pageOf(50, 150, 2, 101))
    });
    const products = await sportApi.getProducts();
    expect(products).toHaveLength(150);
    const productUrls = (global.fetch as any).mock.calls.map((c: any[]) => c[0]).filter((u: string) => u.includes('/public/products'));
    expect(productUrls).toHaveLength(2);
  });

  test('số món thu được khác total -> ném lỗi tường minh', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    route({ '/public/voma-categories': () => ok([]), '/public/products': () => ok(pageOf(10, 11, 1, 1)) });
    await expect(sportApi.getProducts()).rejects.toThrow(/10 of 11/);
    expect(err).toHaveBeenCalled();
  });

  test('getProductById ném lỗi lên khi tải danh sách lỗi (không trả null giả)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    route({
      '/public/voma-categories': () => ok([]),
      '/public/products/9': () => Promise.resolve({ ok: false, status: 404 }),
      '/public/products?': () => Promise.resolve({ ok: false, status: 500 })
    });
    await expect(sportApi.getProductById('9')).rejects.toThrow();
  });
});
