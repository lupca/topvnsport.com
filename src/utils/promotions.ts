import { Product } from '../types';
import { getPriceDisplay } from './priceDisplay';

// STOR-109: mọi SP đang KM VÀ còn hàng (stock > 0; undefined = chưa rõ tồn -> không tính),
// giảm % nhiều nhất trước. Không giới hạn số lượng. Sort ổn định giữ thứ tự API khi hòa.
export function getPromotedInStock(products: Product[]): Product[] {
  return products
    .filter((p) => (p.stock ?? 0) > 0 && getPriceDisplay(p).hasActivePromotion)
    .sort((a, b) => getPriceDisplay(b).discountPercent - getPriceDisplay(a).discountPercent);
}
