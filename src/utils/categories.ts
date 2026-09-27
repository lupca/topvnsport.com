import { Category, Product } from '../types';

// Đếm số sản phẩm đang bán theo MÃ ngành VOMA (categoryCode). Sản phẩm chưa
// gắn ngành (categoryCode rỗng) không tính vào bất kỳ ngành nào.
export function getProductCategoryCounts(products: Product[]): Record<string, number> {
  return products.reduce<Record<string, number>>((counts, product) => {
    if (!product.categoryCode) return counts;
    counts[product.categoryCode] = (counts[product.categoryCode] || 0) + 1;
    return counts;
  }, {});
}

// Danh sách ngành để hiển thị (thanh danh mục, ô trang chủ, sidebar catalog...),
// xếp theo số sản phẩm giảm dần. API /public/voma-categories đã chỉ trả về
// đúng những ngành có sản phẩm đang bán, nên ở đây chỉ cần sắp xếp lại.
export function getCategoriesSortedByCount(categories: Category[], products: Product[]): Category[] {
  const counts = getProductCategoryCounts(products);
  return [...categories].sort((a, b) => (counts[b.code] || 0) - (counts[a.code] || 0));
}

function splitDisplayPath(displayName: string): string[] {
  return displayName.split('>').map(segment => segment.trim()).filter(Boolean);
}

// Tên ngành (name) có thể trùng giữa hai nhánh khác nhau của cây VOMA (ví dụ
// hai ngành "Khác" nằm dưới hai ngành cha khác nhau). Khi trùng, ghép thêm
// đoạn cha ngay trước nó trong display_name để phân biệt trên màn hình.
export function getCategoryLabel(category: Category, allCategories: Category[]): string {
  const hasDuplicateName = allCategories.some(
    other => other.id !== category.id && other.name === category.name
  );
  if (!hasDuplicateName) return category.name;

  const segments = splitDisplayPath(category.display_name);
  const parentSegment = segments.length >= 2 ? segments[segments.length - 2] : '';
  return parentSegment ? `${parentSegment} – ${category.name}` : category.name;
}
