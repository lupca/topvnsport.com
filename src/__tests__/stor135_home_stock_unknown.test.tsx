// @vitest-environment jsdom
// STOR-135: tồn kho chưa rõ không được báo thành "hết hàng" trên trang chủ.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';

const prod = (id: string, stock: number | undefined) =>
  ({ id, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, stock, categoryCode: 'c1' }) as any;
const categories = [{ id: 1, name: 'Cầu Lông', code: 'c1', parent_id: null, display_name: 'Thể Thao > Cầu Lông' }];

function renderHome(stock: number | undefined, stockError: boolean) {
  const products = ['1', '2', '3'].map(id => prod(id, stock));
  const store = configureStore({
    reducer: { appData: (state = { products, categories, stockError }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(<Provider store={store}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
}
const pillAll = () => screen.getByTestId('cate-pill-ALL').textContent;
afterEach(cleanup);

describe('STOR-135 repro: lỗi tồn, stock undefined', () => {
  it('không có chữ còn hàng phù hợp', () => {
    renderHome(undefined, true);
    expect(document.body.textContent).not.toContain('còn hàng phù hợp');
  });
  it('chip Tất cả không có (0)', () => {
    renderHome(undefined, true);
    expect(pillAll()).not.toContain('(0)');
  });
  it('câu trung tính', () => {
    renderHome(undefined, true);
    expect(screen.getByTestId('instock-shelf').textContent).toContain('Chưa tải được tình trạng hàng.');
  });
  it('bộ đếm không hiện 0 / 0', () => {
    renderHome(undefined, true);
    expect(screen.queryByTestId('result-counter')?.textContent ?? '').not.toContain('0 / 0');
  });
  it('chip ngành vẫn có (3), bấm không lỗi và kệ có 3 SP', () => {
    renderHome(undefined, true);
    expect(screen.getByTestId('cate-pill-c1').textContent).toContain('(3)');
    expect(() => fireEvent.click(screen.getByTestId('cate-pill-c1'))).not.toThrow();
    expect(within(screen.getByTestId('instock-shelf')).getAllByText(/^SP \d+$/)).toHaveLength(3);
  });
});

describe('STOR-135 lỗi tồn, stock 0', () => {
  it('chip Tất cả không (0)', () => {
    renderHome(0, true);
    expect(pillAll()).not.toContain('(0)');
  });
  it('không có chữ còn hàng phù hợp', () => {
    renderHome(0, true);
    expect(document.body.textContent).not.toContain('còn hàng phù hợp');
  });
  it('bộ đếm không 0 / 0', () => {
    renderHome(0, true);
    expect(screen.queryByTestId('result-counter')?.textContent ?? '').not.toContain('0 / 0');
  });
});

describe('STOR-135 không lỗi, mọi stock undefined', () => {
  it('chip Tất cả không (0)', () => {
    renderHome(undefined, false);
    expect(pillAll()).not.toContain('(0)');
  });
  it('không có chữ còn hàng phù hợp', () => {
    renderHome(undefined, false);
    expect(document.body.textContent).not.toContain('còn hàng phù hợp');
  });
  it('bộ đếm không 0 / 0', () => {
    renderHome(undefined, false);
    expect(screen.queryByTestId('result-counter')?.textContent ?? '').not.toContain('0 / 0');
  });
});

describe('STOR-135 tồn đã biết, hết sạch (giữ STOR-132)', () => {
  it('chip (0) và câu hết hàng', () => {
    renderHome(0, false);
    expect(pillAll()).toContain('(0)');
    expect(screen.getByTestId('instock-shelf').textContent).toContain('Không có sản phẩm còn hàng');
  });
});
