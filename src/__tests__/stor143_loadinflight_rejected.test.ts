import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import appDataReducer, { fetchAppData } from '../features/appData/appDataSlice';
import { sportApi } from '../services/sportApi';

// STOR-143 guard: fetchAppData phải nhả loadInFlight khi rejected (nếu không,
// 'Thử lại' sau một lần tải lỗi sẽ không làm gì), và sau một lần tải 200 không
// còn timer nào treo (clearTimeout trong fetchWithRetry).

const CATS_URL = '/api/pmi/public/voma-categories';
const PRODUCTS_URL = '/api/pmi/public/products?page=1&limit=100';
const STOCK_URL = '/api/wms/public/stock';
const PRODUCT = { id: 1, name: 'Vợt test', variants: [{ id: 11, sku_code: 'SKU-1', price: 100000 }] };
const OK_BODY: Record<string, unknown> = {
  [CATS_URL]: [],
  [PRODUCTS_URL]: { items: [PRODUCT], total: 1, page: 1, limit: 100, pages: 1 },
  [STOCK_URL]: { stock: { 'SKU-1': 9 } },
  '/api/pmi/public/products/1': PRODUCT
};

let calls: string[];
const count = (url: string) => calls.filter((u) => u === url).length;

// Mọi GET trả 200 (không hẹn giờ abort nào bị bỏ lại trừ khi fetchWithRetry leak).
function stubFetchAll200() {
  calls = [];
  global.fetch = vi.fn((input: string) => {
    const url = String(input);
    calls.push(url);
    const body = OK_BODY[url.split('?sku_codes')[0]] ?? OK_BODY[url] ?? {};
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
  }) as any;
}

// Chạy dispatch tới khi promise xong, chỉ bằng advanceTimersByTimeAsync(0) (không runAllTimers).
async function drain<T>(p: Promise<T>): Promise<T> {
  let done = false;
  p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 50 && !done; i += 1) {
    await vi.advanceTimersByTimeAsync(0);
  }
  return p;
}

describe('STOR-143 fetchAppData loadInFlight + timers', () => {
  const newStore = () => configureStore({ reducer: { appData: appDataReducer } });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('all-200 load: không còn timer treo (vi.getTimerCount() === 0)', async () => {
    stubFetchAll200();
    const store = newStore();
    const res = await drain(store.dispatch(fetchAppData()));
    expect(res.meta.requestStatus).toBe('fulfilled');
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejected (getBranches ném): loadInFlight = false, productsError = true', async () => {
    stubFetchAll200();
    vi.spyOn(sportApi, 'getBranches').mockRejectedValueOnce(new Error('boom'));
    const store = newStore();
    const res = await drain(store.dispatch(fetchAppData()));
    expect(res.meta.requestStatus).toBe('rejected');
    expect(store.getState().appData.loadInFlight).toBe(false);
    expect(store.getState().appData.productsError).toBe(true);
  });

  test('sau rejected, dispatch lần 2 thật sự gọi GET mới (không bị condition chặn)', async () => {
    stubFetchAll200();
    vi.spyOn(sportApi, 'getBranches').mockRejectedValueOnce(new Error('boom'));
    const store = newStore();
    await drain(store.dispatch(fetchAppData()));
    const catsBefore = count(CATS_URL);
    const stockBefore = count(STOCK_URL);

    const second = await drain(store.dispatch(fetchAppData()));
    expect(second.meta.requestStatus).toBe('fulfilled');
    expect(count(CATS_URL)).toBe(catsBefore + 1);
    expect(count(STOCK_URL)).toBe(stockBefore + 1);
  });
});
