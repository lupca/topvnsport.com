import { Product } from '../types';
import { getPriceDisplay } from './priceDisplay';

export type SortMode = 'in-stock-first' | 'price-asc' | 'price-desc';

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'in-stock-first', label: 'Còn hàng trước' },
  { value: 'price-asc', label: 'Giá thấp → cao' },
  { value: 'price-desc', label: 'Giá cao → thấp' }
];

// còn hàng (0) → chưa rõ tồn (1, STOR-015) → hết hàng (2)
function stockRank(p: Product): number {
  if (p.stock === undefined) return 1;
  return p.stock > 0 ? 0 : 2;
}

// Hàm thuần, không đổi mảng đầu vào; Array.sort ổn định nên giữ thứ tự API trong nhóm.
export function sortProducts(products: Product[], mode: SortMode): Product[] {
  if (mode === 'in-stock-first') return [...products].sort((a, b) => stockRank(a) - stockRank(b));
  const dir = mode === 'price-asc' ? 1 : -1;
  return [...products].sort((a, b) => {
    // Không có giá: luôn cuối ở cả hai chiều, không gán giá 0.
    if (a.price === undefined || b.price === undefined) {
      return (a.price === undefined ? 1 : 0) - (b.price === undefined ? 1 : 0);
    }
    return dir * (getPriceDisplay(a).salePrice - getPriceDisplay(b).salePrice);
  });
}
