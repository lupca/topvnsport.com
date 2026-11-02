// @vitest-environment jsdom
// STOR-073: bố cục trang chủ theo public/design/index.html — eyebrow, phụ đề mục, hàng đếm/sắp xếp riêng,
// nội dung 1232px ở 1440, ảnh thẻ ~288px, ô danh mục không bao giờ trống ảnh. Không dữ liệu mẫu của design.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { hasO2OStringing } from '../utils/badmintonReadiness';

const STRING_TIER = { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'BG 65'] };
const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'BrandA', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const categories = [
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
const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
// src/index.css đặt html font-size 17px: 1 bậc spacing Tailwind = 0.25rem = 4.25px, nên lề phải là px tuyệt đối.
const SPACING_PX = 0.25 * 17;
// Bề rộng nội dung ở viewport 1440 (md trở lên) suy từ class Tailwind của section.
const innerAt1440 = (el: Element) => {
  const max = Number(/^max-w-\[(\d+)px\]$/.exec(cls(el).find(c => c.startsWith('max-w-')) ?? '')?.[1]);
  const m = /^md:px-(?:\[(\d+)px\]|(\d+))$/.exec(cls(el).find(c => c.startsWith('md:px-')) ?? '');
  const pad = m?.[1] ? Number(m[1]) : Number(m?.[2]) * SPACING_PX;
  return Math.min(max, 1440) - 2 * pad;
};

describe('STOR-073 bố cục trang chủ', () => {
  it('(1) eyebrow nằm trong hub header, ngay trên h1 BADMINTON, đúng kiểu chữ design', () => {
    renderHome([prod('1')]);
    const hub = screen.getByTestId('badminton-hub-header');
    const eyebrow = within(hub).getByText('TOPVNSPORT OFFICIAL SPECIALTY HUB');
    const h1 = within(hub).getByRole('heading', { level: 1, name: 'BADMINTON' });
    expect(eyebrow.nextElementSibling).toBe(h1);
    expect(cls(eyebrow)).toEqual(expect.arrayContaining(['font-mono', 'font-bold', 'uppercase', 'text-brand-primary', 'text-xs']));
  });

  it('(2) phụ đề SẢN PHẨM NỔI BẬT = số SP còn hàng thật, không có "12" mẫu; vế đan cước chỉ khi có SP còn hàng có tầng cước', () => {
    renderHome([prod('1'), prod('2'), prod('3', { stock: 0, tier_variations: [STRING_TIER] })]);
    const h2 = screen.getByRole('heading', { level: 2, name: 'SẢN PHẨM NỔI BẬT' });
    const sub = screen.getByTestId('featured-subtitle');
    expect(h2.nextElementSibling).toBe(sub);
    expect(sub.textContent).toBe('2 sản phẩm thật từ hệ thống PIM TopVNSport');
    expect(sub.textContent).not.toMatch(/\b12\b/);
    cleanup();

    const withTier = [prod('1', { tier_variations: [STRING_TIER] }), prod('2')];
    expect(withTier.some(hasO2OStringing)).toBe(true);
    renderHome(withTier);
    expect(screen.getByTestId('featured-subtitle').textContent).toBe(
      '2 sản phẩm thật từ hệ thống PIM TopVNSport — Tích hợp cấu hình đan cước 2 tầng (Khung vợt + Loại cước & Số KG)',
    );
  });

  it('(2) phụ đề Danh mục cầu lông đúng câu của design, ngay dưới h2', () => {
    renderHome([prod('1')]);
    const h2 = screen.getByRole('heading', { level: 2, name: 'Danh mục cầu lông' });
    const sub = screen.getByTestId('category-subtitle');
    expect(h2.nextElementSibling).toBe(sub);
    expect(sub.textContent).toBe('Đi thẳng vào từng nhóm trang thiết bị cầu lông chuyên dụng');
  });

  it('(3) bộ đếm + sắp xếp ở hàng riêng sau thanh lọc nhanh (toolbar xếp cột ở mọi breakpoint)', () => {
    renderHome([prod('1')]);
    const quick = screen.getByTestId('quick-filter-bar');
    const row = screen.getByTestId('shelf-count-sort');
    expect(row.contains(screen.getByTestId('result-counter'))).toBe(true);
    expect(row.contains(screen.getByTestId('sort-select'))).toBe(true);
    expect(quick.nextElementSibling).toBe(row);
    expect(follows(quick, row)).toBe(true);
    const toolbar = quick.parentElement!;
    expect(cls(toolbar)).toContain('flex-col');
    expect(cls(toolbar).some(c => /^(sm|md|lg|xl):flex-row$/.test(c))).toBe(false);
  });

  it('(4) nội dung hub / kệ / danh mục rộng 1232px ở 1440', () => {
    renderHome([prod('1')]);
    for (const id of ['badminton-hub-header', 'instock-shelf', 'category-tiles']) {
      expect(innerAt1440(screen.getByTestId(id))).toBe(1232);
    }
  });

  it('(5) ảnh thẻ SP trên trang chủ ~288px ở 1440 như design (1:1, 4 cột)', () => {
    renderHome([prod('1')]);
    const grid = screen.getByTestId('featured-grid');
    expect(cls(grid)).toEqual(expect.arrayContaining(['lg:grid-cols-4', 'md:gap-6']));
    const img = within(grid).getByTestId('product-card-image');
    expect(cls(img)).toContain('aspect-square');
    const cardWidth = (innerAt1440(screen.getByTestId('instock-shelf')) - 3 * 6 * SPACING_PX) / 4;
    // design đo bằng Playwright: ảnh 288px ở 1440 (thẻ 290px trừ viền); QA ghi ~190 là đo nhầm.
    expect(Math.abs(cardWidth - 288)).toBeLessThanOrEqual(10);
  });

  it('(6) ô danh mục: ảnh lỗi -> thử ảnh SP còn hàng kế tiếp cùng ngành, hết ảnh -> placeholder có icon, không phụ đề', () => {
    renderHome([prod('1', { image: '/img/a.jpg' }), prod('2', { image: '/img/b.jpg' }), prod('3', { categoryCode: 'c2', image: '/img/c.jpg' })]);
    const tile = screen.getByTestId('cat-tile-c1');
    expect(within(tile).getByRole('img').getAttribute('src')).toBe('/img/a.jpg');
    fireEvent.error(within(tile).getByRole('img'));
    expect(within(tile).getByRole('img').getAttribute('src')).toBe('/img/b.jpg');
    fireEvent.error(within(tile).getByRole('img'));
    expect(within(tile).queryByRole('img')).toBeNull();
    const ph = within(tile).getByTestId('cat-tile-placeholder');
    const svg = ph.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    expect(ph.textContent).toBe('');
    // ô khác không bị ảnh hưởng; không ô nào có phụ đề
    expect(within(screen.getByTestId('cat-tile-c2')).getByRole('img').getAttribute('src')).toBe('/img/c.jpg');
    for (const t of screen.getAllByTestId(/^cat-tile-c\d$/)) {
      expect(t.textContent).toBe(t.querySelector('h3')!.textContent);
      expect(t.querySelectorAll('p')).toHaveLength(0);
    }
  });

  it('không có sản phẩm / ảnh / số mẫu của design', () => {
    renderHome([prod('1')]);
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/yonexshop\.jp|12 sản phẩm|Vợt Cầu Lông \(Rackets\)|Đủ 3U \/ 4U \/ 5U/);
  });
});
