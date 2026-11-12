// @vitest-environment jsdom
// STOR-168 (goal 2c881ad4, QA 701b68cd, MOB-F): nhãn "Giảm đến N%" trang chủ 14px dưới md, 13px từ md (desktop không đổi);
// "Đang tải sản phẩm..." trong App.tsx 14px dưới md. Guard không phụ thuộc fixture: render nhãn từ SP còn hàng đang KM,
// và quét mọi file .ts/.tsx trong src: cỡ chữ gốc (hoặc max-md:) dưới 14px phải có max-md:text-* >= 14px, hoặc nằm trong allowlist có lý do.
// Vừa khít thật (font thật, 360-430px) đo ở e2e/mobile-text-fit.cjs.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, afterEach, afterAll } from 'vitest';
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

// Parser cho mọi token text-*. Quy đổi cố định: px = 1, rem và em = 16px, pt = 4/3 px
// (không dùng 17px của html trong index.css). Dạng được nhận: text-xs/sm/base/lg/xl/2xl/3xl và text-[Npx|Nrem|Nem|Npt]
// hoặc text-[length:Npx|...]. Giá trị khác (ví dụ text-[var(--x)]) bỏ qua.
// Variant được đọc theo chuỗi (có thể xếp chồng, ví dụ dark:max-md:, sm:max-md:, max-md:hover:, max-[399px]:):
//  - không có variant: base, áp mọi màn hình;
//  - phone: chuỗi có một đoạn max-sm:, max-md:, max-lg:, max-xl:, max-2xl: hoặc max-[Npx]: với N >= 360
//    (các đoạn này áp dụng ở 360-430px). Ví dụ max-[399px]: là phone, max-[320px]: thì không.
// Variant khác (dark:, hover:, min-*, [&>p]:, ...) không được tính là base hay phone: text-* dưới các variant đó bị bỏ qua.
// Giới hạn đã biết: (1) kiểm tra theo dòng, không theo từng token class. Dòng có token nhỏ và có một token phone >= 14px
// cùng dòng sẽ bị bỏ qua. (2) Chuỗi variant có ':' trong ngoặc vuông (ví dụ [@media(min-width:768px)]:) không được tách đúng.
// (3) max-[Nrem]: không được coi là phone. Ghi lại ở đây và trong báo cáo STOR-168 Round 3.
const MIN = 14;
const TW_SIZE_PX = new Map<string, number>([['xs', 12], ['sm', 14], ['base', 16], ['lg', 18], ['xl', 20], ['2xl', 24], ['3xl', 30]]);
const UNIT_PX = new Map<string, number>([['px', 1], ['rem', 16], ['em', 16], ['pt', 4 / 3]]);
const SIZE_TOKEN = /(?<![\w:\-[.])((?:(?:[\w-]+(?:\[[^\]\s"'`]+\])?|\[[^\]\s"'`]+\]):)*)text-(xs|sm|base|lg|xl|2xl|3xl|\[[^\]\s"'`]+\])(?![\w-])/g;
const PHONE_VARIANT = /^max-(?:sm|md|lg|xl|2xl|\[(\d*\.?\d+)px\])$/;
export function isPhoneChain(prefix: string): boolean {
  return prefix.split(':').filter(Boolean).some((seg) => {
    const m = PHONE_VARIANT.exec(seg);
    return m !== null && (m[1] === undefined || parseFloat(m[1]) >= 360);
  });
}
export function sizePx(value: string): number | null {
  if (TW_SIZE_PX.has(value)) return TW_SIZE_PX.get(value)!;
  const m = /^\[(?:length:)?(\d*\.?\d+)(px|rem|em|pt)\]$/.exec(value);
  return m ? parseFloat(m[1]) * UNIT_PX.get(m[2])! : null;
}
export function isHit(line: string): boolean {
  const toks = [...line.matchAll(SIZE_TOKEN)].map((m) => ({ phone: isPhoneChain(m[1]), base: m[1] === '', px: sizePx(m[2]) }));
  const small = (t: { px: number | null }) => t.px !== null && t.px < MIN;
  const phoneOk = toks.some((t) => t.phone && t.px !== null && t.px >= MIN);
  return (toks.some((t) => t.phone && small(t)) || toks.some((t) => t.base && small(t))) && !phoneOk;
}

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
});

const scanTree = (root: string) =>
  walk(root).flatMap((f) =>
    fs.readFileSync(f, 'utf8').split('\n')
      .map((text, i) => ({ file: path.relative(root, f), line: i + 1, text }))
      .filter((h) => isHit(h.text)),
  );

describe('STOR-168 quét chữ nhỏ trên điện thoại trong src', () => {
  const hits = scanTree(SRC);
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

// File mới giả lập trong thư mục tạm (cùng đường đi scanTree như src), không đụng src thật.
describe('STOR-168 quét file mới: mỗi dạng cỡ chữ', () => {
  const dirs: string[] = [];
  const probe = (classes: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stor168-'));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, 'Probe.tsx'), `export const P = () => <p className="${classes}">x</p>;\n`);
    return scanTree(dir);
  };
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it.each([
    ['text-[12px]', 'text-[12px] font-bold'],
    ['text-[0.75rem]', 'text-[0.75rem] font-bold'],
    ['text-[.7rem]', 'text-[.7rem] font-bold'],
    ['text-[0.75em]', 'text-[0.75em] font-bold'],
    ['text-[9pt] (= 12px)', 'text-[9pt] font-bold'],
    ['text-[length:12px]', 'text-[length:12px] font-bold'],
    ['dark:max-md:text-[12px] (F2, xếp chồng)', 'dark:max-md:text-[12px] font-bold'],
    ['sm:max-md:text-xs (F2, xếp chồng)', 'sm:max-md:text-xs font-bold'],
    ['max-sm:text-[0.75rem] (F3)', 'max-sm:text-[0.75rem] font-bold'],
    ['max-lg:text-xs (F3)', 'max-lg:text-xs font-bold'],
    ['max-[399px]:text-[12px] (F3)', 'max-[399px]:text-[12px] font-bold'],
    ['max-md:hover:text-xs (F3)', 'max-md:hover:text-xs font-bold'],
  ])('fail: %s', (_, classes) => {
    expect(probe(classes)).toHaveLength(1);
  });

  it.each([
    ['text-[0.875rem] (= 14px)', 'text-[0.875rem] font-bold'],
    ['text-[12pt] (= 16px)', 'text-[12pt] font-bold'],
    ['text-[12px] max-md:text-[20px] (max-md override)', 'text-[12px] max-md:text-[20px]'],
    ['max-[399px]:text-[15px] (Header.tsx:191, không bị coi là nhỏ)', 'max-[399px]:text-[15px] font-bold'],
  ])('pass: %s', (_, classes) => {
    expect(probe(classes)).toEqual([]);
  });
});
