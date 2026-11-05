// @vitest-environment jsdom
// STOR-161 (goal 2c881ad4, MOB-E 5c6e5961 / MOB-F 4aaf9681): ô chọn thương hiệu trong khung lọc đủ 44px dưới md
// (max-md:w-11 max-md:h-11); lớp cũ giữ nguyên nên desktop không đổi. Số đo thật nằm ở docs/stor161-shots.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import CatalogPage from '../features/catalog/CatalogPage';
import { Product } from '../types';

afterEach(cleanup);

const mk = (id: string, brand: string) =>
  ({ id, slug: id, name: id, brand, image: '', category: 'Vợt cầu lông', categoryCode: 'VC001491', price: 1, salePrice: 1, badge: '', specs: { weight: '4U', stiffness: '', balance: 0, maxTension: 0 }, description: '', stock: 1, variants: [], tier_variations: [] }) as unknown as Product;

describe('STOR-161 brand checkbox touch target', () => {
  it('mọi ô thương hiệu có max-md:w-11 max-md:h-11 và giữ lớp cũ', () => {
    const store = configureStore({
      reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
      preloadedState: {
        appData: { products: [mk('a', 'Yonex'), mk('b', 'Victor'), mk('c', 'Mizuno')], branches: [], stringOptions: [], categories: [], isLoading: false },
        cart: { items: [], isOpen: false, quickViewProduct: null },
        catalog: catalogReducer(undefined, { type: 'init' }),
      } as any,
    });
    render(<Provider store={store}><MemoryRouter><CatalogPage /></MemoryRouter></Provider>);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (const b of boxes) {
      const c = (b.getAttribute('class') ?? '').split(/\s+/);
      for (const want of ['max-md:w-11', 'max-md:h-11', 'rounded', 'border-gray-300', 'text-brand-primary', 'focus:ring-brand-primary/40']) expect(c, want).toContain(want);
    }
  });
});
