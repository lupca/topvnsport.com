// @vitest-environment jsdom
// STOR-171: POST /orders carries voucher_code only when validated for the selected option; order 422
// SHIPPING_VOUCHER_NOT_APPLICABLE is split by field_path. All bodies are producer fixtures (r:f04e3ee5).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import type { CreateOrderPayload } from '../services/sport-api/types';
import { PROVINCE_BODY, WARD_BODY, ERR_429, pickAdminUnits } from './fixtures/adminUnits';
import {
  QUOTE_V_Q1, QUOTE_V_Q3, ORDER_201_O1, VALIDATE_V1, VALIDATE_V2, ERR_WARD_MISMATCH, ERR_SHIPPING_VOUCHER_NOT_APPLICABLE,
  ERR_ORDER_O1E, ERR_VALIDATE_V9, ERR_VALIDATE_V10, ERR_VALIDATE_V11, ERR_GATEWAY_401, ERR_RATE_LIMITED_429,
} from './fixtures/shippingQuote';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

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
const O1E_MESSAGE = 'Mã chỉ áp dụng cho Giao tiêu chuẩn';

type Reply = { status: number; body: unknown };
let calls: { url: string; body: any }[];
let validateReply: Reply;
let orderReply: Reply;

const reply = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');
const validateCalls = () => calls.filter(c => c.url === '/api/oms/checkout/validate-voucher');
const orderBody = () => calls.find(c => c.url.endsWith('/orders'))!.body;

beforeEach(() => {
  calls = []; alertMock.mockClear();
  validateReply = { status: 200, body: VALIDATE_V1 };
  orderReply = { status: 201, body: ORDER_201_O1 };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') return reply({ status: 200, body: body.voucher_code ? QUOTE_V_Q3 : QUOTE_V_Q1 });
    if (url === '/api/oms/checkout/validate-voucher') return reply(validateReply);
    if (url.endsWith('/verify-otp')) return reply({ status: 200, body: { success: true, verification_token: 'vt-171' } });
    if (url.endsWith('/orders')) return reply(orderReply);
    return reply({ status: 200, body: { success: true } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const card = (label: string) => screen.getByText(label).closest('button')! as HTMLButtonElement;
const feeRow = () => screen.getByText('Phí vận chuyển:').parentElement!;
const switchTo = (label: 'Giao hàng chuẩn' | 'Giao hỏa tốc') => fireEvent.click(screen.getByText(label));

async function gotoQuote() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await pickAdminUnits();
  await screen.findByText('Giao hỏa tốc');
  await waitFor(() => expect(card('Giao hàng chuẩn').disabled).toBe(false));
  switchTo('Giao hỏa tốc');
}
// EXPRESS, HOAQUOC30K applied and validated (V1), Q3 refetch landed.
async function applied() {
  await gotoQuote();
  fireEvent.change(screen.getByRole('textbox', { name: 'Mã giảm phí vận chuyển' }), { target: { value: 'HOAQUOC30K' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  await screen.findByRole('button', { name: 'Xoá' });
  await waitFor(() => expect(feeRow()).toHaveTextContent('15.000đ'));
}
// Applied on EXPRESS, switched to STANDARD, the re-validate answers V2 -> code dropped, no-code quote landed.
async function dropped() {
  await applied();
  validateReply = { status: 200, body: VALIDATE_V2 };
  switchTo('Giao hàng chuẩn');
  await waitFor(() => expect(validateCalls()).toHaveLength(2));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull());
  await waitFor(() => expect(quoteCalls().at(-1)!.body).not.toHaveProperty('voucher_code'));
  await waitFor(() => expect(feeRow()).toHaveTextContent('78.000đ'));
}
async function submitOrder() {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
  return orderBody();
}
// Applied, then the order answers 422 with `body`; resolves once the requote landed.
async function rejectedOrder(body: unknown) {
  await applied();
  orderReply = { status: 422, body };
  const before = quoteCalls().length;
  await submitOrder();
  await waitFor(() => expect(alertMock).toHaveBeenCalled());
  await waitFor(() => expect(quoteCalls().length).toBeGreaterThan(before));
  // let any second (wrong) requote surface before counting
  await new Promise(r => setTimeout(r, 50));
  return quoteCalls().slice(before);
}

describe('STOR-171 types', () => {
  it('CreateOrderPayload declares an optional voucher_code string', () => {
    // Compile-time: npx tsc --noEmit fails if the key is missing or not string.
    const withCode: CreateOrderPayload['voucher_code'] = 'HOAQUOC30K';
    const without: Pick<CreateOrderPayload, 'voucher_code'> = {};
    expect([withCode, without]).toEqual(['HOAQUOC30K', {}]);
  });
});

describe('STOR-171 order body voucher_code', () => {
  it("On the validated path, the order body has voucher_code 'HOAQUOC30K'", async () => {
    await applied();
    expect((await submitOrder()).voucher_code).toBe('HOAQUOC30K');
  });

  it("That order body has delivery_option 'EXPRESS'", async () => {
    await applied();
    expect((await submitOrder()).delivery_option).toBe('EXPRESS');
  });

  it('That order body has shipping_discount 30000', async () => {
    await applied();
    expect((await submitOrder()).shipping_discount).toBe(30000);
  });

  it('An order placed with no code applied sends no voucher_code key', async () => {
    await gotoQuote();
    expect(await submitOrder()).not.toHaveProperty('voucher_code');
  });

  it('An order placed after the code was dropped sends no voucher_code key', async () => {
    await dropped();
    expect(await submitOrder()).not.toHaveProperty('voucher_code');
  });
});

describe('STOR-171 order 422 field_path voucher_code (O1e)', () => {
  it('The O1e order 422 calls popupService.alert exactly once', async () => {
    await rejectedOrder(ERR_ORDER_O1E);
    expect(alertMock).toHaveBeenCalledTimes(1);
  });

  it(`That alert shows '${O1E_MESSAGE}'`, async () => {
    await rejectedOrder(ERR_ORDER_O1E);
    expect(alertMock).toHaveBeenCalledWith(O1E_MESSAGE);
  });

  it('After the O1e 422, no in-page alert shows that message', async () => {
    await rejectedOrder(ERR_ORDER_O1E);
    expect(screen.queryAllByRole('alert').filter(el => el.textContent?.includes(O1E_MESSAGE))).toHaveLength(0);
  });

  it("After the O1e 422, the applied code's 'Xoá' button is gone", async () => {
    await rejectedOrder(ERR_ORDER_O1E);
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  });

  it('After the O1e 422, exactly one more shipping-quote POST is made', async () => {
    expect(await rejectedOrder(ERR_ORDER_O1E)).toHaveLength(1);
  });

  it('The requote after O1e has no voucher_code key', async () => {
    const [requote] = await rejectedOrder(ERR_ORDER_O1E);
    expect(requote.body).not.toHaveProperty('voucher_code');
  });
});

describe('STOR-171 order 422 field_path shipping_discount', () => {
  it("After the shipping_discount 422, the 'Xoá' button is still shown", async () => {
    await rejectedOrder(ERR_SHIPPING_VOUCHER_NOT_APPLICABLE);
    expect(screen.getByRole('button', { name: 'Xoá' })).toBeInTheDocument();
  });

  it('The shipping_discount 422 triggers exactly one more shipping-quote POST', async () => {
    expect(await rejectedOrder(ERR_SHIPPING_VOUCHER_NOT_APPLICABLE)).toHaveLength(1);
  });

  it("The requote after the shipping_discount 422 has voucher_code 'HOAQUOC30K'", async () => {
    const [requote] = await rejectedOrder(ERR_SHIPPING_VOUCHER_NOT_APPLICABLE);
    expect(requote.body.voucher_code).toBe('HOAQUOC30K');
  });
});

// Captures from voma-oms origin/develop; skipped when that checkout is not on this machine.
const OMS = '/data/projects/voma/voma-oms';
const capture = (doc: string, head: string) => {
  const lines = execSync(`git -C ${OMS} show origin/develop:docs/evidence/${doc}/captures.md`).toString().split('\n');
  const i = lines.findIndex(l => l.startsWith(`### ${head} `));
  return JSON.parse(lines.slice(i).find(l => l.startsWith('RESPONSE '))!.slice('RESPONSE '.length));
};
let omsAvailable = true;
try { execSync(`git -C ${OMS} rev-parse origin/develop`, { stdio: 'ignore' }); } catch { omsAvailable = false; }

describe('STOR-171 fixtures', () => {
  it.skipIf(!omsAvailable)('The O1e fixture deep-equals the O1e capture', () => {
    expect(ERR_ORDER_O1E).toStrictEqual(capture('oms-219', 'O1e'));
  });

  it.skipIf(!omsAvailable)('The V11 fixture deep-equals the V11 capture', () => {
    expect(ERR_VALIDATE_V11).toStrictEqual(capture('oms-218', 'V11'));
  });

  it.skipIf(!omsAvailable)('The 401 fixture deep-equals the body in spec 500c4fbd (V12 capture)', () => {
    expect(ERR_GATEWAY_401).toStrictEqual(capture('oms-218', 'V12'));
  });

  it('The 429 fixture deep-equals the body in spec fae8d7ae', () => {
    // The spec fae8d7ae 429 body, retyped here as an independent literal; fixtures/adminUnits.tsx ERR_429 carries the same text.
    const spec = { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.', retry_after_seconds: 12, detail: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.', retry_after_seconds: 12 } };
    expect(ERR_RATE_LIMITED_429).toStrictEqual(spec);
    expect(ERR_RATE_LIMITED_429).toStrictEqual(ERR_429);
  });

  it('The V9 fixture has exactly the keys code, message and field_path', () => {
    expect(Object.keys(ERR_VALIDATE_V9).sort()).toEqual(['code', 'field_path', 'message']);
  });

  it('The V10 fixture is the ERR_WARD_MISMATCH object', () => {
    expect(ERR_VALIDATE_V10).toBe(ERR_WARD_MISMATCH);
  });
});
