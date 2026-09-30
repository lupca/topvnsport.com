// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { sportApi } from '../services/sport-api/index';
import ProductDetailTabs from '../components/product-detail/ProductDetailTabs';
import ProductPurchaseSection from '../components/product-detail/ProductPurchaseSection';
import QuickViewModal from '../components/QuickViewModal';
import { PmiProduct } from '../services/sport-api/types';
import { Product } from '../types';

const pmi = (over: Partial<PmiProduct> = {}): PmiProduct => ({ id: 7, name: 'Vợt A', variants: [], ...over } as PmiProduct);
const attr = (code: string, value: string | number) => ({
  id: 1, attribute_id: 1, ...(typeof value === 'number' ? { value_decimal: value } : { value_string: value }),
  attribute: { code, name: code }
});

describe('STOR-006 mapper', () => {
  let err: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { err = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it('thiếu tên -> null + console.error nêu id', () => {
    expect(mapPmiProduct(pmi({ name: undefined }), [])).toBeNull();
    expect(err.mock.calls.flat().join(' ')).toContain('7');
  });

  it('tên toàn khoảng trắng -> null + console.error nêu id', () => {
    expect(mapPmiProduct(pmi({ id: 99, name: '   ' }), [])).toBeNull();
    expect(err.mock.calls.flat().join(' ')).toContain('99');
  });

  it('thiếu hoặc rỗng mô tả -> description undefined', () => {
    expect(mapPmiProduct(pmi({ description: undefined }), [])!.description).toBeUndefined();
    expect(mapPmiProduct(pmi({ description: '' }), [])!.description).toBeUndefined();
    expect(mapPmiProduct(pmi({ description: 'Thật' }), [])!.description).toBe('Thật');
  });

  it('biến thể không có tier_1_option -> colors []', () => {
    const p = mapPmiProduct(pmi({ variants: [{ id: 1, price: 1, stock: 1, sku_code: 'A' }, { id: 2, price: 1, stock: 1, sku_code: 'B', tier_1_option: '' }] as any }), []);
    expect(p!.colors).toEqual([]);
  });

  it('colors chỉ từ tier_1_option không rỗng, bỏ trùng', () => {
    const variants = ['Đỏ', 'Đỏ', '', 'Xanh', undefined].map((t, i) => ({ id: i + 1, price: 1, stock: 1, sku_code: `S${i}`, tier_1_option: t }));
    expect(mapPmiProduct(pmi({ variants: variants as any }), [])!.colors).toEqual(['Đỏ', 'Xanh']);
  });

  it.each([[0], ['']])('balance/maxTension = %j -> undefined', (v) => {
    const p = mapPmiProduct(pmi({ attribute_values: [attr('balance', v as any), attr('maxTension', v as any)] as any }), [])!;
    expect(p.specs.balance).toBeUndefined();
    expect(p.specs.maxTension).toBeUndefined();
  });

  it('balance/maxTension số thật > 0 được giữ', () => {
    const p = mapPmiProduct(pmi({ attribute_values: [attr('balance', 300), attr('maxTension', 28)] as any }), [])!;
    expect(p.specs).toMatchObject({ balance: 300, maxTension: 28 });
  });
});

describe('STOR-006 getProducts/getProductById (hợp đồng PIM)', () => {
  const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  const page = (items: unknown[]) => ({ items, total: items.length, page: 1, limit: 100, pages: 1 });
  const named = { id: 1, name: 'Có tên', variants: [] };
  const nameless = { id: 2, variants: [] };
  let err: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    err = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/public/voma-categories')) return ok([]);
      if (url.includes('/public/products/2')) return ok(nameless);
      if (url.includes('/public/products?')) return ok(page([named, nameless]));
      return ok({ stock: {} });
    }) as any;
  });
  afterEach(() => vi.restoreAllMocks());

  it('getProducts bỏ sản phẩm không tên, giữ sản phẩm có tên', async () => {
    const list = await sportApi.getProducts();
    expect(list.map((p) => p.id)).toEqual(['1']);
  });

  it('getProductById trả null cho sản phẩm không tên sau khi console.error nêu id', async () => {
    expect(await sportApi.getProductById('2')).toBeNull();
    expect(err.mock.calls.flat().join(' ')).toContain('sản phẩm 2');
    // Không rơi sang getProducts và không có lỗi nuốt (TypeError) nào.
    const urls = (global.fetch as any).mock.calls.map((c: any[]) => c[0] as string);
    expect(urls.some((u) => u.includes('/public/products?'))).toBe(false);
    expect(err.mock.calls.flat().some((a) => a instanceof Error)).toBe(false);
  });
});

const base: Product = { id: 'p', name: 'Vợt', image: '', price: 1, specs: {}, reviews: [], stock: 1, categoryCode: 'VC001491' } as Product;

describe('STOR-006 render', () => {
  afterEach(() => cleanup());

  it('ProductDetailTabs không hiện tiêu đề/nội dung mô tả khi description undefined', () => {
    render(<ProductDetailTabs product={base} isRacket={true} activeTab="details" onTabChange={vi.fn()} />);
    expect(screen.queryByText(/Cảm giác đánh thực tế/)).toBeNull();
    expect(screen.queryByText('Sản phẩm chính hãng.')).toBeNull();
  });

  it('ProductDetailTabs hiện mô tả khi có', () => {
    render(<ProductDetailTabs product={{ ...base, description: 'Mô tả thật' }} isRacket={true} activeTab="details" onTabChange={vi.fn()} />);
    expect(screen.getByText('Mô tả thật')).toBeTruthy();
    expect(screen.getByText(/Cảm giác đánh thực tế/)).toBeTruthy();
  });

  it('ProductDetailTabs không có "Tiêu chuẩn" khi balance/maxTension undefined', () => {
    const { container } = render(<ProductDetailTabs product={base} isRacket={true} activeTab="tech" onTabChange={vi.fn()} />);
    expect(container.textContent).not.toContain('Tiêu chuẩn');
    expect(container.textContent).not.toContain('Điểm Cân Bằng');
    expect(container.textContent).not.toContain('Max Tension');
  });

  it('ProductDetailTabs không dựng chú thích "Tiêu chuẩn" kể cả khi balance/maxTension = 0 lọt vào', () => {
    const p = { ...base, specs: { balance: 0, maxTension: 0 } };
    const { container } = render(<ProductDetailTabs product={p} isRacket={true} activeTab="tech" onTabChange={vi.fn()} />);
    expect(container.textContent).not.toContain('Tiêu chuẩn');
  });

  it('QuickViewModal không có khung mô tả khi description undefined', () => {
    const { container } = render(
      <MemoryRouter><QuickViewModal product={base} onClose={vi.fn()} onAddToCart={vi.fn()} /></MemoryRouter>
    );
    expect(container.querySelector('p.whitespace-pre-line')).toBeNull();
  });

  it('ProductPurchaseSection không có nút "Tiêu chuẩn" cho sản phẩm không tầng', () => {
    const props: any = {
      product: { ...base, colors: [], tier_variations: [], variants: [] }, isRacket: true, totalDisplayPrice: 1, hasPrice: true,
      displayOriginalPrice: 1, hasDiscount: false, discountPercent: 0, stringPrice: 0, selectedTier1: '', selectedTier2: '',
      selectedColor: 'Tiêu chuẩn', withStringing: false, selectedString: null, tension: 0, stringOptions: [],
      hasStringingVariation: false, isDynamicStringingActive: false, activeStringValue: '', isOutOfStock: false,
      onSetSelectedTier1: vi.fn(), onSetSelectedTier2: vi.fn(), onSetSelectedColor: vi.fn(), onSetWithStringing: vi.fn(),
      onSetSelectedString: vi.fn(), onSetTension: vi.fn(), onAddToCart: vi.fn(), getVariantStock: () => 0
    };
    const { container } = render(<MemoryRouter><ProductPurchaseSection {...props} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Tiêu chuẩn' })).toBeNull();
    expect(container.textContent).not.toContain('Tiêu chuẩn');
  });
});
