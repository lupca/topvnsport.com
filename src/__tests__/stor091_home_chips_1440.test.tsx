// @vitest-environment jsdom
// STOR-091: Home page 1440px chips panel: design chip bar 1160px, chips 44px/14.5px, count and active styles
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

describe('STOR-091 desktop chip bar and chip styles (1440px)', () => {
  it('thanh chip bar chứa md:max-w-[1160px], md:p-[6px], md:gap-[4px], md:rounded-[999px]; bỏ token trôi', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const bar = screen.getByTestId('cate-select-bar');
    const c = cls(bar);
    expect(c).toContain('md:max-w-[1160px]');
    expect(c).toContain('md:p-[6px]');
    expect(c).toContain('md:gap-[4px]');
    expect(c).toContain('md:rounded-[999px]');

    // Drifted tokens must be gone
    expect(c).not.toContain('md:p-1.5');
    expect(c).not.toContain('md:gap-1');
    expect(c).not.toContain('md:rounded-full');
    expect(c).not.toContain('rounded-full');
  });

  it('mọi chip button chứa md:font-sans!, md:text-[14.5px], md:min-h-[44px], md:py-[8px], md:gap-[7px], md:rounded-[999px]', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const pills = [screen.getByTestId('cate-pill-ALL'), screen.getByTestId('cate-pill-c1'), screen.getByTestId('cate-pill-c2')];
    for (const pill of pills) {
      const c = cls(pill);
      expect(c).toContain('md:font-sans!');
      expect(c).toContain('md:text-[14.5px]');
      expect(c).toContain('md:min-h-[44px]');
      expect(c).toContain('md:py-[8px]');
      expect(c).toContain('md:gap-[7px]');
      expect(c).toContain('md:rounded-[999px]');

      // Drifted tokens must be gone
      expect(c).not.toContain('md:py-2');
      expect(c).not.toContain('md:text-sm');
      expect(c).not.toContain('rounded-full');

      // Mobile tokens below md must still be present
      expect(c).toContain('max-md:rounded-full');
      expect(c).toContain('max-md:min-h-[44px]');
      expect(c).toContain('max-md:px-[14px]');
      expect(c).toContain('max-md:py-[8px]');
      expect(c).toContain('text-[14px]');
      expect(c).toContain('gap-1.5');
    }
  });

  it('chip active chứa md:[box-shadow:0_2px_8px_rgba(0,0,0,0.18)] và max-md:shadow-md, không có shadow-md không tiền tố', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const activePill = screen.getByTestId('cate-pill-ALL');
    const c = cls(activePill);
    expect(c).toContain('md:[box-shadow:0_2px_8px_rgba(0,0,0,0.18)]');
    expect(c).toContain('max-md:shadow-md');
    expect(c).not.toContain('shadow-md');
  });

  it('số đếm count span chứa md:opacity-[0.88]; bỏ md:opacity-90', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const pills = [screen.getByTestId('cate-pill-ALL'), screen.getByTestId('cate-pill-c1'), screen.getByTestId('cate-pill-c2')];
    for (const pill of pills) {
      const spans = pill.querySelectorAll('span');
      expect(spans).toHaveLength(2);
      const count = cls(spans[1]);
      expect(count).toContain('md:opacity-[0.88]');
      expect(count).not.toContain('md:opacity-90');
    }
  });
});
