// @vitest-environment jsdom
// STOR-144 (MOB-E/F): trang chủ dưới md — vùng chạm ≥44px, chữ ≥14px; từ md giữ nguyên token cũ (1440 không đổi).
// Mỗi `it` chốt một nhánh; bỏ token tương ứng trong HomePage/HeroBanner thì test đó đỏ.
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

const STRING_TIER = { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'BG 65'] };
const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'BrandA', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const categories: Category[] = [
  { id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Thể Thao > Vợt' },
  { id: 2, name: 'Giày', code: 'c2', parent_id: null, display_name: 'Thể Thao > Giày' },
];

function renderHome() {
  const products = [prod('1', { tier_variations: [STRING_TIER] }), prod('2', { categoryCode: 'c2' })];
  const store = configureStore({
    reducer: { appData: (state = { products, categories }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(cleanup);
const cls = (el: Element) => el.className.toString().split(/\s+/);
const has = (el: Element, ...tokens: string[]) => expect(cls(el)).toEqual(expect.arrayContaining(tokens));

describe('STOR-144 trang chủ dưới md: 44px và chữ ≥14px', () => {
  it('chip ngành cao 44px dưới md, md:min-h-[44px] giữ nguyên', () => {
    renderHome();
    for (const code of ['ALL', 'c1', 'c2']) {
      const c = cls(screen.getByTestId(`cate-pill-${code}`));
      expect(c).toEqual(expect.arrayContaining(['max-md:min-h-[44px]', 'md:min-h-[44px]']));
      expect(c).not.toContain('max-md:min-h-[40px]');
    }
  });

  it('nhãn và số đếm chip 14px dưới md (kế thừa từ nút), md:text-[14.5px] / md:text-[11.5px] giữ nguyên', () => {
    renderHome();
    const pill = screen.getByTestId('cate-pill-ALL');
    has(pill, 'text-[14px]', 'md:text-[14.5px]');
    const [label, count] = [...pill.querySelectorAll('span')];
    // hai span không tự đặt cỡ chữ dưới md, nên cỡ chữ là của nút
    for (const s of [label, count]) expect(cls(s).filter(t => /^(max-md:)?text-(\[|xs|sm|base)/.test(t))).toEqual([]);
    has(count, 'md:text-[11.5px]');
  });

  it('eyebrow mobile 14px, giữ font-mono và tracking-[0.12em]', () => {
    renderHome();
    has(screen.getByTestId('hub-eyebrow-mobile'), 'md:hidden', 'text-[14px]', 'font-mono', 'tracking-[0.12em]');
  });

  it('CTA banner cao 44px dưới md, md:h-12 giữ nguyên', () => {
    renderHome();
    for (const cta of screen.getAllByTestId('hero-banner-cta')) has(cta, 'h-[44px]', 'md:h-12');
  });

  it('chữ CTA banner 14px dưới md, md:text-[15px] giữ nguyên', () => {
    renderHome();
    for (const cta of screen.getAllByTestId('hero-banner-cta')) has(cta, 'text-[14px]', 'md:text-[15px]');
  });

  it('subline banner 14px dưới md, md:text-[19px] giữ nguyên', () => {
    renderHome();
    for (const slide of screen.getAllByTestId('hero-banner')) has(slide.querySelector('p')!, 'text-[14px]', 'md:text-[19px]');
  });

  it('phụ đề SẢN PHẨM NỔI BẬT (md:hidden) 14px', () => {
    renderHome();
    has(screen.getByTestId('featured-subtitle-mobile'), 'md:hidden', 'text-[14px]');
  });

  it('tên ô ngành 14px dưới md, md:text-[15.5px] giữ nguyên', () => {
    renderHome();
    for (const code of ['c1', 'c2']) has(screen.getByTestId(`cat-tile-${code}`).querySelector('h3')!, 'max-md:text-[14px]', 'md:text-[15.5px]');
  });

  it('dot dưới md là nút 44x44 (cạnh nhau, không chồng), chấm 8px trong span; từ md giữ chấm 8px + ::before -10px', () => {
    renderHome();
    has(screen.getByTestId('slider-dots'), 'max-md:gap-0', 'gap-2.5');
    for (const i of [0, 1, 2, 3]) {
      const dot = screen.getByTestId(`slider-dot-${i}`);
      has(dot, 'max-md:h-11', 'max-md:min-w-11', 'max-md:flex', 'max-md:items-center', 'max-md:justify-center', 'md:h-[8px]', 'md:before:-inset-[10px]');
      const inner = dot.firstElementChild!;
      expect(inner.getAttribute('aria-hidden')).toBe('true');
      has(inner, 'md:hidden', 'h-[8px]', i === 0 ? 'w-[28px]' : 'w-[8px]');
    }
  });

  it('nút dừng 44x44 dưới md, h-8 w-8 từ md', () => {
    renderHome();
    has(screen.getByTestId('slider-pause-toggle'), 'max-md:h-11', 'max-md:w-11', 'h-8', 'w-8');
  });
});
