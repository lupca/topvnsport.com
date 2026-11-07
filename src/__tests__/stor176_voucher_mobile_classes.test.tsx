// @vitest-environment jsdom
// STOR-176: mobile class tokens on the STOR-163 voucher UI (input, 'Áp dụng', 'Xoá', applied line). Tokens are read from rendered elements.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_V_Q1, QUOTE_V_Q3, VALIDATE_V1 } from './fixtures/shippingQuote';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const SKU = 'TVS-AO-88D-01';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 1, tension: 10, stringOption: null,
};

let calls: { url: string; body: any }[];

beforeEach(() => {
  calls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    const reply = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json, text: async () => JSON.stringify(json) });
    if (url.startsWith('/api/oms/admin-units')) return reply(200, url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY);
    if (url === '/api/oms/shipping-quote') return reply(200, body.voucher_code ? QUOTE_V_Q3 : QUOTE_V_Q1);
    if (url === '/api/oms/checkout/validate-voucher') return reply(200, VALIDATE_V1);
    return reply(200, { success: true });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function openQuote() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await pickAdminUnits();
  await screen.findByText('Giao hỏa tốc');
}
async function gotoQuote(option: 'STANDARD' | 'EXPRESS' = 'EXPRESS') {
  await openQuote();
  await waitFor(() => expect(card('Giao hàng chuẩn').disabled).toBe(false));
  if (option === 'EXPRESS') fireEvent.click(screen.getByText('Giao hỏa tốc'));
}
const card = (label: string) => screen.getByText(label).closest('button')! as HTMLButtonElement;
const input = () => screen.getByRole('textbox', { name: 'Mã giảm phí vận chuyển' }) as HTMLInputElement;
const applyBtn = () => screen.getByRole('button', { name: 'Áp dụng' }) as HTMLButtonElement;
const removeBtn = () => screen.getByRole('button', { name: 'Xoá' }) as HTMLButtonElement;
// EXPRESS on Q1, apply HOAQUOC30K, Q3 refetch landed.
async function applied() {
  await gotoQuote();
  fireEvent.change(input(), { target: { value: 'HOAQUOC30K' } });
  fireEvent.click(applyBtn());
  await screen.findByRole('button', { name: 'Xoá' });
  await waitFor(() => expect(screen.getByText('Phí vận chuyển:').parentElement).toHaveTextContent('15.000đ'));
}

describe('STOR-176 voucher mobile classes', () => {
  it('voucher input carries max-md:text-base', async () => {
    await gotoQuote();
    expect(input()).toHaveClass('max-md:text-base');
  });

  it('voucher input carries max-md:min-h-11', async () => {
    await gotoQuote();
    expect(input()).toHaveClass('max-md:min-h-11');
  });

  it("'Áp dụng' carries max-md:text-base", async () => {
    await gotoQuote();
    expect(applyBtn()).toHaveClass('max-md:text-base');
  });

  it("'Áp dụng' carries max-md:min-h-11", async () => {
    await gotoQuote();
    expect(applyBtn()).toHaveClass('max-md:min-h-11');
  });

  it("'Xoá' carries max-md:text-base", async () => {
    await applied();
    expect(removeBtn()).toHaveClass('max-md:text-base');
  });

  it("'Xoá' carries max-md:min-h-11", async () => {
    await applied();
    expect(removeBtn()).toHaveClass('max-md:min-h-11');
  });

  it('applied voucher line carries max-md:text-sm', async () => {
    await applied();
    expect(screen.getByText(/^Đã áp dụng:/)).toHaveClass('max-md:text-sm');
  });
});
