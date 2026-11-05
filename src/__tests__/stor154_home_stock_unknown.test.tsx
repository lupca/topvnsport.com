// @vitest-environment jsdom
// STOR-154: stockError=false nhưng không SP nào có tồn đã biết -> tồn chưa rõ, không báo thành hết hàng (spec 6f42ecd0).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import appDataReducer, { AppDataState } from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import HomePage from '../features/home/HomePage';
import { Product } from '../types';

const appData = (over: Partial<AppDataState> = {}): AppDataState => ({
  products: [], branches: [], stringOptions: [], categories: [], isLoading: false,
  categoriesError: false, productsError: false, stringOptionsError: false, stockError: false,
  loadInFlight: false, stockRefetching: false, ...over
});

const makeStore = (over: Partial<AppDataState> = {}) =>
  configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: { appData: appData(over) } as any
  });

const prod = (id: string, stock: number | undefined, categoryCode: string): Product => ({
  id, slug: `sp-${id}`, name: `SP ${id}`, brand: 'Yonex', category: 'Vợt', categoryCode, price: 100000,
  image: 'https://example.com/x.jpg', specs: {}, description: '', stock,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: `SKU-${id}`, price: 100000, stock }]
} as Product);

const categories = [
  { id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Thể Thao > Vợt' },
  { id: 2, name: 'Giày', code: 'c2', parent_id: null, display_name: 'Thể Thao > Giày' }
] as any;

function home(over: Partial<AppDataState>) {
  const store = makeStore({ categories, ...over });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>
    </Provider>
  );
  return store;
}

const grid = () => within(screen.getByTestId('featured-grid'));

beforeEach(() => {
  // jsdom không có scrollIntoView / matchMedia (pickCategory dùng cả hai)
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }) as any;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('STOR-154 tồn chưa rõ (stockError=false, mọi SP stock undefined)', () => {
  const unknownProducts = () => [prod('1', undefined, 'c1'), prod('2', undefined, 'c2')];

  it('chip Tất cả hiện (N), không (0)', () => {
    home({ products: unknownProducts(), stockError: false });
    const all = screen.getByTestId('cate-pill-ALL').textContent ?? '';
    expect(all).toContain('(2)');
    expect(all).not.toContain('(0)');
  });

  it('kệ không có câu "không có sản phẩm còn hàng", có câu trung tính role=status', () => {
    home({ products: unknownProducts(), stockError: false });
    expect(screen.queryByText('Không có sản phẩm còn hàng phù hợp bộ lọc.')).toBeNull();
    const msg = screen.getByTestId('shelf-stock-error');
    expect(msg.getAttribute('role')).toBe('status');
    expect(msg.textContent).toBe('Chưa tải được tình trạng hàng.');
  });

  it('kệ Tất cả liệt kê mọi SP, không có nhãn Hết hàng', () => {
    home({ products: unknownProducts(), stockError: false });
    expect(grid().getByText('SP 1')).toBeTruthy();
    expect(grid().getByText('SP 2')).toBeTruthy();
    expect(screen.queryByText('Hết hàng')).toBeNull();
  });

  it('mỗi chip ngành hiện đủ số đếm', () => {
    home({ products: unknownProducts(), stockError: false });
    expect(screen.getByTestId('cate-pill-c1').textContent).toContain('(1)');
    expect(screen.getByTestId('cate-pill-c2').textContent).toContain('(1)');
  });

  it('bấm chip ngành không lỗi, kệ chỉ liệt kê SP của ngành đó', () => {
    home({ products: unknownProducts(), stockError: false });
    expect(() => fireEvent.click(screen.getByTestId('cate-pill-c2'))).not.toThrow();
    expect(grid().getByText('SP 2')).toBeTruthy();
    expect(grid().queryByText('SP 1')).toBeNull();
  });
});

describe('STOR-154 tồn đã biết toàn 0 vẫn giữ STOR-132', () => {
  it('Tất cả hiện câu kệ trống, không có shelf-stock-error', () => {
    home({ products: [prod('1', 0, 'c1'), prod('2', undefined, 'c1')], stockError: false });
    expect(screen.getByText('Không có sản phẩm còn hàng phù hợp bộ lọc.')).toBeTruthy();
    expect(screen.queryByTestId('shelf-stock-error')).toBeNull();
  });
});
