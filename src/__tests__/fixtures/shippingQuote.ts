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

// STOR-155: bodies of OMS develop 8a49cc2 POST /public/shipping-quote with vouchers (spec c55789ce, captures.md oms-218).
// Q1 and Q3 are copied verbatim from the spec (r.text).
export const QUOTE_V_Q1 = JSON.parse('{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":false,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":"SCN","service_name":"Chuyển phát nhanh","shipping_fee":78000,"eta_days":2,"is_fallback":false,"shipping_fee_original":78000,"shipping_discount":0,"voucher_message":null},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":"VHT","service_name":"Hỏa tốc thỏa thuận","shipping_fee":226111,"eta_days":1,"is_fallback":false,"shipping_fee_original":226111,"shipping_discount":0,"voucher_message":null}],"voucher":{"code":null,"name":null,"valid":null,"message":null}}');
export const QUOTE_V_Q3 = JSON.parse('{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":false,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":"VTP","service_name":"Chuyển phát tiêu chuẩn","shipping_fee":35000,"eta_days":2,"is_fallback":false,"shipping_fee_original":35000,"shipping_discount":0,"voucher_message":"Mã chỉ áp dụng cho Giao hoả tốc"},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":"VHT","service_name":"Chuyển phát nhanh","shipping_fee":15000,"eta_days":1,"is_fallback":false,"shipping_fee_original":45000,"shipping_discount":30000,"voucher_message":null}],"voucher":{"code":"HOAQUOC30K","name":"Freeship hỏa tốc tháng 11","valid":true,"message":null}}');
// The spec quotes Q7 and Q8 only as fragments: the amount and message keys plus the voucher block, all verbatim.
// The rest of each option (service, eta) comes from Q3, which uses the same fake upstream (VTP 35000 / VHT 45000).
const [q3Std, q3Exp] = QUOTE_V_Q3.options;
export const QUOTE_V_Q7 = {
  ...QUOTE_V_Q3,
  options: [
    { ...q3Std, shipping_fee: 0, shipping_fee_original: 35000, shipping_discount: 35000, voucher_message: null },
    { ...q3Exp, shipping_fee: 45000, shipping_fee_original: 45000, shipping_discount: 0, voucher_message: 'Mã chỉ áp dụng cho Giao tiêu chuẩn' },
  ],
  voucher: JSON.parse('{"code":"THUONGDI","name":"Chỉ giao thường","valid":true,"message":null}'),
};
const MIN_MSG = 'Đơn hàng chưa đạt giá trị tối thiểu 500.000đ để dùng mã';
export const QUOTE_V_Q8 = {
  ...QUOTE_V_Q3,
  options: [
    { ...q3Std, shipping_fee: 35000, shipping_fee_original: 35000, shipping_discount: 0, voucher_message: MIN_MSG },
    { ...q3Exp, shipping_fee: 45000, shipping_fee_original: 45000, shipping_discount: 0, voucher_message: MIN_MSG },
  ],
  voucher: JSON.parse('{"code":"MIN500K","name":null,"valid":false,"message":"Đơn hàng chưa đạt giá trị tối thiểu 500.000đ để dùng mã"}'),
};
// Q2 voucher block, verbatim (unknown code): options keep shipping_fee == shipping_fee_original, discount 0, voucher_message null.
export const QUOTE_V_Q2 = {
  ...QUOTE_V_Q1,
  voucher: JSON.parse('{"code":"SAIMAROI","name":null,"valid":false,"message":"Mã giảm phí vận chuyển không tồn tại hoặc không đúng"}'),
};
// POST /public/checkout/orders 422, captures.md oms-219 O3b (echo 99999, fee 47999). Shape {code,message,field_path,detail:{same}}
// and field_path shipping_discount are from spec a4918ed8; the message is ApiMessage.SHIPPING_VOUCHER_DISCOUNT_LOST (spec b1477aa6).
// The spec stores no byte-for-byte copy of O3b.
export const ERR_SHIPPING_VOUCHER_NOT_APPLICABLE = {
  code: 'SHIPPING_VOUCHER_NOT_APPLICABLE', message: 'Ưu đãi phí vận chuyển không còn hiệu lực. Vui lòng thử lại.', field_path: 'shipping_discount',
  detail: { code: 'SHIPPING_VOUCHER_NOT_APPLICABLE', message: 'Ưu đãi phí vận chuyển không còn hiệu lực. Vui lòng thử lại.', field_path: 'shipping_discount' },
};

// STOR-157: quote failure bodies of OMS develop 8a49cc2 (spec 08893767), copied verbatim (r.text).
// F1: network down, default fallback fees 30000/50000. F3: same with OMS_SHIPPING_FALLBACK_FEES all 0.
export const QUOTE_F1 = JSON.parse('{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":true,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":null,"service_name":null,"shipping_fee":30000,"eta_days":null,"is_fallback":true,"shipping_fee_original":30000,"shipping_discount":0,"voucher_message":null},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":null,"service_name":null,"shipping_fee":50000,"eta_days":null,"is_fallback":true,"shipping_fee_original":50000,"shipping_discount":0,"voucher_message":null}],"voucher":{"code":null,"name":null,"valid":null,"message":null}}');
export const QUOTE_F3 = JSON.parse('{"currency":"VND","receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886","is_fallback":true,"options":[{"delivery_option":"STANDARD","available":true,"unavailable_reason":null,"service_code":null,"service_name":null,"shipping_fee":0,"eta_days":null,"is_fallback":true,"shipping_fee_original":0,"shipping_discount":0,"voucher_message":null},{"delivery_option":"EXPRESS","available":true,"unavailable_reason":null,"service_code":null,"service_name":null,"shipping_fee":0,"eta_days":null,"is_fallback":true,"shipping_fee_original":0,"shipping_discount":0,"voucher_message":null}],"voucher":{"code":null,"name":null,"valid":null,"message":null}}');
// SYNTHETIC (not an OMS capture): Q1 with only the top-level is_fallback set, every option is_fallback false.
export const QUOTE_FALLBACK_TOP_ONLY = { ...QUOTE_V_Q1, is_fallback: true };
// SYNTHETIC (not an OMS capture): Q1 with only the EXPRESS option is_fallback true, top level false.
export const QUOTE_FALLBACK_ONE_OPTION = { ...QUOTE_V_Q1, options: [QUOTE_V_Q1.options[0], { ...QUOTE_V_Q1.options[1], is_fallback: true }] };
// A plain quote with fees 30000/50000 and no fallback flag, for suites that only need some usable fee.
export const QUOTE_200_FLAT = {
  ...QUOTE_200_FALLBACK,
  is_fallback: false,
  options: QUOTE_200_FALLBACK.options.map(o => ({ ...o, is_fallback: false })),
};

// STOR-169: POST /public/checkout/orders 201, captures.md oms-219 case O1 (spec a4918ed8 section 3, AUTO voucher 30000, quote STANDARD
// 78000, 2 x 100000 goods). NOT a whole capture: the spec quotes only the amount keys, copied verbatim; id and order_number are added.
export const ORDER_201_O1 = JSON.parse('{"id":7,"order_number":"DH-O1","total_amount":"248000.00","shipping_fee":"48000.00","delivery_option":"STANDARD","shipping_service_code":"SCN","shipping_fee_source":"SERVER_QUOTE","shipping_fee_original":"78000.00","shipping_discount":"30000.00","shipping_voucher":null}');
// SYNTHETIC (not a 201 capture): O1 with shipping_voucher in the shape spec a4918ed8 section 7 gives for an AUTO voucher; the id comes
// from the O1 DB readback (shipping_voucher_id 1), the name is a placeholder.
export const ORDER_201_O1_VOUCHER = { ...ORDER_201_O1, shipping_voucher: { voucher_id: 1, code: null, name: 'Tên voucher giả' } };
// SYNTHETIC (not a 201 capture): O1 with the order row amounts of spec c4c05162, full waiver case (original 30000, discount 30000, paid 0).
export const ORDER_201_FULL_WAIVER = { ...ORDER_201_O1, total_amount: '110000.00', shipping_fee: '0.00', shipping_fee_original: '30000.00', shipping_discount: '30000.00' };
