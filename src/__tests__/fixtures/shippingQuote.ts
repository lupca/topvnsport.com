// Body nguyên văn hợp đồng OMS-132 (B) POST /public/shipping-quote (spec fae8d7ae, r:f04e3ee5).
export const QUOTE_REQUEST = {
  items: [{ sku_code: 'TVS-AO-01-M', quantity: 2 }],
  receiver_province_code: 'ADM1-01',
  receiver_ward_code: 'ADM1-01.W49886',
  delivery_option: null,
};

export const QUOTE_200 = {
  currency: 'VND',
  receiver_province_code: 'ADM1-01',
  receiver_ward_code: 'ADM1-01.W49886',
  is_fallback: false,
  options: [
    { delivery_option: 'STANDARD', available: true, unavailable_reason: null, service_code: 'SCN', service_name: 'Chuyển phát nhanh', shipping_fee: 78000, eta_days: 2, is_fallback: false },
    { delivery_option: 'EXPRESS', available: true, unavailable_reason: null, service_code: 'VHT', service_name: 'Hỏa tốc thỏa thuận', shipping_fee: 226111, eta_days: 1, is_fallback: false },
  ],
};

// "200, code missing from the quote": option bị thay nguyên văn bằng bản available=false.
export const EXPRESS_UNAVAILABLE = { delivery_option: 'EXPRESS', available: false, unavailable_reason: 'Chưa có dịch vụ giao hỏa tốc cho địa chỉ này.', service_code: null, service_name: null, shipping_fee: null, eta_days: null, is_fallback: false };
export const STANDARD_UNAVAILABLE = { delivery_option: 'STANDARD', available: false, unavailable_reason: 'Chưa có dịch vụ giao tiêu chuẩn cho địa chỉ này.', service_code: null, service_name: null, shipping_fee: null, eta_days: null, is_fallback: false };
export const QUOTE_200_EXPRESS_UNAVAILABLE = { ...QUOTE_200, options: [QUOTE_200.options[0], EXPRESS_UNAVAILABLE] };
export const QUOTE_200_STANDARD_UNAVAILABLE = { ...QUOTE_200, options: [STANDARD_UNAVAILABLE, QUOTE_200.options[1]] };
export const QUOTE_200_BOTH_UNAVAILABLE = { ...QUOTE_200, options: [STANDARD_UNAVAILABLE, EXPRESS_UNAVAILABLE] };

export const QUOTE_200_FALLBACK = {
  currency: 'VND',
  receiver_province_code: 'ADM1-01',
  receiver_ward_code: 'ADM1-01.W49886',
  is_fallback: true,
  options: [
    { delivery_option: 'STANDARD', available: true, unavailable_reason: null, service_code: null, service_name: null, shipping_fee: 30000, eta_days: null, is_fallback: true },
    { delivery_option: 'EXPRESS', available: true, unavailable_reason: null, service_code: null, service_name: null, shipping_fee: 50000, eta_days: null, is_fallback: true },
  ],
};

export const ERR_SKU_NOT_FOUND = { code: 'SKU_NOT_FOUND', message: 'Không tìm thấy sản phẩm có mã TVS-AO-01-M.', field_path: 'items[0].sku_code', detail: { code: 'SKU_NOT_FOUND', message: 'Không tìm thấy sản phẩm có mã TVS-AO-01-M.', field_path: 'items[0].sku_code' } };
export const ERR_WARD_MISMATCH = { code: 'RECEIVER_WARD_PROVINCE_MISMATCH', message: 'Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.', field_path: 'receiver_ward_code', detail: { code: 'RECEIVER_WARD_PROVINCE_MISMATCH', message: 'Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.', field_path: 'receiver_ward_code' } };
// Schema 422 dạng đã dịch: {"detail":[{loc,msg,type}]} (loc body/delivery_option, type literal_error).
export const ERR_422_SCHEMA_B = { detail: [{ loc: ['body', 'delivery_option'], msg: 'Giá trị phải là STANDARD hoặc EXPRESS', type: 'literal_error' }] };

// Body THẬT của OMS dev (đo 23/10): fallback 200 cho xã ADM1-01.W49827 (Phường Ba Đình thật).
export const QUOTE_REAL_DEV = {
  currency: 'VND',
  receiver_province_code: 'ADM1-01',
  receiver_ward_code: 'ADM1-01.W49827',
  is_fallback: true,
  options: [
    { delivery_option: 'STANDARD', available: true, unavailable_reason: null, service_code: null, service_name: null, shipping_fee: 30000, eta_days: null, is_fallback: true },
    { delivery_option: 'EXPRESS', available: true, unavailable_reason: null, service_code: null, service_name: null, shipping_fee: 50000, eta_days: null, is_fallback: true },
  ],
};
// Danh sách xã thật (rút gọn từ admin-units ward ADM1-01 của OMS dev) cho test body thật.
export const WARD_BODY_REAL = {
  items: [
    { code: 'ADM1-01.W49823', level: 'ward', name: 'Phường Hoàn Kiếm', parent_code: 'ADM1-01' },
    { code: 'ADM1-01.W49827', level: 'ward', name: 'Phường Ba Đình', parent_code: 'ADM1-01' },
  ],
  next_cursor: null,
};
