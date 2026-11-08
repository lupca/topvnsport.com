// @vitest-environment jsdom
// STOR-173: validate-voucher failures on an option switch. Error bodies are the STOR-171 producer fixtures, verbatim (r:f04e3ee5).
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
  QUOTE_V_Q1, QUOTE_V_Q3, VALIDATE_V1,
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
const switchTo = () => fireEvent.click(screen.getByText('Giao hàng chuẩn'));

// EXPRESS on Q1 (226.111đ), form filled with COD; the phone is the caller's, so the phone rule can vary.
async function openCheckout(phone: string) {
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
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: phone } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Mã giảm phí vận chuyển' }), { target: { value: 'HOAQUOC30K' } });
}

async function ready() {
  await openCheckout('0987654321');
  await waitFor(() => expect(orderBtn().disabled).toBe(false));
  expect(feeRow()).toHaveTextContent('Phí vận chuyển: 226.111đ');
  expect(applyBtn().disabled).toBe(false);
}

// EXPRESS on Q1, apply HOAQUOC30K (V1), Q3 refetch landed.
async function applied() {
  await ready();
  fireEvent.click(applyBtn());
  await screen.findByRole('button', { name: 'Xoá' });
  await waitFor(() => expect(feeRow()).toHaveTextContent('15.000đ'));
}

// Same, for the phone-rule cases, whose form phone is the caller's.
async function appliedOn(phone: string) {
  await openCheckout(phone);
  fireEvent.click(applyBtn());
  await screen.findByRole('button', { name: 'Xoá' });
  await waitFor(() => expect(feeRow()).toHaveTextContent('15.000đ'));
}

// The re-validate timeout belongs to omsCall (20 s), so only the timeout row fakes timers, before the switch.
async function failSwitch(row: { kind: string }) {
  if (row.kind === 'timeout') vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    switchTo();
    if (row.kind === 'timeout') await vi.advanceTimersByTimeAsync(20_001);
  } finally { vi.useRealTimers(); }
}

const KINDS: { kind: string; validate: Validate; message: string }[] = [
  { kind: 'network', validate: 'network', message: 'Không kết nối được tới cửa hàng. Vui lòng kiểm tra mạng rồi thử lại.' },
  { kind: 'timeout', validate: 'hang', message: 'Cửa hàng phản hồi quá lâu. Vui lòng thử lại sau ít phút.' },
  { kind: '5xx', validate: { status: 502, body: { detail: 'upstream_unreachable' } }, message: 'Cửa hàng đang tạm thời không phản hồi. Vui lòng thử lại sau ít phút.' },
  { kind: '429', validate: { status: 429, body: ERR_RATE_LIMITED_429 }, message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.' },
  { kind: '401', validate: { status: 401, body: ERR_GATEWAY_401 }, message: 'Yêu cầu đặt hàng công khai thiếu hoặc sai thông tin xác thực gian hàng. Vui lòng tải lại trang rồi thử lại.' },
  { kind: 'V9', validate: { status: 422, body: ERR_VALIDATE_V9 }, message: 'Không tìm thấy sản phẩm có mã KHONG-TON-TAI.' },
  { kind: 'V10', validate: { status: 422, body: ERR_VALIDATE_V10 }, message: 'Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.' },
  { kind: 'V11', validate: { status: 422, body: ERR_VALIDATE_V11 }, message: 'Thông tin gửi đi chưa hợp lệ. Vui lòng kiểm tra lại.' },
];

describe('STOR-173 failed re-validate on an option switch', () => {
  it.each(KINDS)('$kind: shows the Vietnamese reason after the switch', async row => {
    await applied();
    validate = row.validate;
    await failSwitch(row);
    expect(await screen.findByRole('alert')).toHaveTextContent(row.message);
    expect(document.body.textContent).not.toContain('upstream_unreachable');
    await waitFor(() => expect(quoteCalls()).toHaveLength(3));
    expect(screen.getByRole('alert')).toHaveTextContent(row.message);
  });

  it.each(KINDS)('$kind: drops the applied code and refetches the quote without voucher_code', async row => {
    await applied();
    validate = row.validate;
    await failSwitch(row);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
    expect(screen.queryByText(/Đã áp dụng:/)).toBeNull();
    await waitFor(() => expect(quoteCalls()).toHaveLength(3));
    expect(quoteCalls().slice(2).filter(c => 'voucher_code' in c.body)).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent(row.message);
  });

  it.each(KINDS)('$kind: records two validate-voucher calls and leaves the order button enabled', async row => {
    await applied();
    validate = row.validate;
    await failSwitch(row);
    await screen.findByRole('alert');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    const body = validateCalls()[1].body;
    expect(body.delivery_option).toBe('STANDARD');
    expect(body.code).toBe('HOAQUOC30K');
    expect(body).not.toHaveProperty('voucher_code');
    await waitFor(() => expect(orderBtn().disabled).toBe(false));
    expect(validateCalls()).toHaveLength(2);
  });

  it("Phone rule: the spaced number '0900 000 001' sends customer_phone '0900000001'", async () => {
    await appliedOn('0900 000 001');
    switchTo();
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    const body = validateCalls()[1].body;
    expect(body.customer_phone).toBe('0900000001');
    expect(body.code).toBe('HOAQUOC30K');
    expect(body.delivery_option).toBe('STANDARD');
    expect(body).not.toHaveProperty('voucher_code');
  });

  it('Phone rule: an empty phone makes the re-validate request omit customer_phone', async () => {
    await appliedOn('');
    switchTo();
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    const body = validateCalls()[1].body;
    expect(body).not.toHaveProperty('customer_phone');
    expect(body.code).toBe('HOAQUOC30K');
    expect(body.delivery_option).toBe('STANDARD');
    expect(body).not.toHaveProperty('voucher_code');
  });

  it("Phone rule: the invalid phone '0123' omits the customer_phone key", async () => {
    await appliedOn('0123');
    switchTo();
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    const body = validateCalls()[1].body;
    expect(body).not.toHaveProperty('customer_phone');
    expect(body.code).toBe('HOAQUOC30K');
    expect(body.delivery_option).toBe('STANDARD');
    expect(body).not.toHaveProperty('voucher_code');
  });
});
