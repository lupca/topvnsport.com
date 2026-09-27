import { StringOption } from '../../types';

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

// So khớp tên tier "Loại cước" không phân biệt hoa/thường -- prod có cả
// 'Loại cước' lẫn 'Loại Cước'.
export const isStringingTierName = (name: string | undefined | null): boolean =>
  (name || '').trim().toLowerCase() === 'loại cước';

// Ghép "Loại • Ø Độ dày" chỉ từ các phần THẬT có dữ liệu; trả rỗng khi không
// có phần nào (UI tự ẩn cả dòng khi rỗng).
export const formatStringMeta = (meta: { type?: string; thickness?: string }): string =>
  [meta.type, meta.thickness ? `Ø ${meta.thickness}` : null].filter(Boolean).join(' • ');
