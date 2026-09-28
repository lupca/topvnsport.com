// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CartModal, { CartItem } from '../components/CartModal';

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

// SKU bịa dạng cũ (`SKU-<id>-...`) sót lại trong localStorage của khách trước
// khi lỗi được sửa -- KHÔNG phải SKU thật (SKU thật luôn "PRD-"/"SP-").
const staleItem: CartItem = {
  id: '341-2XL-DAZZLING BLUE',
  productId: '341',
  skuCode: 'SKU-341-2XL-DAZZLING-BLUE',
  name: 'Áo Yonex Collection',
  brand: 'Yonex',
  image: 'https://example.com/341.jpg',
  price: 175000,
  selectedWeight: '2XL',
  selectedColor: 'DAZZLING BLUE',
  stringOption: null,
  tension: 10.5,
  quantity: 1
};

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

describe('CartModal -- SKU không hợp lệ trong giỏ hàng cũ', () => {
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

  it('giữ hiển thị món hàng SKU bịa kèm cảnh báo, không tự xoá', () => {
    render(
      <CartModal
        isOpen={true}
        onClose={() => {}}
        cartItems={[staleItem]}
        onRemoveItem={() => {}}
        onClearCart={() => {}}
      />
    );

    // Món hàng vẫn còn trong danh sách (không bị xoá im lặng)
    expect(screen.getByText('Áo Yonex Collection')).toBeInTheDocument();
    // Câu cảnh báo verbatim
    expect(
      screen.getByText('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')
    ).toBeInTheDocument();
  });

  it('chặn thanh toán tới khi khách xoá/chọn lại -- không gửi SKU bịa lên OMS', async () => {
    render(
      <CartModal
        isOpen={true}
        onClose={() => {}}
        cartItems={[staleItem]}
        onRemoveItem={() => {}}
        onClearCart={() => {}}
      />
    );

    await fillCheckoutForm();
    // Bước 1: submit không token -> gửi OTP -> mở modal OTP
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledWith('0987654321'));

    const otpInput = await screen.findByPlaceholderText('Nhập 6 số OTP');
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));

    // Sau khi có token, hàng đợi chạm nhánh chặn SKU bịa trước khi tạo đơn
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(
      '"Áo Yonex Collection": Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.'
    ));

    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('không cảnh báo/không chặn khi SKU là SKU thật hợp lệ', async () => {
    const validItem: CartItem = { ...staleItem, skuCode: 'PRD-AO-YONEX-COLLECTION-8T3G-DAZZLING-BLUE-S' };
    render(
      <CartModal
        isOpen={true}
        onClose={() => {}}
        cartItems={[validItem]}
        onRemoveItem={() => {}}
        onClearCart={() => {}}
      />
    );

    expect(
      screen.queryByText('Phân loại của sản phẩm này đã thay đổi. Vui lòng xoá và chọn lại.')
    ).not.toBeInTheDocument();

    await fillCheckoutForm();
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalled());

    const otpInput = await screen.findByPlaceholderText('Nhập 6 số OTP');
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));

    await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
    expect(alertMock).not.toHaveBeenCalledWith(expect.stringContaining('đã thay đổi'));
  });
});
