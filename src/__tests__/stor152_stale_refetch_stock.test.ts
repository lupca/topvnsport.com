// STOR-153: refetchStock về muộn sau một fetchAppData mới hơn đã thành công bị bỏ qua.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import appDataReducer, { AppDataState, fetchAppData, refetchStock } from '../features/appData/appDataSlice';
import { sportApi } from '../services/sportApi';
import { applyWmsStock } from '../services/sport-api/wmsStock';
import { Product } from '../types';

const prod = (stock: number | undefined): Product => ({
  id: '1', slug: 'sp-1', name: 'SP 1', brand: 'Yonex', category: 'Vợt', categoryCode: 'c1', price: 100000,
  image: 'https://example.com/x.jpg', specs: {}, description: '', stock,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: 'S1', price: 100000, stock }]
} as Product);

const makeStore = (over: Partial<AppDataState> = {}) =>
  configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: {
      appData: {
        products: [prod(undefined)], branches: [], stringOptions: [], categories: [], isLoading: false,
        categoriesError: false, productsError: true, stringOptionsError: false, stockError: true,
        loadInFlight: false, stockRefetching: false, ...over
      }
    }
  });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// getAllStock call 1 (refetchStock) chờ; call 2 (fetchAppData) trả {S1:0}.
function mockApi() {
  const call1 = deferred<Record<string, number>>();
  const getStock = vi.spyOn(sportApi, 'getAllStock')
    .mockReturnValueOnce(call1.promise)
    .mockResolvedValueOnce({ S1: 0 });
  vi.spyOn(sportApi, 'getCategories').mockResolvedValue([]);
  vi.spyOn(sportApi, 'getBranches').mockResolvedValue([]);
  vi.spyOn(sportApi, 'getStringOptions').mockResolvedValue([]);
  vi.spyOn(sportApi, 'getProducts').mockImplementation(async (_c, stockP) =>
    applyWmsStock([prod(undefined)], await stockP!));
  return { call1, getStock };
}

afterEach(() => vi.restoreAllMocks());

describe('STOR-153 refetchStock cũ sau fetchAppData mới', () => {
  it('rejected muộn: stockError vẫn false, tồn 0 giữ nguyên, stockRefetching không kẹt', async () => {
    const store = makeStore();
    const { call1, getStock } = mockApi();
    const stale = store.dispatch(refetchStock());
    await store.dispatch(fetchAppData());
    expect(store.getState().appData.stockError).toBe(false);
    call1.reject(new Error('503'));
    await stale;
    const s = store.getState().appData;
    expect(getStock).toHaveBeenCalledTimes(2);
    expect(s.stockError).toBe(false);
    expect(s.productsError).toBe(false);
    expect(s.products[0].stock).toBe(0);
    expect(s.stockRefetching).toBe(false);
  });

  it('fulfilled muộn: không ghi đè tồn mới của fetchAppData', async () => {
    const store = makeStore();
    const { call1 } = mockApi();
    const stale = store.dispatch(refetchStock());
    await store.dispatch(fetchAppData());
    const fresh = store.getState().appData.products;
    call1.resolve({ S1: 5 });
    await stale;
    const s = store.getState().appData;
    expect(s.products).toBe(fresh);
    expect(s.products[0].stock).toBe(0);
    expect(s.stockError).toBe(false);
    expect(s.stockRefetching).toBe(false);
  });
});

describe('STOR-153 refetchStock hiện hành vẫn như STOR-141', () => {
  it('rejected: stockError=true, products không đổi', async () => {
    const store = makeStore({ productsError: false });
    const products = store.getState().appData.products;
    vi.spyOn(sportApi, 'getAllStock').mockRejectedValue(new Error('503'));
    await store.dispatch(refetchStock());
    const s = store.getState().appData;
    expect(s.stockError).toBe(true);
    expect(s.products).toBe(products);
    expect(s.stockRefetching).toBe(false);
  });

  it('fulfilled: áp tồn, stockError=false', async () => {
    const store = makeStore({ productsError: false });
    vi.spyOn(sportApi, 'getAllStock').mockResolvedValue({ S1: 5 });
    await store.dispatch(refetchStock());
    const s = store.getState().appData;
    expect(s.products[0].stock).toBe(5);
    expect(s.stockError).toBe(false);
    expect(s.stockRefetching).toBe(false);
  });
});
