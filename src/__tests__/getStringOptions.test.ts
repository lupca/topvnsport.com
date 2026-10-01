import { describe, test, expect, vi, beforeEach } from 'vitest';
import { sportApi } from '../services/sport-api/index';

function mockFetch(productsResponse: { items: unknown[] }) {
  const page = { ...productsResponse, total: productsResponse.items.length, page: 1, limit: 100, pages: 1 };
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/public/stock')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ stock: {} }) });
    }
    if (url.includes('/public/products')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(page) });
    }
    if (url.includes('/public/voma-categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  }) as any;
}

describe('sportApi.getStringOptions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('getStringOptions ném lỗi khi /public/products trả ok:false', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/public/products')) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as any;

    await expect(sportApi.getStringOptions()).rejects.toThrow();
  });

  test('nhận diện sản phẩm cước qua thuộc tính thật `thickness`, không qua tên/ngành', async () => {
    // Sản phẩm này KHÔNG có voma_category_id khớp ngành nào (category là
    // undefined, không phải "Cước") -- nếu logic cũ so category === 'Cước'
    // thì test này sẽ trả rỗng và ĐỎ.
    mockFetch({
      items: [
        {
          id: 1,
          name: 'Cước Yonex Exbolt 68',
          attribute_values: [
            { id: 1, attribute_id: 5, value_string: '0.68mm', attribute: { code: 'thickness', name: 'Độ dày' } }
          ],
          variants: [{ id: 10, sku_code: 'SKU-STRING-1', price: 200000, stock: 5 }]
        }
      ]
    });

    const options = await sportApi.getStringOptions();

    expect(options).toHaveLength(1);
    expect(options[0].thickness).toBe('0.68mm');
  });

  test('trả mảng rỗng khi không sản phẩm nào có thuộc tính thickness -- không fallback data.json', async () => {
    mockFetch({
      items: [
        { id: 2, name: 'Vợt Yonex Astrox', variants: [{ id: 20, sku_code: 'SKU-RACKET-1', price: 1000000, stock: 5 }] }
      ]
    });

    const options = await sportApi.getStringOptions();

    expect(options).toEqual([]);
  });
});
