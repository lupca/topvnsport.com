// Body NGUYÊN VĂN hợp đồng (C) POST /public/checkout/orders -- OMS-133 (spec fae8d7ae, r:f04e3ee5).
// Nguồn response: chạy test OMS tại commit 9919762 (voma-oms develop), file
// backend/tests/test_public_checkout_shipping.py (fixture up/contract_body/token_for, upstream giả ở tầng transport),
// in r.json() bằng test bắt tạm ngoài repo: pytest tests/test_capture_stor038.py (OMS_TEST_SQLITE_DIR riêng, sqlite).
// Chỉ chép nguyên văn, không sửa tay giá trị. 403 'Mã xác minh không hợp lệ.' là test_bad_token_never_calls_quote_http.
// Test nguồn: test_contract_c_body_201_server_quote_saved (201 STANDARD COD), 201 EXPRESS = contract_body(delivery_option=EXPRESS, payment_method=SEPAY),
// test_fee_equal_records_no_adjusted_event (shipping_fee 78000), test_unavailable_option_422_and_no_order,
// receiver_ward_code='ADM1-02.W1' (mismatch), PIM by-sku 404 (SKU_NOT_FOUND), test_only_one_admin_code_422 (schema).

// Body mẫu chốt nguyên văn (test chỉ thay verification_token).
export const CONTRACT_C_BODY =
  '{"customer":{"name":"Nguyễn Văn A","phone":"0987654321","address":"Số 1 Đường Giải Phóng"},' +
  '"shipping_fee":30000,"shipping_address":"Số 1 Đường Giải Phóng, Phường Hoàng Mai, Hà Nội",' +
  '"note":null,"items":[{"sku_code":"TVS-AO-01-M","quantity":2}],"verification_token":"<token>",' +
  '"receiver_province_code":"ADM1-01","receiver_ward_code":"ADM1-01.W49886",' +
  '"delivery_option":"STANDARD","payment_method":"COD"}';

export const ORDER_201_STANDARD_COD = {
  "order_number": "ORD-20261023-0001",
  "customer_id": 1,
  "channel_id": 6,
  "status": "DRAFT",
  "total_amount": "278000.00",
  "shipping_fee": "78000.00",
  "shipping_address": "Số 1 Đường Giải Phóng, Phường Hoàng Mai, Hà Nội",
  "note": null,
  "payment_status": "PENDING",
  "payment_method": "COD",
  "sepay_order_id": null,
  "paid_at": null,
  "placed_at": "2026-10-23T21:48:11.126373Z",
  "created_by": null,
  "id": 1,
  "created_at": "2026-10-23T21:48:11.126371Z",
  "updated_at": "2026-10-23T21:48:11.126373Z",
  "fulfillment_status": null,
  "invoice_intake": null,
  "channel_metadata": {},
  "channel_code": "WEB",
  "recipient_phone": null,
  "customer": {
    "name": "Nguyễn Văn A",
    "phone": "84987654321",
    "email": null,
    "address": "Số 1 Đường Giải Phóng",
    "id": 1,
    "created_at": "2026-10-23T21:48:11.120036Z",
    "source": null
  },
  "channel": {
    "code": "STOREFRONT",
    "name": "Storefront",
    "is_active": true,
    "id": 6
  },
  "items": [
    {
      "sku_code": "TVS-AO-01-M",
      "product_name": "Áo",
      "variant_name": null,
      "quantity": 2,
      "unit_price": "100000.00",
      "subtotal": "200000.00",
      "image_url": null,
      "id": 1,
      "order_id": 1
    }
  ],
  "fulfillment_orders": [],
  "receiver_province_code": "ADM1-01",
  "receiver_ward_code": "ADM1-01.W49886",
  "delivery_option": "STANDARD",
  "shipping_service_code": "SCN",
  "shipping_fee_source": "SERVER_QUOTE"
};

export const ORDER_201_EXPRESS_SEPAY = {
  "order_number": "ORD-20261023-0001",
  "customer_id": 1,
  "channel_id": 6,
  "status": "DRAFT",
  "total_amount": "426111.00",
  "shipping_fee": "226111.00",
  "shipping_address": "Số 1 Đường Giải Phóng, Phường Hoàng Mai, Hà Nội",
  "note": null,
  "payment_status": "PENDING",
  "payment_method": null,
  "sepay_order_id": null,
  "paid_at": null,
  "placed_at": "2026-10-23T21:48:11.165690Z",
  "created_by": null,
  "id": 1,
  "created_at": "2026-10-23T21:48:11.165688Z",
  "updated_at": "2026-10-23T21:48:11.165690Z",
  "fulfillment_status": null,
  "invoice_intake": null,
  "channel_metadata": {},
  "channel_code": "WEB",
  "recipient_phone": null,
  "customer": {
    "name": "Nguyễn Văn A",
    "phone": "84987654321",
    "email": null,
    "address": "Số 1 Đường Giải Phóng",
    "id": 1,
    "created_at": "2026-10-23T21:48:11.157021Z",
    "source": null
  },
  "channel": {
    "code": "STOREFRONT",
    "name": "Storefront",
    "is_active": true,
    "id": 6
  },
  "items": [
    {
      "sku_code": "TVS-AO-01-M",
      "product_name": "Áo",
      "variant_name": null,
      "quantity": 2,
      "unit_price": "100000.00",
      "subtotal": "200000.00",
      "image_url": null,
      "id": 1,
      "order_id": 1
    }
  ],
  "fulfillment_orders": [],
  "receiver_province_code": "ADM1-01",
  "receiver_ward_code": "ADM1-01.W49886",
  "delivery_option": "EXPRESS",
  "shipping_service_code": "VHT",
  "shipping_fee_source": "SERVER_QUOTE"
};

export const ORDER_201_FEE_EQUAL = {
  "order_number": "ORD-20261023-0001",
  "customer_id": 1,
  "channel_id": 6,
  "status": "DRAFT",
  "total_amount": "278000.00",
  "shipping_fee": "78000.00",
  "shipping_address": "Số 1 Đường Giải Phóng, Phường Hoàng Mai, Hà Nội",
  "note": null,
  "payment_status": "PENDING",
  "payment_method": "COD",
  "sepay_order_id": null,
  "paid_at": null,
  "placed_at": "2026-10-23T21:48:11.200818Z",
  "created_by": null,
  "id": 1,
  "created_at": "2026-10-23T21:48:11.200816Z",
  "updated_at": "2026-10-23T21:48:11.200818Z",
  "fulfillment_status": null,
  "invoice_intake": null,
  "channel_metadata": {},
  "channel_code": "WEB",
  "recipient_phone": null,
  "customer": {
    "name": "Nguyễn Văn A",
    "phone": "84987654321",
    "email": null,
    "address": "Số 1 Đường Giải Phóng",
    "id": 1,
    "created_at": "2026-10-23T21:48:11.195582Z",
    "source": null
  },
  "channel": {
    "code": "STOREFRONT",
    "name": "Storefront",
    "is_active": true,
    "id": 6
  },
  "items": [
    {
      "sku_code": "TVS-AO-01-M",
      "product_name": "Áo",
      "variant_name": null,
      "quantity": 2,
      "unit_price": "100000.00",
      "subtotal": "200000.00",
      "image_url": null,
      "id": 1,
      "order_id": 1
    }
  ],
  "fulfillment_orders": [],
  "receiver_province_code": "ADM1-01",
  "receiver_ward_code": "ADM1-01.W49886",
  "delivery_option": "STANDARD",
  "shipping_service_code": "SCN",
  "shipping_fee_source": "SERVER_QUOTE"
};

export const ERR_DELIVERY_OPTION_UNAVAILABLE = {
  "code": "DELIVERY_OPTION_UNAVAILABLE",
  "message": "Hình thức giao hàng đã chọn hiện không khả dụng cho địa chỉ này. Vui lòng chọn hình thức khác.",
  "field_path": "delivery_option",
  "detail": {
    "code": "DELIVERY_OPTION_UNAVAILABLE",
    "message": "Hình thức giao hàng đã chọn hiện không khả dụng cho địa chỉ này. Vui lòng chọn hình thức khác.",
    "field_path": "delivery_option"
  }
};

export const ERR_C_WARD_MISMATCH = {
  "code": "RECEIVER_WARD_PROVINCE_MISMATCH",
  "message": "Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.",
  "field_path": "receiver_ward_code",
  "detail": {
    "code": "RECEIVER_WARD_PROVINCE_MISMATCH",
    "message": "Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.",
    "field_path": "receiver_ward_code"
  }
};

export const ERR_C_SKU_NOT_FOUND = {
  "code": "SKU_NOT_FOUND",
  "message": "Không tìm thấy sản phẩm có mã TVS-AO-01-M.",
  "field_path": "items[0].sku_code",
  "detail": {
    "code": "SKU_NOT_FOUND",
    "message": "Không tìm thấy sản phẩm có mã TVS-AO-01-M.",
    "field_path": "items[0].sku_code"
  }
};

export const ERR_C_SCHEMA_MISSING_CODE = {
  "detail": [
    {
      "loc": [
        "body"
      ],
      "msg": "Địa chỉ người nhận thiếu mã tỉnh/thành hoặc phường/xã chuẩn.",
      "type": "value_error"
    }
  ]
};

export const ERR_403_TOKEN = {
  "detail": "Mã xác minh không hợp lệ."
};

