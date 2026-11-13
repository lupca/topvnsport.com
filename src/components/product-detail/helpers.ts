import type { Product, StringOption } from '../../types';
import { dedupeByStockCode, sumStock } from '../../utils/stock.js';

export const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export function getPdpPrice(product: Product, tier1: string, tier2: string) {
  const matchedVariant = product.variants?.find((v) => {
    const t1Match = !product.tier_variations?.some(tv => tv.tier_index === 1) || v.tier_1_option === tier1;
    const t2Match = !product.tier_variations?.some(tv => tv.tier_index === 2) || v.tier_2_option === tier2;
    return t1Match && t2Match;
  });

  // Giá thật quyết định theo biến thể đang chọn (giá 0 = chưa có giá); chưa chọn
  // được biến thể thì theo giá thật của sản phẩm.
  const hasPrice = matchedVariant ? matchedVariant.price > 0 : product.price !== undefined;
  const baseOriginalPrice = product.originalPrice ?? product.price ?? 0;
  const baseSalePrice = product.computedPrice ?? product.salePrice ?? product.price ?? 0;

  const originalPriceToUse = matchedVariant?.originalPrice ?? matchedVariant?.price ?? baseOriginalPrice;
  const salePriceToUse = matchedVariant?.computedPrice ?? matchedVariant?.price ?? baseSalePrice;

  const displayBasePrice = salePriceToUse;
  const displayOriginalPrice = originalPriceToUse;

  // STOR-111: chỉ gạch giá khi giá đang chọn thật sự thấp hơn giá gốc. Cờ KM của sản phẩm
  // bật khi BẤT KỲ biến thể nào KM (STOR-109), không nói gì về biến thể đang chọn.
  const hasDiscount = displayBasePrice < displayOriginalPrice;

  const discountPercent = matchedVariant?.percentageDiscount ?? product.percentageDiscount ?? 
    (hasDiscount && displayOriginalPrice > 0 ? Math.round(((displayOriginalPrice - displayBasePrice) / displayOriginalPrice) * 100) : 0);

  return {
    matchedVariant,
    hasPrice,
    salePrice: displayBasePrice,
    originalPrice: displayOriginalPrice,
    hasDiscount,
    discountPercent,
  };
}

export const isNoStringOption = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('khung') ||
    normalized.includes('khong') ||
    normalized.includes('không') ||
    normalized.includes('no string') ||
    normalized.includes('khong dan') ||
    normalized.includes('không đan')
  );
};

export const getTensionTooltip = (kg: number): string => {
  if (kg < 10) {
    return 'Mức căng nhẹ (9 - 9.5 kg): Phù hợp tuyệt đối với người mới tập, trẻ em, phụ nữ lực tay nhẹ, ưu tiên trợ lực tối đa.';
  }

  if (kg <= 11) {
    return 'Mức căng trung bình (10 - 11 kg): Khuyên dùng cho người chơi phong trào lâu năm, kỹ thuật khá, cân bằng trợ lực và kiểm soát.';
  }

  return 'Mức căng cao chuyên nghiệp (11.5 - 13 kg+): Dành riêng cho tay vợt bán chuyên/chuyên nghiệp, lực cổ tay cực khỏe, kiểm soát cầu chính xác 100% nhưng hoàn toàn không trợ lực.';
};

export const inferStringMeta = (
  optionName: string,
  stringOptions: StringOption[]
): { type?: StringOption['type']; thickness?: string } => {
  const option = stringOptions.find(
    (item) =>
      item.name.toLowerCase().includes(optionName.toLowerCase()) ||
      optionName.toLowerCase().includes(item.name.toLowerCase())
  );

  // Không khớp được với sản phẩm cước thật nào trong catalog -> không bịa
  // loại/độ dày, để UI tự ẩn dòng này và chỉ hiện tên lựa chọn.
  return {
    type: option?.type,
    thickness: option?.thickness
  };
};

// Tầng cước của vợt = tầng có lựa chọn 'khung không dây'. Không so tên tầng:
// người bán đặt tên tùy ý. Tầng chọn màu cước của
// cuộn cước không có lựa chọn này nên không khớp. PIM chưa có trường chính thức.
export const isStringingTier = (tier: { options: string[] }): boolean =>
  tier.options.some(isNoStringOption);

// Ghép "Loại • Ø Độ dày" chỉ từ các phần THẬT có dữ liệu; trả rỗng khi không
// có phần nào (UI tự ẩn cả dòng khi rỗng).
export const formatStringMeta = (meta: { type?: string; thickness?: string }): string =>
  [meta.type, meta.thickness ? `Ø ${meta.thickness}` : null].filter(Boolean).join(' • ');

// Tồn của một tổ hợp (STOR-027), ba trạng thái tách bạch:
// none = không biến thể nào khớp; unknown = có biến thể nhưng tồn không rõ
// (lỗi WMS, STOR-015); known = tổng tồn đã biết. Biến thể cùng stock_code
// đếm MỘT lần (AC8, design 5.6 / R4).
export type StockState = { kind: 'none' } | { kind: 'unknown' } | { kind: 'known'; stock: number };

// Tầng có trong tier_variations mà giá trị rỗng = khớp mọi giá trị của tầng;
// tầng không có = bỏ qua. Sản phẩm không có biến thể thì dùng tồn cấp sản phẩm.
export const aggregateStock = (product: Product, tier1: string, tier2: string): StockState => {
  if (!product.variants || product.variants.length === 0) {
    return product.stock === undefined ? { kind: 'unknown' } : { kind: 'known', stock: product.stock };
  }
  const hasTier = (i: number) => !!product.tier_variations?.some((tv) => tv.tier_index === i);
  const matched = dedupeByStockCode(product.variants.filter(
    (v) =>
      (!hasTier(1) || !tier1 || v.tier_1_option === tier1) &&
      (!hasTier(2) || !tier2 || v.tier_2_option === tier2)
  ));
  if (matched.length === 0) return { kind: 'none' };
  const known = matched.filter((v) => v.stock !== undefined);
  const total = sumStock(known.map((v) => v.stock));
  if (known.some((v) => (v.stock as number) > 0)) return { kind: 'known', stock: total };
  if (known.length < matched.length) return { kind: 'unknown' };
  return { kind: 'known', stock: 0 };
};

// Giá trị chọn sẵn khi mở trang: biến thể chọn sẵn của listing webstore (PIM
// default_variant_id) -> lựa chọn của nó; tầng có đúng 1 lựa chọn -> nó; tầng cước có
// giá trị không-đan -> giá trị đó (công tắc đan cước TẮT); còn lại để trống.
export const initialTierValue = (product: Product, tierIndex: number): string => {
  const tier = product.tier_variations?.find((tv) => tv.tier_index === tierIndex);
  if (!tier) return '';
  const preset = product.variants?.find((v) => v.id !== undefined && v.id === product.defaultVariantId);
  const presetOption = tierIndex === 1 ? preset?.tier_1_option : preset?.tier_2_option;
  if (presetOption && tier.options.includes(presetOption)) return presetOption;
  if (tier.options.length === 1) return tier.options[0];
  if (isStringingTier(tier)) return tier.options.find(isNoStringOption) ?? '';
  return '';
};
