import { Product } from '../types';
import { isRacketCategoryCode } from '../config/storefront';
import { isStringingTier } from '../components/product-detail/helpers';

export type RacketPlayStyle = 'Tấn Công' | 'Phản Tạt' | 'Toàn Diện';

const ATTACK_LINE = /astrox|axforce|voltric|thruster|ryuga|calibar\s*900|nặng\s*đầu|tấn\s*công|chuyên\s*công|head\s*heavy/i;
const SPEED_LINE = /nanoflare|bladex|auraspeed|windstorm|jetspeed|lightfighter|nhẹ\s*đầu|phản\s*tạt|tốc\s*độ|head\s*light/i;
const ALLROUND_LINE = /arcsaber|halbertec|tectonic|duora|drive\s*x|cân\s*bằng|công\s*thủ\s*toàn\s*diện|toàn\s*diện|even\s*balance/i;

// Suy luận lối đánh vợt theo 3 tầng, ưu tiên tín hiệu có cấu trúc nhất:
// (1) characteristics / specs.balance từ PIM, (2) dòng vợt & từ khóa trong tên +
// mô tả, (3) không còn tín hiệu nào thì trả undefined -- không bịa giá trị mặc
// định cho sản phẩm không có dữ liệu (STOR-008 / 37f60f5b / db4c9460).
export function inferRacketPlayStyle(product: Product): RacketPlayStyle | undefined {
  if (!isRacketCategoryCode(product.categoryCode)) return undefined;

  if (product.characteristics === 'Tấn Công') return 'Tấn Công';
  if (product.characteristics === 'Phòng Thủ') return 'Phản Tạt';
  if (product.characteristics === 'Toàn Diện') return 'Toàn Diện';

  const balance = product.specs?.balance;
  if (typeof balance === 'number') {
    if (balance >= 300) return 'Tấn Công';
    if (balance <= 292) return 'Phản Tạt';
    return 'Toàn Diện';
  }

  const haystack = `${product.name ?? ''} ${product.description ?? ''}`;
  if (ATTACK_LINE.test(haystack)) return 'Tấn Công';
  if (SPEED_LINE.test(haystack)) return 'Phản Tạt';
  if (ALLROUND_LINE.test(haystack)) return 'Toàn Diện';

  return undefined;
}

export function hasO2OStringing(product: Product): boolean {
  return (
    Array.isArray(product.tier_variations) &&
    product.tier_variations.some((tier) => Array.isArray(tier.options) && isStringingTier(tier))
  );
}

export function getPrimaryTierPreview(product: Product, maxOptions = 4): string[] {
  const tier = (product.tier_variations ?? []).find(
    (t) => Array.isArray(t.options) && !isStringingTier(t)
  );
  if (!tier) return [];
  return tier.options
    .map((option) => option.trim())
    .filter((option) => option !== '')
    .slice(0, maxOptions);
}
