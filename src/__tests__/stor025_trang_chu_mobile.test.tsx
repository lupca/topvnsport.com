// @vitest-environment jsdom
// STOR-025: trang chủ mobile — chip/mũi tên danh mục đọc được, lưới gọn, kệ sản phẩm thật còn hàng.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { sortProducts } from '../utils/productSort';

const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const categories = [
  { id: 1, name: 'Cầu Lông', code: 'c1', parent_id: null, display_name: 'Thể Thao > Cầu Lông' },
  { id: 2, name: 'Vợt', code: 'c2', parent_id: null, display_name: 'Thể Thao > Vợt' },
];

const Probe = () => <div data-testid="loc">{useLocation().pathname}</div>;

function renderHome(products: any[]) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(cleanup);

describe('STOR-025 thẻ danh mục', () => {
  it('lưới danh mục 2 cột', () => {
    renderHome([prod('1')]);
    const grid = screen.getByLabelText('Mở danh mục Cầu Lông').parentElement!;
    expect(grid.className.split(/\s+/)).toContain('grid-cols-2');
    expect(grid.className.split(/\s+/)).not.toContain('grid-cols-1');
  });
});

describe('STOR-025 kệ sản phẩm còn hàng', () => {
  const names = () => within(screen.getByTestId('instock-shelf')).getAllByText(/^SP \d+$/).map(e => e.textContent);

  it('chỉ còn hàng', () => {
    renderHome([prod('1', { stock: 0 }), prod('2'), prod('3', { stock: undefined }), prod('4', { stock: 5 })]);
    expect(names()).toEqual(['SP 2', 'SP 4']);
  });
  it('tối đa 8 thẻ', () => {
    renderHome(Array.from({ length: 12 }, (_, i) => prod(String(i + 1))));
    expect(names()).toHaveLength(8);
  });
  it('thứ tự sortProducts', () => {
    const ps = [prod('1', { stock: 0 }), prod('2', { stock: 2 }), prod('3', { stock: 3 }), prod('4', { stock: 1 })];
    renderHome(ps);
    const exp = sortProducts(ps, 'in-stock-first').filter(p => p.stock > 0).map(p => p.name);
    expect(names()).toEqual(exp);
  });
  it('mã nguồn import sortProducts từ utils/productSort', () => {
    expect(readFileSync('src/features/home/HomePage.tsx', 'utf8')).toMatch(/import \{[^}]*sortProducts[^}]*\} from '..\/..\/utils\/productSort'/);
  });
  it('lưới kệ 2 cột', () => {
    renderHome([prod('1')]);
    const grid = within(screen.getByTestId('instock-shelf')).getByText('SP 1').closest('.grid')!;
    expect(grid.className.split(/\s+/)).toContain('grid-cols-2');
  });
  it('STOR-056: kệ không còn nút "Xem tất cả"', () => {
    renderHome([prod('1')]);
    expect(within(screen.getByTestId('instock-shelf')).queryByRole('button', { name: /Xem tất cả/ })).toBeNull();
  });
  it('không còn hàng thì không kệ', () => {
    renderHome([prod('1', { stock: 0 }), prod('2', { stock: undefined })]);
    expect(screen.queryByTestId('instock-shelf')).toBeNull();
  });
  // STOR-056 thay 9841359a: tiêu đề theo thiết kế chủ shop đã duyệt.
  it('tiêu đề kệ SẢN PHẨM NỔI BẬT', () => {
    renderHome([prod('1')]);
    expect(within(screen.getByTestId('instock-shelf')).getByRole('heading', { level: 2 }).textContent).toBe('SẢN PHẨM NỔI BẬT');
  });
  it('không thương hiệu cứng', () => {
    renderHome([prod('1', { brand: '' })]);
    expect(screen.getByTestId('instock-shelf').textContent).not.toMatch(/Hot|Bán chạy|Yonex|Lining|Li-Ning|Victor/i);
  });
});
