// @vitest-environment jsdom
// STOR-087: trang chủ 390px theo tab 'Khung nhìn Mobile (390px)' của public/design/index.html —
// banner 290x290 (cột giữa 290px, căn giữa), ẩn caption bar / mũi tên / nhãn 'Tạm dừng' dưới md,
// hamburger ẩn trên '/' (giữ ở '/catalog'), eyebrow SPECIALTY STORE, chip tách viên riêng
// (viền từng pill, không panel xám), phụ đề mobile 'Chạm vào thẻ...' chỉ khi có SP còn hàng có tầng cước.
// Mọi thay đổi chỉ là cặp hidden md:<orig>, token dời sau md:, hoặc max-md: — 1440 và các tuyến khác không đổi.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
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
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </Provider>,
  );
}

function renderSlider() {
  const products: Product[] = [
    { ...prod('s1'), slug: 'sp-1' } as Product,
    { ...prod('s2'), slug: 'sp-2' } as Product,
  ];
  return render(
    <MemoryRouter>
      <BadmintonCenterSlider products={products} />
    </MemoryRouter>,
  );
}

function renderHeaderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header cartCount={1} openCart={vi.fn()} products={[prod('h1') as any]} categories={categories} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

const cls = (el: Element) => el.className.toString().split(/\s+/);

describe('STOR-087 hero 290px dưới md theo tab Mobile', () => {
  it('viewport lưới: cột giữa max 290px, cả khối căn giữa dưới md; md+ trả về justify thường', () => {
    const { container } = renderSlider();
    const viewport = container.querySelector('.center-slider-viewport')!;
    expect(cls(viewport)).toEqual(expect.arrayContaining(['grid-cols-[26px_minmax(0,290px)_26px]', 'justify-center', 'md:justify-normal']));
    expect(cls(viewport)).not.toContain('grid-cols-[18px_minmax(0,1fr)_18px]');
  });

  it('caption bar (hàng tiêu đề + XEM CHI TIẾT) ẩn dưới md, hiện flex ở md+', () => {
    renderSlider();
    const c = cls(screen.getByTestId('slider-caption-bar'));
    expect(c).toEqual(expect.arrayContaining(['hidden', 'md:flex', 'flex-row']));
    expect(c).not.toContain('flex');
  });

  it('mũi tên prev: ẩn dưới md, md:inline-flex', () => {
    renderSlider();
    const c = cls(screen.getByTestId('slider-prev'));
    expect(c).toEqual(expect.arrayContaining(['hidden', 'md:inline-flex']));
    expect(c).not.toContain('inline-flex');
  });

  it('mũi tên next: ẩn dưới md, md:inline-flex', () => {
    renderSlider();
    const c = cls(screen.getByTestId('slider-next'));
    expect(c).toEqual(expect.arrayContaining(['hidden', 'md:inline-flex']));
    expect(c).not.toContain('inline-flex');
  });

  it('nhãn chữ "Tạm dừng/Phát tiếp" ẩn dưới md, icon Pause/Play vẫn hiện (nút không hidden)', () => {
    renderSlider();
    const toggle = screen.getByTestId('slider-pause-toggle');
    const label = toggle.querySelector('span')!;
    expect(cls(label)).toEqual(expect.arrayContaining(['hidden', 'md:inline']));
    expect(cls(toggle)).not.toContain('hidden');
    expect(cls(toggle)).toContain('inline-flex');
  });

  it('chip SP và dots vẫn hiện dưới md (không thêm hidden)', () => {
    renderSlider();
    expect(cls(screen.getByTestId('slider-product-chip'))).not.toContain('hidden');
    expect(cls(screen.getByTestId('slider-dots'))).not.toContain('hidden');
  });
});

describe('STOR-087 hamburger ẩn trên "/" dưới md, còn ở "/catalog"', () => {
  it('ở "/" có token hidden, vẫn mounted giữ shrink-0 và aria-label (stor068 F4)', () => {
    renderHeaderAt('/');
    const hamburger = screen.getByRole('button', { name: 'Open mobile menu' });
    expect(cls(hamburger)).toContain('hidden');
    expect(cls(hamburger)).toContain('shrink-0');
  });

  it.each(['/catalog', '/stores'])('ở "%s" không có token hidden', (route) => {
    renderHeaderAt(route);
    expect(cls(screen.getByRole('button', { name: 'Open mobile menu' }))).not.toContain('hidden');
  });
});

describe('STOR-087 eyebrow SPECIALTY STORE và chip tách viên theo tab Mobile', () => {
  it('eyebrow mobile md:hidden, chữ SPECIALTY STORE, 10px tracking 0.12em; eyebrow desktop hidden md:block 14em', () => {
    renderHome([prod('1')]);
    const mobile = screen.getByTestId('hub-eyebrow-mobile');
    expect(mobile.textContent).toBe('SPECIALTY STORE');
    expect(cls(mobile)).toEqual(expect.arrayContaining(['md:hidden', 'font-mono', 'text-[10px]', 'tracking-[0.12em]', 'uppercase', 'text-brand-primary']));
    const desktop = screen.getByTestId('hub-eyebrow');
    expect(cls(desktop)).toEqual(expect.arrayContaining(['hidden', 'md:block', 'text-xs', 'tracking-[0.14em]']));
    // eyebrow mobile nằm TRƯỚC eyebrow desktop (stor073 (1) vẫn thấy hub-eyebrow trên h1).
    expect(mobile.nextElementSibling).toBe(desktop);
    expect(desktop.nextElementSibling).toBe(screen.getByRole('heading', { level: 1, name: 'BADMINTON' }));
  });

  it('thanh chip: trong suốt + viền đáy dưới md (không panel xám), md+ giữ pill-bg viền tròn như cũ', () => {
    renderHome([prod('1')]);
    const c = cls(screen.getByTestId('cate-select-bar'));
    expect(c).toEqual(expect.arrayContaining([
      'w-full', 'md:w-fit', 'border-b', 'border-[#e4e4e7]', 'md:border', 'md:border-line-tag',
      'md:bg-pill-bg', 'md:rounded-[999px]', 'px-0', 'pt-1', 'pb-3', 'md:p-[6px]', 'gap-2', 'md:gap-[4px]',
    ]));
    expect(c).not.toContain('bg-pill-bg');
    expect(c).not.toContain('rounded-2xl');
    expect(c).not.toContain('w-fit');
    expect(c).not.toContain('p-2');
    // stor081: tokens cuộn ngang phải sống sót.
    expect(c).toEqual(expect.arrayContaining(['flex-nowrap', 'overflow-x-auto', 'justify-start', 'md:flex-wrap', 'md:justify-center', 'md:overflow-visible']));
  });

  it('mỗi pill có viền riêng dưới md: active viền đen, inactive viền line-tag nền #f4f4f5', () => {
    renderHome([prod('1'), prod('2', { categoryCode: 'c2' })]);
    const active = cls(screen.getByTestId('cate-pill-ALL'));
    expect(active).toEqual(expect.arrayContaining(['max-md:border', 'max-md:border-ink-primary', 'bg-ink-primary']));
    const inactive = cls(screen.getByTestId('cate-pill-c2'));
    expect(inactive).toEqual(expect.arrayContaining(['max-md:border', 'max-md:border-line-tag', 'max-md:bg-[#f4f4f5]']));
    expect(inactive).not.toContain('bg-ink-primary');
  });

  it('phụ đề nổi bật: desktop hidden md:block; mobile "Chạm vào thẻ..." chỉ khi có SP còn hàng có tầng cước', () => {
    renderHome([prod('1', { tier_variations: [STRING_TIER] }), prod('2')]);
    const desktop = screen.getByTestId('featured-subtitle');
    expect(cls(desktop)).toEqual(expect.arrayContaining(['hidden', 'md:block']));
    const mobile = screen.getByTestId('featured-subtitle-mobile');
    expect(mobile.textContent).toBe('Chạm vào thẻ sản phẩm để chọn loại cước & số kg');
    expect(cls(mobile)).toEqual(expect.arrayContaining(['md:hidden', 'text-xs', 'font-semibold', 'text-ink-secondary']));
    // phụ đề mobile nằm SAU featured-subtitle (stor073 (2) vẫn thấy sub ngay dưới h2).
    expect(desktop.nextElementSibling).toBe(mobile);
    cleanup();

    renderHome([prod('1'), prod('2')]);
    expect(screen.queryByTestId('featured-subtitle-mobile')).toBeNull();
    expect(cls(screen.getByTestId('featured-subtitle'))).toEqual(expect.arrayContaining(['hidden', 'md:block']));
  });
});
