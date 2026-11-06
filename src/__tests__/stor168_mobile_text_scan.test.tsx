// @vitest-environment jsdom
// STOR-168 (goal 2c881ad4, QA 701b68cd, MOB-F): nhãn "Giảm đến N%" trang chủ 14px dưới md, 13px từ md (desktop không đổi);
// "Đang tải sản phẩm..." trong App.tsx 14px dưới md. Guard không phụ thuộc fixture: render nhãn từ SP còn hàng đang KM,
// và quét mọi file .ts/.tsx trong src: cỡ chữ gốc (hoặc max-md:) dưới 14px phải có max-md:text-* >= 14px, hoặc nằm trong allowlist có lý do.
// Vừa khít thật (font thật, 360-430px) đo ở e2e/mobile-text-fit.cjs.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';

const SRC = path.resolve(__dirname, '..');

const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const promo = (id: string, pct: number, extra: Record<string, unknown> = {}) =>
  prod(id, { hasActivePromotion: true, percentageDiscount: pct, originalPrice: 100000, computedPrice: 100000 - pct * 1000, ...extra });
const categories = [{ id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Vợt' }];

function renderHome(products: any[], productsError = false) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories, productsError }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(<Provider store={store}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
}

afterEach(cleanup);

// Cỡ chữ gốc (không variant) dưới 14px, hoặc cỡ dưới md dưới 14px.
const BASE_SMALL = /(?<![\w:-])text-(?:xs|\[(?:\d|1[0-3])(?:\.\d+)?px\])(?![\w-])/;
const PHONE_SMALL = /(?<![\w-])max-md:text-(?:xs|\[(?:\d|1[0-3])(?:\.\d+)?px\])(?![\w-])/;
// max-md:text-* đủ 14px trở lên (sm = 14px, base = 16px, ...).
const PHONE_OK = /(?<![\w-])max-md:text-(?:sm|base|lg|xl|2xl|3xl|\[(?:1[4-9]|[2-9]\d)(?:\.\d+)?px\])(?![\w-])/;
const isHit = (line: string) => (BASE_SMALL.test(line) || PHONE_SMALL.test(line)) && !PHONE_OK.test(line);

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name) ? [p] : [];
  });

// Mỗi dòng nhỏ chưa có override được gắn với một marker và lý do. Pin đúng 16 dòng: thêm dòng nhỏ mới làm đỏ.
const ALLOW: { file: string; marker: string; reason: string }[] = [
  { file: 'components/Header.tsx', marker: 'data-testid="topbar"', reason: 'topbar hidden md:flex, chỉ desktop' },
  { file: 'components/Header.tsx', marker: 'bg-ink-secondary border border-zinc-700', reason: 'chip trong topbar, chỉ desktop' },
  { file: 'components/Header.tsx', marker: 'data-testid="brand-tagline"', reason: 'slogan header, chỉ desktop (đã xác nhận ở STOR-167)' },
  { file: 'components/Header.tsx', marker: '<kbd className', reason: 'gợi ý phím tắt hidden md:inline-block, chỉ desktop' },
  { file: 'components/Header.tsx', marker: 'hidden lg:inline-flex', reason: 'nút chỉ hiện từ lg, không thấy trên điện thoại' },
  { file: 'components/Header.tsx', marker: 'bg-ink-primary text-white px-4 py-2 rounded-full', reason: 'nút header desktop (text-xs md:text-sm, chỉ desktop theo STOR-167)' },
  { file: 'components/Header.tsx', marker: 'bg-brand-primary text-white text-[11px]', reason: 'huy hiệu header desktop (chỉ desktop theo STOR-167)' },
  { file: 'components/MainNav.tsx', marker: 'data-testid="stringing-strip"', reason: 'dải cước hidden md:block, chỉ desktop' },
  { file: 'components/ProductCard.tsx', marker: 'bg-black/90 hover:bg-brand-primary', reason: 'nút Xem nhanh chỉ có trên thiết bị hover ([@media(hover:hover)]), không hiện trên cảm ứng' },
  { file: 'components/CartModal.tsx', marker: 'w-full text-xs uppercase tracking-wider py-3 rounded-sm', reason: 'className tiếp tục ở dòng sau với max-md:text-sm max-md:min-h-11' },
  { file: 'features/home/HomePage.tsx', marker: 'data-testid="hub-eyebrow"', reason: 'eyebrow hidden md:block, chỉ desktop' },
  { file: 'features/home/HomePage.tsx', marker: 'Lọc nhanh:', reason: 'thanh lọc nhanh nằm trong hidden md:flex, chỉ desktop' },
  { file: 'features/home/HomePage.tsx', marker: 'text-[12.5px] font-bold transition', reason: 'chip lọc nhanh, nằm trong hidden md:flex, chỉ desktop' },
  { file: 'features/home/HomePage.tsx', marker: 'data-testid="result-counter"', reason: 'đếm kết quả trong thanh lọc hidden md:flex, chỉ desktop' },
  { file: 'features/home/HomePage.tsx', marker: 'text-[13px] font-bold px-3 py-1.5 rounded-md cursor-pointer', reason: 'ô sắp xếp trong thanh lọc hidden md:flex, chỉ desktop' },
  { file: 'features/home/HomePage.tsx', marker: 'data-testid="cat-tile-sub"', reason: 'phụ đề ô danh mục hidden md:block, chỉ desktop' },
];

describe('STOR-168 nhãn Giảm đến trên trang chủ', () => {
  it('nhãn từ SP còn hàng đang KM: 14px dưới md, 13px từ md, không có cỡ gốc dưới 14px', () => {
    renderHome([promo('a', 10), promo('b', 25)]);
    const badge = within(screen.getByTestId('sale-section')).getByTestId('sale-max-badge');
    expect(badge.textContent).toBe('Giảm đến 25%');
    const tokens = badge.className.split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(['max-md:text-[14px]', 'md:text-[13px]']));
    expect(tokens.filter((t) => /^text-(xs|\[\d+(\.\d+)?px\])$/.test(t))).toEqual([]);
  });

  it('dòng "Đang tải sản phẩm..." trong App.tsx có max-md:text-sm', () => {
    const line = fs.readFileSync(path.resolve(SRC, 'App.tsx'), 'utf8').split('\n').find((l) => l.includes('Đang tải sản phẩm...'));
    expect(line).toBeDefined();
    expect(line!.split(/[\s"']/)).toContain('max-md:text-sm');
  });
});

describe('STOR-168 quét chữ nhỏ trên điện thoại trong src', () => {
  const hits = walk(SRC).flatMap((f) =>
    fs.readFileSync(f, 'utf8').split('\n')
      .map((text, i) => ({ file: path.relative(SRC, f), line: i + 1, text }))
      .filter((h) => isHit(h.text)),
  );
  const allowed = (h: { file: string; text: string }) => ALLOW.some((a) => a.file === h.file && h.text.includes(a.marker));

  it('mọi dòng nhỏ không có override 14px đều nằm trong allowlist', () => {
    const unlisted = hits.filter((h) => !allowed(h)).map((h) => `${h.file}:${h.line} ${h.text.trim().slice(0, 120)}`);
    expect(unlisted).toEqual([]);
  });

  it('allowlist: mỗi mục khớp ít nhất một dòng, có lý do, đúng 16 dòng', () => {
    const unused = ALLOW.filter((a) => !hits.some((h) => h.file === a.file && h.text.includes(a.marker))).map((a) => a.marker);
    expect(unused).toEqual([]);
    expect(ALLOW.every((a) => a.reason.trim().length >= 10)).toBe(true);
    expect(ALLOW).toHaveLength(16);
    expect(hits).toHaveLength(16);
  });
});
