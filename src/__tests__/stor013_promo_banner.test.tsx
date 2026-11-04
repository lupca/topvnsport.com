// @vitest-environment jsdom
// STOR-110 (thay STOR-098/STOR-013): khối "Đang khuyến mãi" liệt kê MỌI SP còn hàng đang KM (getPromotedInStock, STOR-109),
// không giới hạn, giữ thứ tự giảm % nhiều nhất trước; "Giảm đến x%" = % lớn nhất thật; danh sách rỗng hoặc lỗi tải -> không có khối.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { readFileSync } from 'node:fs';

const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const promo = (id: string, pct: number, extra: Record<string, unknown> = {}) =>
  prod(id, { hasActivePromotion: true, percentageDiscount: pct, originalPrice: 100000, computedPrice: 100000 - pct * 1000, ...extra });
const categories = [{ id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Vợt' }];

function renderHome(products: any[], productsError = false) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories, productsError }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(<Provider store={store}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
}

const saleCards = () => within(screen.getByTestId('sale-section')).getByTestId('sale-grid').querySelectorAll('[id^="product-card-"]');
const saleIds = () => [...saleCards()].map(el => el.id.replace('product-card-', ''));

afterEach(cleanup);

describe('STOR-110 khối Đang khuyến mãi trên trang chủ', () => {
  it('10 SP còn hàng đang KM -> đủ 10 thẻ, không cắt', () => {
    renderHome(Array.from({ length: 10 }, (_, i) => promo(`p${i}`, i + 1)));
    expect(saleCards()).toHaveLength(10);
  });

  it('loại SP KM hết hàng và SP còn hàng không KM', () => {
    renderHome([promo('in', 10), promo('out', 30, { stock: 0 }), prod('plain')]);
    expect(saleIds()).toEqual(['in']);
  });

  it('thứ tự = getPromotedInStock (giảm % nhiều nhất trước)', () => {
    renderHome([promo('a', 10), promo('b', 25), promo('c', 15)]);
    expect(saleIds()).toEqual(['b', 'c', 'a']);
  });

  it('nhãn "Giảm đến x%" = % lớn nhất từ dữ liệu', () => {
    renderHome([promo('a', 10), promo('b', 25)]);
    expect(screen.getByRole('heading', { name: 'Đang khuyến mãi' })).toBeTruthy();
    expect(screen.getByTestId('sale-max-badge').textContent).toBe('Giảm đến 25%');
  });

  it('mọi % giảm = 0 -> có khối nhưng không có nhãn "Giảm đến"', () => {
    renderHome([promo('a', 0)]);
    expect(screen.getByTestId('sale-section')).toBeTruthy();
    expect(screen.queryByText(/Giảm đến/)).toBeNull();
  });

  it('% giảm không hữu hạn (Infinity) -> không có nhãn "Giảm đến"', () => {
    renderHome([promo('a', Infinity)]);
    expect(screen.getByTestId('sale-section')).toBeTruthy();
    expect(screen.queryByText(/Giảm đến/)).toBeNull();
  });

  it('không có SP còn hàng đang KM -> không có khối', () => {
    renderHome([prod('plain'), promo('out', 20, { stock: 0 })]);
    expect(screen.queryByTestId('sale-section')).toBeNull();
    expect(screen.queryByText(/Đang khuyến mãi/i)).toBeNull();
  });

  it('lỗi tải sản phẩm -> role=alert, không có khối KM', () => {
    renderHome([promo('a', 20)], true);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('sale-section')).toBeNull();
  });

  it('khối KM nằm sau header hub và kệ nổi bật', () => {
    renderHome([promo('a', 20)]);
    const sale = screen.getByTestId('sale-section');
    for (const id of ['badminton-hub-header', 'instock-shelf'])
      expect(screen.getByTestId(id).compareDocumentPosition(sale) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('thẻ KM hiện giá bán, giá niêm yết gạch ngang và -N% từ dữ liệu', () => {
    renderHome([promo('a', 25, { originalPrice: 200000, computedPrice: 150000 })]);
    const sec = within(screen.getByTestId('sale-section'));
    expect(sec.getByTestId('sale-price').textContent).toContain('150.000');
    const original = sec.getByTestId('original-price');
    expect(original.textContent).toContain('200.000');
    expect(original.className).toContain('line-through');
    expect(sec.getByTestId('discount-badge').textContent).toContain('25%');
  });

  it('mã nguồn không có số giảm/chuỗi KM viết cứng', () => {
    for (const f of ['src/features/home/HomePage.tsx', 'src/features/home/SaleSection.tsx']) {
      const src = readFileSync(f, 'utf8');
      for (const s of ['GIẢM GIÁ 30%', 'GIỜ VÀNG SĂN DEAL CHẤT', '80 chi nhánh', 'Kết thúc sau', '.slice(']) {
        if (f.endsWith('HomePage.tsx') && s === '.slice(') continue;
        expect(src).not.toContain(s);
      }
      expect(src).not.toMatch(/Giảm đến \d/);
    }
  });
});
