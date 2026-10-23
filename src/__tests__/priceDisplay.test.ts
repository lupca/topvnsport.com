import { describe, it, expect } from 'vitest';
import { getPriceDisplay } from '../utils/priceDisplay';
import { Product } from '../types';

const base = { id: 'p', name: 'p', image: '', specs: {}, description: '', stock: 1 } as unknown as Product;

describe('getPriceDisplay', () => {
  it('P1: salePrice bằng price, không KM -> không có khuyến mãi', () => {
    const r = getPriceDisplay({ ...base, price: 145000, salePrice: 145000 });
    expect(r.hasActivePromotion).toBe(false);
    expect(r.salePrice).toBe(145000);
  });
  it('P2: computedPrice < originalPrice (hasActivePromotion không đặt) -> có khuyến mãi', () => {
    const r = getPriceDisplay({ ...base, price: 200000, originalPrice: 200000, computedPrice: 150000 });
    expect(r.hasActivePromotion).toBe(true);
    expect(r.salePrice).toBe(150000);
    expect(r.originalPrice).toBe(200000);
  });
  it('không giá -> không KM', () => {
    expect(getPriceDisplay({ ...base }).hasActivePromotion).toBe(false);
  });
});
