// @vitest-environment jsdom
// STOR-016: bỏ đan cước rời -- tổng báo khách = Σ giá biến thể × số lượng + phí ship (khớp đơn OMS).
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import CartModal, { CartItem } from '../components/CartModal';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product, StringOption } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));
vi.mock('../services/sportApi', () => ({ sportApi: {} }));

afterEach(cleanup);

const kizuna: StringOption = { id: 'k', name: 'Kizuna', brand: 'Yonex', price: 220000, colors: [] } as any;
const fmt = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

const racket: Product = {
  id: 'r1', slug: 'vot-test', name: 'Vợt test', brand: 'B', categoryCode: RACKET_CATEGORY_CODES[0],
  price: 6480000, image: '', specs: {}, description: '', reviews: [], stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Màu', options: ['Đỏ'] }],
  variants: [{ tier_1_option: 'Đỏ', tier_2_option: null, sku_code: 'R1', price: 3240000, stock: 5 }]
} as any;

const noop = () => {};
const assistantProps = {
  product: racket, isRacket: true, hasStringingVariation: false, isDynamicStringingActive: false,
  activeStringValue: '', selectedTier1: '', selectedTier2: '', stringOptions: [kizuna], tension: 10.5,
  onSetSelectedTier1: noop, onSetSelectedTier2: noop, onSetTension: noop
};

function mountRoute(extra: Record<string, unknown> = {}) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer },
    preloadedState: {
      appData: { products: [racket], blogs: [], branches: [], stringOptions: [kizuna], categories: [], isLoading: false, ...extra },
      cart: { items: [], isOpen: false, quickViewProduct: null }
    } as any
  });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/product/vot-test']}>
        <Routes><Route path="/product/:slug" element={<ProductDetailRoute />} /></Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('STOR-016 bỏ cước rời', () => {
  it('cuoc-roi-an: vợt không tầng cước, có stringOptions -> StringingAssistant render rỗng', () => {
    const { container } = render(<StringingAssistant {...assistantProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('cuoc-roi-loi-an: tải cước lỗi, vợt không tầng cước -> không có role=alert', () => {
    mountRoute({ stringOptions: [], stringOptionsError: true });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Không tải được danh sách cước/)).toBeNull();
  });

  it('gio-khong-cong-cuoc: món có stringOption.price=220000 không làm tăng Tổng cộng', () => {
    const item: CartItem = {
      id: 'i1', productId: 'r1', skuCode: 'R1', name: 'Vợt test', brand: 'B', image: '', price: 3240000,
      selectedWeight: 'Tiêu chuẩn', selectedColor: 'Đỏ', stringOption: kizuna as any, tension: 10.5, quantity: 2
    };
    const store = configureStore({
      reducer: { appData: appDataReducer },
      preloadedState: {
        appData: { products: [racket], blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false, categoriesError: false, productsError: false }
      } as any
    });
    render(
      <Provider store={store}>
        <CartModal isOpen onClose={noop} cartItems={[item]} onRemoveItem={noop} onClearCart={noop} />
      </Provider>
    );
    expect(screen.getByText('Tổng cộng thanh toán:').parentElement!.textContent).toContain(fmt(3240000 * 2 + 30000));
  });

  it('pdp-khong-tro-ly: trang chi tiết vợt không tầng cước -> không trợ lý, giá = giá biến thể', () => {
    mountRoute();
    expect(screen.queryByText('Dịch vụ đan cước chuyên nghiệp')).toBeNull();
    expect(screen.getByTestId('purchase-price').textContent).toBe(fmt(3240000));
  });
});
