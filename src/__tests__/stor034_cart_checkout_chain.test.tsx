// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const SKU = 'SKU-VOT-1';
const product: Product = {
  id: '1', name: 'Vợt', brand: 'Yonex', category: 'Vợt', price: 2000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 2000000, stock: 5 }],
} as any;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Vợt', brand: 'Yonex', image: 'x.jpg', price: 2000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 2, tension: 11,
  stringOption: { id: 's', name: 'BG80', price: 0 } as any,
};

let calls: { url: string; body: any }[];
const onClearCart = vi.fn();

beforeEach(() => {
  calls = [];
  onClearCart.mockClear();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    const json = url.endsWith('/verify-otp') ? { success: true, verification_token: 'vt' }
      : url.endsWith('/orders') ? { id: 7, order_number: 'DH-7' }
      : url.endsWith('/payments') ? { action: 'https://sepay.example/pay', fields: { a: 'b' } }
      : { success: true };
    return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
  }));
  // jsdom does not implement form.submit
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function run(payment: 'COD' | 'SePay') {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={onClearCart} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: ' Nguyễn Test ' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
  fireEvent.change(screen.getByPlaceholderText('Nhập phường/xã'), { target: { value: 'Phường A' } });
  fireEvent.change(screen.getByPlaceholderText('Nhập tỉnh/thành phố'), { target: { value: 'Tỉnh B' } });
  fireEvent.click(screen.getByText(payment === 'COD' ? 'Thanh toán COD' : 'SePay QR Code'));
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
}

describe('STOR-034 CartModal -> /api/oms/checkout chain', () => {
  it('COD: send-otp -> verify-otp -> orders, no payments; customer in body, no customer_id/channel_id; note format; cart cleared', async () => {
    await run('COD');
    expect(calls.map(c => c.url)).toEqual(['/api/oms/checkout/send-otp', '/api/oms/checkout/verify-otp', '/api/oms/checkout/orders']);
    const order = calls[2].body;
    expect(order.customer).toEqual({ name: 'Nguyễn Test', phone: '0987654321', address: 'Số 1, Phường A, Tỉnh B' });
    expect(order).not.toHaveProperty('customer_id');
    expect(order).not.toHaveProperty('channel_id');
    expect(order.note).toBe(`Đơn web - Giao tiêu chuẩn | COD | Đan cước ${SKU}: BG80 11 Kg`);
    expect(order.items).toEqual([{ sku_code: SKU, quantity: 2 }]);
    expect(order.verification_token).toBe('vt');
    await waitFor(() => expect(onClearCart).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/DH-7/)).toBeInTheDocument(); // step 3
  });

  it('SePay: payments follows orders with {order_number}; every URL under /api/oms/checkout/', async () => {
    await run('SePay');
    await waitFor(() => expect(calls).toHaveLength(4));
    expect(calls.map(c => c.url)).toEqual(['/api/oms/checkout/send-otp', '/api/oms/checkout/verify-otp', '/api/oms/checkout/orders', '/api/oms/checkout/payments']);
    expect(calls[3].body).toEqual({ order_number: 'DH-7' });
    expect(calls[2].body.note).toBe(`Đơn web - Giao tiêu chuẩn | SePay QR Code | Đan cước ${SKU}: BG80 11 Kg`);
    for (const c of calls) expect(c.url.startsWith('/api/oms/checkout/')).toBe(true);
    expect(onClearCart).toHaveBeenCalled();
  });
});
