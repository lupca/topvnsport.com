// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import {
  buildConfiguredCartItem,
  buildDefaultCartItem,
  getCartItemPriceDisplay,
  getCartItemUnitPrice,
} from '../features/cart/cartSlice';
import { mapPmiProduct, mapProductVariant } from '../services/sport-api/productMappers';
import { PmiProduct, PmiVariant } from '../services/sport-api/types';
import { getPdpPrice } from '../components/product-detail/helpers';
import { getPriceDisplay } from '../utils/priceDisplay';
import { Category, Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200 } from './fixtures/shippingQuote';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const CATEGORIES: Category[] = [
  { id: 1, name: 'Vợt cầu lông', code: 'VC001491', parent_id: null, display_name: 'Vợt cầu lông' },
  { id: 2, name: 'Giày cầu lông', code: 'VC002000', parent_id: null, display_name: 'Giày cầu lông' },
];

// Dữ liệu PIM thô đi qua mapPmiProduct/mapProductVariant thật (không monkeypatch).
const rawPromotedProduct: PmiProduct = {
  id: 101,
  name: 'Vợt Yonex Astrox 88D Pro',
  voma_category_id: 1,
  attribute_values: [
    { id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } },
  ],
  tier_variations: [
    { tier_index: 1, name: 'Màu sắc', options: ['Đỏ', 'Đen'] },
    { tier_index: 2, name: 'Trọng lượng', options: ['4U'] },
  ],
  variants: [
    {
      id: 1011,
      sku_code: 'AX88D-RED-4U',
      tier_1_option: 'Đỏ',
      tier_2_option: '4U',
      price: 2500000,
      original_price: 2500000,
      computed_price: 2000000,
      percentage_discount: 20,
      has_active_promotion: true,
      stock: 10,
    },
    {
      id: 1012,
      sku_code: 'AX88D-BLK-4U',
      tier_1_option: 'Đen',
      tier_2_option: '4U',
      price: 2500000,
      original_price: 2500000,
      computed_price: 2500000,
      has_active_promotion: false,
      stock: 10,
    },
  ],
};

const rawUnpromotedProduct: PmiProduct = {
  id: 102,
  name: 'Giày Victor A970ACE',
  voma_category_id: 2,
  attribute_values: [
    { id: 2, attribute_id: 10, value_string: 'Victor', attribute: { code: 'brand', name: 'Thương hiệu' } },
  ],
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['42'] }],
  variants: [
    {
      id: 1021,
      sku_code: 'A970-WHT-42',
      tier_1_option: '42',
      tier_2_option: null,
      price: 1800000,
      stock: 8,
    },
  ],
};

// PIM trả computed_price < price nhưng KHÔNG trả original_price -> không vẽ gạch ngang (không fallback sang price).
const rawComputedNoOriginalProduct: PmiProduct = {
  id: 103,
  name: 'Túi Yonex BA92431WEX',
  voma_category_id: 1,
  variants: [
    {
      id: 1031,
      sku_code: 'BAG-92431',
      tier_1_option: null,
      tier_2_option: null,
      price: 1900000,
      computed_price: 1500000,
      stock: 5,
    },
  ],
};

const promotedProduct = mapPmiProduct(rawPromotedProduct, CATEGORIES)!;
const unpromotedProduct = mapPmiProduct(rawUnpromotedProduct, CATEGORIES)!;
const computedNoOriginalProduct = mapPmiProduct(rawComputedNoOriginalProduct, CATEGORIES)!;
const ALL_PRODUCTS: Product[] = [promotedProduct, unpromotedProduct, computedNoOriginalProduct];

const promotedCartItem: CartItem = {
  ...buildConfiguredCartItem(promotedProduct, '4U', 'Đỏ', null, 10.5)!,
  quantity: 2,
};
const samePriceCartItem: CartItem = {
  ...buildConfiguredCartItem(promotedProduct, '4U', 'Đen', null, 10.5)!,
  quantity: 1,
};
const unpromotedCartItem: CartItem = {
  ...buildConfiguredCartItem(unpromotedProduct, '', '42', null, 10.5)!,
  quantity: 1,
};
const noOriginalCartItem: CartItem = {
  ...buildDefaultCartItem(computedNoOriginalProduct)!,
  quantity: 2,
};

const fmt = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

function renderCart(
  cartItems: CartItem[],
  appOverrides: Record<string, unknown> = {},
  onClearCart = () => {}
) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: {
      appData: {
        products: ALL_PRODUCTS,
        branches: [],
        stringOptions: [],
        categories: CATEGORIES,
        isLoading: false,
        categoriesError: false,
        productsError: false,
        ...appOverrides,
      },
    } as any,
  });
  return render(
    <Provider store={store}>
      <CartModal
        isOpen
        onClose={() => {}}
        cartItems={cartItems}
        onRemoveItem={() => {}}
        onClearCart={onClearCart}
      />
    </Provider>
  );
}

describe('STOR-093: Giỏ hàng + thanh toán hiện giá KM kèm giá gốc gạch ngang', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Mapper & hàm giá dùng chung cấp biến thể (getCartItemPriceDisplay)', () => {
    it('mapProductVariant giữ originalPrice = undefined khi PIM không gửi original_price (kể cả khi có computed_price < price)', () => {
      const noOrig: PmiVariant = {
        id: 1,
        sku_code: 'S1',
        price: 1900000,
        computed_price: 1500000,
        stock: 3,
      };
      const mapped = mapProductVariant(noOrig, 103);
      expect(mapped.originalPrice).toBeUndefined();
      expect(mapped.computedPrice).toBe(1500000);
      expect(mapped.price).toBe(1900000);
    });

    it('getCartItemPriceDisplay trả { unit, original } chỉ khi originalPrice có thật từ PIM và > unit', () => {
      expect(getCartItemPriceDisplay(promotedCartItem, ALL_PRODUCTS)).toEqual({
        unit: 2000000,
        original: 2500000,
      });
      // original_price === computed_price -> không gạch ngang
      expect(getCartItemPriceDisplay(samePriceCartItem, ALL_PRODUCTS)).toEqual({
        unit: 2500000,
        original: null,
      });
      // Không có khuyến mãi, không có original_price -> original: null
      expect(getCartItemPriceDisplay(unpromotedCartItem, ALL_PRODUCTS)).toEqual({
        unit: 1800000,
        original: null,
      });
      // Có computed_price < price nhưng PIM không gửi original_price -> không fallback sang price
      expect(getCartItemPriceDisplay(noOriginalCartItem, ALL_PRODUCTS)).toEqual({
        unit: 1500000,
        original: null,
      });
    });

    it('PDP (getPdpPrice) và hiển thị cấp sản phẩm (getPriceDisplay cho Header/Slider/ProductCard) giữ nguyên hành vi', () => {
      const pdpPromoted = getPdpPrice(promotedProduct, 'Đỏ', '4U');
      expect(pdpPromoted.salePrice).toBe(2000000);
      expect(pdpPromoted.originalPrice).toBe(2500000);
      expect(pdpPromoted.hasDiscount).toBe(true);

      const pdpUnpromoted = getPdpPrice(unpromotedProduct, '42', '');
      expect(pdpUnpromoted.salePrice).toBe(1800000);
      expect(pdpUnpromoted.originalPrice).toBe(1800000);
      expect(pdpUnpromoted.hasDiscount).toBe(false);

      const cardPromoted = getPriceDisplay(promotedProduct);
      expect(cardPromoted.hasActivePromotion).toBe(true);
      expect(cardPromoted.salePrice).toBe(2000000);
      expect(cardPromoted.originalPrice).toBe(2500000);

      const cardUnpromoted = getPriceDisplay(unpromotedProduct);
      expect(cardUnpromoted.hasActivePromotion).toBe(false);
      expect(cardUnpromoted.salePrice).toBe(1800000);
      expect(cardUnpromoted.originalPrice).toBe(1800000);
    });

    it('CartModal.tsx dùng getCartItemPriceDisplay và không tự so sánh giá inline', () => {
      const src = readFileSync('src/components/CartModal.tsx', 'utf8');
      expect(src).toContain('getCartItemPriceDisplay');
      expect(src).not.toMatch(/computedPrice|originalPrice|hasActivePromotion|salePrice/);
    });
  });

  describe('Bước 1 (Giỏ hàng)', () => {
    it('dòng phân loại đang KM hiện thành tiền KM (unit × qty) và giá gốc × qty gạch ngang', () => {
      renderCart([promotedCartItem]);
      const line = screen.getByTestId('cart-line');
      expect(within(line).getByText(fmt(4000000))).toBeInTheDocument();
      const struck = within(line).getByText(fmt(5000000));
      expect(struck.className).toContain('line-through');
    });

    it('dòng phân loại không KM chỉ hiện một giá, không có phần tử line-through', () => {
      renderCart([unpromotedCartItem]);
      const line = screen.getByTestId('cart-line');
      expect(within(line).getByText(fmt(1800000))).toBeInTheDocument();
      expect(line.querySelector('.line-through')).toBeNull();
    });

    it('dòng có original_price === computed_price chỉ hiện một giá, không có line-through', () => {
      renderCart([samePriceCartItem]);
      const line = screen.getByTestId('cart-line');
      expect(within(line).getByText(fmt(2500000))).toBeInTheDocument();
      expect(line.querySelector('.line-through')).toBeNull();
    });

    it('dòng có computed_price < price nhưng PIM không trả original_price -> hiện giá computed, KHÔNG có line-through', () => {
      renderCart([noOriginalCartItem]);
      const line = screen.getByTestId('cart-line');
      expect(within(line).getByText(fmt(3000000))).toBeInTheDocument();
      expect(line.querySelector('.line-through')).toBeNull();
      expect(within(line).queryByText(fmt(3800000))).toBeNull();
    });

    it('Tổng tiền hàng tính theo giá bán (Σ sale × qty), không tính theo giá gốc', () => {
      renderCart([promotedCartItem, unpromotedCartItem]);
      // 2 × 2.000.000 + 1 × 1.800.000 = 5.800.000đ (không phải 2 × 2.500.000 + 1.800.000 = 6.800.000đ)
      const itemsTotalRow = screen.getByText('Tổng tiền hàng:').parentElement!;
      expect(itemsTotalRow).toHaveTextContent(fmt(5800000));
      expect(itemsTotalRow).not.toHaveTextContent(fmt(6800000));
    });

    it('đang tải hoặc lỗi tải sản phẩm: không hiện cả giá bán lẫn giá gốc gạch ngang', () => {
      const { unmount } = renderCart([promotedCartItem], { isLoading: true });
      expect(screen.getByTestId('cart-line').querySelector('.line-through')).toBeNull();
      expect(screen.queryByText(fmt(4000000))).toBeNull();
      expect(screen.queryByText(fmt(5000000))).toBeNull();
      unmount();

      renderCart([promotedCartItem], { productsError: true });
      expect(screen.getByTestId('cart-line').querySelector('.line-through')).toBeNull();
      expect(screen.queryByText(fmt(4000000))).toBeNull();
      expect(screen.queryByText(fmt(5000000))).toBeNull();
    });
  });

  describe('Bước 2 (Thanh toán: tóm tắt đơn & đồng bộ payload OMS)', () => {
    let calls: { url: string; body: any }[];
    const onClearCart = vi.fn();

    beforeEach(() => {
      sessionStorage.clear();
      calls = [];
      onClearCart.mockClear();
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init: any) => {
          const body = init?.body ? JSON.parse(init.body) : undefined;
          calls.push({ url, body });
          if (url.startsWith('/api/oms/admin-units')) {
            const json = url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY;
            return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
          }
          if (url === '/api/oms/shipping-quote') {
            return { ok: true, status: 200, json: async () => QUOTE_200, text: async () => JSON.stringify(QUOTE_200) };
          }
          if (url.endsWith('/verify-otp')) {
            const json = { success: true, verification_token: 'vt-stor093' };
            return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
          }
          if (url.endsWith('/orders')) {
            // OMS tính tổng = Σ(computed_price × qty) + shipping_fee
            const itemsSum = (body.items as { sku_code: string; quantity: number }[]).reduce((sum, it) => {
              const unit = getCartItemUnitPrice(
                { skuCode: it.sku_code, productId: it.sku_code.startsWith('AX88D') ? '101' : '102' } as CartItem,
                ALL_PRODUCTS
              )!;
              return sum + unit * it.quantity;
            }, 0);
            const total = itemsSum + Number(body.shipping_fee);
            const json = {
              id: 93,
              order_number: 'DH-093',
              shipping_fee: `${body.shipping_fee}.00`,
              total_amount: `${total}.00`,
            };
            return { ok: true, status: 201, json: async () => json, text: async () => JSON.stringify(json) };
          }
          return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '{"success":true}' };
        })
      );
    });

    it('bước 2 liệt kê từng dòng với số lượng, thành tiền KM, giá gốc gạch ngang cho dòng KM và không gạch ngang cho dòng thường', () => {
      renderCart([promotedCartItem, unpromotedCartItem]);
      fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));

      const summary = screen.getByTestId('checkout-order-summary');
      expect(within(summary).getByText('Đơn hàng của bạn')).toBeInTheDocument();
      const lines = within(summary).getAllByTestId('checkout-summary-line');
      expect(lines).toHaveLength(2);

      // Dòng 1: đang KM (2 × 2.000.000 = 4.000.000đ, gốc 2 × 2.500.000 = 5.000.000đ gạch ngang)
      expect(within(lines[0]).getByText('Vợt Yonex Astrox 88D Pro')).toBeInTheDocument();
      expect(lines[0].textContent).toContain('Màu sắc: Đỏ · Trọng lượng: 4U');
      expect(lines[0].textContent).toContain('SL: 2');
      expect(within(lines[0]).getByText(fmt(4000000))).toBeInTheDocument();
      const struck0 = within(lines[0]).getByText(fmt(5000000));
      expect(struck0.className).toContain('line-through');

      // Dòng 2: không KM (1 × 1.800.000 = 1.800.000đ, không gạch ngang)
      expect(within(lines[1]).getByText('Giày Victor A970ACE')).toBeInTheDocument();
      expect(lines[1].textContent).toContain('Size: 42');
      expect(lines[1].textContent).toContain('SL: 1');
      expect(within(lines[1]).getByText(fmt(1800000))).toBeInTheDocument();
      expect(lines[1].querySelector('.line-through')).toBeNull();
    });

    it('payload POST /orders mang đúng sku_code, quantity, shipping_fee và khớp đúng Tổng cộng thanh toán trên màn', async () => {
      renderCart([promotedCartItem, unpromotedCartItem], {}, onClearCart);
      fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));

      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 10 Cầu Giấy' } });
      await pickAdminUnits();

      // Phí chuẩn QUOTE_200 = 78.000đ; Tổng tiền hàng = 5.800.000đ -> Tổng cộng thanh toán = 5.878.000đ
      const standardFee = QUOTE_200.options.find(o => o.delivery_option === 'STANDARD')!.shipping_fee!;
      const expectedItemsTotal = 2000000 * 2 + 1800000 * 1;
      const expectedOrderTotal = expectedItemsTotal + standardFee;

      await waitFor(() => {
        expect(screen.getByText('Tổng tiền hàng:').parentElement!).toHaveTextContent(fmt(expectedItemsTotal));
        expect(screen.getByText('Phí vận chuyển:').parentElement!).toHaveTextContent(fmt(standardFee));
        expect(screen.getByText('Tổng cộng thanh toán:').parentElement!).toHaveTextContent(fmt(expectedOrderTotal));
      });

      fireEvent.click(screen.getByText('Thanh toán COD'));
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
      fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));

      await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
      const orderPayload = calls.find(c => c.url.endsWith('/orders'))!.body;

      expect(orderPayload.items).toEqual([
        { sku_code: 'AX88D-RED-4U', quantity: 2 },
        { sku_code: 'A970-WHT-42', quantity: 1 },
      ]);
      expect(orderPayload.shipping_fee).toBe(standardFee);

      // Chứng minh tổng từ payload gửi OMS = đúng Tổng cộng thanh toán đã hiện ở bước 2
      const payloadTotal =
        orderPayload.items.reduce((sum: number, it: { sku_code: string; quantity: number }) => {
          const cartLine = [promotedCartItem, unpromotedCartItem].find(c => c.skuCode === it.sku_code)!;
          return sum + getCartItemUnitPrice(cartLine, ALL_PRODUCTS)! * it.quantity;
        }, 0) + orderPayload.shipping_fee;
      expect(payloadTotal).toBe(expectedOrderTotal);

      // Bước 3: 201 trả đúng total_amount = 5.878.000đ -> hiện đúng số và không hiện cảnh báo điều chỉnh phí
      expect(await screen.findByText(`Tổng hóa đơn thanh toán: ${fmt(expectedOrderTotal)}`)).toBeInTheDocument();
      expect(screen.queryByText(/Phí vận chuyển đã được cập nhật theo báo giá mới nhất/)).toBeNull();
    });
  });
});
