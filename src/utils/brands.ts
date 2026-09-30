import { Product } from '../types';

// Thương hiệu dựng từ dữ liệu đã tải: nguyên chuỗi người bán nhập, không gộp,
// không danh sách cứng. Sản phẩm không có thương hiệu thì không tạo mục.
export function getBrands(products: Product[]): string[] {
  const brands = new Set<string>();
  for (const product of products) {
    const brand = product.brand?.trim();
    if (brand) brands.add(brand);
  }
  return [...brands].sort((a, b) => a.localeCompare(b));
}
