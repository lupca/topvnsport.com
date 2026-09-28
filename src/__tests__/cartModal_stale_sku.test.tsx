// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
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
const findOrCreateCustomerMock = vi.fn().mockResolvedValue(1);
const getOrCreateStorefrontChannelIdMock = vi.fn().mockResolvedValue(1);
const createOrderMock = vi.fn().mockResolvedValue({ id: 1, order_number: 'DH-1' });

vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: (...args: unknown[]) => sendOtpMock(...args),
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    findOrCreateCustomer: (...args: unknown[]) => findOrCreateCustomerMock(...args),
    getOrCreateStorefrontChannelId: (...args: unknown[]) => getOrCreateStorefrontChannelIdMock(...args),
    createOrder: (...args: unknown[]) => createOrderMock(...args),
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
  reviews: [],
  stock: 10,
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['DAZZLING BLUE'] },
    { tier_index: 2, name: 'Size', options: ['S'] }
  ],
  variants: [
    { tier_1_option: 'DAZZLING BLUE', tier_2_option: 'S', sku_code: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S', price: 175000, stock: 10 }
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

function renderCartModal(cartItems: CartItem[], products: Product[] = [product341]) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: {
      appData: { products, blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false }
    } as any
  });

  return render(
    <Provider store={store}>
      <CartModal isOpen={true} onClose={() => {}} cartItems={cartItems} onRemoveItem={() => {}} onClearCart={() => {}} />
    </Provider>
  );
}

async function fillCheckoutForm() {
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Test' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Test' } });
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

describe('CartModal -- món hàng SKU không hợp lệ (F3: khớp theo biến thể thật của đúng sản phẩm, không chỉ regex/rỗng)', () => {
  beforeEach(() => {
    alertMock.mockClear();
    sendOtpMock.mockClear();
    verifyOtpMock.mockClear();
    findOrCreateCustomerMock.mockClear();
    getOrCreateStorefrontChannelIdMock.mockClear();
    createOrderMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('SKU bịa dạng cũ SKU-<id>-... -- giữ hiển thị món hàng kèm cảnh báo, không tự xoá', () => {
    const staleItem = makeItem({ skuCode: 'SKU-341-2XL-DAZZLING-BLUE' });
    renderCartModal([staleItem]);

    expect(screen.getByText('Áo Yonex Collection')).toBeInTheDocument();
    expect(screen.getByText('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')).toBeInTheDocument();
  });

  it('F3: SKU của biến thể đã bị xoá/đổi trên PIM (PRD-AO-DELETED-VARIANT, không khớp regex SKU-<id>-) -- vẫn bị coi là không hợp lệ', () => {
    const deletedVariantItem = makeItem({ skuCode: 'PRD-AO-DELETED-VARIANT' });
    renderCartModal([deletedVariantItem]);

    expect(screen.getByText('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')).toBeInTheDocument();
  });

  it('sản phẩm của món hàng không còn trong dữ liệu đã tải -- không hợp lệ, không đoán', () => {
    const orphanItem = makeItem({ productId: 'khong-ton-tai' });
    renderCartModal([orphanItem], [product341]);

    expect(screen.getByText('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')).toBeInTheDocument();
  });

  it('SKU thật khớp đúng biến thể của sản phẩm -- không cảnh báo', () => {
    renderCartModal([makeItem({})]);
    expect(
      screen.queryByText('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')
    ).not.toBeInTheDocument();
  });

  it('F3 + F8: PRD-AO-DELETED-VARIANT của sp 341 -- chặn thanh toán, câu báo NGUYÊN VĂN không ghép tên sản phẩm, createOrder không được gọi', async () => {
    const deletedVariantItem = makeItem({ skuCode: 'PRD-AO-DELETED-VARIANT' });
    renderCartModal([deletedVariantItem]);

    await driveToOtpSuccess();

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')
    );
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('không chặn/không gọi sai khi SKU là SKU thật hợp lệ', async () => {
    renderCartModal([makeItem({})]);

    await driveToOtpSuccess();

    await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
    expect(alertMock).not.toHaveBeenCalledWith(expect.stringContaining('đã thay đổi'));
  });
});
