import { describe, test, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import appDataReducer, { fetchAppData } from '../features/appData/appDataSlice';

const api = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  getBlogs: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));

async function run() {
  const store = configureStore({ reducer: { appData: appDataReducer } });
  await store.dispatch(fetchAppData());
  return store.getState().appData;
}

describe('appData lỗi từng nguồn', () => {
  test('chỉ sản phẩm lỗi: productsError=true, danh mục vẫn lưu, categoriesError=false', async () => {
    api.getProducts.mockRejectedValue(new Error('x'));
    api.getCategories.mockResolvedValue([{ id: 'c' }]);
    const s = await run();
    expect(s.productsError).toBe(true);
    expect(s.categoriesError).toBe(false);
    expect(s.categories).toHaveLength(1);
    expect(s.isLoading).toBe(false);
  });

  test('chỉ danh mục lỗi: categoriesError=true, sản phẩm vẫn lưu, productsError=false', async () => {
    api.getProducts.mockResolvedValue([{ id: 'p' }]);
    api.getCategories.mockRejectedValue(new Error('x'));
    const s = await run();
    expect(s.categoriesError).toBe(true);
    expect(s.productsError).toBe(false);
    expect(s.products).toHaveLength(1);
  });

  test('không lỗi: cả hai cờ false', async () => {
    api.getProducts.mockResolvedValue([]);
    api.getCategories.mockResolvedValue([]);
    const s = await run();
    expect(s.productsError || s.categoriesError).toBe(false);
  });
});
