import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveSkuCode,
  buildDefaultCartItem,
  buildConfiguredCartItem,
  getSingleSellableSku,
  isFabricatedSkuCode
} from '../features/cart/cartSlice';
import { Product } from '../types';

// Toàn bộ dữ liệu variants dưới đây chụp THẬT từ prod (GET
// https://www.topvnsport.com/api/pmi/public/products?limit=100, 2026-09-28) --
// không bịa. Đây chính là hai ví dụ trong báo cáo lỗi: id 341 (áo, hai tầng
// Màu Sắc x Size) và id 337 (vợt, hai tầng Màu Sắc x Loại Cước).

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

describe('resolveSkuCode -- sản phẩm hai tầng phân loại', () => {
  it('khớp đúng SKU cho MỌI tổ hợp màu x size của id 341 (dữ liệu thật từ prod)', () => {
    for (const variant of twoTierShirt.variants!) {
      const result = resolveSkuCode(twoTierShirt, variant.tier_1_option!, variant.tier_2_option!);
      expect(result).toEqual({ status: 'ok', skuCode: variant.sku_code });
    }
  });

  it('tái hiện đúng bug report: DAZZLING BLUE / S phải ra SKU của chính biến thể S, không phải 2XL', () => {
    const result = resolveSkuCode(twoTierShirt, 'DAZZLING BLUE', 'S');
    expect(result).toEqual({ status: 'ok', skuCode: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S' });
  });

  it('khớp đúng SKU cho MỌI tổ hợp màu x loại cước của id 337 (dữ liệu thật từ prod)', () => {
    for (const variant of twoTierRacket.variants!) {
      const result = resolveSkuCode(twoTierRacket, variant.tier_1_option!, variant.tier_2_option!);
      expect(result).toEqual({ status: 'ok', skuCode: variant.sku_code });
    }
  });

  it('tái hiện đúng bug report: Cannon Deep Teal / BG 65TI phải ra SKU của chính BG 65TI, không phải Khung không dây', () => {
    const result = resolveSkuCode(twoTierRacket, 'Cannon Deep Teal', 'BG 65TI');
    expect(result).toEqual({ status: 'ok', skuCode: 'PRD-HOA-TOC-VOT-CAU-LONG-DVRY-CANNON-DEEP-TEAL-BG-65TI' });
  });

  it('buildConfiguredCartItem trả đúng skuCode cho từng tổ hợp đã chọn ở trang chi tiết', () => {
    const result = buildConfiguredCartItem(twoTierShirt, 'S', 'DAZZLING BLUE', null, 10.5);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.item.skuCode).toBe('PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S');
    }

    const result2 = buildConfiguredCartItem(twoTierShirt, '2XL', 'WHITE', null, 10.5);
    expect(result2.status).toBe('ok');
    if (result2.status === 'ok') {
      expect(result2.item.skuCode).toBe('PRD-AO-YONEX-COLLECTION-8T3G-WHITE-2XL');
    }
  });
});

describe('resolveSkuCode -- sản phẩm một tầng và không tầng', () => {
  it('sản phẩm một tầng khớp theo tier1', () => {
    expect(resolveSkuCode(oneTierProduct, 'Yonex BG 65Ti', 'Tiêu chuẩn')).toEqual({
      status: 'ok',
      skuCode: 'PRD-VOT-CAU-LONG-LINING-XZBJ-YONEX-BG-65TI'
    });
    expect(resolveSkuCode(oneTierProduct, 'Khung không', 'Tiêu chuẩn')).toEqual({
      status: 'ok',
      skuCode: 'PRD-VOT-CAU-LONG-LINING-XZBJ-KHUNG-KHONG'
    });
  });

  it('sản phẩm không có tầng nào trả về SKU của variant duy nhất, bỏ qua tham số', () => {
    expect(resolveSkuCode(noTierProduct, 'bất kỳ', 'bất kỳ')).toEqual({
      status: 'ok',
      skuCode: 'PRD-BO-VOT-CAU-LONG-VICTOR-K88J-DEFAULT'
    });
  });
});

describe('resolveSkuCode -- thiếu lựa chọn (chưa chọn đủ tầng)', () => {
  it('thiếu tier1 -> báo đúng tên tầng còn thiếu, không đoán', () => {
    const result = resolveSkuCode(twoTierShirt, '', 'S');
    expect(result).toEqual({ status: 'missing_selection', tierName: 'Màu Sắc' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('thiếu tier2 -> báo đúng tên tầng còn thiếu (Size), không đoán', () => {
    const result = resolveSkuCode(twoTierShirt, 'DAZZLING BLUE', '');
    expect(result).toEqual({ status: 'missing_selection', tierName: 'Size' });
  });

  it('sản phẩm một tầng thiếu lựa chọn -> báo đúng tên tầng "Dây vợt"', () => {
    expect(resolveSkuCode(oneTierProduct, '', '')).toEqual({
      status: 'missing_selection',
      tierName: 'Dây vợt'
    });
  });
});

describe('resolveSkuCode -- tổ hợp không tồn tại hoặc nhiều ứng viên (KHÔNG bịa SKU, KHÔNG thêm giỏ)', () => {
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

  it('resolveSkuCode trả not_available khi tổ hợp không có biến thể thật', () => {
    expect(resolveSkuCode(sparseProduct, 'Đỏ', 'L')).toEqual({ status: 'not_available' });
    expect(resolveSkuCode(sparseProduct, 'Xanh', 'S')).toEqual({ status: 'not_available' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('nhiều ứng viên cùng tier_1_option (một tầng) -> not_available, không đoán đại, có console.error nêu product id', () => {
    const result = resolveSkuCode(duplicateTierProduct, 'Đỏ', 'Tiêu chuẩn');
    expect(result).toEqual({ status: 'not_available' });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('998'));
  });

  it('buildConfiguredCartItem trả not_available khi tổ hợp không tồn tại', () => {
    expect(buildConfiguredCartItem(sparseProduct, 'L', 'Đỏ', null, 10.5)).toEqual({ status: 'not_available' });
  });

  it('resolveSkuCode/buildConfiguredCartItem vẫn hoạt động đúng cho tổ hợp CÓ tồn tại trong grid thưa', () => {
    expect(resolveSkuCode(sparseProduct, 'Đỏ', 'S')).toEqual({ status: 'ok', skuCode: 'SP-999-DO-S' });
    const result = buildConfiguredCartItem(sparseProduct, 'S', 'Đỏ', null, 10.5);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.item.skuCode).toBe('SP-999-DO-S');
    }
  });
});

describe('getSingleSellableSku / buildDefaultCartItem -- thêm nhanh CHỈ khi đúng MỘT SKU', () => {
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

describe('isFabricatedSkuCode -- nhận diện SKU bịa của giỏ hàng cũ trong localStorage', () => {
  it('nhận diện đúng dạng SKU bịa cũ `SKU-<id>-...`', () => {
    expect(isFabricatedSkuCode('SKU-341-2XL-DAZZLING-BLUE')).toBe(true);
    expect(isFabricatedSkuCode('SKU-338-Tiêu chuẩn-Tiêu chuẩn')).toBe(true);
  });

  it('không đánh dấu nhầm SKU thật hoặc giá trị rỗng', () => {
    expect(isFabricatedSkuCode('PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S')).toBe(false);
    expect(isFabricatedSkuCode('SP-999-DO-S')).toBe(false);
    expect(isFabricatedSkuCode(undefined)).toBe(false);
    expect(isFabricatedSkuCode('')).toBe(false);
  });
});
