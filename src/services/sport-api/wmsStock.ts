import type { Product } from '../../types';
import { sumStock } from '../../utils/stock.js';

// Đọc phản hồi /public/stock ({stock:{sku:qty}} hoặc {items:[{sku_code,...}]}).
export function parseWmsStock(data: any): Record<string, number> {
  const result: Record<string, number> = {};
  if (data && typeof data.stock === 'object' && data.stock !== null) {
    for (const [sku, qty] of Object.entries(data.stock)) {
      result[sku] = Number(qty) || 0;
    }
  } else if (data && Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item && item.sku_code) {
        result[item.sku_code] = Number(item.qty_available ?? item.qty_on_hand ?? 0);
      }
    }
  }
  return result;
}

// stockMap = TOÀN BỘ tồn WMS nên SKU vắng = WMS không có dòng tồn = 0.
// stockMap null = tồn không tải được -> stock undefined (không biết), không giữ
// variant.stock của PIM (PIM không có trường tồn).
export function applyWmsStock(products: Product[], stockMap: Record<string, number> | null): Product[] {
  const read = (sku: string) => (stockMap ? stockMap[sku] ?? 0 : undefined);

  return products.map((product) => {
    const updatedVariants = product.variants?.map((variant) => {
      const variantStock = variant.sku_code ? read(variant.sku_code) : stockMap ? 0 : undefined;
      return {
        ...variant,
        stock: variantStock
      };
    });

    let finalProductStock: number | undefined = stockMap ? product.stock : undefined;
    if (updatedVariants && updatedVariants.length > 0) {
      finalProductStock = stockMap ? sumStock(updatedVariants.map((v) => v.stock)) : undefined;
    } else if (product.defaultSku) {
      finalProductStock = read(product.defaultSku);
    }

    return {
      ...product,
      stock: finalProductStock,
      variants: updatedVariants || product.variants
    };
  });
}
