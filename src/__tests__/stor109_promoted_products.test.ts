// STOR-109: SP có KM ở BẤT KỲ biến thể nào là "đang KM"; thẻ hiện cặp giá của biến thể giảm % nhiều nhất;
// getPromotedInStock cho khu Sale (STOR-110). Gốc lỗi trên prod: kệ nổi bật chỉ lấy 8 SP còn hàng đầu
// (id giảm dần) nên SP KM nằm ở vị trí 29 và 60 không bao giờ hiện (xem kết quả task).
import { describe, it, expect } from 'vitest';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { applyWmsStock } from '../services/sport-api/wmsStock';
import { getPromotedInStock } from '../utils/promotions';
import { getPriceDisplay } from '../utils/priceDisplay';
import type { Product } from '../types';

type V = Record<string, unknown>;
const raw = (id: number, variants: V[]) => ({ id, name: `SP ${id}`, voma_category_id: null, variants }) as any;
// Biến thể KM đúng dạng PIM prod: has_active_promotion + computed_price < original_price.
const promo = (id: number, price: number, computed: number, pct: number, sku = `S${id}`): V => ({
  id, sku_code: sku, price, original_price: price, computed_price: computed, percentage_discount: pct, has_active_promotion: true
});
const plain = (id: number, price: number, sku = `S${id}`): V => ({
  id, sku_code: sku, price, original_price: price, computed_price: price, percentage_discount: 0, has_active_promotion: false
});
const pair = (p: Product | null) => [p!.computedPrice, p!.originalPrice, p!.percentageDiscount];

describe('1 mapper: KM ở bất kỳ biến thể nào', () => {
  it('chỉ biến thể KHÔNG rẻ nhất có KM -> SP đang KM, thẻ hiện cặp giá của biến thể đó', () => {
    const p = mapPmiProduct(raw(1, [plain(1, 500000), promo(2, 2000000, 1500000, 25)]), []);
    expect(p!.hasActivePromotion).toBe(true);
    expect(pair(p)).toEqual([1500000, 2000000, 25]);
    expect(getPriceDisplay(p!)).toMatchObject({ hasActivePromotion: true, salePrice: 1500000, originalPrice: 2000000, discountPercent: 25 });
  });

  it('biến thể rẻ nhất giảm 10%, biến thể khác giảm 30% -> cặp giá của biến thể 30%', () => {
    const p = mapPmiProduct(raw(1, [promo(1, 1000000, 900000, 10), promo(2, 2000000, 1400000, 30)]), []);
    expect(pair(p)).toEqual([1400000, 2000000, 30]);
  });

  it('hai biến thể cùng % -> lấy biến thể giá bán thấp hơn (dù đứng sau)', () => {
    const p = mapPmiProduct(raw(1, [promo(1, 2000000, 1600000, 20), promo(2, 1000000, 800000, 20)]), []);
    expect(pair(p)).toEqual([800000, 1000000, 20]);
  });

  it('không biến thể nào KM -> cờ false, giá thẻ là biến thể rẻ nhất', () => {
    const p = mapPmiProduct(raw(1, [plain(1, 900000), plain(2, 700000)]), []);
    expect(p!.hasActivePromotion).toBe(false);
    expect(p!.computedPrice).toBeUndefined();
    expect(p!.percentageDiscount).toBeUndefined();
    expect(p!.salePrice).toBe(700000);
    expect(p!.price).toBe(700000);
  });

  // Cửa sổ KM tính ở PIM: KM đã hết hạn / chưa bắt đầu về ngoài là has_active_promotion=false, computed=original.
  it.each(['đã hết hạn', 'chưa bắt đầu'])('KM %s (PIM trả has_active_promotion=false) -> không tính là KM', () => {
    const p = mapPmiProduct(raw(1, [plain(1, 900000), plain(2, 1000000)]), []);
    expect(p!.hasActivePromotion).toBe(false);
    expect(getPriceDisplay(p!).hasActivePromotion).toBe(false);
  });

  it('một biến thể KM hết hạn + một biến thể KM đang chạy -> chỉ lấy biến thể đang chạy', () => {
    const p = mapPmiProduct(raw(1, [plain(1, 900000), promo(2, 1000000, 850000, 15)]), []);
    expect(p!.hasActivePromotion).toBe(true);
    expect(pair(p)).toEqual([850000, 1000000, 15]);
  });

  it('biến thể prod của SP 590 (nguyên văn) -> [2849000, 3538800, 19.49]', () => {
    const rows: [number, number, number][] = [
      [6442, 3009000, 14.97], [6443, 3039000, 14.12], [6444, 2849000, 19.49], [6437, 2909000, 17.8],
      [6438, 3009000, 14.97], [6439, 3039000, 14.12], [6440, 3039000, 14.12], [6441, 3039000, 14.12]
    ];
    const p = mapPmiProduct(raw(590, rows.map(([id, c, pct]) => promo(id, 3538800, c, pct))), []);
    expect(p!.hasActivePromotion).toBe(true);
    expect(pair(p)).toEqual([2849000, 3538800, 19.49]);
  });
});

describe('2 getPromotedInStock', () => {
  // 71 SP còn hàng như prod; KM ở vị trí 29 và 60 (0-based) -> ngoài 8 thẻ đầu của kệ.
  const build = () => {
    const raws: any[] = [];
    for (let i = 0; i < 71; i += 1) {
      const id = 1000 + i;
      raws.push(raw(id, i === 29 ? [promo(id, 3382800, 2959000, 12.53)] : i === 60 ? [promo(id, 3538800, 2849000, 19.49)] : [plain(id, 500000)]));
    }
    raws.push(raw(2000, [promo(2000, 1000000, 500000, 50)])); // KM nhưng hết hàng (WMS 0)
    raws.push(raw(2001, [promo(2001, 1000000, 600000, 40)])); // KM, tồn chưa rõ (undefined)
    raws.push(raw(2002, [plain(2002, 400000)])); // hết hàng, không KM
    const stockMap: Record<string, number> = {};
    for (const r of raws) stockMap[r.variants[0].sku_code] = r.id === 2000 || r.id === 2002 ? 0 : 7;
    const merged = applyWmsStock(raws.map((r) => mapPmiProduct(r, []) as Product), stockMap);
    return merged.map((p) => (p.id === '2001' ? { ...p, stock: undefined } : p));
  };

  it('gốc lỗi: 8 thẻ đầu của kệ (còn hàng, thứ tự API) không có SP KM, nhưng selector lấy đủ 2 SP ở vị trí 29 và 60 theo % giảm', () => {
    const products = build();
    const inStock = products.filter((p) => (p.stock ?? 0) > 0);
    expect(inStock).toHaveLength(71);
    expect(inStock.slice(0, 8).some((p) => p.hasActivePromotion)).toBe(false);
    expect(inStock.findIndex((p) => p.id === '1029')).toBe(29);
    expect(inStock.findIndex((p) => p.id === '1060')).toBe(60);
    // 1029 giảm 12.53% đứng TRƯỚC 1060 giảm 19.49% trong danh sách -> sort giảm dần phải đảo lại.
    expect(getPromotedInStock(products).map((p) => p.id)).toEqual(['1060', '1029']);
  });

  it('chỉ giữ stock > 0: stock 0 và stock undefined bị loại', () => {
    const ids = getPromotedInStock(build()).map((p) => p.id);
    expect(ids).not.toContain('2000');
    expect(ids).not.toContain('2001');
  });

  it('stock đúng 1 vẫn giữ (ranh giới)', () => {
    const p = { ...(mapPmiProduct(raw(5, [promo(5, 1000000, 900000, 10)]), []) as Product), stock: 1 };
    expect(getPromotedInStock([p]).map((x) => x.id)).toEqual(['5']);
  });

  it('SP không KM không vào danh sách', () => {
    const p = { ...(mapPmiProduct(raw(5, [plain(5, 1000000)]), []) as Product), stock: 9 };
    expect(getPromotedInStock([p])).toEqual([]);
  });

  it('sắp xếp theo discountPercent giảm dần, hòa giữ thứ tự API', () => {
    const mk = (id: number, pct: number) => ({ ...(mapPmiProduct(raw(id, [promo(id, 1000000, 1000000 - pct * 10000, pct)]), []) as Product), stock: 3 });
    const out = getPromotedInStock([mk(1, 10), mk(2, 30), mk(3, 20), mk(4, 30)]);
    expect(out.map((p) => p.id)).toEqual(['2', '4', '3', '1']);
  });

  it('không giới hạn số lượng (không bị cắt ở 8 thẻ)', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...(mapPmiProduct(raw(i + 1, [promo(i + 1, 1000000, 900000, 10)]), []) as Product), stock: 2 }));
    expect(getPromotedInStock(many)).toHaveLength(12);
  });

  it('không đổi mảng đầu vào', () => {
    const products = build();
    const before = products.map((p) => p.id);
    getPromotedInStock(products);
    expect(products.map((p) => p.id)).toEqual(before);
  });
});
