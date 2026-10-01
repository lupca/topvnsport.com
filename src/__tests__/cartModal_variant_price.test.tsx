// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));
vi.mock('../services/sportApi', () => ({ sportApi: {} }));

const product = {
  id: '337', name: 'Vợt', brand: 'Lining', category: 'Vợt', price: 900000, image: 'x.jpg', specs: {}, description: '',
  reviews: [], stock: 5,
  variants: [
    { tier_1_option: 'A', tier_2_option: null, sku_code: 'SKU-A', price: 900000, stock: 5 },
    { tier_1_option: 'B', tier_2_option: null, sku_code: 'SKU-B', price: 1300000, stock: 5 },
    { tier_1_option: 'C', tier_2_option: null, sku_code: 'SKU-C', price: 0, stock: 5 }
  ]
};
// price lưu localStorage CŨ (900000) khác giá biến thể đã tải (1300000).
const stale = (sku: string): CartItem => ({
  id: 'i-' + sku, productId: '337', skuCode: sku, name: 'Vợt', brand: 'Lining', image: 'x.jpg', price: 900000,
  selectedWeight: 'Tiêu chuẩn', selectedColor: 'B', stringOption: null, tension: 10, quantity: 2
});

function mount(items: CartItem[], app: Record<string, unknown> = {}) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: {
      appData: { products: [product], blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false, categoriesError: false, productsError: false, ...app }
    } as any
  });
  render(
    <Provider store={store}>
      <CartModal isOpen onClose={() => {}} cartItems={items} onRemoveItem={() => {}} onClearCart={() => {}} />
    </Provider>
  );
}
const fmt = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

describe('CartModal giá theo biến thể đã tải', () => {
  afterEach(cleanup);

  it('dòng hiện số tiền tính từ giá biến thể đã tải, không phải CartItem.price lưu localStorage', () => {
    mount([stale('SKU-B')]);
    expect(screen.getAllByText(fmt(2600000)).length).toBeGreaterThan(0);
    expect(screen.queryByText(fmt(1800000))).toBeNull();
  });

  it('tổng tiền hàng tính từ giá biến thể đã tải, không phải CartItem.price lưu', () => {
    mount([stale('SKU-B')]);
    expect(screen.getByText('Tổng tiền hàng:').parentElement!.textContent).toContain(fmt(2600000));
  });

  it("dòng 'no_price' hiện câu người bán và khoá nút thanh toán", () => {
    mount([stale('SKU-C')]);
    expect(screen.getByText('Phân loại này hiện chưa có giá. Vui lòng xoá và chọn lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tiến hành thanh toán/ })).toBeDisabled();
  });

  it('đang tải sản phẩm: không dòng nào hiện số tiền', () => {
    mount([stale('SKU-B')], { isLoading: true });
    expect(screen.queryByText(fmt(2600000))).toBeNull();
    expect(screen.queryByText(fmt(1800000))).toBeNull();
  });

  it('productsError: không dòng nào hiện số tiền', () => {
    mount([stale('SKU-B')], { productsError: true });
    expect(screen.queryByText(fmt(2600000))).toBeNull();
    expect(screen.queryByText(fmt(1800000))).toBeNull();
  });
});
