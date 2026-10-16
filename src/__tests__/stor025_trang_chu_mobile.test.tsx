// @vitest-environment jsdom
// STOR-025: trang chủ mobile — chip/mũi tên danh mục đọc được, lưới gọn, kệ sản phẩm thật còn hàng.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { categoryTileThemes } from '../features/home/categoryTileThemes';
import { sortProducts } from '../utils/productSort';

const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, stock: 1, reviews: [], categoryCode: 'c1', ...extra }) as any;
const categories = [
  { id: 1, name: 'Cầu Lông', code: 'c1', parent_id: null, display_name: 'Thể Thao > Cầu Lông' },
  { id: 2, name: 'Vợt', code: 'c2', parent_id: null, display_name: 'Thể Thao > Vợt' },
];

const Probe = () => <div data-testid="loc">{useLocation().pathname}</div>;

function renderHome(products: any[]) {
  const store = configureStore({
    reducer: { appData: (state = { products, blogs: [], categories }) => state, cart: cartReducer, catalog: catalogReducer },
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

// ---- tương phản WCAG ----
const css = readFileSync('src/index.css', 'utf8');
const primary = css.match(/--color-brand-primary:\s*(#[0-9a-fA-F]{6})/)![1];
const palette: Record<string, string> = { white: '#ffffff', 'brand-primary': primary };
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
function colorOf(classes: string, prefix: 'text-' | 'bg-'): string {
  const tok = classes.split(/\s+/).find(c => c.startsWith(prefix) && !/^(text-(xs|sm|\[))/.test(c));
  if (!tok) throw new Error(`thiếu ${prefix} trong "${classes}"`);
  const name = tok.slice(prefix.length);
  if (!palette[name]) throw new Error(`màu ${tok} không có trong bảng màu test`);
  return palette[name];
}

describe('STOR-025 thẻ danh mục', () => {
  it('tương phản chip', () => {
    for (const t of categoryTileThemes) expect(ratio(colorOf(t.chip, 'text-'), colorOf(t.chip, 'bg-'))).toBeGreaterThanOrEqual(4.5);
  });
  it('tương phản mũi tên', () => {
    for (const t of categoryTileThemes) expect(ratio(colorOf(t.badge, 'text-'), palette.white)).toBeGreaterThanOrEqual(4.5);
  });
  it('không chữ trắng', () => {
    for (const t of categoryTileThemes) expect(`${t.chip} ${t.badge}`).not.toMatch(/text-white|white\//);
  });
  it('đếm 1 lần', () => {
    renderHome([prod('1'), prod('2'), prod('3', { categoryCode: 'c2' })]);
    for (const [label, n] of [['Mở danh mục Cầu Lông', 2], ['Mở danh mục Vợt', 1]] as const) {
      const tile = screen.getByLabelText(label);
      expect(within(tile).getAllByText(`${n} sản phẩm`)).toHaveLength(1);
    }
  });
  it('lưới danh mục 2 cột', () => {
    renderHome([prod('1')]);
    const grid = screen.getByLabelText('Mở danh mục Cầu Lông').parentElement!;
    expect(grid.className.split(/\s+/)).toContain('grid-cols-2');
    expect(grid.className.split(/\s+/)).not.toContain('grid-cols-1');
  });
  it('phụ đề ẩn mobile', () => {
    renderHome([prod('1')]);
    const sub = within(screen.getByLabelText('Mở danh mục Cầu Lông')).getByText('Thể Thao');
    expect(sub.className.split(/\s+/)).toEqual(expect.arrayContaining(['hidden', 'md:block']));
  });
  it('monogram ẩn mobile', () => {
    renderHome([prod('1')]);
    const box = within(screen.getByLabelText('Mở danh mục Cầu Lông')).getByText('CL').parentElement!;
    expect(box.className.split(/\s+/)).toEqual(expect.arrayContaining(['hidden', 'md:flex']));
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
  it('xem tất cả /catalog', () => {
    renderHome([prod('1')]);
    fireEvent.click(within(screen.getByTestId('instock-shelf')).getByRole('button', { name: /Xem tất cả/ }));
    expect(screen.getByTestId('loc').textContent).toBe('/catalog');
  });
  it('không còn hàng thì không kệ', () => {
    renderHome([prod('1', { stock: 0 }), prod('2', { stock: undefined })]);
    expect(screen.queryByTestId('instock-shelf')).toBeNull();
  });
  it('tiêu đề kệ là nhãn giao diện trung tính', () => {
    renderHome([prod('1')]);
    expect(within(screen.getByTestId('instock-shelf')).getByRole('heading', { level: 2 }).textContent).toBe('Sản phẩm còn hàng');
  });
  it('không chữ quảng cáo/thương hiệu cứng', () => {
    renderHome([prod('1', { brand: '' })]);
    expect(screen.getByTestId('instock-shelf').textContent).not.toMatch(/Nổi bật|Hot|Bán chạy|Yonex|Lining|Li-Ning|Victor/i);
  });
});
