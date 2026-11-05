// @vitest-environment jsdom
// STOR-090: hero 390px theo tab 'Khung nhìn Mobile (390px)' — dots 8px (vùng chạm ::before 28px), nút dừng 32px,
// section = pt 12 + hộp 290 (STOR-107: điều khiển nằm trong hộp), cách thanh chip 12px;
// chip gọn 40px, số đếm cùng font nhãn; ô ngành ảnh vuông viền đen, chỉ tên, phụ đề ngành ẩn dưới md.
// Tất cả là max-md: hoặc cặp md:<gốc> — 1440 không đổi.
// STOR-144: dưới md dot là nút 44x44 (chấm 8px bên trong), nút dừng 44px, chip 44px, chữ ≥14px.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
const cls = (el: Element) => el.className.toString().split(/\s+/);

describe('STOR-090 hero dưới md (STOR-107: banner theo cấu hình)', () => {
  it('section: bỏ khoảng space-y dưới md, pt 12px tới thanh chip', () => {
    renderHome([prod('1')]);
    expect(cls(screen.getByTestId('hero-banner-section'))).toEqual(expect.arrayContaining(['max-md:!mt-0', 'max-md:mb-0', 'max-md:pt-[12px]']));
  });

  it('hub header không đẩy margin space-y-12 xuống hero dưới md', () => {
    renderHome([prod('1')]);
    expect(cls(screen.getByTestId('badminton-hub-header'))).toContain('max-md:mb-0');
  });

  it('dot từ md: 8x8 (đang chọn rộng 28) vùng chạm ::before -10px; dưới md nút 44x44 chứa chấm 8px (STOR-144)', () => {
    renderHome([prod('1')]);
    const dots = [0, 1, 2].map(i => cls(screen.getByTestId(`slider-dot-${i}`)));
    for (const c of dots) {
      expect(c).toEqual(expect.arrayContaining(['md:h-[8px]', 'relative', 'md:before:absolute', 'md:before:-inset-[10px]', "md:before:content-['']", 'max-md:h-11', 'max-md:min-w-11']));
    }
    expect(dots[0]).toEqual(expect.arrayContaining(['md:w-[28px]', 'md:bg-white']));
    expect(dots[1]).toEqual(expect.arrayContaining(['md:w-[8px]', 'md:bg-white/50']));
    const inner = [0, 1].map(i => cls(screen.getByTestId(`slider-dot-${i}`).firstElementChild!));
    expect(inner[0]).toEqual(expect.arrayContaining(['md:hidden', 'h-[8px]', 'w-[28px]', 'bg-white']));
    expect(inner[1]).toEqual(expect.arrayContaining(['md:hidden', 'h-[8px]', 'w-[8px]', 'bg-white/50']));
  });

  it('nút dừng: tròn 32px từ md, 44px dưới md (STOR-144), icon Lucide Pause -> Play, không ký tự ❚', () => {
    renderHome([prod('1')]);
    const t = screen.getByTestId('slider-pause-toggle');
    expect(cls(t)).toEqual(expect.arrayContaining(['h-8', 'w-8', 'max-md:h-11', 'max-md:w-11', 'rounded-full']));
    const icon = () => t.querySelector('svg')!.getAttribute('class')!.split(/\s+/);
    expect(icon()).toContain('lucide-pause');
    fireEvent.click(t);
    expect(t.getAttribute('aria-pressed')).toBe('true');
    expect(icon()).toContain('lucide-play');
    expect(t.textContent).not.toContain('❚');
  });
});

describe('STOR-090 chip, tiêu đề nổi bật, ô ngành dưới md', () => {
  it('chip cao 44 (STOR-144) px 14 py 8 dưới md; số đếm cùng font nhãn dưới md, md+ mono 11.5px', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const pill = screen.getByTestId('cate-pill-ALL');
    expect(cls(pill)).toEqual(expect.arrayContaining(['max-md:min-h-[44px]', 'max-md:px-[14px]', 'max-md:py-[8px]', 'min-h-11', 'md:px-[18px]', 'md:py-[8px]']));
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

  it('ô ngành: không viền/nền dưới md; ảnh vuông viền đen; nhãn 14px (STOR-144) py 6; <p> duy nhất là phụ đề ẩn dưới md', () => {
    renderHome([prod('1')]);
    const tile = screen.getByTestId('cat-tile-c1');
    expect(cls(tile)).toEqual(expect.arrayContaining(['max-md:border-0', 'max-md:bg-transparent', 'border', 'bg-white']));
    const img = tile.firstElementChild!;
    expect(cls(img)).toEqual(expect.arrayContaining(['aspect-square', 'max-md:border', 'max-md:border-line-strong', 'md:border-b', 'md:border-line-tag']));
    expect(cls(img)).not.toContain('border-b');
    const h3 = tile.querySelector('h3')!;
    expect(cls(h3)).toEqual(expect.arrayContaining(['max-md:text-[14px]', 'font-extrabold']));
    expect(cls(h3.parentElement!)).toEqual(expect.arrayContaining(['max-md:px-0', 'max-md:py-[6px]']));
    for (const p of tile.querySelectorAll('p')) {
      expect(p.getAttribute('data-testid')).toBe('cat-tile-sub');
      expect(cls(p)).toEqual(expect.arrayContaining(['hidden', 'md:block']));
    }
  });
});
