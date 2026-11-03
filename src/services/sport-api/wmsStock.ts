import type { Product } from '../../types';
import { dedupeByStockCode, sumStock } from '../../utils/stock.js';

// stock_code đi kèm stockMap mà không đổi kiểu {sku: qty} (mọi caller/test giữ nguyên).
// ponytail: side-channel WeakMap; đổi sang kiểu {qty, codes} nếu cần thêm trường WMS khác.
const STOCK_CODES = new WeakMap<object, Record<string, string>>();
export const stockCodesOf = (stockMap: Record<string, number> | null): Record<string, string> =>
  (stockMap && STOCK_CODES.get(stockMap)) || {};
export const tagStockCodes = (stockMap: Record<string, number>, codes: Record<string, string>) => {
  STOCK_CODES.set(stockMap, codes);
  return stockMap;
};

// Đọc phản hồi /public/stock ({stock:{sku:qty}} hoặc {items:[{sku_code,...}]}).
// stock_code CHỈ đọc từ items[].stock_code, kể cả khi có `stock` (AC8, wire VOMA-399).
export function parseWmsStock(data: any): Record<string, number> {
  const result: Record<string, number> = {};
  const codes: Record<string, string> = {};
  const items: any[] = data && Array.isArray(data.items) ? data.items : [];
  if (data && typeof data.stock === 'object' && data.stock !== null) {
    for (const [sku, qty] of Object.entries(data.stock)) {
      result[sku] = Number(qty) || 0;
    }
  } else {
    for (const item of items) {
      if (item && item.sku_code) {
        result[item.sku_code] = Number(item.qty_available ?? item.qty_on_hand ?? 0);
      }
    }
  }
  for (const item of items) {
    if (item && item.sku_code && item.stock_code) codes[item.sku_code] = String(item.stock_code);
  }
  return tagStockCodes(result, codes);
}

// stockMap = TOÀN BỘ tồn WMS nên SKU vắng = WMS không có dòng tồn = 0.
// stockMap null = tồn không tải được -> stock undefined (không biết), không giữ
// variant.stock của PIM (PIM không có trường tồn).
// Biến thể cùng stock_code mỗi cái hiện tồn của dòng chung; tổng sản phẩm đếm dòng đó MỘT lần.
export function applyWmsStock(products: Product[], stockMap: Record<string, number> | null): Product[] {
  const read = (sku: string) => (stockMap ? stockMap[sku] ?? 0 : undefined);
  const codes = stockCodesOf(stockMap);

  return products.map((product) => {
    const updatedVariants = product.variants?.map((variant) => {
      const variantStock = variant.sku_code ? read(variant.sku_code) : stockMap ? 0 : undefined;
      const stockCode = variant.sku_code ? codes[variant.sku_code] : undefined;
      return {
        ...variant,
        ...(stockCode ? { stock_code: stockCode } : {}),
        stock: variantStock
      };
    });

    let finalProductStock: number | undefined = stockMap ? product.stock : undefined;
    if (updatedVariants && updatedVariants.length > 0) {
      finalProductStock = stockMap ? sumStock(dedupeByStockCode(updatedVariants).map((v) => v.stock)) : undefined;
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
