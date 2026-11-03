// @vitest-environment jsdom
// STOR-100: dải đen 390 trên '/' theo tab Mobile (390px) của public/design/index.html — nền đen, chữ trắng,
// giữa, 11.5px/700, lề 7px 10px. Không có nguồn giờ mở cửa nên giữ chữ tĩnh, không "mở cửa", không .live-dot
// (spec da7a5793/e7944019). PDP/checkout giữ py-1.5 px-3; top bar desktop không đổi.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import { Category } from '../types';

const prod = (id: string) =>
  ({ id, name: `SP ${id}`, brand: 'Yonex', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode: 'c1' }) as any;
const categories: Category[] = [{ id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Vợt' }];
const cls = (el: Element) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const STRIP = 'Đan vợt chuẩn quốc tế 30p';
const TOPBAR_CLASS = 'hidden md:flex bg-ink-primary text-white text-[12px] font-semibold leading-[1.5] py-[8px] px-[24px]';
const PILL = 'Showroom Hà Nội · Đan vợt lấy ngay 30p';

function renderHeader(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header cartCount={0} openCart={vi.fn()} products={[prod('1')]} categories={categories} />
    </MemoryRouter>,
  );
}

describe('STOR-100 dải showroom 390 trên trang chủ', () => {
  afterEach(cleanup);

  it("'/': dải nằm trong #topvnsport-header, đúng chữ, token thiết kế, lề 7px 10px, ẩn từ md", () => {
    const { container } = renderHeader('/');
    const strip = screen.getByTestId('mobile-showroom-strip');
    expect(container.querySelector('#topvnsport-header')!.contains(strip)).toBe(true);
    expect(strip.textContent).toBe(STRIP);
    expect(cls(strip)).toEqual(expect.arrayContaining(['md:hidden', 'bg-ink-primary', 'text-white', 'text-center', 'text-[11.5px]', 'font-bold', 'py-[7px]', 'px-[10px]']));
    expect(cls(strip)).not.toContain('py-1.5');
    expect(cls(strip)).not.toContain('px-3');
  });

  it("'/': không .live-dot, không 'mở cửa' trong header (không có nguồn giờ mở cửa)", () => {
    const { container } = renderHeader('/');
    const header = container.querySelector('#topvnsport-header')!;
    expect(header.querySelectorAll('.live-dot')).toHaveLength(0);
    expect(header.textContent).not.toContain('mở cửa');
  });

  it.each(['/product/yonex-astrox-99-pro', '/checkout/success', '/catalog'])('%s: dải giữ py-1.5 px-3', (path) => {
    renderHeader(path);
    const strip = screen.getByTestId('mobile-showroom-strip');
    expect(strip.textContent).toBe(STRIP);
    expect(cls(strip)).toEqual(expect.arrayContaining(['md:hidden', 'py-1.5', 'px-3']));
    expect(cls(strip)).not.toContain('py-[7px]');
    expect(cls(strip)).not.toContain('px-[10px]');
  });

  it('desktop: class top bar và chữ pill không đổi', () => {
    renderHeader('/');
    const bar = screen.getByTestId('topbar');
    expect(bar.getAttribute('class')).toBe(TOPBAR_CLASS);
    expect(bar.querySelector('button')!.textContent).toBe(PILL);
  });
});
