// @vitest-environment jsdom
// STOR-092: home page 390px chips, tiles and featured heading spacing per design Mobile tab (defect 06d2d2db, part 2)
// Guards font family and sizing tokens below md:
// - cate-pill button contains max-md:!font-sans
// - count span contains max-md:font-sans and md:font-mono, and no unprefixed text-* class
// - cat-tile h3 contains max-md:!font-sans
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Category } from '../types';

const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'BrandA', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const categories: Category[] = [
  { id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Thể Thao > Vợt' },
  { id: 2, name: 'Giày', code: 'c2', parent_id: null, display_name: 'Thể Thao > Giày' },
];

function renderHome(products: any[]) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(cleanup);
const cls = (el: Element) => el.className.toString().split(/\s+/).filter(Boolean);

describe('STOR-092 mobile chips and tiles font guards', () => {
  it('mọi cate-pill button chứa max-md:!font-sans (active và inactive)', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const pills = [screen.getByTestId('cate-pill-ALL'), screen.getByTestId('cate-pill-c1'), screen.getByTestId('cate-pill-c2')];
    for (const pill of pills) {
      expect(cls(pill)).toContain('max-md:!font-sans');
    }
  });

  it('số đếm cate-pill chứa max-md:font-sans và md:font-mono, không có class text- không tiền tố', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const pills = [screen.getByTestId('cate-pill-ALL'), screen.getByTestId('cate-pill-c1')];
    for (const pill of pills) {
      const spans = pill.querySelectorAll('span');
      expect(spans).toHaveLength(2);
      const count = cls(spans[1]);
      expect(count).toContain('max-md:font-sans');
      expect(count).toContain('md:font-mono');
      const unprefixedTextClasses = count.filter(c => /^text-/.test(c));
      expect(unprefixedTextClasses).toEqual([]);
    }
  });

  it('mọi cat-tile h3 chứa max-md:!font-sans', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const tiles = [screen.getByTestId('cat-tile-c1'), screen.getByTestId('cat-tile-c2')];
    for (const tile of tiles) {
      const h3 = tile.querySelector('h3')!;
      expect(cls(h3)).toContain('max-md:!font-sans');
    }
  });
});
