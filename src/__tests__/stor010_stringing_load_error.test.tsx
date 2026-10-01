// @vitest-environment jsdom
// STOR-010: tải cước lỗi -> StringingAssistant báo role=alert, không ẩn như danh sách rỗng.
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

afterEach(cleanup);

const MSG = 'Không tải được danh sách cước. Vui lòng tải lại trang.';

const racket: Product = {
  id: 'r1', slug: 'vot-test', name: 'Vợt test', brand: 'B', categoryCode: RACKET_CATEGORY_CODES[0],
  price: 1000000, image: '', specs: {}, description: '', reviews: [], stock: 5
} as any;

const noop = () => {};
const baseProps = {
  product: racket, isRacket: true, hasStringingVariation: false, isDynamicStringingActive: false,
  activeStringValue: '', selectedTier1: '', selectedTier2: '', withStringing: false, selectedString: null,
  stringOptions: [], tension: 0, onSetSelectedTier1: noop, onSetSelectedTier2: noop,
  onSetWithStringing: noop, onSetSelectedString: noop, onSetTension: noop
};

it('vợt không biến thể cước + stringOptionsError=true: role=alert đúng câu', () => {
  render(<StringingAssistant {...baseProps} stringOptionsError={true} />);
  expect(screen.getByRole('alert').textContent).toBe(MSG);
});

it('stringOptionsError=false + danh sách rỗng: không render gì', () => {
  const { container } = render(<StringingAssistant {...baseProps} stringOptionsError={false} />);
  expect(container.innerHTML).toBe('');
});

it('ProductDetailRoute với store stringOptionsError=true hiện câu báo', () => {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer },
    preloadedState: {
      appData: { products: [racket], blogs: [], branches: [], stringOptions: [], stringOptionsError: true, categories: [], isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null }
    } as any
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/product/vot-test']}>
        <Routes><Route path="/product/:slug" element={<ProductDetailRoute />} /></Routes>
      </MemoryRouter>
    </Provider>
  );
  expect(screen.getByText(MSG)).toBeTruthy();
});
