// @vitest-environment jsdom
// STOR-008: không giá trị bịa (ngành / giá / thương hiệu).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import QuickViewModal from '../components/QuickViewModal';
import ProductPurchaseSection from '../components/product-detail/ProductPurchaseSection';
import MobilePurchaseBar from '../components/product-detail/MobilePurchaseBar';
import { buildDefaultCartItem, buildConfiguredCartItem } from '../features/cart/cartSlice';
import { getBrands } from '../utils/brands';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { sportApi } from '../services/sport-api/index';
import { PmiProduct } from '../services/sport-api/types';
import { Product } from '../types';

const NO_PRICE = 'Liên hệ để biết giá';

const base: Product = {
  id: 'np',
  name: 'Vợt chưa có giá',
  image: '',
  specs: {},
  description: '',
  reviews: [],
  stock: 5,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: 'SKU-NP', price: 0, stock: 5 }]
};

const brandedNoPrice: Product = { ...base, brand: 'VICTORY', category: 'Vợt' };

function pmi(attrBrand?: string, extra: Partial<PmiProduct> = {}): PmiProduct {
  return {
    id: '1',
    name: 'SP',
    variants: [{ id: 1, price: 100, stock: 1, sku_code: 'A' }],
    attribute_values: attrBrand === undefined ? [] : [
      { id: 1, attribute_id: 1, value_string: attrBrand, attribute: { code: 'brand', name: 'Thương hiệu' } }
    ],
    ...extra
  } as PmiProduct;
}

function purchaseProps(over: Record<string, unknown> = {}) {
  return {
    product: brandedNoPrice, isRacket: false, totalDisplayPrice: 0, hasPrice: false,
    displayOriginalPrice: 0, hasDiscount: false, discountPercent: 0, stringPrice: 0,
    selectedTier1: '', selectedTier2: '', selectedColor: '', withStringing: false,
    selectedString: null, tension: 10.5, stringOptions: [], hasStringingVariation: false,
    isDynamicStringingActive: false, activeStringValue: '', isOutOfStock: false,
    onSetSelectedTier1: vi.fn(), onSetSelectedTier2: vi.fn(), onSetSelectedColor: vi.fn(),
    onSetWithStringing: vi.fn(), onSetSelectedString: vi.fn(), onSetTension: vi.fn(),
    onAddToCart: vi.fn(), getVariantStock: () => 5, ...over
  } as any;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('mapPmiProduct không bịa', () => {
  it('giá 0/thiếu/không biến thể -> price undefined (không 100000)', () => {
    expect(mapPmiProduct(pmi(undefined, { variants: [{ id: 1, price: 0, stock: 1 } as any] }), []).price).toBeUndefined();
    expect(mapPmiProduct(pmi(undefined, { variants: [] }), []).price).toBeUndefined();
  });
  it('không ngành -> category undefined (không "Chưa phân loại")', () => {
    expect(mapPmiProduct(pmi(), []).category).toBeUndefined();
  });
  it('thương hiệu: nguyên chuỗi đã trim, VICTORY giữ nguyên', () => {
    expect(mapPmiProduct(pmi(' VICTORY '), []).brand).toBe('VICTORY');
    expect(mapPmiProduct(pmi('Victor'), []).brand).toBe('Victor');
    expect(mapPmiProduct(pmi(' Yonex '), []).brand).toBe('Yonex');
    expect(mapPmiProduct(pmi('Thành Công'), []).brand).toBe('Thành Công');
  });
  it('thiếu / No Brand / NoBrand -> brand undefined (không "Other")', () => {
    expect(mapPmiProduct(pmi(), []).brand).toBeUndefined();
    expect(mapPmiProduct(pmi('No Brand'), []).brand).toBeUndefined();
    expect(mapPmiProduct(pmi('NoBrand'), []).brand).toBeUndefined();
    expect(mapPmiProduct(pmi('  '), []).brand).toBeUndefined();
  });
});

describe('getBrands', () => {
  it('đúng tập thương hiệu khác rỗng đã tải, không gộp VICTORY vào Victor', () => {
    const list = [
      { ...base, brand: 'Yonex' }, { ...base, brand: ' Yonex ' }, { ...base, brand: 'VICTOR' },
      { ...base, brand: 'VICTORY' }, { ...base, brand: undefined }, { ...base, brand: '' }
    ] as Product[];
    expect(getBrands(list)).toEqual(['VICTOR', 'VICTORY', 'Yonex']);
  });
});

describe('ProductCard không giá', () => {
  const onAdd = vi.fn();
  const renderCard = (p: Product) => render(<MemoryRouter><ProductCard product={p} onQuickView={vi.fn()} onAddToCart={onAdd} /></MemoryRouter>);
  it('hiện Liên hệ để biết giá, không hiện số đ', () => {
    const { container } = renderCard(brandedNoPrice);
    expect(screen.getByText(NO_PRICE)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\dđ/);
  });
  it('thêm nhanh không dispatch khi không giá', () => {
    renderCard(brandedNoPrice);
    const btn = screen.getByTitle(NO_PRICE) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onAdd).not.toHaveBeenCalled();
  });
  it('không ngành/thương hiệu -> không có nhãn', () => {
    renderCard(base);
    expect(screen.queryByTestId('brand-label')).toBeNull();
    expect(screen.queryByTestId('category-label')).toBeNull();
  });
  it('có nhãn khi có dữ liệu', () => {
    renderCard(brandedNoPrice);
    expect(screen.getByTestId('brand-label').textContent).toBe('VICTORY');
    expect(screen.getByTestId('category-label').textContent).toBe('Vợt');
  });
});

describe('QuickViewModal không giá', () => {
  it('hiện Liên hệ để biết giá và khoá nút thêm giỏ', () => {
    render(<MemoryRouter><QuickViewModal product={brandedNoPrice} onClose={vi.fn()} onAddToCart={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(NO_PRICE)).toBeTruthy();
    expect((document.getElementById('add-to-cart-quickview') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ProductPurchaseSection không giá', () => {
  it('hiện Liên hệ để biết giá, không kèm số điện thoại/link', () => {
    render(<MemoryRouter><ProductPurchaseSection {...purchaseProps()} /></MemoryRouter>);
    const el = screen.getByTestId('purchase-price');
    expect(el.textContent).toBe(NO_PRICE);
    expect(el.parentElement!.querySelector('a')).toBeNull();
    expect(el.parentElement!.textContent).toBe(NO_PRICE);
  });
  it('khoá nút thêm giỏ', () => {
    render(<MemoryRouter><ProductPurchaseSection {...purchaseProps()} /></MemoryRouter>);
    expect((screen.getByText('Thêm vào giỏ hàng').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('MobilePurchaseBar không giá', () => {
  const p = { productName: 'X', productImage: '', totalDisplayPrice: 0, hasPrice: false, onBuyNow: vi.fn() };
  it('hiện Liên hệ để biết giá không kèm link', () => {
    const { container } = render(<MobilePurchaseBar {...p} />);
    expect(screen.getByText(NO_PRICE)).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
  });
  it('khoá nút Mua ngay', () => {
    render(<MobilePurchaseBar {...p} />);
    const btn = screen.getByText('Mua ngay').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('cartSlice không giá', () => {
  it('buildDefaultCartItem trả null khi price undefined', () => {
    expect(buildDefaultCartItem(brandedNoPrice)).toBeNull();
  });
  it('buildConfiguredCartItem trả null khi price undefined', () => {
    expect(buildConfiguredCartItem(brandedNoPrice, 'Tiêu chuẩn', 'Tiêu chuẩn', null, 10.5)).toBeNull();
  });
  it('có giá thật thì vẫn tạo món hàng', () => {
    expect(buildDefaultCartItem({ ...brandedNoPrice, price: 100, variants: [{ ...brandedNoPrice.variants![0], price: 100 }] })).not.toBeNull();
  });
});

describe('getStringOptions', () => {
  beforeEach(() => {
    const mk = (id: number, brand: string | undefined, price: number) => ({
      id, name: `Cước ${id}`,
      attribute_values: [
        { id: 1, attribute_id: 5, value_string: '0.68mm', attribute: { code: 'thickness', name: 'Độ dày' } },
        ...(brand ? [{ id: 2, attribute_id: 6, value_string: brand, attribute: { code: 'brand', name: 'Thương hiệu' } }] : [])
      ],
      variants: [{ id: id * 10, sku_code: `S${id}`, price, stock: 5 }]
    });
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const body = url.includes('/public/stock') ? { stock: {} }
        : url.includes('/public/products') ? { items: [mk(1, 'VICTORY', 100), mk(2, undefined, 100), mk(3, 'Kizuna', 0)] }
        : [];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }) as any;
  });
  it('mang thương hiệu của chính sản phẩm (hoặc undefined), không bao giờ Yonex; bỏ cước không giá kèm warn id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const options = await sportApi.getStringOptions();
    expect(options.map((o) => [o.id, o.brand])).toEqual([['1', 'VICTORY'], ['2', undefined]]);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('3'))).toBe(true);
  });
});
