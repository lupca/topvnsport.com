// @vitest-environment jsdom
// STOR-098 (thay STOR-013): trang chủ KHÔNG còn khối khuyến mãi riêng; khuyến mãi chỉ nằm trên thẻ sản phẩm.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { readFileSync } from 'node:fs';

const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, stock: 1, ...extra }) as any;

function renderHome(products: any[]) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories: [] }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(<Provider store={store}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
}

afterEach(cleanup);

const promoted = () => [
  prod('1', { hasActivePromotion: true, percentageDiscount: 10, originalPrice: 100000, computedPrice: 90000 }),
  prod('2', { hasActivePromotion: true, percentageDiscount: 25, originalPrice: 200000, computedPrice: 150000 }),
];

describe('STOR-098 trang chủ không còn khối khuyến mãi riêng', () => {
  it('có sản phẩm khuyến mãi vẫn không hiện khối "Đang khuyến mãi / Giảm đến"', () => {
    renderHome(promoted());
    expect(screen.queryByTestId('promo-section')).toBeNull();
    expect(screen.queryByTestId('promo-banner')).toBeNull();
    expect(screen.queryByText(/Đang khuyến mãi/i)).toBeNull();
    expect(screen.queryByText(/Giảm đến/i)).toBeNull();
  });

  it('thẻ sản phẩm vẫn hiện giá khuyến mãi và giá niêm yết gạch ngang', () => {
    renderHome([promoted()[0]]);
    expect(screen.getByTestId('sale-price').textContent).toContain('90.000');
    const original = screen.getByTestId('original-price');
    expect(original.textContent).toContain('100.000');
    expect(original.className).toContain('line-through');
  });

  it('mã nguồn không còn khối khuyến mãi và chuỗi viết cứng', () => {
    const src = readFileSync('src/features/home/HomePage.tsx', 'utf8');
    for (const s of ['promoProducts', 'maxDiscount', 'promo-section', 'promo-banner', 'Đang khuyến mãi', 'Giảm đến',
      'GIẢM GIÁ 30%', 'GIỜ VÀNG SĂN DEAL CHẤT', '80 chi nhánh', 'Kết thúc sau']) expect(src).not.toContain(s);
  });
});
