// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import { Product } from '../types';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({
  popupService: {
    alert: (...args: unknown[]) => alertMock(...args)
  }
}));

// Tầng 1 chỉ có MỘT lựa chọn (tự chọn sẵn theo F7), tầng 2 có HAI lựa chọn
// (KHÔNG tự chọn sẵn -- khách phải tự bấm) để cô lập đúng ca "thiếu tầng 2".
const productMissingTier2: Product = {
  id: 'prod-missing-tier2',
  slug: 'ao-test-missing-tier2',
  name: 'Áo test thiếu tầng 2',
  brand: 'Yonex',
  category: 'Áo cầu lông',
  price: 200000,
  image: 'https://example.com/x.jpg',
  specs: {},
  description: '',
  reviews: [],
  stock: 20,
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['Đỏ'] },
    { tier_index: 2, name: 'Size', options: ['S', 'M'] }
  ],
  variants: [
    { tier_1_option: 'Đỏ', tier_2_option: 'S', sku_code: 'PRD-TEST-DO-S', price: 200000, stock: 10 },
    { tier_1_option: 'Đỏ', tier_2_option: 'M', sku_code: 'PRD-TEST-DO-M', price: 200000, stock: 10 }
  ]
};

// Grid thưa: Đỏ/L không có biến thể thật -- để test ca "not_available".
const productSparseGrid: Product = {
  id: 'prod-sparse',
  slug: 'ao-test-sparse',
  name: 'Áo test grid thưa',
  brand: 'Yonex',
  category: 'Áo cầu lông',
  price: 200000,
  image: 'https://example.com/y.jpg',
  specs: {},
  description: '',
  reviews: [],
  stock: 20,
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['Đỏ'] },
    { tier_index: 2, name: 'Size', options: ['S', 'L'] }
  ],
  variants: [
    { tier_1_option: 'Đỏ', tier_2_option: 'S', sku_code: 'PRD-SPARSE-DO-S', price: 200000, stock: 10 }
    // Cố ý không có Đỏ/L.
  ]
};

function renderProductDetailRoute(product: Product) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer },
    preloadedState: {
      appData: { products: [product], blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null }
    } as any
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/product/${product.slug}`]}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

describe('ProductDetailRoute -- F6: thiếu tầng / không khớp -> đúng câu báo, KHÔNG dispatch addCartItem', () => {
  afterEach(() => {
    cleanup();
    alertMock.mockClear();
  });

  it('chưa chọn Size -> báo "Vui lòng chọn Size", không thêm vào giỏ', () => {
    const store = renderProductDetailRoute(productMissingTier2);

    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));

    expect(alertMock).toHaveBeenCalledWith('Vui lòng chọn Size');
    expect(store.getState().cart.items.length).toBe(0);
  });

  it('chọn đủ Size -> thêm vào giỏ thành công, không báo lỗi', () => {
    const store = renderProductDetailRoute(productMissingTier2);

    fireEvent.click(screen.getByRole('button', { name: 'S' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));

    expect(alertMock).not.toHaveBeenCalled();
    expect(store.getState().cart.items.length).toBe(1);
    expect(store.getState().cart.items[0].skuCode).toBe('PRD-TEST-DO-S');
  });

  it('chọn tổ hợp không tồn tại (Đỏ/L) -> báo "Phân loại này hiện không có sẵn. Vui lòng chọn phân loại khác.", không thêm vào giỏ', () => {
    const store = renderProductDetailRoute(productSparseGrid);

    fireEvent.click(screen.getByRole('button', { name: 'L' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));

    expect(alertMock).toHaveBeenCalledWith('Phân loại này hiện không có sẵn. Vui lòng chọn phân loại khác.');
    expect(store.getState().cart.items.length).toBe(0);
  });
});
