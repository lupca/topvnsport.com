// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));
const sendOtp = vi.hoisted(() => vi.fn());
const findOrCreateCustomer = vi.hoisted(() => vi.fn());
const createOrder = vi.hoisted(() => vi.fn());
vi.mock('../services/sportApi', () => ({ sportApi: { sendOtp, findOrCreateCustomer, createOrder } }));

const item: CartItem = {
  id: 'i1', productId: '341', skuCode: 'PRD-X-1', name: 'Áo Yonex', brand: 'Yonex', image: 'x.jpg',
  price: 1000, selectedWeight: 'S', selectedColor: 'Xanh', stringOption: null, tension: 10, quantity: 1
};

describe('CartModal khi tải sản phẩm lỗi', () => {
  afterEach(cleanup);

  it('hiện câu lỗi tải, khoá thanh toán, không kết luận "không còn trên cửa hàng", không gọi OTP/khách/đơn', () => {
    const store = configureStore({
      reducer: { appData: appDataReducer },
      preloadedState: {
        appData: { products: [], blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false, categoriesError: false, productsError: true }
      } as any
    });
    render(
      <Provider store={store}>
        <CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} />
      </Provider>
    );

    expect(screen.getByText('Không tải được danh sách sản phẩm. Vui lòng tải lại trang.')).toBeInTheDocument();
    expect(screen.queryByText(/không còn trên cửa hàng/)).toBeNull();
    const button = screen.getByRole('button', { name: /Tiến hành thanh toán/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(sendOtp).not.toHaveBeenCalled();
    expect(findOrCreateCustomer).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
