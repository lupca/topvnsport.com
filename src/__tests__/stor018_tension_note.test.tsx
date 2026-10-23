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

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({
  popupService: {
    alert: (...args: unknown[]) => alertMock(...args)
  }
}));

const sendOtpMock = vi.fn().mockResolvedValue(undefined);
const verifyOtpMock = vi.fn().mockResolvedValue({ success: true, verification_token: 'tok-123' });
const createOrderMock = vi.fn().mockResolvedValue({ id: 1, order_number: 'DH-1' });

vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: (...args: unknown[]) => sendOtpMock(...args),
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    createOrder: (...args: unknown[]) => createOrderMock(...args),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: async () => QUOTE_200_FALLBACK,
    createSepayCheckout: vi.fn()
  }
}));

// Sản phẩm 341 "thật" đã tải vào store -- CHỈ có biến thể DAZZLING BLUE/S còn
// bán (mô phỏng đúng F3: PIM có thể đổi/xoá tổ hợp sau khi khách đã thêm giỏ).
const product341: Product = {
  id: '341',
  name: 'Áo Yonex Collection',
  brand: 'Yonex',
  category: 'Áo cầu lông',
  price: 145000,
  image: 'https://example.com/341.jpg',
  specs: {},
  description: '',
  stock: 10,
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['DAZZLING BLUE'] },
    { tier_index: 2, name: 'Size', options: ['S'] }
  ],
  variants: [
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S', price: 175000, stock: 10 },
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'S', sku_code: 'SKU-B', price: 175000, stock: 10 },
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'S', sku_code: 'SKU-C', price: 175000, stock: 10 }
  ]
};

function makeItem(overrides: Partial<CartItem>): CartItem {
  return {
    id: '341-item',
    productId: '341',
    skuCode: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S',
    name: 'Áo Yonex Collection',
    brand: 'Yonex',
    image: 'https://example.com/341.jpg',
    price: 175000,
    selectedWeight: 'S',
    selectedColor: 'DAZZLING BLUE',
    stringOption: null,
    tension: 10.5,
    quantity: 1,
    ...overrides
  };
}

function renderCartModal(cartItems: CartItem[], products: Product[] = [product341], isLoading = false) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: {
      appData: { products, branches: [], stringOptions: [], categories: [], isLoading }
    } as any
  });

  return render(
    <Provider store={store}>
      <CartModal isOpen={true} onClose={() => {}} cartItems={cartItems} onRemoveItem={() => {}} onClearCart={() => {}} />
    </Provider>
  );
}

function getCheckoutButton() {
  return screen.getByRole('button', { name: /Tiến hành thanh toán|Đang tải/ });
}

async function fillCheckoutForm() {
  fireEvent.click(getCheckoutButton());
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Test' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Test' } });
  await pickAdminUnits();
  // Chọn COD để nút submit hiển thị "Xác nhận đặt hàng" và tránh nhánh
  // redirect SePay (không liên quan tới việc chặn SKU không hợp lệ).
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
}

async function driveToOtpSuccess() {
  await fillCheckoutForm();
  await waitFor(() => expect(sendOtpMock).toHaveBeenCalled());
  const otpInput = await screen.findByPlaceholderText('Nhập 6 số OTP');
  fireEvent.change(otpInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
}

const exbolt = { id: 'exbolt', name: 'Exbolt 65', price: 0 } as any;
const bg80 = { id: 'bg80', name: 'BG80', price: 0 } as any;

const BASE = 'Đơn web - Giao tiêu chuẩn | COD';

async function orderNote() {
  await driveToOtpSuccess();
  await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
  return createOrderMock.mock.calls[0][0];
}

describe('STOR-018 -- độ căng của món đan cước đi vào note đơn OMS', () => {
  beforeEach(() => {
    createOrderMock.mockClear();
    sendOtpMock.mockClear();
  });
  afterEach(() => cleanup());

  it('một món đan cước -> note có đoạn Đan cước <sku>: <cước> <kg> Kg', async () => {
    renderCartModal([makeItem({ stringOption: exbolt, tension: 10.5 })]);
    const payload = await orderNote();
    expect(payload.note).toBe(`${BASE} | Đan cước PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S: Exbolt 65 10.5 Kg`);
  });

  it('hai món đan cước khác độ căng + một món không đan -> đúng hai đoạn theo thứ tự giỏ', async () => {
    renderCartModal([
      makeItem({ id: 'a', stringOption: exbolt, tension: 9 }),
      makeItem({ id: 'b', skuCode: 'SKU-B', stringOption: null, tension: 10.5 }),
      makeItem({ id: 'c', skuCode: 'SKU-C', stringOption: bg80, tension: 13 })
    ]);
    const payload = await orderNote();
    expect(payload.note).toBe(
      `${BASE} | Đan cước PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S: Exbolt 65 9 Kg | Đan cước SKU-C: BG80 13 Kg`
    );
  });

  it('giỏ không món đan cước -> note y như cũ, items chỉ {sku_code, quantity}', async () => {
    renderCartModal([makeItem({})]);
    const payload = await orderNote();
    expect(payload.note).toBe(BASE);
    expect(payload.items).toEqual([{ sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S', quantity: 1 }]);
  });

  it('món đan cước vẫn chỉ gửi items {sku_code, quantity}', async () => {
    renderCartModal([makeItem({ stringOption: exbolt, tension: 13 })]);
    const payload = await orderNote();
    expect(payload.items).toEqual([{ sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S', quantity: 1 }]);
  });
});
