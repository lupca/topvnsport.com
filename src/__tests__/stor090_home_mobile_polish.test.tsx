// @vitest-environment jsdom
// STOR-090: hero 390px theo tab 'Khung nhìn Mobile (390px)' — thẻ giữa không viền, hé 26px, dots 7px
// (vùng chạm ::before 25px), nút dừng cao 20px, section 334 (pt 12 + 290 + controls 32), cách thanh chip 12px;
// chip gọn 40px, số đếm cùng font nhãn; ô ngành ảnh vuông viền đen, chỉ tên, phụ đề ngành ẩn dưới md.
// Tất cả là max-md: hoặc cặp md:<gốc> — 1440 không đổi.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import BadmintonCenterSlider from '../features/home/BadmintonCenterSlider';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Category, Product } from '../types';

const STRING_TIER = { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'BG 65'] };
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

function renderSlider() {
  const products = [prod('s1'), prod('s2'), prod('s3')] as Product[];
  return render(
    <MemoryRouter>
      <BadmintonCenterSlider products={products} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);
const cls = (el: Element) => el.className.toString().split(/\s+/);

describe('STOR-090 hero dưới md', () => {
  it('section: bỏ khoảng space-y dưới md, pt 12px tới thanh chip', () => {
    renderSlider();
    expect(cls(screen.getByTestId('badminton-center-slider'))).toEqual(expect.arrayContaining(['max-md:!mt-0', 'max-md:mb-0', 'max-md:pt-[12px]']));
  });

  it('hub header không đẩy margin space-y-12 xuống hero dưới md', () => {
    renderHome([prod('1')]);
    expect(cls(screen.getByTestId('badminton-hub-header'))).toContain('max-md:mb-0');
  });

  it('viewport: cột hé 26px, md+ giữ 1fr/1060px', () => {
    const { container } = renderSlider();
    const c = cls(container.querySelector('.center-slider-viewport')!);
    expect(c).toEqual(expect.arrayContaining(['grid-cols-[26px_minmax(0,290px)_26px]', 'md:grid-cols-[1fr_minmax(0,1060px)_1fr]']));
  });

  it('thẻ giữa không viền dưới md, md+ giữ viền', () => {
    renderSlider();
    expect(cls(screen.getByTestId('center-slide-active'))).toEqual(expect.arrayContaining(['border', 'max-md:border-0', 'border-line-strong']));
  });

  it('controls: giữ mt-2 md:mt-4, dưới md mt-0 pt 8 pb 4 gap 10', () => {
    const { container } = renderSlider();
    expect(cls(container.querySelector('.slider-controls')!)).toEqual(
      expect.arrayContaining(['mt-2', 'md:mt-4', 'max-md:mt-0', 'max-md:pt-[8px]', 'max-md:pb-[4px]', 'max-md:gap-[10px]']),
    );
  });

  it('mỗi dot 7x7 dưới md, vùng chạm ::before tuyệt đối -10px; md+ giữ 11px / 38px', () => {
    renderSlider();
    const dots = [0, 1, 2].map(i => cls(screen.getByTestId(`slider-dot-${i}`)));
    for (const c of dots) {
      expect(c).toEqual(expect.arrayContaining([
        'max-md:h-[7px]', 'max-md:w-[7px]', 'h-[11px]',
        'max-md:relative', 'max-md:before:absolute', 'max-md:before:-inset-[10px]', "max-md:before:content-['']",
      ]));
    }
    expect(dots[0]).toEqual(expect.arrayContaining(['w-[38px]', 'bg-ink-primary']));
    expect(dots[1]).toEqual(expect.arrayContaining(['w-[11px]', 'bg-line-tag']));
  });

  it('nút dừng: dưới md px 6 py 2 góc vuông, icon 14px (cao 20); md+ giữ px-3 py-1.5 rounded-[4px]; vẫn icon Lucide', () => {
    renderSlider();
    const t = screen.getByTestId('slider-pause-toggle');
    expect(cls(t)).toEqual(expect.arrayContaining(['max-md:px-[6px]', 'max-md:py-[2px]', 'max-md:rounded-none', 'px-3', 'py-1.5', 'rounded-[4px]']));
    const icon = () => t.querySelector('svg')!.getAttribute('class')!.split(/\s+/);
    expect(icon()).toEqual(expect.arrayContaining(['lucide-pause', 'max-md:w-[14px]', 'max-md:h-[14px]']));
    fireEvent.click(t);
    expect(t.getAttribute('aria-pressed')).toBe('true');
    expect(icon()).toEqual(expect.arrayContaining(['lucide-play', 'max-md:w-[14px]', 'max-md:h-[14px]']));
    expect(t.textContent).not.toContain('❚');
  });
});

describe('STOR-090 chip, tiêu đề nổi bật, ô ngành dưới md', () => {
  it('chip cao 40 px 14 py 8 dưới md; số đếm cùng font nhãn dưới md, md+ mono 11.5px', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const pill = screen.getByTestId('cate-pill-ALL');
    expect(cls(pill)).toEqual(expect.arrayContaining(['max-md:min-h-[40px]', 'max-md:px-[14px]', 'max-md:py-[8px]', 'min-h-11', 'md:px-[18px]', 'md:py-[8px]']));
    const count = cls(pill.querySelectorAll('span')[1]);
    expect(count).toEqual(expect.arrayContaining(['md:font-mono', 'md:text-[11.5px]', 'md:opacity-[0.88]']));
    expect(count).not.toContain('font-mono');
    expect(count).not.toContain('opacity-90');
  });

  it('tiêu đề SẢN PHẨM NỔI BẬT: 20px pt 22 dưới md; phụ đề mobile mt 2 pb 14; không O2O thì h2 tự pb 14', () => {
    renderHome([prod('1', { tier_variations: [STRING_TIER] })]);
    const h2 = screen.getByRole('heading', { level: 2, name: 'SẢN PHẨM NỔI BẬT' });
    expect(cls(h2)).toEqual(expect.arrayContaining(['max-md:text-[20px]', 'max-md:pt-[22px]', 'md:text-3xl', 'pt-5']));
    expect(cls(h2)).not.toContain('max-md:pb-[14px]');
    expect(cls(screen.getByTestId('featured-subtitle-mobile'))).toEqual(expect.arrayContaining(['max-md:mt-[2px]', 'max-md:pb-[14px]']));
    cleanup();
    renderHome([prod('1')]);
    expect(cls(screen.getByRole('heading', { level: 2, name: 'SẢN PHẨM NỔI BẬT' }))).toContain('max-md:pb-[14px]');
  });

  it('lọc nhanh vẫn ẩn dưới md (spec e7944019)', () => {
    renderHome([prod('1')]);
    expect(cls(screen.getByTestId('quick-filter-bar').parentElement!)).toEqual(expect.arrayContaining(['hidden', 'md:flex']));
  });

  it('phụ đề ngành ẩn dưới md nhưng còn trong DOM ngay sau h2', () => {
    renderHome([prod('1')]);
    const sub = screen.getByTestId('category-subtitle');
    expect(cls(sub)).toEqual(expect.arrayContaining(['hidden', 'md:block']));
    expect(sub.previousElementSibling?.textContent).toBe('Danh mục cầu lông');
  });

  it('ô ngành: không viền/nền dưới md; ảnh vuông viền đen; nhãn 13px py 6; không <p>', () => {
    renderHome([prod('1')]);
    const tile = screen.getByTestId('cat-tile-c1');
    expect(cls(tile)).toEqual(expect.arrayContaining(['max-md:border-0', 'max-md:bg-transparent', 'border', 'bg-white']));
    const img = tile.firstElementChild!;
    expect(cls(img)).toEqual(expect.arrayContaining(['aspect-square', 'max-md:border', 'max-md:border-line-strong', 'md:border-b', 'md:border-line-tag']));
    expect(cls(img)).not.toContain('border-b');
    const h3 = tile.querySelector('h3')!;
    expect(cls(h3)).toEqual(expect.arrayContaining(['max-md:text-[13px]', 'font-extrabold']));
    expect(cls(h3.parentElement!)).toEqual(expect.arrayContaining(['max-md:px-0', 'max-md:py-[6px]']));
    expect(tile.querySelectorAll('p')).toHaveLength(0);
  });
});
