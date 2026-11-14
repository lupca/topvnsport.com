// @vitest-environment jsdom
// STOR-052: HomePage.tsx chuẩn Yonex Badminton Specialty Hub (hero là banner cấu hình từ STOR-107)
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Product, Category } from '../types';

afterEach(cleanup);

const Probe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

const sampleRacketAttack: Product = {
  id: 'racket-1',
  name: 'Vợt Astrox 88D Pro',
  brand: 'Yonex',
  category: 'Vợt Cầu Lông',
  categoryCode: 'VC001491',
  price: 3500000,
  stock: 10,
  characteristics: 'Tấn Công',
  specs: { weight: '4U', balance: 305 },
  image: '/images/astrox88d.jpg',
} as Product;

const sampleRacketSpeed: Product = {
  id: 'racket-2',
  name: 'Vợt Nanoflare 800',
  brand: 'Yonex',
  category: 'Vợt Cầu Lông',
  categoryCode: 'VC001491',
  price: 3200000,
  stock: 5,
  characteristics: 'Phòng Thủ', // inferRacketPlayStyle maps Phòng Thủ -> Phản Tạt
  specs: { weight: '4U', balance: 290 },
  image: '/images/nanoflare800.jpg',
} as Product;

const sampleShuttleNoPlayStyle: Product = {
  id: 'shuttle-1',
  name: 'Quả cầu lông AS50',
  brand: 'Yonex',
  category: 'Quả Cầu Lông',
  categoryCode: 'c1',
  price: 500000,
  stock: 20,
  specs: {},
  image: '/images/as50.jpg',
} as Product;

const sampleCategories: Category[] = [
  { id: 1, name: 'Cầu Lông', code: 'c1', parent_id: null, display_name: 'Thể Thao > Cầu Lông' },
  { id: 2, name: 'Vợt', code: 'VC001491', parent_id: null, display_name: 'Thể Thao > Vợt' },
];

function renderHome(
  products: Product[] = [sampleRacketAttack, sampleRacketSpeed, sampleShuttleNoPlayStyle],
  categories: Category[] = sampleCategories
) {
  const store = configureStore({
    reducer: {
      appData: (state = { products, categories }) => state,
      cart: cartReducer,
      catalog: catalogReducer,
    },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<Probe />} />
          <Route path="/product/:slug" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('STOR-052 hero trang chủ không còn là slider sản phẩm (STOR-107)', () => {
  it('không còn slider sản phẩm: không testid slider-active-title / slider-cta / center-slide-*, hero không có tên sản phẩm', () => {
    renderHome([sampleRacketAttack, sampleRacketSpeed]);
    for (const id of ['badminton-center-slider', 'slider-active-title', 'slider-cta', 'slider-playstyle-badge', 'center-slide-active', 'center-slide-1']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    const hero = screen.getByTestId('hero-banner-section');
    expect(hero.textContent).not.toContain(sampleRacketAttack.name);
    expect(hero.textContent).not.toContain(sampleRacketSpeed.name);
  });

  it('Bấm dot chuyển banner, bấm nút Tạm dừng đổi aria-pressed', () => {
    renderHome();
    expect(screen.getByTestId('slider-dot-0').getAttribute('aria-current')).toBe('true');
    fireEvent.click(screen.getByTestId('slider-dot-1'));
    expect(screen.getByTestId('slider-dot-1').getAttribute('aria-current')).toBe('true');
    const toggle = screen.getByTestId('slider-pause-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('STOR-052 HomePage.tsx chuẩn Yonex Hub', () => {
  it('HomePage.tsx hiện chữ BADMINTON và h1 = HOME_SEO.h1 (như server render) trong khối data-testid="badminton-hub-header"', () => {
    renderHome();
    const header = screen.getByTestId('badminton-hub-header');
    expect(within(header).getByText('BADMINTON').tagName).toBe('P');
    const h1 = within(header).getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Vợt cầu lông, cước, giày và phụ kiện cầu lông');
  });

  it('STOR-056: bấm cate-pill-<code> lọc kệ ngay trên trang, URL vẫn là /', () => {
    renderHome();
    const pill = screen.getByTestId('cate-pill-VC001491');
    expect(pill.textContent).toContain('Vợt');
    fireEvent.click(pill);
    expect(screen.queryByTestId('loc')).toBeNull();
    const shelf = screen.getByTestId('instock-shelf');
    expect(within(shelf).queryByText('Quả cầu lông AS50')).toBeNull();
    expect(within(shelf).getByText('Vợt Astrox 88D Pro')).toBeTruthy();
  });

  it('STOR-056: không còn playstyle-filter-bar dù sản phẩm có lối đánh', () => {
    renderHome([sampleRacketAttack, sampleRacketSpeed]);
    expect(screen.queryByTestId('playstyle-filter-bar')).toBeNull();
    expect(screen.queryByTestId(/^playstyle-chip-/)).toBeNull();
  });

  it('Thẻ danh mục trong HomePage.tsx dùng class text-ink-primary cho tiêu đề h3 của ngành', () => {
    renderHome();
    const tile = screen.getByLabelText('Mở danh mục Cầu Lông');
    const h3 = within(tile).getByRole('heading', { level: 3 });
    expect(h3.className).toContain('text-ink-primary');
  });
});
