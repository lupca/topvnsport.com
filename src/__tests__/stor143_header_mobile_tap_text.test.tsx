// @vitest-environment jsdom
// STOR-143 (goal 2c881ad4): khung đầu trang dưới md đạt MOB-E (vùng bấm ≥44px, MOB-E 5c6e5961) và MOB-F (chữ ≥14px,
// ô nhập ≥16px) mà hàng dính vẫn một hàng ≤120px (MOB-A c4cd5fa6) và TOPVNSPORT không bị cắt ở 360px
// (max-[399px] khép lề/khoảng cách, chữ 14px). Desktop: mọi token đổi đều có md: trả lại giá trị cũ.
// Số đo thật (bbox/computed style 360/390/430/1440) đo bằng playwright; ở đây khoá token.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import { Category } from '../types';

const categories: Category[] = [{ id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Vợt' }];
const PLACEHOLDER = 'Tìm vợt Yonex, Lining, cước đan, giày cầu lông...';
const cls = (el: Element) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const has = (el: Element, tokens: string[]) => expect(cls(el)).toEqual(expect.arrayContaining(tokens));

function renderHeader(pathname = '/catalog') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header cartCount={12} openCart={vi.fn()} products={[]} categories={categories} />
    </MemoryRouter>,
  );
}

describe('STOR-143 header mobile: vùng bấm 44px, chữ ≥14px, ô tìm 16px', () => {
  afterEach(cleanup);

  it('hàng dính: khép lề/khoảng cách dưới 400px để TOPVNSPORT không bị cắt ở 360px', () => {
    renderHeader();
    const bar = screen.getByTestId('mobile-sticky-bar');
    has(bar, ['max-[399px]:px-2', 'max-[399px]:gap-0.5', 'px-4', 'gap-2']);
  });

  it('nút menu 44x44 (inline-flex căn giữa, -ml-2); trên "/" vẫn ẩn', () => {
    renderHeader();
    has(screen.getByRole('button', { name: 'Open mobile menu' }), ['inline-flex', 'items-center', 'justify-center', 'w-[44px]', 'h-[44px]', '-ml-2']);
    cleanup();
    renderHeader('/');
    const menu = screen.getByRole('button', { name: 'Open mobile menu' });
    expect(cls(menu)).toContain('hidden');
    expect(cls(menu)).not.toContain('inline-flex');
  });

  it("'Đan cước': cao 44px, chữ 14px, lề px-1 dưới 400px", () => {
    renderHeader();
    has(screen.getByRole('button', { name: 'Đan cước' }), ['inline-flex', 'items-center', 'min-h-[44px]', 'text-[14px]', 'max-[399px]:px-1']);
  });

  it("'Giỏ (N)': 44x44 tối thiểu, chữ 14px, lề px-1.5 dưới 400px; nhãn và số đếm không đổi", () => {
    renderHeader();
    const cart = screen.getAllByRole('button', { name: 'Giỏ hàng' }).find(b => b.textContent === 'Giỏ (12)')!;
    expect(cart).toBeDefined();
    has(cart, ['inline-flex', 'items-center', 'min-h-[44px]', 'min-w-[44px]', 'text-[14px]', 'max-[399px]:px-1.5']);
  });

  it.each(['/', '/catalog'])('%s: dải showroom chữ text-sm', (path) => {
    renderHeader(path);
    const strip = screen.getByTestId('mobile-showroom-strip');
    has(strip, ['text-sm']);
    expect(cls(strip)).not.toContain('text-[11.5px]');
  });

  it('ô tìm: 16px dưới md, cao ≥44px dưới md; md giữ 14px và line-height 1/0.75', () => {
    renderHeader();
    has(screen.getByPlaceholderText(PLACEHOLDER), ['text-base', 'max-md:min-h-[44px]', 'md:text-[14px]', 'md:leading-[calc(1/0.75)]']);
  });

  it("'Tìm kiếm': 44x44 tối thiểu và chữ text-sm dưới md; md giữ 12px/normal", () => {
    renderHeader();
    has(screen.getByRole('button', { name: 'Tìm kiếm' }), [
      'text-sm', 'max-md:inline-flex', 'max-md:items-center', 'max-md:min-h-[44px]', 'max-md:min-w-[44px]', 'md:text-[12px]', 'md:leading-[normal]',
    ]);
  });

  it("'Xoá từ khoá': 44x44 dưới md, lề trái âm (không lề phải âm nên không đè 'Tìm kiếm'); md giữ p-1 mr-1", () => {
    renderHeader();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'yonex' } });
    const clear = screen.getByRole('button', { name: 'Xoá từ khoá' });
    has(clear, ['max-md:inline-flex', 'max-md:items-center', 'max-md:justify-center', 'max-md:w-[44px]', 'max-md:h-[44px]', 'max-md:-ml-2', 'max-md:mr-0', 'p-1', 'mr-1']);
    expect(cls(clear).some(t => /(^|:)-mr-/.test(t))).toBe(false);
  });

  it('thanh danh mục: link text-sm dưới md, md giữ 13.5px, line-height 1.5', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) has(a, ['text-sm', 'md:text-[13.5px]', 'leading-[1.5]']);
  });
});
