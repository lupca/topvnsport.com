// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import { getAdminUnitsFromFixture, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200_FALLBACK } from './fixtures/shippingQuote';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));
const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const createOrderMock = vi.fn();
const sepayMock = vi.fn();
vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: (...a: unknown[]) => sendOtpMock(...a),
    verifyOtp: (...a: unknown[]) => verifyOtpMock(...a),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: async () => QUOTE_200_FALLBACK,
    createSepayCheckout: (...a: unknown[]) => sepayMock(...a)
  }
}));

const mkProduct = (id: string, sku: string) => ({
  id, name: `Vợt ${id}`, brand: 'Yonex', category: 'Vợt', price: 1000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: sku, price: 1000000, stock: 5 }],
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }]
}) as unknown as Product;
const mkItem = (id: string, sku: string): CartItem => ({
  id: `i${id}`, productId: id, skuCode: sku, name: `Vợt ${id}`, brand: 'Yonex', image: 'x.jpg', price: 1000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', stringOption: null, tension: 11, quantity: 1
});
const OLD = mkItem('1', 'SKU-1');
const NEW = mkItem('2', 'SKU-2');
const clearCart = vi.fn();

function mount(items: CartItem[]) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [mkProduct('1', 'SKU-1'), mkProduct('2', 'SKU-2')], branches: [], stringOptions: [], categories: [], isLoading: false } } as any
  });
  const el = (open: boolean, list: CartItem[]) => (
    <Provider store={store}>
      <CartModal isOpen={open} onClose={() => {}} cartItems={list} onRemoveItem={() => {}} onClearCart={clearCart} />
    </Provider>
  );
  const r = render(el(true, items));
  return { setCart: (open: boolean, list: CartItem[]) => r.rerender(el(open, list)) };
}

// Đặt SePay thành công đơn DH-9 nhưng /payments lỗi -> màn đơn chờ (giỏ đã xoá).
async function toPendingScreen() {
  sepayMock.mockRejectedValueOnce(Object.assign(new Error('Cổng SePay đang bảo trì'), { kind: 'http', status: 400 }));
  const m = mount([OLD]);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
  await pickAdminUnits();
  await waitFor(() => expect(screen.getByRole('button', { name: /Thanh toán SePay QR/ })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay QR/ }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await screen.findByRole('button', { name: 'Thanh toán lại' });
  return m;
}

beforeEach(() => {
  sessionStorage.clear();
  [sendOtpMock, verifyOtpMock, createOrderMock, sepayMock, clearCart].forEach(m => m.mockReset());
  sendOtpMock.mockResolvedValue({ success: true });
  verifyOtpMock.mockResolvedValue({ success: true, verification_token: 'tok' });
  createOrderMock.mockResolvedValue({ id: 1, order_number: 'DH-9', total_amount: 1030000, shipping_fee: 30000 });
  sepayMock.mockResolvedValue({ action: 'https://pay.example/c', fields: { a: 'b' } });
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('STOR-046: đơn SePay chờ không che giỏ mới', () => {
  it('đ1: màn đơn chờ có "Quay về giỏ hàng": về bước 1, giữ giỏ hiện tại, đơn chờ vẫn nhớ', async () => {
    const { setCart } = await toPendingScreen();
    const cleared = clearCart.mock.calls.length;
    setCart(true, [NEW]);
    fireEvent.click(screen.getByRole('button', { name: 'Quay về giỏ hàng' }));
    expect(screen.getByText('Vợt 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tiến hành thanh toán/ })).toBeInTheDocument();
    expect(clearCart.mock.calls.length).toBe(cleared);
    expect(sessionStorage.getItem('pending_sepay_order')).not.toBeNull();
  });

  it('đ2+đ3 (kịch bản Opus): đóng giỏ, thêm món mới, mở lại -> bước 1 với món mới + dải "Đơn DH-9 chưa thanh toán"', async () => {
    const { setCart } = await toPendingScreen();
    setCart(false, []);
    setCart(true, [NEW]);
    expect(screen.getByText('Vợt 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tiến hành thanh toán/ })).toBeInTheDocument();
    expect(screen.queryByText(/Chưa mở được trang thanh toán/)).not.toBeInTheDocument();
    expect(screen.getByText(/Đơn DH-9 chưa thanh toán/)).toBeInTheDocument();
  });

  it('đ2: dải nhắc "Thanh toán lại" gọi payments đúng mã, không /orders, không xoá giỏ mới; thành công xoá đơn chờ', async () => {
    const { setCart } = await toPendingScreen();
    setCart(false, []);
    setCart(true, [NEW]);
    const cleared = clearCart.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    await waitFor(() => expect(sepayMock).toHaveBeenLastCalledWith('DH-9'));
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(clearCart.mock.calls.length).toBe(cleared);
    await waitFor(() => expect(sessionStorage.getItem('pending_sepay_order')).toBeNull());
  });

  it('đ2: dải nhắc thanh toán lại vẫn lỗi -> báo lỗi trong dải, đơn chờ còn', async () => {
    const { setCart } = await toPendingScreen();
    setCart(false, []);
    setCart(true, [NEW]);
    sepayMock.mockRejectedValueOnce(Object.assign(new Error('Hết thời gian chờ'), { kind: 'timeout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    expect(await screen.findByText(/Hết thời gian chờ/)).toBeInTheDocument();
    expect(sessionStorage.getItem('pending_sepay_order')).not.toBeNull();
  });

  it('đ2: nút bỏ nhắc xoá đơn chờ và dải biến mất, giỏ mới còn', async () => {
    const { setCart } = await toPendingScreen();
    setCart(false, []);
    setCart(true, [NEW]);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ nhắc' }));
    expect(sessionStorage.getItem('pending_sepay_order')).toBeNull();
    expect(screen.queryByText(/chưa thanh toán/)).not.toBeInTheDocument();
    expect(screen.getByText('Vợt 2')).toBeInTheDocument();
    setCart(false, [NEW]);
    setCart(true, [NEW]);
    expect(screen.queryByText(/chưa thanh toán/)).not.toBeInTheDocument();
  });

  it('đ4: mở lại từ đơn đã khôi phục rồi bấm tiếp tục mua sắm không làm rỗng giỏ hiện tại', async () => {
    const { setCart } = await toPendingScreen();
    setCart(false, []);
    setCart(true, [NEW]);
    const cleared = clearCart.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(clearCart.mock.calls.length).toBe(cleared);
    expect(screen.queryByRole('button', { name: 'Hoàn thành mua sắm' })).not.toBeInTheDocument();
  });

  it('khách bấm "Hoàn thành mua sắm" ở màn đơn chờ vừa tạo: bỏ đơn chờ', async () => {
    await toPendingScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành mua sắm' }));
    expect(sessionStorage.getItem('pending_sepay_order')).toBeNull();
  });
});
