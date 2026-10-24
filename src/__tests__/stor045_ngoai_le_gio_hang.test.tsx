// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer, {
  addCartItem, buildDefaultCartItem, buildConfiguredCartItem, describeCartItemSkuStatus,
  cartItemWarningMessage, loadCartItemsFromStorage, variantUnitPrice
} from '../features/cart/cartSlice';
import CartModal from '../components/CartModal';
import Header from '../components/Header';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { getPriceDisplay } from '../utils/priceDisplay';
import { Product } from '../types';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a), confirm: vi.fn(async () => true) } }));

const prod = (id: string, variants: any[]): Product => ({
  id, slug: `sp-${id}`, name: `SP ${id}`, brand: 'B', image: '', price: 100000, specs: {}, description: '', variants
} as any);
const V = (sku: string, stock?: number, price = 100000, extra: any = {}) =>
  ({ tier_1_option: null, tier_2_option: null, sku_code: sku, price, stock, ...extra });
const mkStore = (items: any[] = [], products: Product[] = []) => configureStore({
  reducer: { appData: appDataReducer, cart: cartReducer },
  preloadedState: {
    cart: { items, isOpen: false, quickViewProduct: null },
    appData: { products, isLoading: false, productsError: false } as any
  } as any
});
const cartItem = (o: any = {}) => ({ id: 'x', productId: '1', skuCode: 'S1', name: 'n', brand: '', image: '', price: 100000,
  selectedWeight: 'a', selectedColor: 'b', stringOption: null, tension: 10.5, quantity: 1, ...o });

beforeEach(() => { localStorage.clear(); alertMock.mockClear(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('1 thêm vượt tồn', () => {
  it('tồn 2, bấm 3 lần -> qty 2 và báo Chỉ còn 2', () => {
    const p = prod('1', [V('S1', 2)]);
    const s = mkStore([], [p]);
    render(<Provider store={s}><MemoryRouter><Header cartCount={0} openCart={() => {}} products={[p]} categories={[]} /></MemoryRouter></Provider>);
    for (let i = 0; i < 3; i++) s.dispatch(addCartItem(buildDefaultCartItem(p)!));
    expect(s.getState().cart.items[0].quantity).toBe(2);
    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(alertMock.mock.calls[0][0]).toMatch(/^Chỉ còn 2 sản phẩm/);
  });
  it('tồn 0 -> không thêm, báo hết hàng', () => {
    const p = prod('1', [V('S1', 0)]);
    const s = mkStore([], [p]);
    s.dispatch(addCartItem(buildDefaultCartItem(p)!));
    expect(s.getState().cart.items.length).toBe(0);
    expect(s.getState().cart.stockNotice).toMatch(/hết hàng/);
  });
  it('tồn chưa biết (undefined) -> vẫn thêm được', () => {
    const p = prod('1', [V('S1', undefined)]);
    const s = mkStore([], [p]);
    s.dispatch(addCartItem(buildDefaultCartItem(p)!));
    expect(s.getState().cart.items.length).toBe(1);
  });
});

describe('2 giỏ vượt tồn / hết hàng khoá thanh toán', () => {
  it('trạng thái + câu cảnh báo', () => {
    const over = prod('1', [V('S1', 2)]);
    expect(describeCartItemSkuStatus(cartItem({ quantity: 3 }), [over])).toBe('over_stock');
    expect(describeCartItemSkuStatus(cartItem({ quantity: 2 }), [over])).toBe('ok');
    expect(describeCartItemSkuStatus(cartItem(), [prod('1', [V('S1', 0)])])).toBe('out_of_stock');
    expect(describeCartItemSkuStatus(cartItem({ quantity: 3 }), [prod('1', [V('S1', undefined)])])).toBe('ok');
    expect(cartItemWarningMessage('over_stock', 2)).toBe('Chỉ còn 2 sản phẩm. Vui lòng giảm số lượng.');
    expect(cartItemWarningMessage('out_of_stock')).toMatch(/hết hàng/);
  });
  it.each([[3, 2], [1, 0]])('CartModal khoá nút khi qty %i, tồn %i', (qty, stock) => {
    const p = prod('1', [V('S1', stock)]);
    const s = mkStore([cartItem({ quantity: qty })], [p]);
    render(<Provider store={s}><MemoryRouter><CartModal isOpen onClose={() => {}} cartItems={s.getState().cart.items} onRemoveItem={() => {}} onClearCart={() => {}} /></MemoryRouter></Provider>);
    expect((screen.getByRole('button', { name: /Tiến hành thanh toán/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('3 giá 0đ', () => {
  it('computedPrice 0 không phải giá; không tạo món', () => {
    const v: any = V('S1', 5, 100000, { computedPrice: 0 });
    expect(variantUnitPrice(v)).toBeNull();
    expect(buildDefaultCartItem(prod('1', [v]))).toBeNull();
    expect(describeCartItemSkuStatus(cartItem(), [prod('1', [v])])).toBe('no_price');
  });
});

describe('4 gộp cùng SKU', () => {
  it('thẻ (id kiểu mặc định) rồi PDP (id kiểu cấu hình) -> 1 dòng qty 2', () => {
    const p = prod('1', [V('S1', 5)]);
    const s = mkStore([], [p]);
    s.dispatch(addCartItem(buildDefaultCartItem(p)!));
    s.dispatch(addCartItem(buildConfiguredCartItem(p, '', '', null, 10.5)!));
    expect(s.getState().cart.items.length).toBe(1);
    expect(s.getState().cart.items[0].quantity).toBe(2);
  });
  it('khác dây hoặc khác lực căng -> dòng riêng', () => {
    const p = prod('1', [V('S1', 9)]);
    const s = mkStore([], [p]);
    s.dispatch(addCartItem(cartItem({ id: 'a' })));
    s.dispatch(addCartItem(cartItem({ id: 'b', tension: 11 })));
    s.dispatch(addCartItem(cartItem({ id: 'c', stringOption: { id: 'd1' } })));
    expect(s.getState().cart.items.length).toBe(3);
  });
});

describe('5 giá thẻ KM một phần', () => {
  it('thẻ: giá bán <= giá gốc, cùng một biến thể', () => {
    const p = mapPmiProduct({
      id: 1, name: 'Km mot phan', voma_category_id: 1,
      variants: [
        { id: 1, sku_code: 'A', tier_1_option: 'A', price: 500000 },
        { id: 2, sku_code: 'B', tier_1_option: 'B', price: 2000000, computed_price: 1500000, original_price: 2000000, has_active_promotion: true }
      ]
    } as any, []);
    const d = getPriceDisplay(p!);
    expect(d.salePrice).toBeLessThanOrEqual(d.originalPrice);
    expect(d.salePrice).toBe(500000);
    expect(p!.percentageDiscount ?? 0).toBeGreaterThanOrEqual(0);
  });
  it('biến thể rẻ nhất có KM -> cặp giá của chính nó', () => {
    const p = mapPmiProduct({
      id: 1, name: 'Km re nhat', voma_category_id: 1,
      variants: [
        { id: 1, sku_code: 'A', price: 900000 },
        { id: 2, sku_code: 'B', price: 1000000, computed_price: 800000, original_price: 1000000, has_active_promotion: true }
      ]
    } as any, []);
    expect([p!.computedPrice, p!.originalPrice, p!.percentageDiscount]).toEqual([800000, 1000000, 20]);
  });
});

describe('6 giỏ localStorage hỏng', () => {
  const load = (v: unknown) => { localStorage.setItem('cart_items', JSON.stringify(v)); return loadCartItemsFromStorage(); };
  it('lọc phần tử hỏng', () => {
    expect(load([null])).toEqual([]);
    expect(load([{}])).toEqual([]);
    expect(load([cartItem({ quantity: '2' }), cartItem({ quantity: -3 }), cartItem({ quantity: 0.5 }), cartItem({ quantity: 0 })])).toEqual([]);
    expect(load([cartItem({ quantity: 2 }), null])).toHaveLength(1);
  });
});

describe('7 trang SP không tồn tại', () => {
  it('hiện Không tìm thấy trang (tiếng Việt)', () => {
    const s = mkStore([], []);
    render(<Provider store={s}><MemoryRouter initialEntries={['/product/khong-co']}>
      <ProductDetailRoute />
    </MemoryRouter></Provider>);
    expect(screen.getByText('Không tìm thấy trang')).toBeTruthy();
    expect(screen.queryByText('Not Found')).toBeNull();
  });
});

describe('8 nút giỏ Header', () => {
  it('có aria-label Giỏ hàng', () => {
    const s = mkStore();
    render(<Provider store={s}><MemoryRouter><Header cartCount={0} openCart={() => {}} products={[]} categories={[]} /></MemoryRouter></Provider>);
    expect(screen.getAllByRole('button', { name: 'Giỏ hàng' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Giỏ hàng' })[0]);
  });
});
