// @vitest-environment jsdom
// STOR-061: Header chrome A: Top bar and header match /design/index.html
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Header from '../components/Header';
import { Category, Product } from '../types';

const mkProduct = (id: string, extra: Partial<Product> = {}): Product => ({
  id,
  name: `Vot Yonex ${id}`,
  brand: 'Yonex',
  image: '',
  price: 1500000,
  specs: {},
  description: '',
  stock: 5,
  categoryCode: 'racket',
  ...extra,
} as Product);

const categories: Category[] = [
  { id: 1, name: 'racket', code: 'racket', parent_id: null, display_name: 'Vợt Cầu Lông' },
];

let currentLocation = '';
const LocationProbe = () => {
  const loc = useLocation();
  currentLocation = loc.pathname + loc.search;
  return null;
};

interface SetupOptions {
  cartCount?: number;
  openCart?: () => void;
  products?: Product[];
  url?: string;
}

function setupHeader(options: SetupOptions = {}) {
  const {
    cartCount = 2,
    openCart = vi.fn(),
    products = [mkProduct('1')],
    url = '/',
  } = options;

  currentLocation = url;

  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <Header
        cartCount={cartCount}
        openCart={openCart}
        products={products}
        categories={categories}
      />
    </MemoryRouter>
  );

  return { ...result, openCartMock: openCart };
}

beforeEach(() => {
  window.innerWidth = 1440;
  window.innerHeight = 900;
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('STOR-061: Top bar chrome & contracts', () => {
  it('T1: Cam kết text exact match', () => {
    setupHeader();
    expect(screen.getByText('Cam kết 100% chính hãng - Đền gấp 10 nếu giả')).toBeTruthy();
  });

  it('T2: Showroom Hà Nội pill navigates to /stores', () => {
    setupHeader();
    const showroomBtn = screen.getByRole('button', { name: /Showroom Hà Nội/ });
    expect(showroomBtn.textContent).toContain('Showroom Hà Nội · Đan vợt lấy ngay 30p');
    fireEvent.click(showroomBtn);
    expect(currentLocation).toBe('/stores');
  });

  it('T3: Đặt lịch đan vợt O2O link navigates to /stores', () => {
    setupHeader();
    const link = screen.getByRole('link', { name: 'Đặt lịch đan vợt O2O' });
    fireEvent.click(link);
    expect(currentLocation).toBe('/stores');
  });

  it('T4: Hotline anchor has exact text and tel:0976007006 href', () => {
    setupHeader();
    const hotline = screen.getByRole('link', { name: 'Hotline: 097 6007006' });
    expect(hotline.getAttribute('href')).toBe('tel:0976007006');
  });

  it('T5: Top bar inner container has flex-wrap token to prevent overflow', () => {
    const { container } = setupHeader();
    const topBar = container.querySelector('#topvnsport-header > div:first-child');
    expect(topBar).not.toBeNull();
    const innerRow = topBar?.firstElementChild;
    expect(innerRow?.classList.contains('flex-wrap')).toBe(true);
  });
});

describe('STOR-061: Search bar & Tìm kiếm button', () => {
  it('S1: Has accessible button "Tìm kiếm"', () => {
    setupHeader();
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeTruthy();
  });

  it('S2: Search wrapper has min-w-0 token for flex-shrink safety', () => {
    const { container } = setupHeader();
    const searchWrapper = container.querySelector('#search-wrap, [class*="min-w-0 flex-1 md:max-w-xl"]');
    expect(searchWrapper).not.toBeNull();
    expect(searchWrapper?.classList.contains('min-w-0')).toBe(true);
  });

  it('S3: Clicking "Tìm kiếm" with " yonex " navigates to trimmed /catalog?search=yonex', () => {
    setupHeader();
    const input = screen.getByPlaceholderText(/Tìm vợt/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: ' yonex ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(currentLocation).toBe('/catalog?search=yonex');
  });

  it('S4: Clicking "Tìm kiếm" with whitespace-only leaves location unchanged', () => {
    setupHeader({ url: '/' });
    const input = screen.getByPlaceholderText(/Tìm vợt/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(currentLocation).toBe('/');
  });
});

describe('STOR-061: Desktop actions & 768-1023px overflow guard', () => {
  it('A1: "Tư vấn Đan Cước" button has hidden and lg:inline-flex (not md:inline-flex)', () => {
    setupHeader();
    const btn = screen.getByRole('button', { name: 'Tư vấn Đan Cước' });
    expect(btn.classList.contains('hidden')).toBe(true);
    expect(btn.classList.contains('lg:inline-flex')).toBe(true);
    expect(btn.classList.contains('md:inline-flex')).toBe(false);
  });

  it('A2: Clicking "Tư vấn Đan Cước" navigates to /stores', () => {
    setupHeader();
    const btn = screen.getByRole('button', { name: 'Tư vấn Đan Cước' });
    fireEvent.click(btn);
    expect(currentLocation).toBe('/stores');
  });

  it('A3: Desktop cart pill shows "Giỏ hàng" + cartCount and calls openCart', () => {
    const openCart = vi.fn();
    setupHeader({ cartCount: 5, openCart });
    const cartBtns = screen.getAllByRole('button', { name: 'Giỏ hàng' });
    const desktopCart = cartBtns.find(b => b.textContent?.includes('Giỏ hàng'));
    expect(desktopCart).toBeDefined();
    expect(desktopCart!.textContent).toContain('Giỏ hàng');
    expect(desktopCart!.textContent).toContain('5');
    fireEvent.click(desktopCart!);
    expect(openCart).toHaveBeenCalledTimes(1);
  });
});

describe('STOR-061: Mobile row, black strip & drawer', () => {
  it('M1: Outline "Đan cước" button navigates to /stores', () => {
    setupHeader();
    const danCuocBtn = screen.getByRole('button', { name: 'Đan cước' });
    fireEvent.click(danCuocBtn);
    expect(currentLocation).toBe('/stores');
  });

  it('M2: Mobile cart pill reads "Giỏ (N)" and calls openCart', () => {
    const openCart = vi.fn();
    setupHeader({ cartCount: 3, openCart });
    const cartBtns = screen.getAllByRole('button', { name: 'Giỏ hàng' });
    const mobileCart = cartBtns.find(b => b.textContent?.includes('Giỏ ('));
    expect(mobileCart).toBeDefined();
    expect(mobileCart!.textContent).toBe('Giỏ (3)');
    fireEvent.click(mobileCart!);
    expect(openCart).toHaveBeenCalledTimes(1);
  });

  it('M3: Black strip "Đan vợt chuẩn quốc tế 30p" is present', () => {
    setupHeader();
    expect(screen.getByText('Đan vợt chuẩn quốc tế 30p')).toBeTruthy();
  });

  it('M4: Drawer opens on clicking "Open mobile menu"', () => {
    setupHeader();
    const menuBtn = screen.getByRole('button', { name: 'Open mobile menu' });
    fireEvent.click(menuBtn);
    expect(document.getElementById('mobile-sidebar-drawer')).not.toBeNull();
  });
});

describe('STOR-061: Removed legacy elements absence', () => {
  it('R1: Header contains no "Xu hướng"', () => {
    setupHeader();
    expect(screen.queryByText(/Xu hướng/i)).toBeNull();
  });

  it('R2: Top bar has "Tra cứu bảo hành" linking to /stores, between O2O and hotline with | on each side', () => {
    setupHeader();
    const link = screen.getByRole('link', { name: 'Tra cứu bảo hành' });
    expect(link.getAttribute('href')).toBe('/stores');
    const row = Array.from(link.parentElement!.children).map(el => el.textContent?.trim());
    const i = row.indexOf('Tra cứu bảo hành');
    expect(row.slice(i - 2, i + 3)).toEqual(['Đặt lịch đan vợt O2O', '|', 'Tra cứu bảo hành', '|', 'Hotline: 097 6007006']);
  });

  it('R3: Header contains no "Kiểm tra đơn hàng"', () => {
    setupHeader();
    expect(screen.queryByText(/Kiểm tra đơn hàng/i)).toBeNull();
  });

  it('R4: Header contains no "mở cửa" (case-insensitive)', () => {
    const { container } = setupHeader();
    expect(container.textContent?.toLowerCase()).not.toContain('mở cửa');
  });

  it('R5: Header has no button named "Sản Phẩm"', () => {
    setupHeader();
    expect(screen.queryByRole('button', { name: /Sản Phẩm/i })).toBeNull();
  });

  it('R6: Header contains no svg.lucide-heart', () => {
    const { container } = setupHeader();
    expect(container.querySelector('svg.lucide-heart')).toBeNull();
  });

  it('R7: Header contains no green live-dot element', () => {
    const { container } = setupHeader();
    expect(container.querySelector('.live-dot')).toBeNull();
  });
});

describe('STOR-061: Sticky header integrity and no global overflow-x:hidden injection', () => {
  it('H1: Header root element has sticky top-0 classes', () => {
    const { container } = setupHeader();
    const header = container.querySelector('#topvnsport-header');
    expect(header).not.toBeNull();
    expect(header?.classList.contains('sticky')).toBe(true);
    expect(header?.classList.contains('top-0')).toBe(true);
  });

  it('H2: Header does not contain injected <style> setting overflow-x: hidden on html or body', () => {
    const { container } = setupHeader();
    const styles = container.querySelectorAll('style');
    for (const style of styles) {
      expect(style.textContent).not.toMatch(/html.*body.*overflow-x:\s*hidden/i);
      expect(style.textContent).not.toMatch(/overflow-x:\s*hidden/i);
    }
  });

  it('H3: Document body and html have clean overflow when drawer is closed', () => {
    setupHeader();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
