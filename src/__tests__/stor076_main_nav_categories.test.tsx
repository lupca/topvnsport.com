// @vitest-environment jsdom
// STOR-076: menu chính dựng từ ngành VOMA thật (còn hàng, cùng thứ tự và nhãn với chip trang chủ).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
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

const CATS: Category[] = [
  { id: 1, code: 'VC001491', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' },
  { id: 2, code: 'VC001427', name: 'Giày Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Giày Cầu Lông' },
  { id: 3, code: 'VC009999', name: 'Khác', parent_id: null, display_name: 'Thể Thao & Dã Ngoại > Khác' },
  { id: 4, code: 'VC000004', name: 'Tất', parent_id: null, display_name: 'Thể Thao > Tất' }, // không có sản phẩm nào
  { id: 5, code: 'VC000005', name: 'Băng Quấn', parent_id: null, display_name: 'Thể Thao > Băng Quấn' } // chỉ có SP hết hàng
];

const prod = (id: string, categoryCode: string, stock: number): Product => ({
  id, name: `SP ${id}`, brand: 'Yonex', image: '', category: '', categoryCode, price: 100000, specs: {}, description: '', stock
});

const PRODUCTS: Product[] = [
  prod('v1', 'VC001491', 1),
  prod('v2', 'VC001491', 2),
  prod('v3', 'VC001491', 3),
  prod('g1', 'VC001427', 1),
  prod('g2', 'VC001427', 1),
  prod('k1', 'VC009999', 4),
  prod('b1', 'VC000005', 0),
  prod('b2', 'VC000005', 0)
];

const STRIP_CTA_HREF = '/catalog?category=VC001491';

beforeEach(() => {
  api.getCategories.mockResolvedValue(CATS);
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

function renderApp(path: string) {
  const store = configureStore({ reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
}

// Đợi menu có đủ link (home + ngành còn hàng) rồi trả về các link của <nav>.
async function loadedNavLinks(): Promise<HTMLAnchorElement[]> {
  const nav = await waitFor(() => {
    const el = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(el).getAllByRole('link').length).toBeGreaterThan(1);
    return el;
  });
  return within(nav).getAllByRole('link') as HTMLAnchorElement[];
}

// Chip ngành trên trang chủ: [{code, label}], bỏ chip "Tất cả".
function chipPills(): { code: string; label: string }[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="cate-pill-"]'))
    .filter(el => el.dataset.testid !== 'cate-pill-ALL')
    .map(el => ({
      code: el.dataset.testid!.slice('cate-pill-'.length),
      label: el.firstElementChild?.textContent ?? ''
    }));
}

describe('STOR-076 menu chính lấy từ ngành VOMA thật', () => {
  it('thứ tự link ngành = thứ tự chip (đếm giảm dần), sau link trang chủ', async () => {
    renderApp('/');
    const links = await loadedNavLinks();
    const pills = await waitFor(() => {
      const found = chipPills();
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    expect(links.slice(1).map(a => a.textContent)).toEqual(pills.map(p => p.label));
  });

  it('thứ tự cố định theo số SP còn hàng giảm dần (đổi chiều sắp xếp -> đỏ)', async () => {
    renderApp('/');
    const links = await loadedNavLinks();
    expect(links.map(a => a.textContent)).toEqual(['BADMINTON (TRANG CHỦ)', 'Vợt Cầu Lông', 'Giày Cầu Lông', 'Khác']);
  });

  it('mỗi link ngành trỏ /catalog?category=<mã VOMA>', async () => {
    renderApp('/');
    const links = await loadedNavLinks();
    const byLabel = new Map(links.map(a => [a.textContent, a.getAttribute('href')]));
    expect(byLabel.get('Vợt Cầu Lông')).toBe('/catalog?category=VC001491');
    expect(byLabel.get('Giày Cầu Lông')).toBe('/catalog?category=VC001427');
    expect(byLabel.get('Khác')).toBe('/catalog?category=VC009999');
  });

  it('ngành mới VC009999 có 1 SP còn hàng -> có link trong menu', async () => {
    renderApp('/');
    const links = await loadedNavLinks();
    const khac = links.find(a => a.getAttribute('href') === '/catalog?category=VC009999');
    expect(khac?.textContent).toBe('Khác');
  });

  it('ngành không có SP (Tất) và ngành chỉ có SP hết hàng (Băng Quấn) không có link', async () => {
    renderApp('/');
    const links = await loadedNavLinks();
    const labels = links.map(a => a.textContent);
    expect(labels).not.toContain('Tất');
    expect(labels).not.toContain('Băng Quấn');
    expect(links.some(a => a.getAttribute('href') === '/catalog?category=VC000004')).toBe(false);
    expect(links.some(a => a.getAttribute('href') === '/catalog?category=VC000005')).toBe(false);
  });

  it('không có chữ "lối đánh" trong menu chính', async () => {
    renderApp('/');
    await loadedNavLinks();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(nav.textContent).not.toMatch(/lối đánh/i);
  });

  it('mọi link menu có class uppercase và font-extrabold', async () => {
    renderApp('/');
    const links = await loadedNavLinks();
    for (const link of links) {
      expect(link.className).toContain('uppercase');
      expect(link.className).toContain('font-extrabold');
    }
  });

  it('link đầu là BADMINTON (TRANG CHỦ) trỏ về /', async () => {
    renderApp('/');
    const [first] = await loadedNavLinks();
    expect(first.textContent).toBe('BADMINTON (TRANG CHỦ)');
    expect(first.getAttribute('href')).toBe('/');
  });

  it('aria-current=page chỉ nằm trên link đúng URL catalog đang mở', async () => {
    renderApp('/catalog?category=VC009999');
    const links = await loadedNavLinks();
    const current = links.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent);
    expect(current).toEqual(['Khác']);
  });

  it('dải đan cước nằm ngoài nav và trỏ tới ngành vợt', async () => {
    renderApp('/');
    await loadedNavLinks();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const strip = screen.getByTestId('stringing-strip');
    expect(nav.contains(strip)).toBe(false);
    expect(within(strip).getByRole('link', { name: 'Trải nghiệm chọn cước →' }).getAttribute('href')).toBe(STRIP_CTA_HREF);
  });

  it('không còn dải bảo đảm 4 ô (#trust-badges-ribbon) giữa header và tiêu đề BADMINTON', async () => {
    const { container } = renderApp('/');
    await loadedNavLinks();
    expect(container.querySelector('#trust-badges-ribbon')).toBeNull();
    expect(container.querySelector('[data-testid="trust-badges"]')).toBeNull();
  });
});

describe('STOR-076 MainNav.tsx không còn danh sách cứng', () => {
  const source = readFileSync(resolve(__dirname, '../components/MainNav.tsx'), 'utf8');

  it('không dùng getVisibleMainNav hay MAIN_NAV (đưa lại -> đỏ)', () => {
    expect(source).not.toMatch(/getVisibleMainNav|MAIN_NAV/);
  });

  it('không có tên ngành cứng (Giày, Bao vợt, Vợt Cầu Lông)', () => {
    expect(source).not.toMatch(/Giày|Bao vợt|Vợt Cầu Lông/i);
  });
});
