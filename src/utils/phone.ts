// Luật SĐT của OMS -- MỘT nguồn duy nhất ở storefront.
// Nguồn: voma-oms backend/utils/phone_helper.py:3 (PHONE_REGEX), dùng ở
// backend/schemas/common.py cho customer.phone. Đổi bên OMS thì đổi ở đây.
export const PHONE_REGEX = /^(0|\+84|84)[35789]\d{8}$/;

export const PHONE_ERROR_MESSAGE =
  'Số điện thoại chưa đúng. Vui lòng nhập số di động Việt Nam, ví dụ 0912345678.';

/** Bỏ khoảng trắng, dấu chấm, dấu gạch ngang; không sửa gì khác. */
export const normalizePhone = (raw: string): string => raw.replace(/[\s.-]/g, '');

export const isValidPhone = (raw: string): boolean => PHONE_REGEX.test(normalizePhone(raw));

/** Đã gõ đủ độ dài (10 ký tự nếu mở đầu 0, 11 nếu 84, 12 nếu +84). */
export const isPhoneComplete = (raw: string): boolean => {
  const p = normalizePhone(raw);
  const need = p.startsWith('+84') ? 12 : p.startsWith('84') ? 11 : p.startsWith('0') ? 10 : Infinity;
  return p.length >= need;
};
