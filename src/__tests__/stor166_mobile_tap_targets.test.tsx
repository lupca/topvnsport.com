// @vitest-environment jsdom
// STOR-166 (goal 2c881ad4, MOB-E 5c6e5961): các vùng bấm còn dưới 44px trên điện thoại. jsdom không có bố cục nên ở đây khoá token;
// số đo thật ở 360/390/430 và 768: node e2e/mobile-tap-targets.cjs.
import React from 'react';
import { readFileSync } from 'node:fs';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { popupService, SystemPopupProvider } from '@topvnsport/ui-kit';
import Header from '../components/Header';
import MainNav from '../components/MainNav';
import ProductMediaGallery from '../components/ProductMediaGallery';
import MobilePurchaseBar from '../components/product-detail/MobilePurchaseBar';

const has = (el: Element, tokens: string[]) => expect((el.getAttribute('class') || '').split(/\s+/)).toEqual(expect.arrayContaining(tokens));

describe('STOR-166 vùng bấm 44px dưới md', () => {
  afterEach(() => { act(() => { popupService.resolveCurrent(undefined); }); cleanup(); });

  it('chữ logo: cao 44px, vẫn là div cắt chữ', () => {
    render(<MemoryRouter initialEntries={['/catalog']}><Header cartCount={0} openCart={vi.fn()} products={[]} categories={[]} /></MemoryRouter>);
    const wordmark = screen.getByTestId('mobile-sticky-bar').querySelector('img')!.parentElement!;
    expect(wordmark.tagName).toBe('DIV');
    has(wordmark, ['min-h-[44px]', 'leading-[44px]', 'truncate', 'min-w-0']);
  });

  it("link nav ngắn 'Tất': rộng tối thiểu 44px dưới md, căn giữa chữ", () => {
    render(<MemoryRouter><MainNav items={[{ code: 'c1', label: 'Tất' }]} /></MemoryRouter>);
    has(screen.getByRole('link', { name: 'Tất' }), ['max-md:min-w-[44px]', 'max-md:justify-center']);
  });

  it("gạch chân link đang chọn nằm trên span chữ, không kéo theo ô 44px dưới md", () => {
    render(<MemoryRouter initialEntries={['/catalog?category=c1']}><MainNav items={[{ code: 'c1', label: 'Tất' }]} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Tất' });
    const span = link.querySelector('span')!;
    has(span, ['max-md:relative', 'after:absolute', 'after:inset-x-0', 'after:bottom-0', 'max-md:after:bottom-[-13px]', 'after:h-[3px]']);
    expect(link.className).not.toContain('after:');
  });

  it.each([['trái', 'max-md:left-[2px]'], ['phải', 'max-md:right-[2px]']])('mũi tên %s: ô bấm 44px trong suốt, vòng 30px nằm trên icon', (dir, side) => {
    render(<ProductMediaGallery productName="Vợt" image="/a.webp" gallery={['/b.webp']} />);
    const arrow = screen.getByRole('button', { name: `Cuộn danh sách ảnh sang ${dir}` });
    has(arrow, [side, 'max-md:size-[44px]', 'max-md:flex', 'max-md:items-center', 'max-md:justify-center', 'max-md:rounded-none', 'max-md:border-0', 'max-md:bg-transparent', 'max-md:p-0', 'max-md:shadow-none']);
    has(arrow.querySelector('svg')!, ['max-md:box-content', 'max-md:size-[16px]', 'max-md:p-[6px]', 'max-md:rounded-full', 'max-md:border', 'max-md:border-gray-200', 'max-md:bg-white/95', 'max-md:shadow-sm']);
  });

  it('dải ảnh: snap dừng sau ô bấm mũi tên trái, ảnh đầu không nằm dưới mũi tên', () => {
    render(<ProductMediaGallery productName="Vợt" image="/a.webp" gallery={['/b.webp']} />);
    const rail = screen.getByRole('button', { name: 'Cuộn danh sách ảnh sang trái' }).parentElement!.querySelector('.snap-x')!;
    has(rail, ['max-md:scroll-pl-[36px]']);
  });

  it.each([
    ['Mua ngay', {}],
    ['Hết hàng', { isOutOfStock: true }],
    ['Chưa rõ tồn kho', { stockUnknown: true }],
  ])("nút thanh mua '%s': cao 44px, -my-px giữ thanh 69px", (name, state) => {
    render(<MobilePurchaseBar productName="Vợt" productImage="/a.webp" totalDisplayPrice={1000} hasPrice onBuyNow={vi.fn()} {...state} />);
    has(screen.getByRole('button', { name }), ['min-h-[44px]', '-my-px']);
  });

  it("popup 'Đồng ý'/'Hủy': luật CSS dưới 48rem trúng role=alertdialog có thật của ui-kit", () => {
    const rule = /@media \(width < 48rem\) \{\s*\[role='alertdialog'\] button \{([^}]*)\}/.exec(readFileSync('src/index.css', 'utf8'));
    expect(rule?.[1]).toContain('min-height: 44px');
    expect(rule?.[1]).toContain('min-width: 44px');
    render(<SystemPopupProvider><div /></SystemPopupProvider>);
    act(() => { void popupService.confirm('Xoá món này?'); });
    const buttons = screen.getByRole('alertdialog').querySelectorAll('button');
    expect([...buttons].map(b => b.textContent)).toEqual(['Hủy', 'Đồng ý']);
  });
});
