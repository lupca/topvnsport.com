// @vitest-environment jsdom
// STOR-172: validate-voucher failures on 'Áp dụng'. Error bodies are the STOR-171 producer fixtures, verbatim (r:f04e3ee5).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import {
  QUOTE_V_Q1, QUOTE_V_Q3, VALIDATE_V1, VALIDATE_V2,
  ERR_VALIDATE_V9, ERR_VALIDATE_V10, ERR_VALIDATE_V11, ERR_GATEWAY_401, ERR_RATE_LIMITED_429,
} from './fixtures/shippingQuote';

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

type Reply = { status: number; body: unknown };
type Validate = Reply | 'network' | 'hang';
let calls: { url: string; body: any }[];
let validate: Validate;

const reply = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');
const validateCalls = () => calls.filter(c => c.url === '/api/oms/checkout/validate-voucher');

beforeEach(() => {
  calls = [];
  validate = { status: 200, body: VALIDATE_V1 };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') return reply({ status: 200, body: body.voucher_code ? QUOTE_V_Q3 : QUOTE_V_Q1 });
    if (url === '/api/oms/checkout/validate-voucher') {
      if (validate === 'network') throw new TypeError('Failed to fetch');
      if (validate === 'hang') return new Promise(() => {});
      return reply(validate);
    }
    return reply({ status: 200, body: { success: true } });
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const card = (label: string) => screen.getByText(label).closest('button')! as HTMLButtonElement;
const feeRow = () => screen.getByText('Phí vận chuyển:').parentElement!;
const applyBtn = () => screen.getByRole('button', { name: 'Áp dụng' }) as HTMLButtonElement;
const orderBtn = () => screen.getByRole('button', { name: 'Xác nhận đặt hàng' }) as HTMLButtonElement;

// EXPRESS on Q1 (226.111đ), form filled with COD so the order button is enabled before 'Áp dụng'.
async function ready() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await pickAdminUnits();
  await screen.findByText('Giao hỏa tốc');
  await waitFor(() => expect(card('Giao hàng chuẩn').disabled).toBe(false));
  fireEvent.click(screen.getByText('Giao hỏa tốc'));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Mã giảm phí vận chuyển' }), { target: { value: 'HOAQUOC30K' } });
  await waitFor(() => expect(orderBtn().disabled).toBe(false));
  expect(feeRow()).toHaveTextContent('Phí vận chuyển: 226.111đ');
  expect(applyBtn().disabled).toBe(false);
}

const ROWS: { kind: string; validate: Validate; message: string }[] = [
  { kind: 'network', validate: 'network', message: 'Không kết nối được tới cửa hàng. Vui lòng kiểm tra mạng rồi thử lại.' },
  { kind: 'timeout', validate: 'hang', message: 'Cửa hàng phản hồi quá lâu. Vui lòng thử lại sau ít phút.' },
  { kind: '5xx', validate: { status: 502, body: { detail: 'upstream_unreachable' } }, message: 'Cửa hàng đang tạm thời không phản hồi. Vui lòng thử lại sau ít phút.' },
  { kind: '429', validate: { status: 429, body: ERR_RATE_LIMITED_429 }, message: ERR_RATE_LIMITED_429.message },
  { kind: '401', validate: { status: 401, body: ERR_GATEWAY_401 }, message: ERR_GATEWAY_401.detail },
  { kind: 'V9', validate: { status: 422, body: ERR_VALIDATE_V9 }, message: ERR_VALIDATE_V9.message },
  { kind: 'V10', validate: { status: 422, body: ERR_VALIDATE_V10 }, message: ERR_VALIDATE_V10.message },
  { kind: 'V11', validate: { status: 422, body: ERR_VALIDATE_V11 }, message: 'Thông tin gửi đi chưa hợp lệ. Vui lòng kiểm tra lại.' },
];

describe('STOR-172 validate-voucher failure on Áp dụng', () => {
  it.each(ROWS)("$kind: shows its message, applies no code, re-enables 'Áp dụng' and the order button", async row => {
    validate = row.validate;
    await ready();
    if (row.kind === 'timeout') vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(applyBtn());
      // omsCall's 20 s timeout (OMS_TIMEOUT_MS) fires only under advanced fake time.
      if (row.kind === 'timeout') await vi.advanceTimersByTimeAsync(20_001);
    } finally { vi.useRealTimers(); }

    expect(await screen.findByRole('alert')).toHaveTextContent(row.message);
    expect(validateCalls()).toHaveLength(1);
    expect(document.body.textContent).not.toContain('upstream_unreachable');
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
    expect(screen.queryByText('HOAQUOC30K')).toBeNull();
    expect(screen.queryByText(/Đã áp dụng:/)).toBeNull();
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 226.111đ');
    expect(feeRow().querySelector('.line-through')).toBeNull();
    expect(quoteCalls().filter(c => 'voucher_code' in c.body)).toEqual([]);
    expect(applyBtn().disabled).toBe(false);
    expect(orderBtn().disabled).toBe(false);
  });

  it("Control: a V1 200 reply and the Q3 refetch show the 'Đã áp dụng:' line", async () => {
    await ready();
    fireEvent.click(applyBtn());
    await screen.findByRole('button', { name: 'Xoá' });
    expect(await screen.findByText(/Đã áp dụng:/)).toBeInTheDocument();
    expect(quoteCalls().at(-1)!.body.voucher_code).toBe('HOAQUOC30K');
  });

  it("A valid:false 200 reply on 'Áp dụng' shows the message and applies no code", async () => {
    validate = { status: 200, body: VALIDATE_V2 };
    await ready();
    fireEvent.click(applyBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent(VALIDATE_V2.message);
    expect(validateCalls()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
    expect(screen.queryByText('HOAQUOC30K')).toBeNull();
    expect(applyBtn().disabled).toBe(false);
    expect(orderBtn().disabled).toBe(false);
  });
});
