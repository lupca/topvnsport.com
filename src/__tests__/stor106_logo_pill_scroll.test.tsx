// @vitest-environment jsdom
// STOR-106: logo ảnh thật (lưu trong public/) ở header desktop, hàng mobile, ngăn kéo;
// bấm chip ngành trang chủ lọc kệ và cuộn kệ SẢN PHẨM NỔI BẬT vào tầm nhìn (mượt, hoặc 'auto' khi giảm chuyển động).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { existsSync, readFileSync } from 'node:fs';
import Header from '../components/Header';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Category } from '../types';

const LOGO_ALT = 'TopVNSport Logo';
const LOGO_SRC = '/topvnsport-logo.webp';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

const categories: Category[] = [
  { id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Thể Thao > Vợt' },
  { id: 2, name: 'Giày', code: 'c2', parent_id: null, display_name: 'Thể Thao > Giày' },
];
const prod = (id: string, categoryCode: string) =>
  ({ id, name: `SP ${id}`, brand: 'BrandA', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode }) as any;
const products = [prod('1', 'c1'), prod('2', 'c2'), prod('3', 'c2')];

function renderHeader(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header cartCount={0} openCart={vi.fn()} products={[]} categories={categories} />
    </MemoryRouter>,
  );
}

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderHome() {
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
        <Routes>
          <Route path="/" element={<><HomePage /><Where /></>} />
          <Route path="/catalog" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(cleanup);

describe('STOR-106 logo: ảnh thật ở desktop, hàng mobile và ngăn kéo', () => {
  it('desktop: ảnh logo đứng cạnh wordmark trong khối thương hiệu', () => {
    renderHeader('/');
    const brand = screen.getByTestId('brand-wordmark').parentElement!.parentElement!;
    const logo = within(brand).getByAltText(LOGO_ALT);
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src')).toBe(LOGO_SRC);
  });

  it('mobile: ảnh logo nằm trong khối wordmark, chữ vẫn đúng "TOPVNSPORT"', () => {
    const { container } = renderHeader('/');
    const row = screen.getByRole('button', { name: 'Đan cước' }).parentElement!;
    const wordmark = Array.from(row.querySelectorAll('div')).find(d => d.textContent === 'TOPVNSPORT')!;
    expect(wordmark).toBeDefined();
    const logo = within(wordmark).getByAltText(LOGO_ALT);
    expect(logo.getAttribute('src')).toBe(LOGO_SRC);
    expect(container.querySelectorAll(`img[alt="${LOGO_ALT}"]`)).toHaveLength(2);
  });

  it('ngăn kéo mở trên /catalog: có ảnh logo trong ngăn kéo', () => {
    renderHeader('/catalog');
    expect(document.getElementById('mobile-sidebar-drawer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open mobile menu' }));
    const drawer = document.getElementById('mobile-sidebar-drawer')!;
    const logo = within(drawer).getByAltText(LOGO_ALT);
    expect(logo.getAttribute('src')).toBe(LOGO_SRC);
    expect(logo.hasAttribute('referrerpolicy')).toBe(false);
  });
});

describe('STOR-106 logo: lưu trong repo, không còn ô chữ TVN', () => {
  it('mọi ảnh logo trỏ vào đường dẫn repo và không có CDN ngoài trong DOM', () => {
    const { container } = renderHeader('/catalog');
    fireEvent.click(screen.getByRole('button', { name: 'Open mobile menu' }));
    const logos = Array.from(container.querySelectorAll(`img[alt="${LOGO_ALT}"]`));
    expect(logos).toHaveLength(3);
    for (const logo of logos) expect(logo.getAttribute('src')).toBe(LOGO_SRC);
    expect(container.innerHTML).not.toContain('susercontent');
  });

  it('public/topvnsport-logo.webp có thật và là file WebP', () => {
    expect(existsSync('public/topvnsport-logo.webp')).toBe(true);
    const head = readFileSync('public/topvnsport-logo.webp').subarray(0, 12);
    expect(head.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(head.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });

  it('không còn ô chữ "TVN" trong DOM header lẫn Header.tsx, không còn susercontent trong nguồn', () => {
    renderHeader('/');
    expect(screen.queryByText('TVN')).toBeNull();
    const src = readFileSync('src/components/Header.tsx', 'utf8');
    expect(src).not.toContain('TVN');
    expect(src).not.toContain('susercontent');
  });
});

describe('STOR-106 chip ngành: lọc kệ và cuộn kệ vào tầm nhìn', () => {
  const scroll = vi.mocked(Element.prototype.scrollIntoView);
  const gridNames = () => within(screen.getByTestId('featured-grid')).queryAllByText(/^SP \d$/).map(e => e.textContent);
  const setReducedMotion = (reduce: boolean) =>
    vi.spyOn(window, 'matchMedia').mockImplementation(
      query => ({ matches: reduce && query === REDUCE_QUERY, media: query }) as MediaQueryList,
    );

  beforeEach(() => scroll.mockClear());
  afterEach(() => vi.restoreAllMocks());

  it('vừa tải trang không gọi scrollIntoView', () => {
    renderHome();
    expect(scroll).not.toHaveBeenCalled();
  });

  it('bấm chip gọi scrollIntoView đúng một lần, this là kệ instock-shelf', () => {
    renderHome();
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(screen.getByTestId('instock-shelf'));
    expect(scroll.mock.calls[0][0]).toMatchObject({ block: 'start' });
  });

  it('chuyển động bình thường: behavior smooth', () => {
    setReducedMotion(false);
    renderHome();
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(scroll.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' });
  });

  it('giảm chuyển động (prefers-reduced-motion): behavior auto', () => {
    setReducedMotion(true);
    renderHome();
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(scroll.mock.calls[0][0]).toMatchObject({ behavior: 'auto' });
  });

  it('mỗi lần bấm chip (kể cả "Tất cả") đều cuộn', () => {
    renderHome();
    fireEvent.click(screen.getByTestId('cate-pill-c1'));
    fireEvent.click(screen.getByTestId('cate-pill-ALL'));
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('bấm chip đặt aria-selected cho chip đó và bỏ chip cũ', () => {
    renderHome();
    expect(screen.getByTestId('cate-pill-ALL').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(screen.getByTestId('cate-pill-c2').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('cate-pill-ALL').getAttribute('aria-selected')).toBe('false');
  });

  it('bấm chip đổi sản phẩm trong kệ và không rời trang chủ', () => {
    renderHome();
    expect(gridNames()).toEqual(['SP 1', 'SP 2', 'SP 3']);
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(gridNames()).toEqual(['SP 2', 'SP 3']);
    fireEvent.click(screen.getByTestId('cate-pill-c1'));
    expect(gridNames()).toEqual(['SP 1']);
    expect(screen.getByTestId('where').textContent).toBe('/');
  });
});
