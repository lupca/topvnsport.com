import { Product } from '../types';

// MỘT quy tắc giá/khuyến mãi dùng chung (ProductCard, gợi ý tìm kiếm Header, STOR-024 QuickView).
export function getPriceDisplay(product: Product) {
  const hasPrice = product.price !== undefined;
  const hasActivePromotion = hasPrice && Boolean(
    product.hasActivePromotion ||
    (product.computedPrice !== undefined && product.originalPrice !== undefined && product.computedPrice < product.originalPrice) ||
    (product.salePrice !== undefined && product.salePrice < (product.price as number))
  );

  const originalPrice = product.originalPrice ?? product.price;
  const salePrice = product.computedPrice ?? product.salePrice ?? product.price;
  const discountPercent = product.percentageDiscount ?? (hasActivePromotion && originalPrice > 0 ? Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 0);

  return { hasActivePromotion, salePrice, originalPrice, discountPercent };
}
