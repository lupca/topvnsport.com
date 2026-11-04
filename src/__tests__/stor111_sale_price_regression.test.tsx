// @vitest-environment jsdom
// STOR-111: sau STOR-109, Product.salePrice của SP KM một phần là giá biến thể giảm % nhiều nhất,
// không phải giá rẻ nhất. Lọc giá, sắp theo giá phải dùng giá mua được rẻ nhất; PDP chỉ gạch giá
// khi biến thể đang chọn thật sự rẻ hơn giá gốc. Prod 590/551 đều KM mọi biến thể nên dùng fixture
// đúng dạng PIM prod (như biến thể 6442 của SP 590).
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import CatalogPage from '../features/catalog/CatalogPage';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { sortProducts } from '../utils/productSort';
import { getCheapestPrice } from '../utils/priceDisplay';
import { getPdpPrice } from '../components/product-detail/helpers';
import type { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({
  popupService: { alert: vi.fn().mockResolvedValue(undefined) }
}));
Element.prototype.scrollIntoView = vi.fn();

type V = Record<string, unknown>;
const raw = (id: number, opts: string[], variants: V[]) => ({
  id, name: `SP ${id}`, slug: `sp-${id}`, voma_category_id: null, variants,
  tier_variations: [{ tier_index: 1, name: 'Loại', options: opts }]
}) as any;
const v = (id: number, opt: string, price: number, computed: number, pct: number, active: boolean): V => ({
  id, sku_code: `S${id}`, tier_1_option: opt, tier_2_option: null, stock: 5,
  price, original_price: price, computed_price: computed, percentage_discount: pct, has_active_promotion: active
});

// A: biến thể rẻ nhất 500000 không KM; biến thể 2000000 -> 1500000 (25%).
const A = mapPmiProduct(raw(1, ['Thường', 'KM'], [v(11, 'Thường', 500000, 500000, 0, false), v(12, 'KM', 2000000, 1500000, 25, true)]), [])!;
// B: cờ KM bật nhưng giá bán = giá gốc.
const B = mapPmiProduct(raw(2, ['X'], [v(21, 'X', 800000, 800000, 0, true)]), [])!;
// C: một giá 1000000.
const C = mapPmiProduct(raw(3, ['Y'], [v(31, 'Y', 1000000, 1000000, 0, false)]), [])!;

afterEach(cleanup);

function renderCatalog(products: Product[], maxPrice: number) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      appData: { products, branches: [], stringOptions: [], categories: [], isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { ...catalogReducer(undefined, { type: '@@init' }), maxPrice }
    } as any
  });
  render(<Provider store={store}><MemoryRouter><CatalogPage /></MemoryRouter></Provider>);
}

function renderPdp(product: Product) {
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
        <Routes><Route path="/product/:slug" element={<ProductDetailRoute />} /></Routes>
      </MemoryRouter>
    </Provider>
  );
}
const struck = () => screen.getByTestId('purchase-price').parentElement!.querySelector('.line-through');

describe('STOR-111 fixture giữ cặp giá thẻ STOR-109', () => {
  it('A: salePrice là giá biến thể KM (1500000), price là 500000', () => {
    expect([A.salePrice, A.originalPrice, A.price]).toEqual([1500000, 2000000, 500000]);
  });
});

describe('getCheapestPrice', () => {
  it('A -> 500000 (biến thể rẻ nhất, không phải biến thể KM)', () => {
    expect(getCheapestPrice(A)).toBe(500000);
  });
  it('SP không có biến thể không lỗi, dùng giá sản phẩm', () => {
    const p = { ...C, variants: undefined, price: 700000, salePrice: 700000 } as Product;
    expect(getCheapestPrice(p)).toBe(700000);
    expect(() => sortProducts([p, A], 'price-asc')).not.toThrow();
    expect(sortProducts([p, A], 'price-asc').map(x => x.id)).toEqual([A.id, p.id]);
  });
});

describe('Catalog lọc giá theo giá rẻ nhất', () => {
  it('maxPrice 1000000 vẫn hiện A', () => {
    renderCatalog([A], 1000000);
    expect(screen.getAllByText(A.name).length).toBeGreaterThan(0);
  });
  it('maxPrice 400000 ẩn A', () => {
    renderCatalog([A], 400000);
    expect(screen.queryAllByText(A.name)).toHaveLength(0);
  });
});

describe('Sắp theo giá dùng giá rẻ nhất', () => {
  it('price-asc: A (500000) trước C (1000000)', () => {
    expect(sortProducts([C, A], 'price-asc').map(p => p.id)).toEqual([A.id, C.id]);
  });
  it('price-desc: C (1000000) trước A', () => {
    expect(sortProducts([A, C], 'price-desc').map(p => p.id)).toEqual([C.id, A.id]);
  });
});

describe('getPdpPrice.hasDiscount theo biến thể đang chọn', () => {
  it('biến thể 500000 không KM -> hasDiscount=false', () => {
    expect(getPdpPrice(A, 'Thường', '')).toMatchObject({ salePrice: 500000, hasDiscount: false });
  });
  it('biến thể KM -> hasDiscount=true, 1500000 / 2000000', () => {
    expect(getPdpPrice(A, 'KM', '')).toMatchObject({ salePrice: 1500000, originalPrice: 2000000, hasDiscount: true });
  });
  it('cờ KM bật nhưng giá bán = giá gốc -> hasDiscount=false', () => {
    expect(getPdpPrice(B, 'X', '')).toMatchObject({ salePrice: 800000, originalPrice: 800000, hasDiscount: false });
  });
});

describe('PDP render', () => {
  it('chọn biến thể không KM: không gạch giá', () => {
    renderPdp(A);
    fireEvent.click(screen.getByText('Thường'));
    expect(screen.getByTestId('purchase-price').textContent).toContain('500.000');
    expect(struck()).toBeNull();
  });
  it('chọn biến thể KM: gạch 2.000.000đ', () => {
    renderPdp(A);
    fireEvent.click(screen.getByText('KM'));
    expect(screen.getByTestId('purchase-price').textContent).toContain('1.500.000');
    expect(struck()?.textContent).toBe('2.000.000đ');
  });
});
