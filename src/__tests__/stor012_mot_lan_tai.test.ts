import { describe, test, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import appDataReducer, { fetchAppData } from '../features/appData/appDataSlice';

// STOR-012: fetchAppData tải mỗi nguồn đúng 1 lần, ba nguồn bắn song song.
const PRODUCT = {
  id: 1,
  name: 'Vợt test',
  variants: [{ id: 11, sku_code: 'SKU-1', price: 100000, stock: 5 }]
};

let urls: string[] = [];
let releaseProducts: () => void;

function stubFetch(opts: { categoriesFail?: boolean; productsFail?: boolean; holdProducts?: boolean } = {}) {
  urls = [];
  const gate = new Promise<void>((resolve) => { releaseProducts = resolve; });
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    urls.push(url);
    if (url.includes('/public/stock')) return { ok: true, json: async () => ({ stock: { 'SKU-1': 9 } }) };
    if (url.includes('/public/voma-categories')) {
      return opts.categoriesFail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => [] };
    }
    if (url.includes('/public/products')) {
      if (opts.holdProducts) await gate;
      return opts.productsFail
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, json: async () => ({ items: [PRODUCT], total: 1, page: 1, limit: 100, pages: 1 }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as any;
}

async function run() {
  const store = configureStore({ reducer: { appData: appDataReducer } });
  await store.dispatch(fetchAppData());
  return store.getState().appData;
}

const count = (part: string) => urls.filter((u) => u.includes(part)).length;

describe('STOR-012 fetchAppData một lần tải', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('fetchAppData gọi voma-categories đúng 1 lần', async () => {
    stubFetch();
    await run();
    expect(count('/public/voma-categories')).toBe(1);
  });

  test('fetchAppData gọi public/products đúng 1 lần mỗi trang', async () => {
    stubFetch();
    await run();
    expect(count('/public/products')).toBe(1);
  });

  test('fetchAppData gọi public/stock đúng 1 lần', async () => {
    stubFetch();
    const s = await run();
    expect(count('/public/stock')).toBe(1);
    expect(urls.find((u) => u.includes('/public/stock'))).not.toContain('sku_codes');
    expect(s.products[0].variants?.[0].stock).toBe(9);
  });

  test('fetchAppData bắn stock song song products', async () => {
    stubFetch({ holdProducts: true });
    const store = configureStore({ reducer: { appData: appDataReducer } });
    const done = store.dispatch(fetchAppData());
    await vi.waitFor(() => expect(count('/public/stock')).toBe(1));
    expect(count('/public/products')).toBe(1);
    releaseProducts();
    await done;
  });

  test('danh mục lỗi đặt categoriesError + productsError', async () => {
    stubFetch({ categoriesFail: true });
    const s = await run();
    expect(s.categoriesError).toBe(true);
    expect(s.productsError).toBe(true);
    expect(s.isLoading).toBe(false);
  });

  test('products lỗi đặt stringOptionsError', async () => {
    stubFetch({ productsFail: true });
    const s = await run();
    expect(s.productsError).toBe(true);
    expect(s.stringOptionsError).toBe(true);
  });
});
