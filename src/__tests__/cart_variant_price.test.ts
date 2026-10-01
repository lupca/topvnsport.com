import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildDefaultCartItem,
  buildConfiguredCartItem,
  describeCartItemSkuStatus,
  getCartItemUnitPrice,
  variantUnitPrice
} from '../features/cart/cartSlice';
import { Product } from '../types';
import { CartItem } from '../components/CartModal';

// Mô phỏng sản phẩm id 337 (Lining Axforce, giá biến thể 900000..1300000):
// giá cấp sản phẩm (price/salePrice) là giá thấp nhất, KHÔNG phải giá biến thể.
const racket: Product = {
  id: '337', name: 'Vợt Lining Axforce', brand: 'Lining', category: 'Vợt', price: 900000, salePrice: 900000,
  image: 'x.jpg', specs: {}, description: '', reviews: [], stock: 10,
  tier_variations: [{ tier_index: 1, name: 'Loại', options: ['A', 'B', 'C'] }],
  variants: [
    { tier_1_option: 'A', tier_2_option: null, sku_code: 'SKU-A', price: 900000, stock: 5 },
    { tier_1_option: 'B', tier_2_option: null, sku_code: 'SKU-B', price: 1300000, stock: 5 },
    { tier_1_option: 'C', tier_2_option: null, sku_code: 'SKU-C', price: 0, stock: 5 }
  ]
};

const single = (variant: Product['variants']): Product => ({
  ...racket, id: '500', tier_variations: [], variants: variant
});

afterEach(() => vi.restoreAllMocks());

describe('giá món giỏ theo biến thể', () => {
  it('buildDefaultCartItem lấy computedPrice ?? price của biến thể bán được duy nhất, không lấy giá sản phẩm', () => {
    const p = single([{ tier_1_option: null, tier_2_option: null, sku_code: 'ONLY', price: 1100000, computedPrice: 1000000, stock: 1 }]);
    expect(buildDefaultCartItem(p)!.price).toBe(1000000);
    const q = single([{ tier_1_option: null, tier_2_option: null, sku_code: 'ONLY', price: 1100000, stock: 1 }]);
    expect(buildDefaultCartItem(q)!.price).toBe(1100000);
  });

  it('buildConfiguredCartItem lấy giá của biến thể khớp resolveSkuCode', () => {
    const item = buildConfiguredCartItem(racket, '', 'B', null, 10.5)!;
    expect(item.skuCode).toBe('SKU-B');
    expect(item.price).toBe(1300000);
  });

  it('sản phẩm 337: hai biến thể khác nhau cho hai giá giỏ khác nhau, mỗi giá đúng của biến thể', () => {
    const a = buildConfiguredCartItem(racket, '', 'A', null, 10.5)!;
    const b = buildConfiguredCartItem(racket, '', 'B', null, 10.5)!;
    expect([a.price, b.price]).toEqual([900000, 1300000]);
  });

  it('buildDefaultCartItem trả null khi biến thể không có giá (0) và console.error nêu product id + sku_code', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = single([{ tier_1_option: null, tier_2_option: null, sku_code: 'ZERO', price: 0, stock: 1 }]);
    expect(buildDefaultCartItem(p)).toBeNull();
    const msg = err.mock.calls.map(c => String(c[0])).join('\n');
    expect(msg).toContain('500');
    expect(msg).toContain('ZERO');
  });

  it('buildConfiguredCartItem trả null khi biến thể không có giá (0) và console.error nêu product id + sku_code', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(buildConfiguredCartItem(racket, '', 'C', null, 10.5)).toBeNull();
    const msg = err.mock.calls.map(c => String(c[0])).join('\n');
    expect(msg).toContain('337');
    expect(msg).toContain('SKU-C');
  });

  it('variantUnitPrice: giá thiếu/0/âm -> null', () => {
    expect(variantUnitPrice({ tier_1_option: null, tier_2_option: null, sku_code: 'x', price: -1, stock: 0 })).toBeNull();
    expect(variantUnitPrice({ tier_1_option: null, tier_2_option: null, sku_code: 'x', price: undefined as unknown as number, stock: 0 })).toBeNull();
  });

  it("describeCartItemSkuStatus trả 'no_price' khi sku khớp biến thể bán được nhưng chưa có giá; getCartItemUnitPrice null", () => {
    const item = { id: 'i', productId: '337', skuCode: 'SKU-C', price: 1, quantity: 1 } as CartItem;
    expect(describeCartItemSkuStatus(item, [racket])).toBe('no_price');
    expect(getCartItemUnitPrice(item, [racket])).toBeNull();
    const ok = { ...item, skuCode: 'SKU-B' };
    expect(describeCartItemSkuStatus(ok, [racket])).toBe('ok');
    expect(getCartItemUnitPrice(ok, [racket])).toBe(1300000);
  });
});
