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
  getCartItemUnitPrice,
  getCartPriceSummary,
} from '../features/cart/cartSlice';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { PmiProduct } from '../services/sport-api/types';
import { Category, Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200 } from './fixtures/shippingQuote';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const CATEGORIES: Category[] = [
  { id: 1, name: 'Vợt cầu lông', code: 'VC001491', parent_id: null, display_name: 'Vợt cầu lông' },
  { id: 2, name: 'Giày cầu lông', code: 'VC002000', parent_id: null, display_name: 'Giày cầu lông' },
];

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
const unpromotedCartItem: CartItem = {
  ...buildConfiguredCartItem(unpromotedProduct, '', '42', null, 10.5)!,
  quantity: 1,
};
const noOriginalCartItem: CartItem = {
  ...buildDefaultCartItem(computedNoOriginalProduct)!,
  quantity: 1,
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

describe('STOR-096: Giỏ hàng + thanh toán: khối tổng tiền hiện giá gốc gạch ngang, giảm giá SP, tiết kiệm', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Pure helper getCartPriceSummary & cấu trúc mã', () => {
    it('cartSlice.ts exports pure function getCartPriceSummary', () => {
      expect(typeof getCartPriceSummary).toBe('function');
    });

    it('getCartPriceSummary calls getCartItemPriceDisplay', () => {
      const src = readFileSync('src/features/cart/cartSlice.ts', 'utf8');
      expect(src).toMatch(/function getCartPriceSummary[\s\S]*?getCartItemPriceDisplay/);
    });

    it('CartModal.tsx has no original_price comparison of its own', () => {
      const src = readFileSync('src/components/CartModal.tsx', 'utf8');
      expect(src).toContain('getCartPriceSummary');
      expect(src).not.toMatch(/computedPrice|originalPrice|hasActivePromotion|salePrice|original_price/);
    });

    it('getCartPriceSummary computes correct numbers for mixed promoted + unpromoted cart', () => {
      // 2× promoted (orig: 2.500.000, sale: 2.000.000) + 1× unpromoted (sale: 1.800.000)
      // itemsTotal = 2*2000000 + 1*1800000 = 5.800.000
      // productDiscount = 2*(2500000 - 2000000) = 1.000.000
      // originalItemsTotal = 5.800.000 + 1.000.000 = 6.800.000
      const summary = getCartPriceSummary([promotedCartItem, unpromotedCartItem], ALL_PRODUCTS);
      expect(summary).toEqual({
        itemsTotal: 5800000,
        originalItemsTotal: 6800000,
        productDiscount: 1000000,
      });
    });

    it('getCartPriceSummary returns productDiscount 0 when cart has unpromoted lines only', () => {
      const summary = getCartPriceSummary([unpromotedCartItem], ALL_PRODUCTS);
      expect(summary).toEqual({
        itemsTotal: 1800000,
        originalItemsTotal: 1800000,
        productDiscount: 0,
      });
    });

    it('A line lacking PIM original_price adds 0 to the discount and does not fallback to variant.price', () => {
      const summary = getCartPriceSummary([noOriginalCartItem], ALL_PRODUCTS);
      // unit = 1.500.000, price = 1.900.000 (no originalPrice) -> discount 0, orig = sale = 1.500.000
      expect(summary).toEqual({
        itemsTotal: 1500000,
        originalItemsTotal: 1500000,
        productDiscount: 0,
      });
    });

    it('getCartPriceSummary returns null when any line item has missing unit price', () => {
      const invalidItem: CartItem = {
        ...unpromotedCartItem,
        productId: '9999', // not found
      };
      const summary = getCartPriceSummary([promotedCartItem, invalidItem], ALL_PRODUCTS);
      expect(summary).toBeNull();
    });
  });

  describe('Bước 1 (Giỏ hàng): khối tổng tiền & dòng món', () => {
    it('The struck cart line price has class text-sm or larger, not text-xs, no text-gray-400', () => {
      renderCart([promotedCartItem]);
      const line = screen.getByTestId('cart-line');
      const struck = within(line).getByText(fmt(5000000));
      expect(struck.className).toContain('text-sm');
      expect(struck.className).toContain('text-gray-600');
      expect(struck.className).toContain('line-through');
      expect(struck.className).not.toContain('text-xs');
      expect(struck.className).not.toContain('text-[10px]');
      expect(struck.className).not.toContain('text-gray-400');

      const saleEl = within(line).getByText(fmt(4000000));
      expect(saleEl.className).toContain('text-base');
    });

    it('Promoted case, cart: Tổng tiền hàng shows struck 6.800.000đ and sale 5.800.000đ', () => {
      renderCart([promotedCartItem, unpromotedCartItem]);
      const itemsTotalRow = screen.getByText('Tổng tiền hàng:').parentElement!;

      // The mixed fixture shows struck 6.800.000đ
      const struckTotal = within(itemsTotalRow).getByText(fmt(6800000));
      expect(struckTotal.className).toContain('line-through');

      // The mixed fixture shows sale 5.800.000đ
      const saleTotal = within(itemsTotalRow).getByText(fmt(5800000));
      expect(saleTotal.className).not.toContain('line-through');
    });

    it('Promoted case: Giảm giá sản phẩm row starts with minus sign, equals 1.000.000đ, has text-brand-sale, and precedes Phí vận chuyển', () => {
      renderCart([promotedCartItem, unpromotedCartItem]);

      // The mixed fixture shows 'Giảm giá sản phẩm: −1.000.000đ'
      const discountLabel = screen.getByText('Giảm giá sản phẩm:');
      const discountRow = discountLabel.parentElement!;
      expect(discountRow).toHaveTextContent('Giảm giá sản phẩm: −1.000.000đ');

      // The 'Giảm giá sản phẩm' value starts with a minus sign and has class text-brand-sale
      const discountVal = within(discountRow).getByText('−1.000.000đ');
      expect(discountVal.textContent?.startsWith('−')).toBe(true);
      expect(discountVal.className).toContain('text-brand-sale');

      // The 'Giảm giá sản phẩm' row precedes 'Phí vận chuyển' in the DOM
      const shippingLabel = screen.getByText('Phí vận chuyển:');
      const shippingRow = shippingLabel.parentElement!;
      expect(discountRow.compareDocumentPosition(shippingRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('Promoted case: Tiết kiệm 1.000.000đ renders under Tổng cộng thanh toán in cart step before shipping quote', () => {
      renderCart([promotedCartItem, unpromotedCartItem]);

      // Cart step before a shipping quote: 'Tiết kiệm Xđ' still renders
      const savingEl = screen.getByText('Tiết kiệm 1.000.000đ');
      expect(savingEl).toBeInTheDocument();
      const savingRow = savingEl.closest('div')!;
      expect(savingRow.className).toContain('text-sm');
      expect(savingRow.className).toContain('font-medium');
      expect(savingRow.className).toContain('text-brand-sale');
      expect(savingRow.className).not.toContain('text-[11px]');

      // Renders under 'Tổng cộng thanh toán'
      const orderTotalLabel = screen.getByText('Tổng cộng thanh toán:');
      const orderTotalRow = orderTotalLabel.parentElement!;
      expect(orderTotalRow.compareDocumentPosition(savingEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('Unpromoted case: no line-through in totals block, no Giảm giá sản phẩm, no Tiết kiệm', () => {
      renderCart([unpromotedCartItem]);

      const itemsTotalRow = screen.getByText('Tổng tiền hàng:').parentElement!;
      expect(itemsTotalRow).toHaveTextContent(fmt(1800000));
      // No line-through in totals block
      const totalsContainer = itemsTotalRow.parentElement!;
      expect(totalsContainer.querySelector('.line-through')).toBeNull();

      // Giảm giá sản phẩm is absent
      expect(screen.queryByText(/Giảm giá sản phẩm/)).toBeNull();

      // Tiết kiệm is absent
      expect(screen.queryByText(/Tiết kiệm/)).toBeNull();
    });

    it('New rows are hidden while products load or fail', () => {
      const { unmount } = renderCart([promotedCartItem, unpromotedCartItem], { isLoading: true });
      expect(screen.queryByText(/Giảm giá sản phẩm/)).toBeNull();
      expect(screen.queryByText(/Tiết kiệm/)).toBeNull();
      unmount();

      renderCart([promotedCartItem, unpromotedCartItem], { productsError: true });
      expect(screen.queryByText(/Giảm giá sản phẩm/)).toBeNull();
      expect(screen.queryByText(/Tiết kiệm/)).toBeNull();
    });
  });

  describe('Bước 2 (Thanh toán) & payload OMS không đổi', () => {
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
            const json = { success: true, verification_token: 'vt-stor096' };
            return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
          }
          if (url.endsWith('/orders')) {
            const itemsSum = (body.items as { sku_code: string; quantity: number }[]).reduce((sum, it) => {
              const unit = getCartItemUnitPrice(
                { skuCode: it.sku_code, productId: it.sku_code.startsWith('AX88D') ? '101' : '102' } as CartItem,
                ALL_PRODUCTS
              )!;
              return sum + unit * it.quantity;
            }, 0);
            const total = itemsSum + Number(body.shipping_fee);
            const json = {
              id: 96,
              order_number: 'DH-096',
              shipping_fee: `${body.shipping_fee}.00`,
              total_amount: `${total}.00`,
            };
            return { ok: true, status: 201, json: async () => json, text: async () => JSON.stringify(json) };
          }
          return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '{"success":true}' };
        })
      );
    });

    it('Payment step with a promoted line: the original sum is struck through and the sale sum is plain', () => {
      renderCart([promotedCartItem, unpromotedCartItem]);
      fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));

      // Checkout summary line struck price
      const summary = screen.getByTestId('checkout-order-summary');
      const lines = within(summary).getAllByTestId('checkout-summary-line');
      const struckLinePrice = within(lines[0]).getByText(fmt(5000000));
      expect(struckLinePrice.className).toContain('text-sm');
      expect(struckLinePrice.className).toContain('text-gray-600');
      expect(struckLinePrice.className).toContain('line-through');
      expect(struckLinePrice.className).not.toContain('text-xs');
      expect(struckLinePrice.className).not.toContain('text-gray-400');

      const saleLinePrice = within(lines[0]).getByText(fmt(4000000));
      expect(saleLinePrice.className).toContain('text-base');

      // Totals block in payment step
      const itemsTotalRow = screen.getByText('Tổng tiền hàng:').parentElement!;
      const struckTotal = within(itemsTotalRow).getByText(fmt(6800000));
      expect(struckTotal.className).toContain('line-through');

      const saleTotal = within(itemsTotalRow).getByText(fmt(5800000));
      expect(saleTotal.className).not.toContain('line-through');

      // Giảm giá sản phẩm and Tiết kiệm
      expect(screen.getByText('Giảm giá sản phẩm:')).toBeInTheDocument();
      const savingEl2 = screen.getByText('Tiết kiệm 1.000.000đ');
      expect(savingEl2).toBeInTheDocument();
      const savingRow2 = savingEl2.closest('div')!;
      expect(savingRow2.className).toContain('text-sm');
      expect(savingRow2.className).toContain('font-medium');
      expect(savingRow2.className).toContain('text-brand-sale');
    });

    it('Promoted case test: POST /orders items and shipping_fee are unchanged, Σunit×qty + fee equals displayed Tổng cộng thanh toán', async () => {
      renderCart([promotedCartItem, unpromotedCartItem], {}, onClearCart);
      fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));

      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 10 Cầu Giấy' } });
      await pickAdminUnits();

      const standardFee = QUOTE_200.options.find(o => o.delivery_option === 'STANDARD')!.shipping_fee!;
      const expectedItemsTotal = 2000000 * 2 + 1800000 * 1; // 5.800.000đ
      const expectedOrderTotal = expectedItemsTotal + standardFee; // 5.878.000đ

      await waitFor(() => {
        expect(screen.getByText('Tổng tiền hàng:').parentElement!).toHaveTextContent(fmt(expectedItemsTotal));
        expect(screen.getByText('Phí vận chuyển:').parentElement!).toHaveTextContent(fmt(standardFee));
        expect(screen.getByText('Tổng cộng thanh toán:').parentElement!).toHaveTextContent(fmt(expectedOrderTotal));
        expect(screen.getByText('Tiết kiệm 1.000.000đ')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Thanh toán COD'));
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
      fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));

      await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
      const orderPayload = calls.find(c => c.url.endsWith('/orders'))!.body;

      // Promoted case test: POST /orders items are unchanged
      expect(orderPayload.items).toEqual([
        { sku_code: 'AX88D-RED-4U', quantity: 2 },
        { sku_code: 'A970-WHT-42', quantity: 1 },
      ]);
      // Promoted case test: POST /orders shipping_fee is unchanged
      expect(orderPayload.shipping_fee).toBe(standardFee);

      // Promoted case test: Σunit×qty + fee equals the displayed 'Tổng cộng thanh toán'
      const computedTotal =
        orderPayload.items.reduce((sum: number, it: { sku_code: string; quantity: number }) => {
          const cartLine = [promotedCartItem, unpromotedCartItem].find(c => c.skuCode === it.sku_code)!;
          return sum + getCartItemUnitPrice(cartLine, ALL_PRODUCTS)! * it.quantity;
        }, 0) + orderPayload.shipping_fee;
      expect(computedTotal).toBe(expectedOrderTotal);
    });
  });
});
