import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import appDataReducer, { fetchAppData } from '../features/appData/appDataSlice';
import { sportApi } from '../services/sportApi';
import { ATTEMPT_TIMEOUT_MS, RETRY_DELAYS_MS } from '../services/sport-api';

// STOR-137: GET danh mục/sản phẩm/tồn thử lại lỗi tạm (5xx, lỗi mạng, quá 12 s):
// 3 lần, chờ 1000 rồi 2000 ms; 4xx không thử lại; hết lượt vẫn console.error + ném.

type Reply = number | 'network' | 'hang' | { status: number; body: unknown };

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

let queues: Record<string, Reply[]>;
let calls: string[];
let signals: AbortSignal[];

const count = (url: string) => calls.filter((u) => u === url).length;

function answer(url: string, reply: Reply, signal?: AbortSignal) {
  if (reply === 'network') return Promise.reject(new TypeError('Failed to fetch'));
  if (reply === 'hang') {
    return new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    });
  }
  const { status, body } = typeof reply === 'number' ? { status: reply, body: OK_BODY[url.split('?sku_codes')[0]] ?? {} } : reply;
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
}

// Mỗi URL một hàng đợi trả lời; phần tử cuối dùng lại mãi.
function stubFetch(replies: Record<string, Reply[]> = {}) {
  queues = replies;
  calls = [];
  signals = [];
  global.fetch = vi.fn((input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (init?.signal) signals.push(init.signal);
    const key = url.startsWith(STOCK_URL) ? STOCK_URL : url;
    const q = queues[key] ?? [200];
    return answer(url, q.length > 1 ? q.shift()! : q[0], init?.signal ?? undefined);
  }) as any;
}

// Chạy promise dưới fake timers tới khi xong; trả kết quả hoặc lỗi.
async function settle<T>(p: Promise<T>) {
  const out = p.then((value) => ({ value }), (error) => ({ error }));
  await vi.runAllTimersAsync();
  return out as Promise<{ value?: T; error?: unknown }>;
}

describe('STOR-137 fetchWithRetry', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('hằng số: 3 lần thử, chờ 1000 rồi 2000 ms, mỗi lần 12000 ms', () => {
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000]);
    expect(ATTEMPT_TIMEOUT_MS).toBe(12000);
  });

  test('getCategories: 503 ba lần -> fetch đúng 3 lần rồi ném, console.error nêu URL + status', async () => {
    stubFetch({ [CATS_URL]: [503] });
    const r = await settle(sportApi.getCategories());
    expect(count(CATS_URL)).toBe(3);
    expect(r.error).toBeInstanceOf(Error);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(`${CATS_URL} returned status 503`));
  });

  test('fetchAllWmsStock (getAllStock): 503 ba lần -> fetch đúng 3 lần rồi ném', async () => {
    stubFetch({ [STOCK_URL]: [503] });
    const r = await settle(sportApi.getAllStock());
    expect(count(STOCK_URL)).toBe(3);
    expect(r.error).toBeInstanceOf(Error);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(`${STOCK_URL} returned status 503`));
  });

  test('fetchAllPmiProducts (getProducts): 503 ba lần -> fetch đúng 3 lần rồi ném, không trả []', async () => {
    stubFetch({ [PRODUCTS_URL]: [503] });
    const r = await settle(sportApi.getProducts(Promise.resolve([])));
    expect(count(PRODUCTS_URL)).toBe(3);
    expect(r.error).toBeInstanceOf(Error);
    expect(r.value).toBeUndefined();
  });

  test('503 rồi 200 -> fetch đúng 2 lần, trả dữ liệu thật', async () => {
    stubFetch({ [CATS_URL]: [503, { status: 200, body: [{ id: 7 }] }] });
    const r = await settle(sportApi.getCategories());
    expect(count(CATS_URL)).toBe(2);
    expect(r.value).toEqual([{ id: 7 }]);
  });

  test('chờ 1000 ms trước lần 2 và 2000 ms trước lần 3', async () => {
    stubFetch({ [STOCK_URL]: [503] });
    const out = sportApi.getAllStock().catch(() => 'rejected');
    await vi.advanceTimersByTimeAsync(0);
    expect(count(STOCK_URL)).toBe(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(count(STOCK_URL)).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(count(STOCK_URL)).toBe(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(count(STOCK_URL)).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(count(STOCK_URL)).toBe(3);
    await vi.runAllTimersAsync();
    expect(await out).toBe('rejected');
    expect(count(STOCK_URL)).toBe(3);
  });

  test('lỗi mạng (fetch reject) được thử lại tới 3 lần rồi ném chính lỗi đó', async () => {
    stubFetch({ [CATS_URL]: ['network'] });
    const r = await settle(sportApi.getCategories());
    expect(count(CATS_URL)).toBe(3);
    expect(r.error).toBeInstanceOf(TypeError);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(CATS_URL), r.error);
  });

  test('lỗi mạng rồi 200 -> fetch 2 lần, trả dữ liệu', async () => {
    stubFetch({ [CATS_URL]: ['network', { status: 200, body: [] }] });
    const r = await settle(sportApi.getCategories());
    expect(count(CATS_URL)).toBe(2);
    expect(r.value).toEqual([]);
  });

  test('lần thử treo quá 12000 ms bị abort và thử lại', async () => {
    stubFetch({ [CATS_URL]: ['hang', { status: 200, body: [] }] });
    const out = sportApi.getCategories();
    await vi.advanceTimersByTimeAsync(11999);
    expect(count(CATS_URL)).toBe(1);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(count(CATS_URL)).toBe(2);
    await vi.runAllTimersAsync();
    expect(await out).toEqual([]);
  });

  test.each([404, 400, 429])('%i -> fetch đúng 1 lần, ném ngay', async (status) => {
    stubFetch({ [CATS_URL]: [status] });
    const r = await settle(sportApi.getCategories());
    expect(count(CATS_URL)).toBe(1);
    expect(r.error).toBeInstanceOf(Error);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(`returned status ${status}`));
  });

  test('getProductById: 503 rồi 200 -> GET /products/1 đúng 2 lần', async () => {
    stubFetch({ '/api/pmi/public/products/1': [503, 200] });
    const r = await settle(sportApi.getProductById('1'));
    expect(count('/api/pmi/public/products/1')).toBe(2);
    expect(r.value?.id).toBe('1');
  });

  test('getProductById: 404 -> GET /products/1 đúng 1 lần, rồi tìm trong getProducts()', async () => {
    stubFetch({ '/api/pmi/public/products/1': [404] });
    const r = await settle(sportApi.getProductById('1'));
    expect(count('/api/pmi/public/products/1')).toBe(1);
    expect(count(PRODUCTS_URL)).toBe(1);
    expect(r.value?.id).toBe('1');
  });
});

describe('STOR-137 fetchAppData single-flight', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  const newStore = () => configureStore({ reducer: { appData: appDataReducer } });

  test('tất cả 200 -> đúng 1 GET mỗi nguồn, tắt spinner', async () => {
    stubFetch();
    const store = newStore();
    await store.dispatch(fetchAppData());
    expect(count(CATS_URL)).toBe(1);
    expect(count(STOCK_URL)).toBe(1);
    expect(count(PRODUCTS_URL)).toBe(1);
    expect(store.getState().appData.isLoading).toBe(false);
    expect(store.getState().appData.products[0].stock).toBe(9);
  });

  test('dispatch lần 2 khi lần 1 đang chạy -> không thêm GET; xong rồi dispatch lại vẫn tải', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    stubFetch();
    const inner = global.fetch as any;
    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input) === PRODUCTS_URL) await gate;
      return inner(input, init);
    }) as any;

    const store = newStore();
    const first = store.dispatch(fetchAppData());
    await Promise.resolve();
    const second = await store.dispatch(fetchAppData());
    expect(second.meta.requestStatus).toBe('rejected');
    expect((second.meta as any).condition).toBe(true);
    release();
    await first;

    expect(count(CATS_URL)).toBe(1);
    expect(count(STOCK_URL)).toBe(1);
    expect(count(PRODUCTS_URL)).toBe(1);
    expect(store.getState().appData.isLoading).toBe(false);
    expect(store.getState().appData.productsError).toBe(false);

    await store.dispatch(fetchAppData());
    expect(count(CATS_URL)).toBe(2);
  });
});
