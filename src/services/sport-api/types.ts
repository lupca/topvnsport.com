import { Category } from '../../types';

export type PmiVariant = {
  id?: number;
  product_id?: number;
  price?: number;
  stock?: number;
  tier_1_option?: string | null;
  tier_2_option?: string | null;
  sku_code?: string;
  barcode?: string | null;
  computed_price?: number;
  original_price?: number;
  percentage_discount?: number;
  has_active_promotion?: boolean;
  promotion_id?: string | number;
};

export type PmiMedia = {
  image_url?: string;
  variant_id?: number | null;
  is_cover?: boolean;
  display_order?: number;
};

export type PmiAttribute = {
  code?: string;
  name?: string;
  type?: string;
};

export type PmiAttributeValue = {
  id?: number;
  attribute_id?: number;
  value_string?: string | null;
  value_decimal?: number | null;
  attribute?: PmiAttribute | null;
};

export type PmiVomaAttributeValue = {
  code: string;
  name: string;
  value: string | null;
  value_code?: string | null;
  unit?: string | null;
};

export type PmiTierVariation = {
  id?: number;
  product_id?: number;
  tier_index: number;
  name: string;
  options: string[];
};

export type PmiProduct = {
  id: string | number;
  name?: string;
  description?: string;
  weight?: string | number;
  category_id?: number;
  voma_category_id?: number | null;
  family_id?: number;
  attribute_values?: PmiAttributeValue[];
  voma_attribute_values?: PmiVomaAttributeValue[];
  variants?: PmiVariant[];
  media?: PmiMedia[];
  tier_variations?: PmiTierVariation[];
  computed_price?: number;
  original_price?: number;
  percentage_discount?: number;
  has_active_promotion?: boolean;
};

export type CreateOrderItem = {
  sku_code: string;
  quantity: number;
};

// Hợp đồng OMS (A) GET /public/admin-units: chỉ 4 trường này.
export type AdminUnit = { code: string; level: 'province' | 'ward'; name: string; parent_code: string | null };

export type CreateOrderPayload = {
  customer: { name: string; phone: string; address?: string };
  shipping_fee: number;
  shipping_address: string;
  note?: string;
  items: CreateOrderItem[];
  verification_token?: string;
};


export type DeliveryOption = 'STANDARD' | 'EXPRESS';

// Hợp đồng OMS-132 (B) POST /public/shipping-quote.
export type ShippingQuoteRequest = {
  items: { sku_code: string; quantity: number }[];
  receiver_province_code: string;
  receiver_ward_code: string;
  delivery_option: DeliveryOption | null;
};

export type ShippingQuoteOption = {
  delivery_option: DeliveryOption;
  available: boolean;
  unavailable_reason: string | null;
  service_code: string | null;
  service_name: string | null;
  shipping_fee: number | null;
  eta_days: number | null;
  is_fallback: boolean;
};

export type ShippingQuote = {
  currency: string;
  receiver_province_code: string;
  receiver_ward_code: string;
  is_fallback: boolean;
  options: ShippingQuoteOption[];
};

export type SendOtpResponse = {
  success: boolean;
  message?: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  verification_token: string;
};


export type ApiListResponse<T> = {
  items?: T[];
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
};

export type PmiProductMapper = (product: PmiProduct, categories: Category[]) => any;
