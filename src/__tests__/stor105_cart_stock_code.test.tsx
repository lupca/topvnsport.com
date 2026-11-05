// @vitest-environment jsdom
// STOR-105 (AC8, design 5.6 cartSlice row + 4.2, spec f0e00186 / 13476ead / b34d9ea0 / 5a8a968e):
// cart lines whose variants share a WMS stock_code are checked by their SUMMED quantity.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import cartReducer, {
  addCartItem, addCartItemAndOpen, buildConfiguredCartItem, describeCartItemSkuStatus
} from '../features/cart/cartSlice';
import { applyWmsStock, parseWmsStock } from '../services/sport-api/wmsStock';
import { getAdminUnitsFromFixture, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200_FLAT } from './fixtures/shippingQuote';
import type { Product, ProductVariant } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));
const createOrderMock = vi.hoisted(() => vi.fn());
vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: async () => ({ success: true }),
    verifyOtp: async () => ({ success: true, verification_token: 'tok-1' }),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: async () => QUOTE_200_FLAT,
    createSepayCheckout: async () => ({ action: 'https://pay.example', fields: {} })
  }
}));

const STRINGS = ['BG65', 'BG80'];
const sku = (s: string) => `VOT-Đen-${s}`;
// Pinned wire body (VOMA-399): {stock:{sku:qty}, items:[{sku_code, qty_available, qty_on_hand, qty_reserved, stock_code}]}.
const row = (s: string, qty: number, stock_code?: string) => ({
  sku_code: sku(s), qty_available: qty, qty_on_hand: qty, qty_reserved: 0, ...(stock_code ? { stock_code } : {})
});
const ITEMS = STRINGS.map((s) => row(s, 2, 'FRAME-DEN'));
const BODY = { stock: Object.fromEntries(ITEMS.map((i) => [i.sku_code, 2])), items: ITEMS };
const BODY_RULE_OFF = { stock: BODY.stock, items: ITEMS.map(({ stock_code: _drop, ...rest }) => rest) };

const racket = (): Product => ({
  id: '1', slug: 'vot', name: 'Vợt', brand: 'Yonex', category: 'Vợt', price: 1000000, image: 'x.jpg',
  specs: {}, description: '', stock: 99,
  tier_variations: [{ tier_index: 1, name: 'Màu Sắc', options: ['Đen'] }, { tier_index: 2, name: 'Loại Cước', options: STRINGS }],
  variants: STRINGS.map((s): ProductVariant => ({ tier_1_option: 'Đen', tier_2_option: s, sku_code: sku(s), price: 1000000 }))
});
const applied = (body: unknown) => applyWmsStock([racket()], parseWmsStock(body))[0];
const input = (p: Product, s: string) => buildConfiguredCartItem(p, s, 'Đen', null, 10)!;
const line = (p: Product, s: string, quantity: number): CartItem => {
  const { stock: _s, stockGroupSkus: _g, ...it } = input(p, s);
  return { ...it, quantity };
};
const stateWith = (items: CartItem[]) => ({ items, isOpen: false, quickViewProduct: null });

describe('STOR-105 reducer: add checks the stock_code group total', () => {
  beforeEach(() => localStorage.clear());

  it('refuses past the group qty with stockNotice; items unchanged (f0e00186)', () => {
    const p = applied(BODY);
    const before = stateWith([line(p, 'BG65', 1), line(p, 'BG80', 1)]);
    const after = cartReducer(before, addCartItem(input(p, 'BG80')));
    expect(after.stockNotice).toBe('Chỉ còn 2 sản phẩm. Trong giỏ của bạn đã có 2.');
    expect(after.items).toBe(before.items);
  });

  it('M in the notice is the summed quantity of the group lines', () => {
    const p = applied(BODY);
    const after = cartReducer(stateWith([line(p, 'BG65', 2)]), addCartItem(input(p, 'BG80')));
    expect(after.stockNotice).toBe('Chỉ còn 2 sản phẩm. Trong giỏ của bạn đã có 2.');
  });

  it('addCartItemAndOpen: a refused add leaves the cart closed (f0e00186)', () => {
    const p = applied(BODY);
    const store = configureStore({ reducer: { cart: cartReducer }, preloadedState: { cart: stateWith([line(p, 'BG65', 2)]) } });
    store.dispatch(addCartItemAndOpen(input(p, 'BG80')) as any);
    expect(store.getState().cart.isOpen).toBe(false);
    expect(store.getState().cart.items).toHaveLength(1);
  });

  it('an add within the group total is accepted', () => {
    const p = applied(BODY);
    const after = cartReducer(stateWith([line(p, 'BG65', 1)]), addCartItem(input(p, 'BG80')));
    expect(after.stockNotice).toBeUndefined();
    expect(after.items.map((i) => [i.skuCode, i.quantity])).toEqual([[sku('BG65'), 1], [sku('BG80'), 1]]);
  });

  it('rule off (no stock_code): each line only checked against its own stock', () => {
    const p = applied(BODY_RULE_OFF);
    expect(input(p, 'BG80').stockGroupSkus).toBeUndefined();
    const after = cartReducer(stateWith([line(p, 'BG65', 2)]), addCartItem(input(p, 'BG80')));
    expect(after.items.map((i) => i.quantity)).toEqual([2, 1]);
    const refused = cartReducer(stateWith([line(p, 'BG80', 2)]), addCartItem(input(p, 'BG80')));
    expect(refused.stockNotice).toBe('Chỉ còn 2 sản phẩm. Trong giỏ của bạn đã có 2.');
  });

  it('unknown (undefined) stock never blocks a stock_code group (13476ead)', () => {
    const p = { ...racket(), variants: racket().variants!.map((v) => ({ ...v, stock_code: 'FRAME-DEN', stock: undefined })) };
    const after = cartReducer(stateWith([line(p, 'BG65', 50)]), addCartItem(input(p, 'BG80')));
    expect(after.items).toHaveLength(2);
    expect(after.items.map((i) => describeCartItemSkuStatus(i, [p], after.items))).toEqual(['ok', 'ok']);
  });

  it('the group sku set is never saved to localStorage cart items', () => {
    const p = applied(BODY);
    expect(input(p, 'BG80').stockGroupSkus).toEqual([sku('BG65'), sku('BG80')]);
    const after = cartReducer(stateWith([]), addCartItem(input(p, 'BG80')));
    const saved = JSON.parse(localStorage.getItem('cart_items')!);
    expect(saved).toHaveLength(1);
    expect('stockGroupSkus' in saved[0]).toBe(false);
    expect('stockGroupSkus' in after.items[0]).toBe(false);
  });
});

describe('STOR-105 describeCartItemSkuStatus sums the stock_code group', () => {
  it('over_stock on each line of an over-qty group', () => {
    const p = applied(BODY);
    const items = [line(p, 'BG65', 2), line(p, 'BG80', 1)];
    expect(items.map((i) => describeCartItemSkuStatus(i, [p], items))).toEqual(['over_stock', 'over_stock']);
  });

  it('a group at or under its qty gives ok on every line', () => {
    const p = applied(BODY);
    const items = [line(p, 'BG65', 1), line(p, 'BG80', 1)];
    expect(items.map((i) => describeCartItemSkuStatus(i, [p], items))).toEqual(['ok', 'ok']);
  });

  it('rule off: lines are not summed', () => {
    const p = applied(BODY_RULE_OFF);
    const items = [line(p, 'BG65', 2), line(p, 'BG80', 2)];
    expect(items.map((i) => describeCartItemSkuStatus(i, [p], items))).toEqual(['ok', 'ok']);
  });
});

describe('STOR-105 CartModal', () => {
  beforeEach(() => { sessionStorage.clear(); createOrderMock.mockReset(); createOrderMock.mockResolvedValue({ id: 1, order_number: 'DH-1', total_amount: 2030000, shipping_fee: 30000 }); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  const mount = (p: Product, items: CartItem[]) => {
    const store = configureStore({
      reducer: { appData: appDataReducer },
      preloadedState: { appData: { products: [p], branches: [], stringOptions: [], categories: [], isLoading: false } } as any
    });
    return render(
      <Provider store={store}>
        <CartModal isOpen onClose={() => {}} cartItems={items} onRemoveItem={() => {}} onClearCart={() => {}} />
      </Provider>
    );
  };
  const checkoutBtn = () => screen.getByRole('button', { name: /Tiến hành thanh toán/ });

  it('checkout disabled while the group is over qty; warning on each line', () => {
    const p = applied(BODY);
    mount(p, [line(p, 'BG65', 2), line(p, 'BG80', 1)]);
    expect(checkoutBtn()).toBeDisabled();
    expect(screen.getAllByText('Chỉ còn 2 sản phẩm. Vui lòng giảm số lượng.')).toHaveLength(2);
  });

  it('stepper + still caps per line at the variant stock (b34d9ea0)', () => {
    const p = applied(BODY);
    mount(p, [line(p, 'BG65', 1), line(p, 'BG80', 1)]);
    expect(checkoutBtn()).not.toBeDisabled();
    expect(screen.getAllByLabelText('Tăng số lượng').map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, false]);
  });

  it('createOrder body stays items:[{sku_code, quantity}], one per line (5a8a968e)', async () => {
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    const p = applied(BODY);
    mount(p, [line(p, 'BG65', 1), line(p, 'BG80', 1)]);
    fireEvent.click(checkoutBtn());
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách Test' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Test' } });
    await pickAdminUnits();
    fireEvent.click(screen.getByText('Thanh toán COD'));
    const orderBtn = () => screen.getByRole('button', { name: /Xác nhận đặt hàng/ });
    await waitFor(() => expect(orderBtn()).not.toBeDisabled());
    fireEvent.click(orderBtn());
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    expect(createOrderMock.mock.calls[0][0].items).toEqual([
      { sku_code: sku('BG65'), quantity: 1 }, { sku_code: sku('BG80'), quantity: 1 }
    ]);
  });
});
