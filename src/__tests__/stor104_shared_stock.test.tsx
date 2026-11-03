// @vitest-environment jsdom
// STOR-104 (AC8, design 5.6 / R4, spec 13476ead + a4f6975e): variants sharing a WMS
// stock_code each show the shared row's qty and are counted once. Real functions only.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, cleanup, fireEvent } from '@testing-library/react';
import ProductDetailPage from '../components/ProductDetailPage';
import { applyWmsStock, parseWmsStock, stockCodesOf } from '../services/sport-api/wmsStock';
import { aggregateStock } from '../components/product-detail/helpers';
import { sportApi } from '../services/sport-api';
import type { Product, ProductVariant } from '../types';

const COLORS = ['Đen', 'Đỏ'];
const STRINGS = ['Khung không dây', 'BG65', 'BG80'];
const sku = (c: string, s: string) => `VOT-${c}-${s}`;

// Pinned wire body (coordinator, VOMA-399): {stock:{sku:qty}, items:[{sku_code, qty_available,
// qty_on_hand, qty_reserved, stock_code}]}; every covered member carries the shared qty.
const row = (sku_code: string, qty: number, stock_code?: string) => ({
  sku_code, qty_available: qty, qty_on_hand: qty, qty_reserved: 0, ...(stock_code ? { stock_code } : {})
});
const FRAME = { 'Đen': ['FRAME-DEN', 31], 'Đỏ': ['FRAME-DO', 7] } as const;
const ITEMS = COLORS.flatMap((c) => STRINGS.map((s) => row(sku(c, s), FRAME[c as 'Đen'][1], FRAME[c as 'Đen'][0])));
const BODY = { stock: Object.fromEntries(ITEMS.map((i) => [i.sku_code, i.qty_available])), items: ITEMS };
const BODY_RULE_OFF = { stock: BODY.stock, items: ITEMS.map(({ stock_code: _drop, ...rest }) => rest) };

const racket = (): Product => ({
  id: '1', slug: 'vot', name: 'Vợt', brand: 'Yonex', category: 'Vợt', price: 1000000, image: 'x.jpg',
  specs: {}, description: '', stock: 99,
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: COLORS },
    { tier_index: 2, name: 'Loại Cước', options: STRINGS }
  ],
  variants: COLORS.flatMap((c) => STRINGS.map((s): ProductVariant => ({
    tier_1_option: c, tier_2_option: s, sku_code: sku(c, s), price: 1000000
  })))
});

const applied = (body: unknown) => applyWmsStock([racket()], parseWmsStock(body))[0];
const stockOf = (p: Product, c: string, s: string) => p.variants!.find((v) => v.sku_code === sku(c, s))!.stock;

function renderPdp(p: Product) {
  return render(
    <MemoryRouter>
      <ProductDetailPage product={p} stringOptions={[]} onAddToCartWithSpecs={() => {}} onBackToCatalog={() => {}} />
    </MemoryRouter>
  );
}

describe('STOR-104 shared stock_code', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('parser reads items[].stock_code even when `stock` is present (verbatim body)', () => {
    const map = parseWmsStock(BODY);
    expect(map).toEqual(BODY.stock);
    expect(stockCodesOf(map)[sku('Đen', 'BG65')]).toBe('FRAME-DEN');
  });

  it('two variants of one stock_code each carry the shared qty', () => {
    const p = applied(BODY);
    expect([stockOf(p, 'Đen', 'BG65'), stockOf(p, 'Đen', 'BG80')]).toEqual([31, 31]);
    expect(p.variants!.find((v) => v.sku_code === sku('Đen', 'BG65'))!.stock_code).toBe('FRAME-DEN');
  });

  it('applyWmsStock counts one stock_code once in product.stock', () => {
    expect(applied(BODY).stock).toBe(31 + 7);
    // R4: 8 variants of one frame -> 31, not 8 x 31.
    const eight = { ...racket(), variants: Array.from({ length: 8 }, (_, i) => ({ tier_1_option: 'Đen', tier_2_option: `S${i}`, sku_code: `F-${i}`, price: 1 })) };
    const body = { stock: {}, items: eight.variants.map((v) => row(v.sku_code, 31, 'FRAME-1')) };
    body.stock = Object.fromEntries(body.items.map((i) => [i.sku_code, 31]));
    expect(applyWmsStock([eight], parseWmsStock(body))[0].stock).toBe(31);
  });

  it('unchosen string tier shows the frame qty; unchosen colour sums the frames', () => {
    const p = applied(BODY);
    expect(aggregateStock(p, 'Đen', '')).toEqual({ kind: 'known', stock: 31 });
    expect(aggregateStock(p, '', 'BG65')).toEqual({ kind: 'known', stock: 38 });
    expect(aggregateStock(p, '', '')).toEqual({ kind: 'known', stock: 38 });
  });

  it('members reporting different qty -> the minimum, never overstated', () => {
    const items = BODY.items.map((i) => (i.sku_code === sku('Đen', 'BG80') ? { ...i, qty_available: 5 } : i));
    const p = applied({ stock: { ...BODY.stock, [sku('Đen', 'BG80')]: 5 }, items });
    expect(aggregateStock(p, 'Đen', '')).toEqual({ kind: 'known', stock: 5 });
  });

  it('payload without stock_code yields today\'s numbers (rule off)', () => {
    const p = applied(BODY_RULE_OFF);
    expect(p.stock).toBe(3 * 31 + 3 * 7);
    expect(aggregateStock(p, 'Đen', '')).toEqual({ kind: 'known', stock: 93 });
    expect(p.variants!.some((v) => 'stock_code' in v)).toBe(false);
  });

  it('unknown stock on a covered variant never renders Hết', () => {
    const unknown = { ...racket(), variants: racket().variants!.map((v) => ({ ...v, stock_code: 'FRAME-DEN', stock: undefined })) };
    expect(aggregateStock(unknown, 'Đen', '')).toEqual({ kind: 'unknown' });
    expect(applyWmsStock([racket()], null)[0].stock).toBeUndefined();
    const { container } = renderPdp(unknown);
    expect(container.textContent).not.toContain('Hết');
  });

  it('PDP: two string options of one frame each show the shared qty', () => {
    const { container } = renderPdp(applied(BODY));
    const btn = [...container.querySelectorAll<HTMLElement>('[data-stock]')];
    const byText = (t: string) => btn.filter((b) => b.textContent?.includes(t)).map((b) => b.dataset.stock);
    // Colour buttons aggregate over the string tier: frame qty, not 3x.
    expect(byText('Đen')).toEqual(['31']);
    expect(byText('Đỏ')).toEqual(['7']);
  });

  it('PDP one frame: string options BG65 and BG80 each show 31', () => {
    const p = applied(BODY);
    const oneFrame = { ...p, tier_variations: [{ tier_index: 1, name: 'Màu Sắc', options: ['Đen'] }, p.tier_variations![1]], variants: p.variants!.filter((v) => v.tier_1_option === 'Đen') };
    const { container } = renderPdp(oneFrame);
    fireEvent.click(container.querySelector('input[type="checkbox"]')!); // bật đan cước
    const stocks = ['BG65', 'BG80'].map((t) => [...container.querySelectorAll<HTMLElement>('[data-stock]')].find((b) => b.textContent?.includes(t))?.dataset.stock);
    expect(stocks).toEqual(['31', '31']);
    expect(oneFrame.variants.length).toBe(3);
  });

  it('getWmsStock keeps stock_code across chunk merge (verbatim body)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(BODY), { status: 200 })));
    const map = await sportApi.getWmsStock([sku('Đen', 'BG65')]);
    expect(applyWmsStock([racket()], map)[0].stock).toBe(38);
  });
});
