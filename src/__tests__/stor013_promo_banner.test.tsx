// @vitest-environment jsdom
// STOR-013: banner khuyến mãi trang chủ chỉ hiện khi có khuyến mãi thật, nội dung từ dữ liệu.
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

describe('STOR-013 banner khuyến mãi', () => {
  it('không khuyến mãi thì không banner', () => {
    renderHome([prod('1'), prod('2', { salePrice: 90000 })]);
    expect(screen.queryByTestId('promo-banner')).toBeNull();
    expect(screen.queryByText('Đang khuyến mãi')).toBeNull();
  });

  it('không khuyến mãi thì không thẻ sản phẩm khuyến mãi', () => {
    renderHome([prod('1', { salePrice: 90000 })]);
    expect(screen.queryByTestId('promo-section')).toBeNull();
  });

  it('banner hiện mức giảm lớn nhất', () => {
    renderHome([
      prod('1', { hasActivePromotion: true, percentageDiscount: 10 }),
      prod('2', { hasActivePromotion: true, percentageDiscount: 25 }),
    ]);
    expect(screen.getByTestId('promo-banner').textContent).toContain('Giảm đến 25%');
  });

  it('percentageDiscount thiếu hoặc 0 thì không hiện con số phần trăm', () => {
    renderHome([prod('1', { hasActivePromotion: true }), prod('2', { hasActivePromotion: true, percentageDiscount: 0 })]);
    const banner = screen.getByTestId('promo-banner');
    expect(banner.textContent).toContain('Đang khuyến mãi');
    expect(banner.textContent).not.toMatch(/%|Giảm đến/);
  });

  it('lưới chỉ có sản phẩm khuyến mãi', () => {
    renderHome([prod('1', { salePrice: 90000 }), prod('2', { hasActivePromotion: true, percentageDiscount: 5 })]);
    const promo = within(screen.getByTestId('promo-section'));
    expect(promo.getByText('SP 2')).toBeTruthy();
    expect(promo.queryByText('SP 1')).toBeNull();
  });

  it('mã nguồn không còn chuỗi viết cứng và đồng hồ đếm ngược', () => {
    const src = readFileSync('src/features/home/HomePage.tsx', 'utf8');
    for (const s of ['GIẢM GIÁ 30%', 'GIỜ VÀNG SĂN DEAL CHẤT', '80 chi nhánh', 'Kết thúc sau']) expect(src).not.toContain(s);
  });
});
