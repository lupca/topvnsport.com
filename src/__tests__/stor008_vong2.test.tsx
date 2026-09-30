// @vitest-environment jsdom
// STOR-008 vòng 2: biến thể giá 0 không kéo giá sản phẩm về "không giá"; không chữ giá bịa.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import ProductCard from '../components/ProductCard';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { Product } from '../types';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const pmiMixed: any = {
  id: '9', name: 'Áo hai giá',
  tier_variations: [{ tier_index: 1, name: 'Màu', options: ['Đỏ', 'Xanh'] }],
  variants: [
    { id: 1, tier_1_option: 'Đỏ', sku_code: 'SKU-DO', price: 0, stock: 5 },
    { id: 2, tier_1_option: 'Xanh', sku_code: 'SKU-XANH', price: 200000, stock: 5 }
  ]
};

afterEach(() => { cleanup(); alertMock.mockClear(); });

function renderRoute(product: Product) {
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
        <Routes><Route path="/product/:slug" element={<ProductDetailRoute />} /></Routes>
      </MemoryRouter>
    </Provider>
  );
  return store;
}

describe('F1: biến thể [0, 200000]', () => {
  const product = mapPmiProduct(pmiMixed, []);

  it('mapper: price = min các giá > 0', () => {
    expect(product.price).toBe(200000);
  });
  it('thẻ sản phẩm hiện giá thật, không "Liên hệ"', () => {
    render(<MemoryRouter><ProductCard product={product} onQuickView={vi.fn()} onAddToCart={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByText('Liên hệ để biết giá')).toBeNull();
    expect(screen.getByTestId('regular-price').textContent).toContain('200.000');
  });
  it('trang chi tiết: chọn biến thể 200000 thêm giỏ được', () => {
    const store = renderRoute(product);
    fireEvent.click(screen.getByRole('button', { name: 'Xanh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));
    expect(alertMock).not.toHaveBeenCalled();
    expect(store.getState().cart.items[0].skuCode).toBe('SKU-XANH');
  });
  it('trang chi tiết: chọn biến thể giá 0 -> Liên hệ để biết giá, nút khoá, không câu "không có sẵn"', () => {
    const store = renderRoute(product);
    fireEvent.click(screen.getByRole('button', { name: 'Đỏ' }));
    expect(screen.getByTestId('purchase-price').textContent).toBe('Liên hệ để biết giá');
    const btn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(alertMock).not.toHaveBeenCalled();
    expect(store.getState().cart.items.length).toBe(0);
  });
});

describe('F2: StringingAssistant không ghi "Miễn phí" khi không có giá thật', () => {
  const mk = (prices: [number, number]): Product => ({
    id: 's', name: 'Vợt', image: '', specs: {}, description: '', reviews: [], stock: 5,
    price: prices[0] > 0 ? prices[0] : undefined,
    tier_variations: [{ tier_index: 1, name: 'Cước', options: ['Không cước', 'Cước A'] }],
    variants: [
      { tier_1_option: 'Không cước', tier_2_option: null, sku_code: 'K', price: prices[0], stock: 5 },
      { tier_1_option: 'Cước A', tier_2_option: null, sku_code: 'A', price: prices[1], stock: 5 }
    ]
  });
  const renderSA = (p: Product) => render(
    <StringingAssistant
      product={p} isRacket hasStringingVariation stringingVariation={p.tier_variations![0]} stringingTierIndex={1}
      isDynamicStringingActive activeStringValue="Cước A" selectedTier1="" selectedTier2="" withStringing
      selectedString={null} stringOptions={[]} tension={10.5}
      onSetSelectedTier1={vi.fn()} onSetSelectedTier2={vi.fn()} onSetWithStringing={vi.fn()}
      onSetSelectedString={vi.fn()} onSetTension={vi.fn()} />
  );
  it('không giá thật -> không có chữ giá', () => {
    const { container } = renderSA(mk([0, 0]));
    expect(container.textContent).not.toContain('Miễn phí');
    expect(container.textContent).not.toMatch(/\+\d/);
  });
  it('giá thật chênh -> +giá; giá thật bằng nhau -> Miễn phí', () => {
    renderSA(mk([100000, 150000]));
    expect(screen.getByText('+50.000đ')).toBeTruthy();
    cleanup();
    renderSA(mk([100000, 100000]));
    expect(screen.getByText('Miễn phí')).toBeTruthy();
  });
});
