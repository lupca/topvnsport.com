import { Product, ProductVariant } from '../types';

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

// Giá thật của MỘT biến thể -- cùng luật với trang chi tiết (computedPrice ??
// price). price không phải số > 0 -> null (chưa có giá, không bịa, không lấy
// giá cấp sản phẩm thay).
export function variantUnitPrice(variant: ProductVariant): number | null {
  if (!(variant.price > 0)) return null;
  const unit = variant.computedPrice ?? variant.price;
  // computed_price = 0 (hoặc không phải số) không phải giá thật -- không bán 0đ.
  return unit > 0 ? unit : null;
}

// STOR-111: giá mua được rẻ nhất (lọc giá, sắp theo giá). salePrice của thẻ là giá biến thể
// giảm % nhiều nhất (STOR-109), có thể đắt hơn biến thể rẻ nhất. Gọi khi product.price có.
export function getCheapestPrice(product: Product): number {
  const variantPrices = (product.variants ?? []).map(variantUnitPrice).filter((n): n is number => n !== null);
  return Math.min(getPriceDisplay(product).salePrice as number, ...variantPrices);
}
