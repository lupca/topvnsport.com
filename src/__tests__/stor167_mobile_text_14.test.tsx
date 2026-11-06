// @vitest-environment jsdom
// STOR-167 (goal 2c881ad4, MOB-F): chữ dưới md tối thiểu 14px, 1440 không đổi. Thanh dưới và thanh mua render thật, kiểm token
// trên đúng phần tử; bốn file còn lại quét nguồn: mọi cỡ chữ gốc dưới 14px phải đi kèm max-md:text-sm, trừ các hàng chỉ có ở desktop.
// Vừa khít thật (font thật, 360-430px) đo ở e2e/mobile-text-fit.cjs.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MobileBottomNav from '../features/navigation/MobileBottomNav';
import MobilePurchaseBar from '../components/product-detail/MobilePurchaseBar';

afterEach(cleanup);

const cls = (el: Element) => el.className.toString().split(/\s+/);
const LABELS = ['BADMINTON', 'Vợt & Cước', 'Đan Vợt O2O', 'Giỏ hàng'];

describe('STOR-167 MobileBottomNav', () => {
  const renderNav = (cartCount = 0) =>
    render(<MobileBottomNav pathname="/" navigate={vi.fn() as any} cartCount={cartCount} onOpenCart={vi.fn()} />);

  it('nhãn 14px một dòng, chữ gọn; md+ giữ 10px', () => {
    renderNav();
    for (const label of LABELS) {
      const c = cls(screen.getByText(label));
      expect(c).toEqual(expect.arrayContaining(['text-[14px]', 'leading-tight', 'tracking-tight', 'whitespace-nowrap', 'md:text-[10px]']));
    }
  });

  it('khoảng đệm gọn: bar px-1, nút gap-0.5 py-1 không còn p-1', () => {
    const { container } = renderNav();
    const bar = cls(container.firstElementChild!);
    expect(bar).toContain('px-1');
    expect(bar).not.toContain('px-2');
    for (const label of LABELS) {
      const c = cls(screen.getByText(label).closest('button')!);
      expect(c).toEqual(expect.arrayContaining(['gap-0.5', 'py-1']));
      expect(c).not.toContain('gap-1');
      expect(c).not.toContain('p-1');
    }
  });

  it('badge giỏ 14px, vẫn absolute để không đổi cỡ nút', () => {
    renderNav(99);
    const c = cls(screen.getByText('99'));
    expect(c).toEqual(expect.arrayContaining(['absolute', '-top-2', '-right-3', 'min-w-5', 'h-5', 'px-1', 'text-[14px]', 'leading-none']));
    expect(c).not.toContain('text-[8px]');
    expect(c).not.toContain('w-3.5');
  });
});

describe('STOR-167 MobilePurchaseBar', () => {
  const STATES = [
    { name: 'có giá', props: { hasPrice: true }, price: /100/, button: 'Mua ngay', mono: true },
    { name: 'chưa có giá', props: { hasPrice: false }, price: 'Liên hệ để biết giá', button: 'Mua ngay', mono: false },
    { name: 'hết hàng', props: { hasPrice: true, isOutOfStock: true }, price: /100/, button: 'Hết hàng', mono: true },
    { name: 'chưa rõ tồn kho', props: { hasPrice: true, stockUnknown: true }, price: /100/, button: 'Chưa rõ tồn kho', mono: true },
  ];

  it.each(STATES)('$name: tên, giá, nút 14px; font-mono chỉ khi có giá', ({ props, price, button, mono }) => {
    render(<MobilePurchaseBar productName="Vợt A" productImage="x.jpg" totalDisplayPrice={100000} onBuyNow={vi.fn()} {...props} />);
    const name = cls(screen.getByRole('heading', { name: 'Vợt A' }));
    const p = cls(screen.getByText(price));
    const btn = cls(screen.getByRole('button', { name: button }));
    for (const c of [name, p, btn]) {
      expect(c).toContain('text-[14px]');
      expect(c).not.toContain('text-xs');
    }
    expect(p.includes('font-mono')).toBe(mono);
    expect(btn).toEqual(expect.arrayContaining(['min-h-[44px]', '-my-px'])); // STOR-166
  });
});

describe('STOR-167 chữ nhỏ trong nguồn', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '../components', f), 'utf8').split('\n');
  // Cỡ gốc (không variant) dưới 14px.
  const SMALL = /(?<![\w:-])text-(?:xs|\[(?:\d|1[0-3])(?:\.\d+)?px\])(?![\w-])/;
  const scan = (f: string, desktopOnly: string[] = []) => {
    const small = read(f).filter((l) => SMALL.test(l));
    const skipped = small.filter((l) => desktopOnly.some((m) => l.includes(m)));
    const guarded = small.filter((l) => !skipped.includes(l));
    return { skipped, guarded, missing: guarded.filter((l) => !l.split(/[\s"'`]/).includes('max-md:text-sm')) };
  };

  // Header: hàng bị ẩn dưới md (hidden md:*), không bao giờ là chữ trên điện thoại.
  const HEADER_DESKTOP_ONLY = [
    'data-testid="topbar"', 'bg-ink-secondary border border-zinc-700', 'data-testid="brand-tagline"', '<kbd',
    'hidden lg:inline-flex', 'text-xs md:text-sm font-bold bg-ink-primary', 'bg-brand-primary text-white text-[11px]',
  ];

  it.each([
    ['Header.tsx', HEADER_DESKTOP_ONLY, 17, 7],
    ['QuickViewModal.tsx', [], 7, 0],
    ['TrustSealsPanel.tsx', [], 1, 0],
    ['ProductMediaGallery.tsx', [], 1, 0],
  ])('%s: mọi cỡ chữ gốc dưới 14px có max-md:text-sm', (file, desktopOnly, guarded, skipped) => {
    const r = scan(file, desktopOnly);
    expect(r.missing).toEqual([]);
    expect(r.guarded).toHaveLength(guarded);
    expect(r.skipped).toHaveLength(skipped);
  });

  it('QuickViewModal: hàng giá xuống dòng dưới md để không tràn ngang ở 360px', () => {
    const row = read('QuickViewModal.tsx').filter((l) => l.includes('flex items-center justify-between'));
    expect(row).toHaveLength(1);
    expect(row[0].split(/[\s"]/)).toEqual(expect.arrayContaining(['max-md:flex-wrap', 'max-md:gap-2']));
  });
});
