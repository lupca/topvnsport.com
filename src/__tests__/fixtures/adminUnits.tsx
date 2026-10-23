import { screen, fireEvent } from '@testing-library/react';

// Body nguyên văn hợp đồng OMS-132 (A) (spec fae8d7ae).
export const PROVINCE_BODY = {
  items: [
    { code: 'ADM1-01', level: 'province', name: 'Hà Nội', parent_code: null },
    { code: 'ADM1-79', level: 'province', name: 'Thành phố Hồ Chí Minh', parent_code: null },
  ],
  next_cursor: null,
};
export const WARD_BODY = {
  items: [
    { code: 'ADM1-01.W49886', level: 'ward', name: 'Phường Ba Đình', parent_code: 'ADM1-01' },
    { code: 'ADM1-01.W49887', level: 'ward', name: 'Phường Hoàn Kiếm', parent_code: 'ADM1-01' },
  ],
  next_cursor: null,
};
export const ERR_422_QUERY = { code: 'INVALID_ADMIN_UNIT_QUERY', message: 'Tham số tra cứu địa giới hành chính không hợp lệ.', field_path: 'cursor', detail: { code: 'INVALID_ADMIN_UNIT_QUERY', message: 'Tham số tra cứu địa giới hành chính không hợp lệ.', field_path: 'cursor' } };
export const ERR_429 = { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.', retry_after_seconds: 12, detail: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.', retry_after_seconds: 12 } };
export const ERR_503 = { code: 'SHIPPING_UNAVAILABLE', message: 'Hệ thống vận chuyển chưa phản hồi. Vui lòng thử lại sau.', detail: { code: 'SHIPPING_UNAVAILABLE', message: 'Hệ thống vận chuyển chưa phản hồi. Vui lòng thử lại sau.' } };
export const ERR_422_SCHEMA = { detail: [{ loc: ['query', 'limit'], msg: 'Giá trị phải nhỏ hơn hoặc bằng 500', type: 'less_than_equal' }] };

// Mock cho sportApi.getAdminUnits (các test mock cả sportApi).
export const getAdminUnitsFromFixture = async (level: string) => (level === 'province' ? PROVINCE_BODY.items : WARD_BODY.items);

// Chọn Hà Nội -> Phường Ba Đình trong bước 2.
export async function pickAdminUnits() {
  fireEvent.focus(await screen.findByRole('combobox', { name: 'Tỉnh/Thành phố' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
  fireEvent.focus(screen.getByRole('combobox', { name: 'Phường/Xã' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Phường Ba Đình' }));
}
export const ADDRESS_SUFFIX = 'Phường Ba Đình, Hà Nội';
export const ERR_401 = { detail: 'Yêu cầu đặt hàng công khai thiếu hoặc sai thông tin xác thực gian hàng. Vui lòng tải lại trang rồi thử lại.' };
export const CURSOR_A = 'QURNMS0wMS5XNDk4ODY=';
