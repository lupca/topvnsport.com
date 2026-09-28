import { describe, it, expect } from 'vitest';
import { resolveSkuCode } from '../features/cart/cartSlice';
import { Product, ProductVariant, TierVariation } from '../types';
import fixture from './fixtures/prod_products.fixture.json';

// Fixture rút gọn (chỉ id, tier_variations, variants[tier_1_option,
// tier_2_option, sku_code]) chụp THẬT từ
// `curl -s "https://www.topvnsport.com/api/pmi/public/products?limit=100"`
// (chỉ GET, không ghi) -- xem src/__tests__/fixtures/prod_products.fixture.json.
// Test này chạy MỌI cặp của MỌI sản phẩm hai tầng (26 sản phẩm) và MỌI lựa
// chọn của MỌI sản phẩm một tầng (42 sản phẩm) trong fixture, không chỉ vài
// ví dụ đại diện.

interface FixtureVariant {
  tier_1_option: string | null;
  tier_2_option: string | null;
  sku_code: string | null;
}

interface FixtureProduct {
  id: number;
  tier_variations: TierVariation[];
  variants: FixtureVariant[];
}

const twoTierEntries = fixture.two_tier_products as FixtureProduct[];
const oneTierEntries = fixture.one_tier_products as FixtureProduct[];

function toProduct(entry: FixtureProduct): Product {
  return {
    id: String(entry.id),
    name: `Fixture product ${entry.id}`,
    brand: 'Other',
    category: 'Test',
    price: 100000,
    image: 'https://example.com/x.jpg',
    specs: {},
    description: '',
    reviews: [],
    stock: 10,
    tier_variations: entry.tier_variations,
    variants: entry.variants.map((v): ProductVariant => ({
      tier_1_option: v.tier_1_option,
      tier_2_option: v.tier_2_option,
      sku_code: v.sku_code || '',
      price: 100000,
      stock: 10
    }))
  };
}

describe('resolveSkuCode -- MỌI cặp của MỌI sản phẩm hai tầng trong fixture prod', () => {
  it('fixture có đúng 26 sản phẩm hai tầng (khớp báo cáo lỗi 26/74)', () => {
    expect(twoTierEntries.length).toBe(26);
  });

  for (const entry of twoTierEntries) {
    it(`sản phẩm ${entry.id}: khớp đúng SKU cho MỌI tổ hợp (${entry.variants.length} biến thể)`, () => {
      const product = toProduct(entry);
      expect(entry.variants.length).toBeGreaterThan(0);
      for (const v of entry.variants) {
        const sku = resolveSkuCode(product, v.tier_1_option || '', v.tier_2_option || '');
        expect(sku).toBe(v.sku_code);
      }
    });
  }
});

describe('resolveSkuCode -- MỌI lựa chọn của MỌI sản phẩm một tầng trong fixture prod', () => {
  it('fixture có đúng 42 sản phẩm một tầng', () => {
    expect(oneTierEntries.length).toBe(42);
  });

  for (const entry of oneTierEntries) {
    it(`sản phẩm ${entry.id}: khớp đúng SKU cho MỌI lựa chọn (${entry.variants.length} biến thể)`, () => {
      const product = toProduct(entry);
      expect(entry.variants.length).toBeGreaterThan(0);
      for (const v of entry.variants) {
        // Tầng 2 không tồn tại ở sản phẩm một tầng -- tham số bị bỏ qua khi
        // khớp, giá trị truyền vào không ảnh hưởng kết quả.
        const sku = resolveSkuCode(product, v.tier_1_option || '', 'Tiêu chuẩn');
        expect(sku).toBe(v.sku_code);
      }
    });
  }
});
