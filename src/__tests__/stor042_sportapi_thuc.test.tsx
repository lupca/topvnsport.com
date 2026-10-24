// @vitest-environment jsdom
// STOR-042 vòng 2 F1/F2: dùng sportApi THẬT + fetch giả trả body thật (không dựng err.body tay).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200 } from './fixtures/shippingQuote';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const SKU = 'SKU-REAL';
const product = {
  id: '1', name: 'Vợt', brand: 'Yonex', category: 'Vợt', price: 2000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 2000000, stock: 5 }],
} as any as Product;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Vợt', brand: 'Yonex', image: 'x.jpg', price: 2000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 1, tension: 11, stringOption: null,
};

type Reply = { status: number; body: unknown } | 'network';
let paymentsReply: Reply;
let urls: string[];

const j = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });

beforeEach(() => {
  sessionStorage.clear();
  urls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/oms/admin-units')) return j(200, url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY);
    if (url === '/api/oms/shipping-quote') return j(200, QUOTE_200);
    urls.push(url);
    if (url.endsWith('/verify-otp')) return j(200, { success: true, verification_token: 'vt' });
    if (url.endsWith('/orders')) return j(201, { id: 7, order_number: 'DH-7', total_amount: 2030000, shipping_fee: 30000 });
    if (url.endsWith('/payments')) {
      if (paymentsReply === 'network') throw new TypeError('Failed to fetch');
      return j(paymentsReply.status, paymentsReply.body);
    }
    return j(200, { success: true });
  }));
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function placeSepayOrder() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
  await pickAdminUnits();
  await waitFor(() => expect(screen.getByRole('button', { name: /Thanh toán SePay/ })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay/ }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await screen.findByText(/Chưa mở được trang thanh toán:/); // 409 là lỗi cuối (STOR-048): không còn nút 'Thanh toán lại'
}

describe('STOR-042 F1 với sportApi thật', () => {
  it('payments 502 {"detail":"upstream_unreachable"}: câu tiếng Việt cố định, không lộ chữ server', async () => {
    paymentsReply = { status: 502, body: { detail: 'upstream_unreachable' } };
    await placeSepayOrder();
    const alertEl = screen.getByRole('alert');
    expect(alertEl.textContent).toContain('Đã tạo đơn DH-7. Chưa mở được trang thanh toán: Hệ thống đặt hàng đang tạm thời không phản hồi.');
    expect(alertEl.textContent).not.toContain('upstream_unreachable');
    expect(urls.filter(u => u.endsWith('/orders'))).toHaveLength(1);
  });
  it('payments 4xx {"code","message"}: hiện đúng lời OMS', async () => {
    paymentsReply = { status: 409, body: { code: 'SEPAY_MAINTENANCE', message: 'Cổng SePay đang bảo trì' } };
    await placeSepayOrder();
    expect(screen.getByRole('alert').textContent).toContain('Chưa mở được trang thanh toán: Cổng SePay đang bảo trì');
  });
  it('payments mất mạng: câu mạng tiếng Việt của sportApi; "Thanh toán lại" không gọi /orders', async () => {
    paymentsReply = 'network';
    await placeSepayOrder();
    expect(screen.getByRole('alert').textContent).toContain('Không kết nối được tới hệ thống đặt hàng');
    paymentsReply = { status: 200, body: { action: 'https://pay.example/c', fields: { a: 'b' } } };
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    await waitFor(() => expect(urls.filter(u => u.endsWith('/payments'))).toHaveLength(2));
    expect(urls.filter(u => u.endsWith('/orders'))).toHaveLength(1);
  });
});
