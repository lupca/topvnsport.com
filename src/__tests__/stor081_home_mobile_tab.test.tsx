// @vitest-environment jsdom
// STOR-081: trang chủ dưới md theo tab 'Khung nhìn Mobile (390px)' của public/design/index.html —
// hàng chip ngành cuộn ngang, banner 1:1, ẩn thanh lọc nhanh/đếm/sắp xếp, lưới khoảng dọc 16px,
// ô danh mục vuông, nút xem tất cả rộng hết khối, nhãn thanh dưới 11px #18181b.
// Mỗi thay đổi chỉ ở class gốc (dưới md); giá trị cũ nằm sau md: để 1440 không đổi.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import MobileBottomNav from '../features/navigation/MobileBottomNav';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';

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
const products = [prod('1'), prod('2', { categoryCode: 'c2' })];

describe('STOR-081 trang chủ 390px theo tab Mobile', () => {
  it('hàng chip ngành: một hàng cuộn ngang, căn trái dưới md; md+ giữ wrap + căn giữa', () => {
    renderHome(products);
    const c = cls(screen.getByTestId('cate-select-bar'));
    expect(c).toEqual(expect.arrayContaining(['flex-nowrap', 'overflow-x-auto', 'justify-start', 'md:flex-wrap', 'md:justify-center', 'md:overflow-visible']));
    // justify-center gốc đẩy chip đầu ra ngoài màn hình khi cuộn (spec 1ad39add).
    expect(c).not.toContain('justify-center');
    expect(c).not.toContain('flex-wrap');
  });

  it('banner: khung ảnh vuông 1:1 dưới md, md+ giữ 1400/600', () => {
    renderHome(products);
    const c = cls(screen.getByTestId('slider-visual-wrap'));
    expect(c).toEqual(expect.arrayContaining(['aspect-square', 'md:aspect-[1400/600]']));
    expect(c).not.toContain('aspect-[16/9]');
  });

  it('thanh lọc nhanh + đếm/sắp xếp ẩn dưới md, hiện flex ở md+', () => {
    renderHome(products);
    const c = cls(screen.getByTestId('quick-filter-bar').parentElement!);
    expect(c).toEqual(expect.arrayContaining(['hidden', 'md:flex', 'flex-col']));
    expect(c).not.toContain('flex');
  });

  it('lưới nổi bật: khoảng dọc 16px dưới md, md:gap-6', () => {
    renderHome(products);
    const c = cls(screen.getByTestId('featured-grid'));
    expect(c).toEqual(expect.arrayContaining(['gap-y-[16px]', 'gap-x-3', 'md:gap-6']));
    expect(c).not.toContain('gap-3');
  });

  it('ô danh mục: khung ảnh vuông dưới md, md+ 4/3', () => {
    renderHome(products);
    for (const code of ['c1', 'c2']) {
      const box = screen.getByTestId(`cat-tile-${code}`).firstElementChild!;
      expect(cls(box)).toEqual(expect.arrayContaining(['aspect-square', 'md:aspect-[4/3]']));
      expect(cls(box)).not.toContain('aspect-[4/3]');
    }
  });

  it('nút xem tất cả rộng hết khối dưới md, md+ 420px / 90%', () => {
    renderHome(products);
    const c = cls(screen.getByTestId('view-all-catalog'));
    expect(c).toEqual(expect.arrayContaining(['w-full', 'md:w-[420px]', 'md:max-w-[90%]']));
    expect(c).not.toContain('w-[420px]');
    expect(c).not.toContain('max-w-[90%]');
  });
});

describe('STOR-081 MobileBottomNav theo tab Mobile', () => {
  const LABELS = ['Trang chủ', 'Sản phẩm', 'Cửa hàng', 'Giỏ hàng'];
  const renderNav = () =>
    render(<MobileBottomNav pathname="/" navigate={vi.fn() as any} cartCount={0} onOpenCart={vi.fn()} />);

  it('nhãn 11px, giữ đủ 4 nhãn', () => {
    renderNav();
    for (const label of LABELS) {
      const span = screen.getByText(label);
      expect(cls(span)).toContain('text-[11px]');
      expect(cls(span)).not.toContain('text-[10px]');
    }
  });

  it('nút chưa chọn: chữ ink-secondary (#18181b) đậm, không text-gray-400 dưới md', () => {
    renderNav();
    for (const label of LABELS.slice(1)) {
      const btn = screen.getByText(label).closest('button')!;
      expect(cls(btn)).toEqual(expect.arrayContaining(['text-ink-secondary', 'font-bold']));
      expect(cls(btn)).not.toContain('text-gray-400');
    }
    const active = screen.getByText('Trang chủ').closest('button')!;
    expect(cls(active)).toContain('text-brand-primary');
    expect(cls(active)).not.toContain('text-ink-secondary');
  });

  it('viền trên đen 1.5px', () => {
    const { container } = renderNav();
    const bar = container.firstElementChild!;
    expect(cls(bar)).toEqual(expect.arrayContaining(['border-t-[1.5px]', 'border-ink-primary']));
    expect(cls(bar)).not.toContain('border-gray-100');
  });
});
