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
// xếp theo số sản phẩm giảm dần và CHỈ gồm ngành đang có sản phẩm trong danh
// sách đã tải (đếm > 0) -- lọc chung một chỗ để mọi nơi hiển thị (Header,
// Footer, HomePage, sidebar CatalogPage) đều nhất quán, tránh hiện ngành rỗng.
export function getCategoriesSortedByCount(categories: Category[], products: Product[]): Category[] {
  const counts = getProductCategoryCounts(products);
  return categories
    .filter(category => (counts[category.code] || 0) > 0)
    .sort((a, b) => (counts[b.code] || 0) - (counts[a.code] || 0));
}

function splitDisplayPath(displayName: string): string[] {
  return displayName.split('>').map(segment => segment.trim()).filter(Boolean);
}

// Nhãn = tên ngành cuối path (leaf), thêm dần từng đoạn tổ tiên (nối bằng
// " – ", từ gần tới xa) từ display_name cho tới khi nhãn không còn trùng với
// bất kỳ ngành nào khác trong danh sách. Cần thiết vì cây VOMA có nhiều cặp
// lá trùng cả tên lẫn tên cha trực tiếp (vd "Áo – Áo thun" ở cả Thời Trang
// Nam và Thời Trang Nữ) -- một cấp cha là chưa đủ để phân biệt.
function labelAtDepth(segments: string[], depth: number): string {
  const leaf = segments[segments.length - 1];
  const ancestorsNeeded = Math.min(depth, segments.length - 1);
  const ancestors = segments.slice(segments.length - 1 - ancestorsNeeded, segments.length - 1);
  return ancestors.length > 0 ? `${ancestors.join(' – ')} – ${leaf}` : leaf;
}

export function getCategoryLabel(category: Category, allCategories: Category[]): string {
  const mySegments = splitDisplayPath(category.display_name);
  const maxDepth = mySegments.length - 1;

  for (let depth = 0; depth <= maxDepth; depth++) {
    const candidate = labelAtDepth(mySegments, depth);
    const collides = allCategories.some(other => {
      if (other.id === category.id) return false;
      return labelAtDepth(splitDisplayPath(other.display_name), depth) === candidate;
    });
    if (!collides) return candidate;
  }

  // Hết đoạn tổ tiên mà vẫn trùng (hai ngành có display_name giống hệt nhau) --
  // trường hợp cực hiếm, dùng cả đường dẫn đầy đủ.
  return mySegments.join(' – ');
}
