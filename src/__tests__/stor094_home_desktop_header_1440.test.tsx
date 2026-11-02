// @vitest-environment jsdom
// STOR-094 (defect 139a2f00 phần 1): header 1440 theo panel Desktop của public/design/index.html — top bar
// 12px/8px lề 24px trong khung 1280 (pill x=80), hàng header 1280 lề 24px, wordmark 24/900/-0.03em đen,
// tagline mono 10.5/700/0.12em mt 4px, ô tìm 540x45 chữ 14px.
// Token px thay cho token rem (html 17px); mọi thứ dưới md giữ nguyên (token base còn, đổi chỉ qua md:).
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import { Category } from '../types';

const prod = (id: string, categoryCode = 'c1') =>
  ({ id, name: `SP ${id}`, brand: 'Yonex', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode }) as any;
const categories: Category[] = [
  { id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Vợt' },
  { id: 2, name: 'Giày', code: 'c2', parent_id: null, display_name: 'Giày' },
];
const cls = (el: Element) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const PLACEHOLDER = 'Tìm vợt Yonex, Lining, cước đan, giày cầu lông...';
const PILL = 'Showroom Hà Nội · Đan vợt lấy ngay 30p';

function renderHeader(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header cartCount={0} openCart={vi.fn()} products={[prod('1')]} categories={categories} />
    </MemoryRouter>,
  );
}

const has = (el: Element, tokens: string[]) => expect(cls(el)).toEqual(expect.arrayContaining(tokens));

describe('STOR-094 header 1440 theo thiết kế', () => {
  afterEach(cleanup);

  it('top bar: 12px, py 8px, lề 24px (ẩn dưới md, giữ leading 1.5)', () => {
    renderHeader();
    const bar = screen.getByTestId('topbar');
    has(bar, ['hidden', 'md:flex', 'text-[12px]', 'py-[8px]', 'px-[24px]', 'leading-[1.5]']);
    expect(cls(bar)).not.toContain('text-xs');
  });

  it('top bar inner: khung 1280px', () => {
    renderHeader();
    has(screen.getByTestId('topbar-inner'), ['max-w-[1280px]', 'mx-auto', 'w-full']);
  });

  it('hàng header: md 1280px, lề 24px, py 16px, gap 24px; token mobile giữ nguyên', () => {
    renderHeader('/catalog');
    const row = screen.getByTestId('header-main-row');
    has(row, ['md:max-w-[1280px]', 'md:px-[24px]', 'md:py-[16px]', 'md:gap-[24px]']);
    has(row, ['max-w-7xl', 'px-[16px]', 'py-2', 'gap-2', 'flex']);
  });

  it('wordmark: 24px / 900 / -0.03em / đen', () => {
    renderHeader();
    has(screen.getByTestId('brand-wordmark'), ['font-display', 'font-black', 'text-[24px]', 'tracking-[-0.03em]', 'text-ink-primary', 'leading-none']);
  });

  it('tagline: mono 10.5px / 700 / 0.12em / ink-secondary / mt 4px', () => {
    renderHeader();
    const t = screen.getByTestId('brand-tagline');
    has(t, ['font-mono', 'text-[10.5px]', 'font-bold', 'uppercase', 'tracking-[0.12em]', 'text-ink-secondary', 'mt-[4px]']);
    expect(t.textContent).toBe('Badminton Specialty Store');
  });

  it('ô tìm: wrap md 540px', () => {
    const { container } = renderHeader();
    has(container.querySelector('#search-wrap')!, ['md:max-w-[540px]', 'flex-1', 'w-full']);
  });

  it('ô tìm: viền 1.5px, py 8px, lề 18/14px ở md; token mobile giữ nguyên', () => {
    renderHeader();
    const box = screen.getByTestId('search-box');
    has(box, ['md:border-[1.5px]', 'md:py-[8px]', 'md:pl-[18px]', 'md:pr-[14px]']);
    has(box, ['border', 'pl-3.5', 'pr-1.5', 'py-1']);
  });

  it('input: md 14px (mobile text-xs), placeholder không đổi trên mọi tuyến', () => {
    for (const path of ['/', '/catalog', '/stores']) {
      renderHeader(path);
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      has(input, ['text-xs', 'md:text-[14px]']);
      cleanup();
    }
  });

  it('nút Tìm kiếm: md 12px, line-height normal, px 12px, py 6px; token mobile giữ nguyên', () => {
    renderHeader();
    const btn = screen.getByRole('button', { name: 'Tìm kiếm' });
    has(btn, ['md:text-[12px]', 'md:leading-[normal]', 'md:px-[12px]', 'md:py-[6px]']);
    has(btn, ['text-xs', 'px-3', 'py-1.5']);
  });

  it('pill showroom giữ nguyên chữ, không .live-dot, không "Đang mở cửa"', () => {
    const { container } = renderHeader();
    expect(screen.getByTestId('topbar').querySelector('button')!.textContent).toBe(PILL);
    expect(container.querySelector('.live-dot')).toBeNull();
    expect(container.textContent).not.toContain('Đang mở cửa');
  });
});
