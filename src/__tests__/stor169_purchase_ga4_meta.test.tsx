// @vitest-environment jsdom
// STOR-169: GA4/Meta purchase after the real checkout, from the 201 body (spec a4918ed8 O1, c4c05162).
// Real CartModal and real src/lib/tracking.ts; only fetch, window.gtag and window.fbq are stubbed.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { purchase } from '../lib/tracking';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_V_Q1, QUOTE_V_Q7, ORDER_201_O1, ORDER_201_O1_VOUCHER, ORDER_201_FULL_WAIVER } from './fixtures/shippingQuote';

const SKU = 'TVS-AO-01-M';
const META_KEYS = ['value', 'currency', 'content_ids', 'contents', 'content_type'];
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
// Cart: 2 x 100.000đ = 200.000đ of goods, as in O1.
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 2, tension: 10, stringOption: null,
};

let gtag: ReturnType<typeof vi.fn>;
let fbq: ReturnType<typeof vi.fn>;

const respond = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const ga4Purchase = () => gtag.mock.calls.find(c => c[0] === 'event' && c[1] === 'purchase')?.[2];
const metaPurchase = () => fbq.mock.calls.find(c => c[0] === 'track' && c[1] === 'Purchase')?.[2];

function stubFetch(quote: unknown, order: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/oms/admin-units')) return respond(200, url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY);
    if (url === '/api/oms/shipping-quote') return respond(200, quote);
    if (url.endsWith('/verify-otp')) return respond(200, { success: true, verification_token: 'vt-169' });
    if (url.endsWith('/orders')) return respond(201, order);
    return respond(200, { success: true });
  }));
}

// Walks step 1 -> OTP -> 201 and waits for the GA4 purchase event.
async function placeOrder(order: unknown, quote: unknown = QUOTE_V_Q1) {
  stubFetch(quote, order);
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await pickAdminUnits();
  await waitFor(() => expect((screen.getByText('Giao hàng chuẩn').closest('button') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(ga4Purchase()).toBeDefined());
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); // once-per-order guard: every test reuses order number DH-O1
  gtag = vi.fn(); fbq = vi.fn();
  window.gtag = gtag; window.fbq = fbq;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('STOR-169 fixture', () => {
  it('ORDER_201_O1 keeps the O1 amount keys of spec a4918ed8, in wire form', () => {
    const wire = JSON.stringify(ORDER_201_O1);
    expect(wire).toContain('"total_amount":"248000.00","shipping_fee":"48000.00",');
    expect(wire).toContain('"delivery_option":"STANDARD","shipping_service_code":"SCN","shipping_fee_source":"SERVER_QUOTE","shipping_fee_original":"78000.00","shipping_discount":"30000.00","shipping_voucher":null}');
  });

  it('ORDER_201_O1 adds only id and order_number to the spec keys', () => {
    expect(Object.keys(ORDER_201_O1)).toEqual([
      'id', 'order_number', 'total_amount', 'shipping_fee', 'delivery_option', 'shipping_service_code',
      'shipping_fee_source', 'shipping_fee_original', 'shipping_discount', 'shipping_voucher',
    ]);
  });
});

describe('STOR-169 O1 (fee paid 48000, original 78000, discount 30000)', () => {
  it('GA4 purchase value is 248000', async () => {
    await placeOrder(ORDER_201_O1);
    expect(ga4Purchase().value).toBe(248000);
  });

  it('GA4 purchase shipping is 48000', async () => {
    await placeOrder(ORDER_201_O1);
    expect(ga4Purchase().shipping).toBe(48000);
  });

  it('Meta Purchase value is 248000', async () => {
    await placeOrder(ORDER_201_O1);
    expect(metaPurchase().value).toBe(248000);
  });

  it('Meta params have exactly the five keys of the current payload', async () => {
    await placeOrder(ORDER_201_O1);
    expect(Object.keys(metaPurchase())).toEqual(META_KEYS);
  });
});

describe('STOR-169 other 201 bodies', () => {
  it('populated shipping_voucher (synthetic): Meta params keep the five keys', async () => {
    await placeOrder(ORDER_201_O1_VOUCHER);
    expect(Object.keys(metaPurchase())).toEqual(META_KEYS);
  });

  it('full waiver (synthetic, fee 0.00, quote Q7): GA4 purchase shipping is 0', async () => {
    await placeOrder(ORDER_201_FULL_WAIVER, QUOTE_V_Q7);
    expect(ga4Purchase().shipping).toBe(0);
  });

  it('shipping_fee null: GA4 params have no shipping key', async () => {
    await placeOrder({ ...ORDER_201_O1, shipping_fee: null });
    expect(ga4Purchase()).not.toHaveProperty('shipping');
  });

  it('shipping_fee NaN: GA4 params have no shipping key', async () => {
    await placeOrder({ ...ORDER_201_O1, shipping_fee: 'NaN' });
    expect(ga4Purchase()).not.toHaveProperty('shipping');
  });

  // CartModal already turns a non-finite fee into undefined, so only a direct call reaches the guard in tracking.ts.
  it('purchase() given a NaN shipping: GA4 params have no shipping key', () => {
    purchase({ order_number: 'DH-NAN', value: 1, shipping: NaN, items: [] });
    expect(ga4Purchase()).not.toHaveProperty('shipping');
  });
});
