// @vitest-environment jsdom
// STOR-058: menu chính + thanh đan cước theo /design/index.html; bỏ dải #trust-badges-ribbon khỏi trang chủ.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import MainNav from '../components/MainNav';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Category, Product } from '../types';

const api = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getAllStock: vi.fn(),
  getCategories: vi.fn(),
  getBranches: vi.fn(),
  getStringOptions: vi.fn()
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

import App from '../App';

// Bốn ngành VOMA đang có hàng trên production (VC001427 Giày không nằm trong đó).
const LIVE: Category[] = [
  { id: 5, code: 'VC000005', name: 'Tất', parent_id: null, display_name: 'Thể Thao > Tất' },
  { id: 1488, code: 'VC001488', name: 'Khác', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Khác' },
  { id: 1489, code: 'VC001489', name: 'Lưới Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Lưới Cầu Lông' },
  { id: 1491, code: 'VC001491', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' }
];

function renderNav(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MainNav categories={LIVE} />
    </MemoryRouter>
  );
}

const menuLabels = () =>
  within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link').map(a => a.textContent);

describe('STOR-058 MainNav', () => {
  afterEach(cleanup);

  it('với bốn ngành live: chỉ BADMINTON (TRANG CHỦ) và VỢT CẦU LÔNG', () => {
    renderNav();
    expect(menuLabels()).toEqual(['BADMINTON (TRANG CHỦ)', 'VỢT CẦU LÔNG']);
  });

  it('link menu: uppercase font-display font-extrabold; VỢT CẦU LÔNG trỏ ngành vợt theo mã', () => {
    renderNav();
    const links = within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link');
    for (const link of links) {
      expect(link.className).toContain('uppercase');
      expect(link.className).toContain('font-display');
      expect(link.className).toContain('font-extrabold');
    }
    expect(screen.getByRole('link', { name: 'VỢT CẦU LÔNG' }).getAttribute('href')).toBe('/catalog?category=VC001491');
  });

  it.each([
    ['/', 'BADMINTON (TRANG CHỦ)'],
    ['/catalog?category=VC001491', 'VỢT CẦU LÔNG'],
    ['/catalog?category=VC001489', null],
    ['/stores', null]
  ])('ở %s chỉ link khớp vị trí có gạch chân active', (path, activeLabel) => {
    renderNav(path);
    const links = within(screen.getByRole('navigation', { name: 'Điều hướng chính' })).getAllByRole('link');
    const underlined = links.filter(a => a.className.includes('after:h-[3px]')).map(a => a.textContent);
    expect(underlined).toEqual(activeLabel ? [activeLabel] : []);
    const current = links.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent);
    expect(current).toEqual(activeLabel ? [activeLabel] : []);
  });

  it('nav không bị ẩn ở mobile (không có lớp hidden)', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(nav.className.split(/\s+/)).not.toContain('hidden');
  });

  it('thanh đan cước: bg-zinc-100, nằm ngoài nav, CTA -> /catalog?category=VC001491', () => {
    renderNav();
    const strip = screen.getByTestId('stringing-strip');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(strip.className).toContain('bg-zinc-100');
    expect(nav.contains(strip)).toBe(false);
    expect(within(strip).getByRole('link', { name: 'Trải nghiệm chọn cước →' }).getAttribute('href')).toBe('/catalog?category=VC001491');
    expect(strip.textContent).toContain('9.0kg–13.0kg');
    expect(strip.textContent).not.toMatch(/BG66|Exbolt|Kizuna/);
  });
});

describe('STOR-058 trang chủ không còn dải cam kết dưới menu', () => {
  const PRODUCTS: Product[] = [
    { id: 'r1', name: 'Vợt Yonex Astrox 77 Pro', brand: 'Yonex', image: '', category: 'Vợt Cầu Lông', categoryCode: 'VC001491', price: 3250000, specs: {}, description: '', stock: 3 },
    { id: 'n1', name: 'Lưới cầu lông', brand: 'Yonex', image: '', category: 'Lưới Cầu Lông', categoryCode: 'VC001489', price: 250000, specs: {}, description: '', stock: 3 }
  ];

  beforeEach(() => {
    api.getCategories.mockResolvedValue(LIVE);
    api.getProducts.mockResolvedValue(PRODUCTS);
    api.getAllStock.mockResolvedValue({});
    api.getBranches.mockResolvedValue([]);
    api.getStringOptions.mockResolvedValue([]);
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('HomePage.tsx không import TrustBadges', () => {
    const source = readFileSync(resolve(__dirname, '../features/home/HomePage.tsx'), 'utf8');
    expect(source).not.toMatch(/TrustBadges/);
  });

  it('/ không có #trust-badges-ribbon; menu nằm trong #topvnsport-header; footer mở đầu bằng dải cam kết', async () => {
    const store = configureStore({ reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer } });
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </Provider>
    );
    await waitFor(() => expect(container.querySelector('#topvnsport-header nav')).not.toBeNull());
    await waitFor(() => expect(screen.getByRole('link', { name: 'VỢT CẦU LÔNG' })).toBeInTheDocument());
    expect(container.querySelector('#trust-badges-ribbon')).toBeNull();
    const nav = container.querySelector('#topvnsport-header nav') as HTMLElement;
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual(['BADMINTON (TRANG CHỦ)', 'VỢT CẦU LÔNG']);
    expect(container.querySelector('footer')?.firstElementChild?.getAttribute('data-testid')).toBe('trust-row');
  });
});
