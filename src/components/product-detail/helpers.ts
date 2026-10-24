import { Product, StringOption } from '../../types';

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
// (lỗi WMS, STOR-015); known = tổng tồn đã biết.
export type StockState = { kind: 'none' } | { kind: 'unknown' } | { kind: 'known'; stock: number };

// Tầng có trong tier_variations mà giá trị rỗng = khớp mọi giá trị của tầng;
// tầng không có = bỏ qua. Sản phẩm không có biến thể thì dùng tồn cấp sản phẩm.
export const aggregateStock = (product: Product, tier1: string, tier2: string): StockState => {
  if (!product.variants || product.variants.length === 0) {
    return product.stock === undefined ? { kind: 'unknown' } : { kind: 'known', stock: product.stock };
  }
  const hasTier = (i: number) => !!product.tier_variations?.some((tv) => tv.tier_index === i);
  const matched = product.variants.filter(
    (v) =>
      (!hasTier(1) || !tier1 || v.tier_1_option === tier1) &&
      (!hasTier(2) || !tier2 || v.tier_2_option === tier2)
  );
  if (matched.length === 0) return { kind: 'none' };
  const known = matched.filter((v) => v.stock !== undefined);
  const total = known.reduce((sum, v) => sum + (v.stock as number), 0);
  if (known.some((v) => (v.stock as number) > 0)) return { kind: 'known', stock: total };
  if (known.length < matched.length) return { kind: 'unknown' };
  return { kind: 'known', stock: 0 };
};

// Giá trị chọn sẵn khi mở trang: tầng có đúng 1 lựa chọn -> nó; tầng cước có
// giá trị không-đan -> giá trị đó (công tắc đan cước TẮT); còn lại để trống.
export const initialTierValue = (product: Product, tierIndex: number): string => {
  const tier = product.tier_variations?.find((tv) => tv.tier_index === tierIndex);
  if (!tier) return '';
  if (tier.options.length === 1) return tier.options[0];
  if (isStringingTier(tier)) return tier.options.find(isNoStringOption) ?? '';
  return '';
};
