// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import { QUOTE_200 } from './fixtures/shippingQuote';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

// [S1] mục (D): body NGUYÊN VĂN OMS /public/checkout/payments.
const MSG_COD = 'Đơn đã tạo vận đơn thu hộ (COD); không thể thanh toán trực tuyến. Vui lòng trả tiền khi nhận hàng.';
const MSG_FULL = 'Đơn hàng đã thu đủ tiền, không cần thanh toán thêm.';
const E409_COD = { code: 'COD_PAYMENT_BLOCKED_SHIPMENT_ACTIVE', message: MSG_COD, detail: { code: 'COD_PAYMENT_BLOCKED_SHIPMENT_ACTIVE', message: MSG_COD } };
const E409_FULL = { code: 'ORDER_ALREADY_FULLY_COLLECTED', message: MSG_FULL, detail: { code: 'ORDER_ALREADY_FULLY_COLLECTED', message: MSG_FULL } };
const E400 = { detail: 'Đơn hàng đã được thanh toán.' };
const E404 = { detail: 'Đơn hàng không tồn tại.' };
const E503 = { code: 'SHIPPING_UNAVAILABLE', message: 'Cổng thanh toán đang bảo trì.', detail: { code: 'SHIPPING_UNAVAILABLE', message: 'Cổng thanh toán đang bảo trì.' } };

const SKU = 'SKU-048';
const product = {
  id: '1', name: 'Vợt', brand: 'Yonex', category: 'Vợt', price: 1000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 1000000, stock: 5 }],
} as unknown as Product;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Vợt', brand: 'Yonex', image: 'x.jpg', price: 1000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', stringOption: null, tension: 11, quantity: 1
};

type PayReply = { status: number; body: unknown } | 'network';
let payReplies: PayReply[];
const res = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json, text: async () => JSON.stringify(json) });

beforeEach(() => {
  sessionStorage.clear();
  alertMock.mockClear();
  payReplies = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/oms/admin-units')) return res(200, url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY);
    if (url === '/api/oms/shipping-quote') return res(200, QUOTE_200);
    if (url.endsWith('/verify-otp')) return res(200, { success: true, verification_token: 'vt' });
    if (url.endsWith('/orders')) return res(200, { id: 9, order_number: 'DH-9' });
    if (url.endsWith('/payments')) {
      const r = payReplies.shift() ?? { status: 200, body: { action: 'https://sepay.example/pay', fields: { a: 'b' } } };
      if (r === 'network') throw new TypeError('Failed to fetch');
      return res(r.status, r.body);
    }
    return res(200, { success: true });
  }));
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mount(open = true) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  const el = (o: boolean) => (
    <Provider store={store}><CartModal isOpen={o} onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>
  );
  const r = render(el(open));
  return { setOpen: (o: boolean) => r.rerender(el(o)) };
}

// Đặt SePay đơn DH-9 rồi /payments trả `reply` -> bước 3.
async function toStep3(reply: PayReply) {
  payReplies.push(reply);
  const m = mount();
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
  await pickAdminUnits();
  await waitFor(() => expect(screen.getByRole('button', { name: /Thanh toán SePay QR/ })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay QR/ }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await screen.findByText(/Chưa mở được trang thanh toán:/);
  return m;
}

const FINAL: [string, number, unknown, string][] = [
  ['400', 400, E400, 'Đơn hàng đã được thanh toán.'],
  ['404', 404, E404, 'Đơn hàng không tồn tại.'],
  ['409 COD_PAYMENT_BLOCKED_SHIPMENT_ACTIVE', 409, E409_COD, MSG_COD],
  ['409 ORDER_ALREADY_FULLY_COLLECTED', 409, E409_FULL, MSG_FULL],
];

describe('STOR-048 [S2] lỗi cuối /payments ở bước 3', () => {
  it.each(FINAL)('%s: không nút "Thanh toán lại", không ghi đơn chờ, lời OMS hiện, có "Quay về giỏ hàng", không popup', async (_n, status, body, text) => {
    await toStep3({ status, body });
    expect(screen.queryByRole('button', { name: 'Thanh toán lại' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('pending_sepay_order')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(`Chưa mở được trang thanh toán: ${text}`);
    expect(screen.getByRole('button', { name: 'Quay về giỏ hàng' })).toBeInTheDocument();
    expect(alertMock).not.toHaveBeenCalled();
  });
});

describe('STOR-048 [S2] lỗi tạm vẫn cho thanh toán lại', () => {
  it.each([['503', { status: 503, body: E503 } as PayReply], ['mạng', 'network' as PayReply]])('%s: có nút "Thanh toán lại" và ghi đơn chờ', async (_n, reply) => {
    await toStep3(reply);
    expect(screen.getByRole('button', { name: 'Thanh toán lại' })).toBeInTheDocument();
    expect(sessionStorage.getItem('pending_sepay_order')).not.toBeNull();
  });
});

describe('STOR-048 [S2] dải nhắc bước 1', () => {
  it('bấm "Thanh toán lại" nhận 409: dải biến mất, popup lời OMS, đơn chờ xoá', async () => {
    const { setOpen } = await toStep3({ status: 503, body: E503 });
    setOpen(false);
    setOpen(true);
    expect(screen.getByText(/Đơn DH-9 chưa thanh toán/)).toBeInTheDocument();
    payReplies.push({ status: 409, body: E409_FULL });
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(MSG_FULL));
    expect(screen.queryByText(/chưa thanh toán/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('pending_sepay_order')).toBeNull();
  });
});
