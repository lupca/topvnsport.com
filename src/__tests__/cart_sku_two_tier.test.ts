import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveSkuCode,
  describeSkuSelection,
  buildDefaultCartItem,
  buildConfiguredCartItem,
  buildVariantLabel,
  getSingleSellableSku,
  isCartItemSkuValid
} from '../features/cart/cartSlice';
import { Product } from '../types';

// Toàn bộ dữ liệu variants dưới đây chụp THẬT từ prod (GET
// https://www.topvnsport.com/api/pmi/public/products?limit=100, 2026-09-28) --
// không bịa. Đây chính là hai ví dụ trong báo cáo lỗi: id 341 (áo, hai tầng
// Màu Sắc x Size) và id 337 (vợt, hai tầng Màu Sắc x Loại Cước). Bộ test chạy
// MỌI cặp/lựa chọn của TOÀN BỘ 26 sản phẩm hai tầng + 42 sản phẩm một tầng
// nằm ở cart_sku_prod_fixture.test.ts.

const twoTierShirt: Product = {
  id: '341',
  name: 'Áo Yonex Collection',
  brand: 'Yonex',
  category: 'Áo cầu lông',
  price: 145000,
  image: 'https://example.com/341.jpg',
  specs: {},
  description: '',
  reviews: [],
  stock: 250,
  colors: ['DAZZLING BLUE', 'FRENCH BLUE', 'DARK ECLIPSE', 'WHITE', 'GOLDEN CREAM'],
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['DAZZLING BLUE', 'FRENCH BLUE', 'DARK ECLIPSE', 'WHITE', 'GOLDEN CREAM'] },
    { tier_index: 2, name: 'Size', options: ['S', 'M', 'L', 'XL', '2XL'] }
  ],
  variants: [
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S', price: 175000, stock: 10 },
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'M', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-M', price: 175000, stock: 10 },
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'L', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-L', price: 175000, stock: 10 },
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-XL', price: 175000, stock: 10 },
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: '2XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-2XL', price: 175000, stock: 10 },
    { tier_1_option: 'FRENCH BLUE', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-FRENCH-BLUE-S', price: 145000, stock: 10 },
    { tier_1_option: 'FRENCH BLUE', tier_2_option: 'M', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-FRENCH-BLUE-M', price: 145000, stock: 10 },
    { tier_1_option: 'FRENCH BLUE', tier_2_option: 'L', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-FRENCH-BLUE-L', price: 145000, stock: 10 },
    { tier_1_option: 'FRENCH BLUE', tier_2_option: 'XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-FRENCH-BLUE-XL', price: 145000, stock: 10 },
    { tier_1_option: 'FRENCH BLUE', tier_2_option: '2XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-FRENCH-BLUE-2XL', price: 145000, stock: 10 },
    { tier_1_option: 'DARK ECLIPSE', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DARK-ECLIPSE-S', price: 175000, stock: 10 },
    { tier_1_option: 'DARK ECLIPSE', tier_2_option: 'M', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DARK-ECLIPSE-M', price: 175000, stock: 10 },
    { tier_1_option: 'DARK ECLIPSE', tier_2_option: 'L', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DARK-ECLIPSE-L', price: 175000, stock: 10 },
    { tier_1_option: 'DARK ECLIPSE', tier_2_option: 'XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DARK-ECLIPSE-XL', price: 175000, stock: 10 },
    { tier_1_option: 'DARK ECLIPSE', tier_2_option: '2XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DARK-ECLIPSE-2XL', price: 175000, stock: 10 },
    { tier_1_option: 'WHITE', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-WHITE-S', price: 165000, stock: 10 },
    { tier_1_option: 'WHITE', tier_2_option: 'M', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-WHITE-M', price: 165000, stock: 10 },
    { tier_1_option: 'WHITE', tier_2_option: 'L', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-WHITE-L', price: 165000, stock: 10 },
    { tier_1_option: 'WHITE', tier_2_option: 'XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-WHITE-XL', price: 165000, stock: 10 },
    { tier_1_option: 'WHITE', tier_2_option: '2XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-WHITE-2XL', price: 165000, stock: 10 },
    { tier_1_option: 'GOLDEN CREAM', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-GOLDEN-CREAM-S', price: 175000, stock: 10 },
    { tier_1_option: 'GOLDEN CREAM', tier_2_option: 'M', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-GOLDEN-CREAM-M', price: 175000, stock: 10 },
    { tier_1_option: 'GOLDEN CREAM', tier_2_option: 'L', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-GOLDEN-CREAM-L', price: 175000, stock: 10 },
    { tier_1_option: 'GOLDEN CREAM', tier_2_option: 'XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-GOLDEN-CREAM-XL', price: 175000, stock: 10 },
    { tier_1_option: 'GOLDEN CREAM', tier_2_option: '2XL', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-GOLDEN-CREAM-2XL', price: 175000, stock: 10 }
  ]
};

const twoTierRacket: Product = {
  id: '337',
  name: '[Hỏa Tốc] Vợt cầu lông Lining Axforce Cannon (5U)',
  brand: 'Lining',
  category: 'Vợt cầu lông',
  price: 900000,
  image: 'https://example.com/337.jpg',
  specs: {},
  description: '',
  reviews: [],
  stock: 240,
  colors: ['Cannon Black', 'Cannon Deep Teal', 'Cannon Ambrosia'],
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['Cannon Black', 'Cannon Deep Teal', 'Cannon Ambrosia'] },
    { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'PA2055', 'BG 65TI', 'BG 66U', 'Exbolt 63', 'Exbolt 65', 'Exbolt 68', 'Kizuna Z61'] }
  ],
  variants: [
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'BG 65TI', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-BG-65TI', price: 1260000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'Exbolt 68', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-EXBOLT-68', price: 1200000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'Khung không dây', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-KHUNG-KHONG-DAY', price: 1000000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'Kizuna Z61', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-KIZUNA-Z61', price: 1100000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'Exbolt 65', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-EXBOLT-65', price: 1300000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'Exbolt 63', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-EXBOLT-63', price: 1100000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'BG 66U', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-BG-66U', price: 1100000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'BG 65TI', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-BG-65TI', price: 1060000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'Exbolt 65', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-EXBOLT-65', price: 1200000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'PA2055', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-PA2055', price: 960000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'Exbolt 65', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-EXBOLT-65', price: 1100000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'Khung không dây', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-KHUNG-KHONG-DAY', price: 900000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'Exbolt 63', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-EXBOLT-63', price: 1300000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'BG 66U', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-BG-66U', price: 1200000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'Kizuna Z61', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-KIZUNA-Z61', price: 1300000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'BG 65TI', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-BG-65TI', price: 1160000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'PA2055', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-PA2055', price: 1160000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'PA2055', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-PA2055', price: 1060000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'BG 66U', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-BG-66U', price: 1300000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'Kizuna Z61', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-KIZUNA-Z61', price: 1200000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'Exbolt 68', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-EXBOLT-68', price: 1300000, stock: 10 },
    { tier_1_option: 'Cannon Deep Teal', tier_2_option: 'Khung không dây', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-KHUNG-KHONG-DAY', price: 1100000, stock: 10 },
    { tier_1_option: 'Cannon Black', tier_2_option: 'Exbolt 68', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-BLACK-EXBOLT-68', price: 1100000, stock: 10 },
    { tier_1_option: 'Cannon Ambrosia', tier_2_option: 'Exbolt 63', sku_code: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-AMBROSIA-EXBOLT-63', price: 1200000, stock: 10 }
  ]
};

// Sản phẩm một tầng, NHIỀU lựa chọn (id 339 "Dây vợt" -- chỉ chọn loại dây,
// không có size). 5 biến thể -> vẫn phải chọn ở trang chi tiết, không thêm
// nhanh được (theo thiết kế mới: thêm nhanh CHỈ khi đúng MỘT SKU bán được).
const oneTierProduct: Product = {
  id: '339',
  name: 'Dây vợt cầu lông Lining',
  brand: 'Lining',
  category: 'Phụ kiện',
  price: 2200000,
  image: 'https://example.com/339.jpg',
  specs: {},
  description: '',
  reviews: [],
  stock: 50,
  colors: ['Khung không', 'Yonex BG 65Ti', 'Yonex BG 66U', 'Yonex EXBOLT 65', 'Kizuna Z61'],
  tier_variations: [
    { tier_index: 1, name: 'Dây vợt', options: ['Khung không', 'Yonex BG 65Ti', 'Yonex BG 66U', 'Yonex EXBOLT 65', 'Kizuna Z61'] }
  ],
  variants: [
    { tier_1_option: 'Yonex BG 65Ti', tier_2_option: null, sku_code: 'PRD-VOT-CAU-LONG-LINING-XZBJ-YONEX-BG-65TI', price: 2380000, stock: 10 },
    { tier_1_option: 'Yonex BG 66U', tier_2_option: null, sku_code: 'PRD-VOT-CAU-LONG-LINING-XZBJ-YONEX-BG-66U', price: 2350000, stock: 10 },
    { tier_1_option: 'Yonex EXBOLT 65', tier_2_option: null, sku_code: 'PRD-VOT-CAU-LONG-LINING-XZBJ-YONEX-EXBOLT-65', price: 2380000, stock: 10 },
    { tier_1_option: 'Kizuna Z61', tier_2_option: null, sku_code: 'PRD-VOT-CAU-LONG-LINING-XZBJ-KIZUNA-Z61', price: 2360000, stock: 10 },
    { tier_1_option: 'Khung không', tier_2_option: null, sku_code: 'PRD-VOT-CAU-LONG-LINING-XZBJ-KHUNG-KHONG', price: 2200000, stock: 10 }
  ]
};

// Sản phẩm không có tầng nào -- đúng một SKU (id 338, bộ vợt). Trường hợp DUY
// NHẤT được thêm nhanh từ thẻ sản phẩm.
const noTierProduct: Product = {
  id: '338',
  name: 'Bộ vợt cầu lông Victor Auraspeed HS Plus',
  brand: 'Victor',
  category: 'Vợt cầu lông',
  price: 6450000,
  image: 'https://example.com/338.jpg',
  specs: {},
  description: '',
  reviews: [],
  stock: 10,
  colors: ['Tiêu chuẩn'],
  variants: [
    { tier_1_option: null, tier_2_option: null, sku_code: 'PRD-BO-VOT-CAU-LONG-VICTOR-K88J-DEFAULT', price: 6450000, stock: 10 }
  ]
};

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe('resolveSkuCode -- kiểu trả string | null (F1)', () => {
  it('khớp đúng SKU cho MỌI tổ hợp màu x size của id 341 (dữ liệu thật từ prod)', () => {
    for (const variant of twoTierShirt.variants!) {
      const sku = resolveSkuCode(twoTierShirt, variant.tier_1_option!, variant.tier_2_option!);
      expect(sku).toBe(variant.sku_code);
    }
  });

  it('tái hiện đúng bug report: DAZZLING BLUE / S phải ra SKU của chính biến thể S, không phải 2XL', () => {
    expect(resolveSkuCode(twoTierShirt, 'DAZZLING BLUE', 'S')).toBe('PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S');
    expect(resolveSkuCode(twoTierShirt, 'DAZZLING BLUE', 'S')).not.toBe('PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-2XL');
  });

  it('khớp đúng SKU cho MỌI tổ hợp màu x loại cước của id 337 (dữ liệu thật từ prod)', () => {
    for (const variant of twoTierRacket.variants!) {
      const sku = resolveSkuCode(twoTierRacket, variant.tier_1_option!, variant.tier_2_option!);
      expect(sku).toBe(variant.sku_code);
    }
  });

  it('sản phẩm một tầng khớp theo tier1', () => {
    expect(resolveSkuCode(oneTierProduct, 'Yonex BG 65Ti', 'Tiêu chuẩn')).toBe('PRD-VOT-CAU-LONG-LINING-XZBJ-YONEX-BG-65TI');
  });

  it('sản phẩm không có tầng nào trả về SKU của variant duy nhất, bỏ qua tham số', () => {
    expect(resolveSkuCode(noTierProduct, 'bất kỳ', 'bất kỳ')).toBe('PRD-BO-VOT-CAU-LONG-VICTOR-K88J-DEFAULT');
  });

  it('không khớp -> null (dùng toBeNull(), không phải chuỗi rỗng/undefined)', () => {
    const noMatch: Product = { ...twoTierShirt, variants: [] };
    expect(resolveSkuCode(noMatch, 'DAZZLING BLUE', 'S')).toBeNull();
    expect(resolveSkuCode(twoTierShirt, '', 'S')).toBeNull();
  });

  it('buildConfiguredCartItem trả đúng skuCode cho từng tổ hợp đã chọn ở trang chi tiết, null khi không khớp', () => {
    const item = buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5);
    expect(item).not.toBeNull();
    expect(item!.skuCode).toBe('PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S');

    const item2 = buildConfiguredCartItem(twoTierShirt, '2XL', 'WHITE', null, 10.5);
    expect(item2!.skuCode).toBe('PRD-AO-YONEX-COLLECTION-8T3G-WHITE-2XL');

    expect(buildConfiguredCartItem(twoTierShirt, '', 'DAZZLING BLUE', null, 10.5)).toBeNull();
  });
});

describe('describeSkuSelection -- lý do chặn tách riêng (F1): thiếu lựa chọn / không có sẵn', () => {
  it('thiếu tier1 -> báo đúng tên tầng còn thiếu, không đoán', () => {
    const result = describeSkuSelection(twoTierShirt, '', 'S');
    expect(result).toEqual({ status: 'missing_selection', tierName: 'Màu Sắc' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('thiếu tier2 -> báo đúng tên tầng còn thiếu (Size), không đoán', () => {
    expect(describeSkuSelection(twoTierShirt, 'DAZZLING BLUE', '')).toEqual({ status: 'missing_selection', tierName: 'Size' });
  });

  it('sản phẩm một tầng thiếu lựa chọn -> báo đúng tên tầng "Dây vợt"', () => {
    expect(describeSkuSelection(oneTierProduct, '', '')).toEqual({ status: 'missing_selection', tierName: 'Dây vợt' });
  });
});

describe('describeSkuSelection -- tổ hợp không tồn tại hoặc nhiều ứng viên (KHÔNG bịa SKU, KHÔNG thêm giỏ)', () => {
  // Grid thưa: cố ý dựng để có tổ hợp màu x size không có trong catalog thật,
  // vì dữ liệu prod thật hiện tại (26/26 sản phẩm hai tầng) đều là grid đặc.
  const sparseProduct: Product = {
    id: '999',
    name: 'Sản phẩm test grid thưa',
    brand: 'Other',
    category: 'Test',
    price: 100000,
    image: 'https://example.com/999.jpg',
    specs: {},
    description: '',
    reviews: [],
    stock: 5,
    colors: ['Đỏ', 'Xanh'],
    tier_variations: [
      { tier_index: 1, name: 'Màu sắc', options: ['Đỏ', 'Xanh'] },
      { tier_index: 2, name: 'Size', options: ['S', 'L'] }
    ],
    variants: [
      { tier_1_option: 'Đỏ', tier_2_option: 'S', sku_code: 'SP-999-DO-S', price: 100000, stock: 5 }
      // Cố ý KHÔNG có Đỏ/L, Xanh/S, Xanh/L -- những tổ hợp này không bán.
    ]
  };

  // Dữ liệu nguồn lỗi: hai biến thể trùng tier_1_option của một sản phẩm MỘT
  // tầng (không nên xảy ra, nhưng nếu xảy ra thì không được đoán đại một cái).
  const duplicateTierProduct: Product = {
    id: '998',
    name: 'Sản phẩm test trùng tier_1_option',
    brand: 'Other',
    category: 'Test',
    price: 50000,
    image: 'https://example.com/998.jpg',
    specs: {},
    description: '',
    reviews: [],
    stock: 5,
    colors: ['Đỏ'],
    tier_variations: [{ tier_index: 1, name: 'Màu sắc', options: ['Đỏ'] }],
    variants: [
      { tier_1_option: 'Đỏ', tier_2_option: null, sku_code: 'SP-998-DO-A', price: 50000, stock: 5 },
      { tier_1_option: 'Đỏ', tier_2_option: null, sku_code: 'SP-998-DO-B', price: 50000, stock: 5 }
    ]
  };

  it('not_available khi tổ hợp không có biến thể thật', () => {
    expect(describeSkuSelection(sparseProduct, 'Đỏ', 'L')).toEqual({ status: 'not_available' });
    expect(describeSkuSelection(sparseProduct, 'Xanh', 'S')).toEqual({ status: 'not_available' });
    expect(resolveSkuCode(sparseProduct, 'Đỏ', 'L')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('nhiều ứng viên cùng tier_1_option (một tầng) -> not_available, không đoán đại, có console.error nêu product id', () => {
    expect(describeSkuSelection(duplicateTierProduct, 'Đỏ', 'Tiêu chuẩn')).toEqual({ status: 'not_available' });
    expect(resolveSkuCode(duplicateTierProduct, 'Đỏ', 'Tiêu chuẩn')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('998'));
  });

  it('buildConfiguredCartItem trả null khi tổ hợp không tồn tại', () => {
    expect(buildConfiguredCartItem(sparseProduct, 'L', 'Đỏ', null, 10.5)).toBeNull();
  });

  it('vẫn hoạt động đúng cho tổ hợp CÓ tồn tại trong grid thưa', () => {
    expect(resolveSkuCode(sparseProduct, 'Đỏ', 'S')).toBe('SP-999-DO-S');
    expect(buildConfiguredCartItem(sparseProduct, 'S', 'Đỏ', null, 10.5)!.skuCode).toBe('SP-999-DO-S');
  });
});

describe('F2 -- "SKU bán được" = biến thể có sku_code khác rỗng', () => {
  const productWithEmptySku: Product = {
    id: '997',
    name: 'Sản phẩm test biến thể sku_code rỗng',
    brand: 'Other',
    category: 'Test',
    price: 100000,
    image: 'https://example.com/997.jpg',
    specs: {},
    description: '',
    reviews: [],
    stock: 5,
    variants: [
      { tier_1_option: null, tier_2_option: null, sku_code: 'PRD-A', price: 100000, stock: 5 },
      { tier_1_option: null, tier_2_option: null, sku_code: '', price: 100000, stock: 5 }
    ]
  };

  it('getSingleSellableSku bỏ qua biến thể sku_code rỗng, đếm đúng 1 biến thể bán được -> "PRD-A"', () => {
    expect(getSingleSellableSku(productWithEmptySku)).toBe('PRD-A');
  });

  it('buildDefaultCartItem thêm nhanh được với SKU của biến thể bán được duy nhất', () => {
    const item = buildDefaultCartItem(productWithEmptySku);
    expect(item).not.toBeNull();
    expect(item!.skuCode).toBe('PRD-A');
  });

  it('resolveSkuCode (không tầng) cũng bỏ qua biến thể sku_code rỗng', () => {
    expect(resolveSkuCode(productWithEmptySku, 'bất kỳ', 'bất kỳ')).toBe('PRD-A');
  });
});

describe('getSingleSellableSku / buildDefaultCartItem -- thêm nhanh CHỈ khi đúng MỘT SKU bán được', () => {
  it('sản phẩm không tầng (đúng 1 biến thể) -> có SKU duy nhất, thêm nhanh được', () => {
    expect(getSingleSellableSku(noTierProduct)).toBe('PRD-BO-VOT-CAU-LONG-VICTOR-K88J-DEFAULT');
    const item = buildDefaultCartItem(noTierProduct);
    expect(item).not.toBeNull();
    expect(item!.skuCode).toBe('PRD-BO-VOT-CAU-LONG-VICTOR-K88J-DEFAULT');
  });

  it('sản phẩm một tầng NHIỀU lựa chọn (5 biến thể) -> không có SKU duy nhất, KHÔNG thêm nhanh được', () => {
    expect(getSingleSellableSku(oneTierProduct)).toBeNull();
    expect(buildDefaultCartItem(oneTierProduct)).toBeNull();
  });

  it('sản phẩm hai tầng -> không có SKU duy nhất, KHÔNG thêm nhanh được (không đoán tổ hợp đại diện)', () => {
    expect(getSingleSellableSku(twoTierShirt)).toBeNull();
    expect(buildDefaultCartItem(twoTierShirt)).toBeNull();
    expect(getSingleSellableSku(twoTierRacket)).toBeNull();
    expect(buildDefaultCartItem(twoTierRacket)).toBeNull();
  });
});

describe('buildVariantLabel (F5) -- nhãn dựng từ TÊN TẦNG THẬT, không phải "Phiên bản: {weight} | {color}"', () => {
  it('hai tầng: ghép cả hai tên tầng thật + giá trị đã chọn', () => {
    expect(buildVariantLabel(twoTierShirt, 'DAZZLING BLUE', 'S')).toBe('Màu Sắc: DAZZLING BLUE · Size: S');
  });

  it('một tầng: chỉ ghép tên tầng có thật', () => {
    expect(buildVariantLabel(oneTierProduct, 'Yonex BG 65Ti', 'Tiêu chuẩn')).toBe('Dây vợt: Yonex BG 65Ti');
  });

  it('không có tầng nào -> undefined, không bịa nhãn', () => {
    expect(buildVariantLabel(noTierProduct, 'Tiêu chuẩn', 'Tiêu chuẩn')).toBeUndefined();
  });

  it('buildConfiguredCartItem/buildDefaultCartItem lưu đúng variantLabel vào CartItem', () => {
    const configured = buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5);
    expect(configured!.variantLabel).toBe('Màu Sắc: DAZZLING BLUE · Size: S');

    const quick = buildDefaultCartItem(noTierProduct);
    expect(quick!.variantLabel).toBeUndefined();
  });
});

describe('isCartItemSkuValid (F3) -- món trong giỏ hợp lệ khi skuCode thuộc biến thể bán được của ĐÚNG sản phẩm đó', () => {
  const products = [twoTierShirt, oneTierProduct, noTierProduct];

  it('SKU thật khớp đúng biến thể của sản phẩm -> hợp lệ', () => {
    const item = { ...buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5)!, productId: '341' };
    expect(isCartItemSkuValid(item, products)).toBe(true);
  });

  it('SKU không thuộc bất kỳ biến thể nào của sản phẩm (biến thể đã bị xoá/đổi trên PIM) -> không hợp lệ', () => {
    const item = {
      ...buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5)!,
      productId: '341',
      skuCode: 'PRD-AO-DELETED-VARIANT'
    };
    expect(isCartItemSkuValid(item, products)).toBe(false);
  });

  it('SKU bịa dạng cũ SKU-<id>-... cũng không hợp lệ (không thuộc biến thể nào)', () => {
    const item = {
      ...buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5)!,
      productId: '341',
      skuCode: 'SKU-341-2XL-DAZZLING-BLUE'
    };
    expect(isCartItemSkuValid(item, products)).toBe(false);
  });

  it('sản phẩm của món hàng không còn trong dữ liệu đã tải -> không hợp lệ, không đoán', () => {
    const item = {
      ...buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5)!,
      productId: 'khong-ton-tai'
    };
    expect(isCartItemSkuValid(item, products)).toBe(false);
  });

  it('skuCode rỗng -> không hợp lệ', () => {
    const item = { ...buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5)!, productId: '341', skuCode: '' };
    expect(isCartItemSkuValid(item, products)).toBe(false);
  });
});
