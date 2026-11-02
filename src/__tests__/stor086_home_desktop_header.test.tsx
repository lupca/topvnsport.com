// @vitest-environment jsdom
// STOR-086: Home page 1440px desktop header: two-row top bar with full promise copy,
// TVN logo mark, '/' search chip & shortcut
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import Header from '../components/Header';
import { Product, Category } from '../types';
import * as TrustBadgesModule from '../components/TrustBadges';

const mkProduct = (id: string, brand?: string): Product => ({
  id,
  name: `Vợt ${brand || 'Yonex'} ${id}`,
  brand: brand || 'Yonex',
  image: '',
  price: 1500000,
  specs: {},
  description: '',
  stock: 5,
  categoryCode: 'racket',
} as Product);

const categories: Category[] = [
  { id: 1, name: 'racket', code: 'racket', parent_id: null, display_name: 'Vợt Cầu Lông' },
];

function renderHeader(products: Product[] = []) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header
        cartCount={0}
        openCart={vi.fn()}
        products={products}
        categories={categories}
      />
    </MemoryRouter>
  );
}

describe('STOR-086: Home desktop header (1440px)', () => {
  afterEach(cleanup);

  describe('Top bar promise copy & brand filtering', () => {
    it('With 4 design brands loaded, the promise lists Yonex, Li-Ning, Victor, Kizuna', () => {
      const products = [
        mkProduct('1', 'Yonex'),
        mkProduct('2', 'Li-Ning'),
        mkProduct('3', 'Victor'),
        mkProduct('4', 'Kizuna'),
      ];
      renderHeader(products);
      expect(
        screen.getByText('Cam kết 100% Chính Hãng Yonex, Li-Ning, Victor, Kizuna — Đền 1000% nếu phát hiện hàng giả')
      ).toBeTruthy();
    });

    it('With only Li-Ning loaded, the promise lists only Li-Ning', () => {
      const products = [mkProduct('1', 'Li-Ning')];
      renderHeader(products);
      expect(
        screen.getByText('Cam kết 100% Chính Hãng Li-Ning — Đền 1000% nếu phát hiện hàng giả')
      ).toBeTruthy();
    });

    it('With no design brand loaded, the promise has no brand list', () => {
      const products = [mkProduct('1', 'Mizuno')];
      renderHeader(products);
      expect(
        screen.getByText('Cam kết 100% Chính Hãng — Đền 1000% nếu phát hiện hàng giả')
      ).toBeTruthy();
    });

    it('Empty products array renders promise with no brand list', () => {
      renderHeader([]);
      expect(
        screen.getByText('Cam kết 100% Chính Hãng — Đền 1000% nếu phát hiện hàng giả')
      ).toBeTruthy();
    });

    it('The promise brand list comes from getTrustBrands(products)', () => {
      const spy = vi.spyOn(TrustBadgesModule, 'getTrustBrands');
      const testProducts = [mkProduct('1', 'Victor')];
      renderHeader(testProducts);
      expect(spy).toHaveBeenCalledWith(testProducts);
      spy.mockRestore();
    });
  });

  describe('Top bar layout and basis-full wrap', () => {
    it('Links group has basis-full to wrap to row 2', () => {
      const { container } = renderHeader([]);
      const linksGroup = container.querySelector('#topvnsport-header .basis-full');
      expect(linksGroup).not.toBeNull();
      expect(linksGroup?.textContent).toContain('Đặt lịch đan vợt O2O');
      expect(linksGroup?.textContent).toContain('Tra cứu bảo hành');
      expect(linksGroup?.textContent).toContain('Hotline: 097 6007006');
    });

    it('Top bar outer element has leading-[1.5]', () => {
      const { container } = renderHeader([]);
      const topBar = container.querySelector('#topvnsport-header > div:first-child');
      expect(topBar?.className).toContain('leading-[1.5]');
    });

    it('Showroom pill has py-[3px]', () => {
      renderHeader([]);
      const showroomBtn = screen.getByRole('button', { name: /Showroom Hà Nội/ });
      expect(showroomBtn.className).toContain('py-[3px]');
    });
  });

  describe('Desktop logo TVN mark', () => {
    it('The desktop logo renders a 44x44 "TVN" box with bg-brand-primary', () => {
      renderHeader([]);
      const logoMark = screen.getByText('TVN');
      expect(logoMark).toBeTruthy();
      expect(logoMark.className).toContain('w-11');
      expect(logoMark.className).toContain('h-11');
      expect(logoMark.className).toContain('bg-brand-primary');
      expect(logoMark.className).toContain('text-white');
      expect(logoMark.className).toContain('rounded-[6px]');
      expect(logoMark.className).toContain('border-[1.5px]');
      expect(logoMark.className).toContain('border-black');
    });

    it('The desktop logo contains no <img>', () => {
      renderHeader([]);
      const logoMark = screen.getByText('TVN');
      const desktopBrand = logoMark.closest('div.hidden.md\\:flex');
      expect(desktopBrand).not.toBeNull();
      expect(desktopBrand?.querySelector('img')).toBeNull();
    });
  });

  describe('Search "/" chip and keyboard shortcut', () => {
    it('The md+ search row has a "/" chip between the input and "Tìm kiếm"', () => {
      const { container } = renderHeader([]);
      const kbd = container.querySelector('kbd');
      expect(kbd).not.toBeNull();
      expect(kbd?.textContent?.trim()).toBe('/');
      expect(kbd?.className).toContain('hidden');
      expect(kbd?.className).toContain('md:inline-block');
      expect(kbd?.className).toContain('font-mono');
      expect(kbd?.className).toContain('text-[11px]');
      expect(kbd?.className).toContain('font-bold');
      expect(kbd?.className).toContain('text-ink-secondary');
      expect(kbd?.className).toContain('bg-zinc-100');
      expect(kbd?.className).toContain('border-line-tag');
      expect(kbd?.className).toContain('rounded-[4px]');

      // Check position: input before kbd, and 'Tìm kiếm' button after kbd
      const searchRow = kbd?.parentElement;
      const children = Array.from(searchRow?.children || []);
      const inputIndex = children.findIndex(el => el.tagName === 'INPUT');
      const kbdIndex = children.indexOf(kbd!);
      const btnIndex = children.findIndex(el => el.textContent?.includes('Tìm kiếm'));
      expect(inputIndex).toBeGreaterThanOrEqual(0);
      expect(kbdIndex).toBeGreaterThan(inputIndex);
      expect(btnIndex).toBeGreaterThan(kbdIndex);
    });

    it('Pressing "/" on document.body focuses the header search input', () => {
      renderHeader([]);
      const input = screen.getByPlaceholderText(/Tìm vợt/);
      const focusSpy = vi.spyOn(input, 'focus');

      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);

      expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('Pressing "/" on document.body calls preventDefault', () => {
      renderHeader([]);
      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.body.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    });

    it('Pressing "/" inside an input does not call preventDefault', () => {
      renderHeader([]);
      const input = screen.getByPlaceholderText(/Tìm vợt/);
      const focusSpy = vi.spyOn(input, 'focus');

      const otherInput = document.createElement('input');
      document.body.appendChild(otherInput);

      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      otherInput.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(focusSpy).not.toHaveBeenCalled();

      otherInput.remove();
    });

    it('The "/" keydown listener is removed when Header unmounts', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHeader([]);
      unmount();

      expect(
        removeEventListenerSpy.mock.calls.some(([event]) => event === 'keydown')
      ).toBe(true);
      removeEventListenerSpy.mockRestore();
    });
  });
});
