// @vitest-environment jsdom
// STOR-052: BadmintonCenterSlider.tsx & HomePage.tsx chuẩn Yonex Badminton Specialty Hub
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import BadmintonCenterSlider from '../features/home/BadmintonCenterSlider';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Product, Category } from '../types';
import { getProductPath } from '../utils/productSlug';

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

function renderSlider(products: Product[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BadmintonCenterSlider products={products} />} />
        <Route path="/product/:slug" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('STOR-052 BadmintonCenterSlider.tsx', () => {
  it('BadmintonCenterSlider.tsx trả về null khi danh sách products rỗng', () => {
    const { container } = renderSlider([]);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('badminton-center-slider')).toBeNull();
  });

  it('BadmintonCenterSlider.tsx hiện tên sản phẩm thật qua data-testid="slider-active-title"', () => {
    renderSlider([sampleRacketAttack, sampleRacketSpeed]);
    expect(screen.getByTestId('slider-active-title').textContent).toBe(sampleRacketAttack.name);
  });

  it('BadmintonCenterSlider.tsx hiện data-testid="slider-playstyle-badge" khi sản phẩm có lối đánh', () => {
    renderSlider([sampleRacketAttack]);
    const badge = screen.getByTestId('slider-playstyle-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('Tấn Công');

    cleanup();
    renderSlider([sampleShuttleNoPlayStyle]);
    expect(screen.queryByTestId('slider-playstyle-badge')).toBeNull();
  });

  it('Bấm nút data-testid="slider-next" chuyển sang slide kế tiếp', () => {
    renderSlider([sampleRacketAttack, sampleRacketSpeed]);
    expect(screen.getByTestId('slider-active-title').textContent).toBe(sampleRacketAttack.name);

    fireEvent.click(screen.getByTestId('slider-next'));
    expect(screen.getByTestId('slider-active-title').textContent).toBe(sampleRacketSpeed.name);
  });

  it('Bấm nút data-testid="slider-dot-1" chuyển slide đang chọn sang vị trí 1', () => {
    renderSlider([sampleRacketAttack, sampleRacketSpeed]);
    expect(screen.getByTestId('slider-active-title').textContent).toBe(sampleRacketAttack.name);

    fireEvent.click(screen.getByTestId('slider-dot-1'));
    expect(screen.getByTestId('slider-active-title').textContent).toBe(sampleRacketSpeed.name);
  });

  it('Bấm nút data-testid="slider-pause-toggle" đổi trạng thái aria-pressed', () => {
    renderSlider([sampleRacketAttack, sampleRacketSpeed]);
    const toggle = screen.getByTestId('slider-pause-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('Bấm nút data-testid="slider-cta" điều hướng tới getProductPath(activeProduct)', () => {
    renderSlider([sampleRacketAttack]);
    fireEvent.click(screen.getByTestId('slider-cta'));
    expect(screen.getByTestId('loc').textContent).toBe(getProductPath(sampleRacketAttack));
  });

  it('Bấm slide lân cận center-slide-1 chuyển activeIndex sang vị trí 1', () => {
    renderSlider([sampleRacketAttack, sampleRacketSpeed]);
    fireEvent.click(screen.getByTestId('center-slide-1'));
    expect(screen.getByTestId('slider-active-title').textContent).toBe(sampleRacketSpeed.name);
  });
});

describe('STOR-052 HomePage.tsx chuẩn Yonex Hub', () => {
  it('HomePage.tsx hiện tiêu đề h1 BADMINTON trong khối data-testid="badminton-hub-header"', () => {
    renderHome();
    const header = screen.getByTestId('badminton-hub-header');
    expect(header).toBeTruthy();
    const h1 = within(header).getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('BADMINTON');
  });

  it('Bấm nút data-testid="cate-pill-<code>" điều hướng tới /catalog?category=<code>', () => {
    renderHome();
    const pill = screen.getByTestId('cate-pill-VC001491');
    expect(pill.textContent).toContain('Vợt');
    fireEvent.click(pill);
    expect(screen.getByTestId('loc').textContent).toBe('/catalog?category=VC001491');
  });

  it('HomePage.tsx chỉ render data-testid="playstyle-filter-bar" khi availablePlayStyles khác rỗng', () => {
    renderHome([sampleShuttleNoPlayStyle]);
    expect(screen.queryByTestId('playstyle-filter-bar')).toBeNull();

    cleanup();
    renderHome([sampleRacketAttack, sampleRacketSpeed]);
    expect(screen.getByTestId('playstyle-filter-bar')).toBeTruthy();
  });

  it('Bấm chip lối đánh trong playstyle-filter-bar lọc đúng sản phẩm trên instock-shelf', () => {
    renderHome([sampleRacketAttack, sampleRacketSpeed]);
    const shelf = screen.getByTestId('instock-shelf');
    expect(within(shelf).getByText('Vợt Astrox 88D Pro')).toBeTruthy();
    expect(within(shelf).getByText('Vợt Nanoflare 800')).toBeTruthy();

    const speedChip = screen.getByTestId('playstyle-chip-Phản Tạt');
    fireEvent.click(speedChip);

    expect(within(shelf).getByText('Vợt Nanoflare 800')).toBeTruthy();
    expect(within(shelf).queryByText('Vợt Astrox 88D Pro')).toBeNull();

    const allChip = screen.getByTestId('playstyle-chip-ALL');
    fireEvent.click(allChip);

    expect(within(shelf).getByText('Vợt Astrox 88D Pro')).toBeTruthy();
    expect(within(shelf).getByText('Vợt Nanoflare 800')).toBeTruthy();
  });

  it('Thẻ danh mục trong HomePage.tsx dùng class text-ink-primary cho tiêu đề h3 của ngành', () => {
    renderHome();
    const tile = screen.getByLabelText('Mở danh mục Cầu Lông');
    const h3 = within(tile).getByRole('heading', { level: 3 });
    expect(h3.className).toContain('text-ink-primary');
  });
});
