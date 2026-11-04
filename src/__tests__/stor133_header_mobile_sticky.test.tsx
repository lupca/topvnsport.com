// STOR-133 (MOB-A/B/C): dưới md chỉ hàng logo + Đan cước + giỏ + menu dính đầu trang; dải đen, ô tìm kiếm,
// thanh danh mục và dải đan vợt nằm ngoài phần dính. jsdom không tính CSS nên kiểm cấu trúc DOM + class Tailwind;
// số đo thật (h0/hScrolled/rows) do e2e/mobile-audit/audit.cjs đo.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, within } from '@testing-library/react';
import Header from '../components/Header';
import { Category, Product } from '../types';

const products = [{ id: '1', name: 'Vot Yonex 1', brand: 'Yonex', image: '', price: 1500000, specs: {}, description: '', stock: 5, categoryCode: 'racket' } as Product];
const categories: Category[] = [{ id: 1, name: 'racket', code: 'racket', parent_id: null, display_name: 'Vợt Cầu Lông' }];

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Header cartCount={2} openCart={vi.fn()} products={products} categories={categories} />
    </MemoryRouter>
  );

const cls = (el: Element | null) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);

afterEach(cleanup);

describe.each(['/catalog', '/product/x'])('STOR-133 header mobile ở "%s"', (url) => {
  it('phần dính dưới md chỉ có hàng logo + Đan cước + giỏ + menu', () => {
    renderAt(url);
    const bar = screen.getByTestId('mobile-sticky-bar');
    expect(cls(bar)).toEqual(expect.arrayContaining(['sticky', 'top-0', 'md:hidden']));
    const b = within(bar);
    expect(b.getByAltText('TopVNSport Logo')).toBeTruthy();
    expect(b.getByRole('button', { name: 'Giỏ hàng' })).toBeTruthy();
    expect(b.getByRole('button', { name: 'Open mobile menu' })).toBeTruthy();
    const dan = b.getByRole('button', { name: 'Đan cước' });
    expect(cls(dan)).toContain('min-h-[44px]');

    expect(bar.querySelector('[data-testid="mobile-showroom-strip"]')).toBeNull();
    expect(bar.querySelector('[data-testid="search-box"]')).toBeNull();
    expect(bar.querySelector('nav[aria-label="Điều hướng chính"]')).toBeNull();
    expect(bar.querySelector('[data-testid="stringing-strip"]')).toBeNull();
  });

  it('<header> chỉ dính từ md; dải đen, tìm kiếm, nav, dải đan vợt nằm trong <header> không dính', () => {
    const { container } = renderAt(url);
    const header = container.querySelector('#topvnsport-header')!;
    expect(cls(header)).not.toContain('sticky');
    expect(cls(header)).not.toContain('top-0');
    expect(cls(header)).toEqual(expect.arrayContaining(['md:sticky', 'md:top-0', 'md:z-50']));
    expect(header.contains(screen.getByTestId('mobile-sticky-bar'))).toBe(false);
    for (const id of ['mobile-showroom-strip', 'search-box', 'stringing-strip']) expect(header.contains(screen.getByTestId(id))).toBe(true);
    expect(header.contains(screen.getByRole('navigation', { name: 'Điều hướng chính' }))).toBe(true);
  });

  it('dải đan vợt ẩn dưới md; thanh danh mục 1 hàng cuộn ngang dưới md', () => {
    renderAt(url);
    expect(cls(screen.getByTestId('stringing-strip'))).toEqual(expect.arrayContaining(['hidden', 'md:block']));
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const ul = nav.querySelector('ul')!;
    expect(cls(ul)).toEqual(expect.arrayContaining(['max-md:flex-nowrap', 'max-md:overflow-x-auto']));
    for (const li of ul.querySelectorAll('li')) expect(cls(li)).toEqual(expect.arrayContaining(['max-md:shrink-0', 'max-md:whitespace-nowrap']));
  });
});
