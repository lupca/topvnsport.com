// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import * as tracking from '../lib/tracking.ts';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({
  popupService: { alert: vi.fn().mockResolvedValue(undefined) }
}));

// Mirror của sản phẩm 637: giá gốc 130000, biến thể đang chọn sẵn 229000.
const productWithVariants: Product = {
  id: '637',
  slug: 'cuoc-test-637',
  name: 'Cước test 637',
  brand: 'Yonex',
  category: 'Cước cầu lông',
  price: 130000,
  image: 'https://example.com/637.jpg',
  specs: {},
  description: '',
  stock: 20,
  tier_variations: [
    { tier_index: 1, name: 'Chọn cước', options: ['3U'] },
    { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'Đan cước BG65'] }
  ],
  variants: [
    { tier_1_option: '3U', tier_2_option: 'Khung không dây', sku_code: 'PRD-637-KHUNG', price: 229000, stock: 10 },
    { tier_1_option: '3U', tier_2_option: 'Đan cước BG65', sku_code: 'PRD-637-BG65', price: 279000, stock: 10 }
  ]
};

// Không có biến thể nào được chọn sẵn: tầng 2 có hai lựa chọn đều không phải không-đan.
const productTwoOptionTier: Product = {
  id: 'prod-two-option',
  slug: 'ao-test-two-option',
  name: 'Áo test hai lựa chọn',
  brand: 'Yonex',
  category: 'Áo cầu lông',
  price: 130000,
  salePrice: 99000,
  image: 'https://example.com/two.jpg',
  specs: {},
  description: '',
  stock: 20,
  tier_variations: [
    { tier_index: 1, name: 'Size', options: ['S', 'M'] }
  ],
  variants: [
    { tier_1_option: 'S', tier_2_option: null, sku_code: 'PRD-TWO-S', price: 99000, stock: 10 },
    { tier_1_option: 'M', tier_2_option: null, sku_code: 'PRD-TWO-M', price: 120000, stock: 10 }
  ]
};

let gtagSpy: ReturnType<typeof vi.fn>;
let fbqSpy: ReturnType<typeof vi.fn>;

function setupSpiedTracking() {
  tracking._resetTrackingForTesting();
  tracking.initTracking('G-TESTID123', 'PIXEL-TEST456');
  window.gtag = gtagSpy as unknown as typeof window.gtag;
  window.fbq = fbqSpy as unknown as typeof window.fbq;
}

function renderProductDetailRoute(product: Product) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer },
    preloadedState: {
      appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false },
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
}

const viewItemCalls = () => gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'view_item');
const viewContentCalls = () => fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'ViewContent');

Element.prototype.scrollIntoView = vi.fn(); // jsdom không có

describe('STOR-075: view_item / ViewContent carry the price the shopper sees', () => {
  beforeEach(() => {
    gtagSpy = vi.fn();
    fbqSpy = vi.fn();
    setupSpiedTracking();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('variant product: default selected variant price (229000), not base price (130000)', () => {
    renderProductDetailRoute(productWithVariants);

    expect(screen.getAllByText(/229\.000/).length).toBeGreaterThan(0);

    expect(viewItemCalls()).toHaveLength(1);
    expect(viewItemCalls()[0][2]).toEqual({
      currency: 'VND',
      value: 229000,
      items: [{ item_id: '637', item_name: 'Cước test 637', price: 229000 }]
    });

    expect(viewContentCalls()).toHaveLength(1);
    expect(viewContentCalls()[0][2]).toEqual({
      content_ids: ['637'],
      content_name: 'Cước test 637',
      content_type: 'product',
      value: 229000,
      currency: 'VND'
    });
  });

  it('changing the variant fires no second view_item or ViewContent', () => {
    renderProductDetailRoute(productWithVariants);

    // Bật đan cước rồi chọn mẫu cước khác: đổi biến thể sau khi mở trang.
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Đan cước BG65'));

    expect(viewItemCalls()).toHaveLength(1);
    expect(viewContentCalls()).toHaveLength(1);
  });

  it('no variant selected: both events use the displayed price (sale price 99000)', () => {
    renderProductDetailRoute(productTwoOptionTier);

    expect(screen.getAllByText(/99\.000/).length).toBeGreaterThan(0);

    expect(viewItemCalls()).toHaveLength(1);
    expect(viewItemCalls()[0][2].value).toBe(99000);
    expect(viewItemCalls()[0][2].items[0].price).toBe(99000);
    expect(viewItemCalls()[0][2].currency).toBe('VND');

    expect(viewContentCalls()).toHaveLength(1);
    expect(viewContentCalls()[0][2].value).toBe(99000);
    expect(viewContentCalls()[0][2].currency).toBe('VND');
  });
});
