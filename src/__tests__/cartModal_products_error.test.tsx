// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import appDataReducer, { fetchAppData } from '../features/appData/appDataSlice';
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

  it('F-1: submit thẳng form thanh toán khi productsError=true (không qua nút đã khoá) -> không gọi sendOtp/findOrCreateCustomer/createOrder', () => {
    const product = {
      id: '341', name: 'Áo Yonex', brand: 'Yonex', category: 'Áo', price: 1000, image: 'x.jpg', specs: {}, description: '',
      reviews: [], stock: 5, variants: [{ sku_code: 'PRD-X-1', price: 1000, stock: 5 }]
    };
    const store = configureStore({
      reducer: { appData: appDataReducer },
      preloadedState: {
        appData: { products: [product], blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false, categoriesError: false, productsError: false }
      } as any
    });
    render(
      <Provider store={store}>
        <CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} />
      </Provider>
    );
    // Vào bước form khi dữ liệu còn tốt, điền đủ, RỒI mới để tải lỗi (giữ nguyên products để chỉ còn chốt productsError chặn).
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Test' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Test' } });
    fireEvent.click(screen.getByText('Thanh toán COD'));
    act(() => {
      store.dispatch(
        fetchAppData.fulfilled(
          { products: [product], productsError: true, categories: [], categoriesError: false, blogs: [], branches: [], stringOptions: [] } as any,
          'req'
        )
      );
    });
    expect(store.getState().appData.productsError).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    expect(sendOtp).not.toHaveBeenCalled();
    expect(findOrCreateCustomer).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
