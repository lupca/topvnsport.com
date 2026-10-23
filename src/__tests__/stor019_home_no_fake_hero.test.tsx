// @vitest-environment jsdom
// STOR-019: trang chủ không còn hero quảng cáo bịa.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { readFileSync, existsSync } from 'node:fs';

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

const text = () => document.body.textContent || '';

describe('STOR-019 trang chủ không hero bịa', () => {
  it('không có vùng hero bịa', () => {
    renderHome([prod('1', { hasActivePromotion: false })]);
    expect(document.querySelector('#topvnsport-hero')).toBeNull();
    for (const s of ['ASTROX 100ZZ', 'G-Force X5', 'Mua Ngay Chỉ 850K']) expect(text()).not.toContain(s);
  });

  it('không chữ khuyến mãi bịa', () => {
    renderHome([prod('1', { hasActivePromotion: false })]);
    for (const s of ['KHUYẾN MÃI HOT', 'Siêu Sale Cước Đan']) expect(text()).not.toContain(s);
    expect(readFileSync('src/features/home/HomePage.tsx', 'utf8')).not.toContain('images.unsplash.com');
    expect(document.body.innerHTML).not.toContain('images.unsplash.com');
    expect(existsSync('src/components/HeroSlider.tsx')).toBe(false);
  });
});
