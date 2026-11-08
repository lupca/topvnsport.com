// @vitest-environment jsdom
// STOR-163: voucher code input, apply and remove, quote refetch with voucher_code. All bodies are producer fixtures (r:f04e3ee5).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import {
  QUOTE_V_Q1, QUOTE_V_Q3, QUOTE_V_TWO_AUTO, QUOTE_F1, QUOTE_200_BOTH_UNAVAILABLE, ORDER_201_O1,
  VALIDATE_V1, VALIDATE_V1_NOT_APPLIED, VALIDATE_V2, VALIDATE_V5, VALIDATE_V7, ERR_VALIDATE_V8, VALIDATE_V1_REQUEST, VALIDATE_V2_REQUEST,
} from './fixtures/shippingQuote';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

// Same cart as the V1/V2 request captures: one TVS-AO-88D-01.
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
let calls: { url: string; body: any }[];
let quoteNoCode: unknown;
let quoteWithCode: unknown;
let validateReply: Reply;
let validateGate: Promise<void> | null;

const reply = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');
const validateCalls = () => calls.filter(c => c.url === '/api/oms/checkout/validate-voucher');

beforeEach(() => {
  calls = [];
  quoteNoCode = QUOTE_V_Q1;
  quoteWithCode = QUOTE_V_Q3;
  validateReply = { status: 200, body: VALIDATE_V1 };
  validateGate = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') return reply({ status: 200, body: body.voucher_code ? quoteWithCode : quoteNoCode });
    if (url === '/api/oms/checkout/validate-voucher') { await validateGate; return reply(validateReply); }
    if (url.endsWith('/verify-otp')) return reply({ status: 200, body: { success: true, verification_token: 'vt-163' } });
    if (url.endsWith('/orders')) return reply({ status: 201, body: ORDER_201_O1 });
    return reply({ status: 200, body: { success: true } });
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
const row = (label: string) => screen.getByText(label).parentElement!;
const feeRow = () => row('Phí vận chuyển:');
const struck = () => feeRow().querySelector('.line-through');
const input = () => screen.getByRole('textbox', { name: 'Mã giảm phí vận chuyển' }) as HTMLInputElement;
const applyBtn = () => screen.getByRole('button', { name: 'Áp dụng' }) as HTMLButtonElement;
const removeBtn = () => screen.getByRole('button', { name: 'Xoá' }) as HTMLButtonElement;
const typeCode = (code: string) => fireEvent.change(input(), { target: { value: code } });
const typePhone = (phone: string) => fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: phone } });
const clickApply = (code: string) => { typeCode(code); fireEvent.click(applyBtn()); };
function holdValidate() {
  let release!: () => void;
  validateGate = new Promise(r => { release = r; });
  return release;
}

// EXPRESS on Q1, apply HOAQUOC30K, Q3 refetch landed.
async function applied() {
  await gotoQuote();
  clickApply('HOAQUOC30K');
  await screen.findByRole('button', { name: 'Xoá' });
  await waitFor(() => expect(feeRow()).toHaveTextContent('15.000đ'));
}
async function removed() {
  await applied();
  fireEvent.click(removeBtn());
  await waitFor(() => expect(quoteCalls()).toHaveLength(3));
  await waitFor(() => expect(feeRow()).toHaveTextContent('226.111đ'));
}
async function rejected(body: unknown) {
  validateReply = { status: 200, body };
  await gotoQuote();
  clickApply('THUONGDI');
  return screen.findByRole('alert');
}
// QUOTE_F1 is a no-code capture; it stands in for the fallback reply to a voucher_code refetch.
async function fallback() {
  quoteWithCode = QUOTE_F1;
  await gotoQuote();
  clickApply('HOAQUOC30K');
  await screen.findByText('Chưa tính được phí');
}

describe('STOR-163 voucher input', () => {
  it('A usable quote with no applied code shows a voucher input', async () => {
    await gotoQuote();
    expect(input()).toBeInTheDocument();
  });

  it("A usable quote with no applied code shows an 'Áp dụng' button", async () => {
    await gotoQuote();
    expect(applyBtn()).toBeInTheDocument();
  });

  it("'Áp dụng' is disabled while the trimmed code is empty", async () => {
    await gotoQuote();
    typeCode('   ');
    expect(applyBtn().disabled).toBe(true);
  });

  it("'Áp dụng' is disabled while a validate request is in flight", async () => {
    const release = holdValidate();
    await gotoQuote();
    clickApply('HOAQUOC30K');
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    expect(applyBtn().disabled).toBe(true);
    release();
    await screen.findByRole('button', { name: 'Xoá' });
  });

  it("'Áp dụng' is disabled while the selected option has no usable fee", async () => {
    quoteNoCode = QUOTE_200_BOTH_UNAVAILABLE;
    await openQuote();
    typeCode('HOAQUOC30K');
    expect(applyBtn().disabled).toBe(true);
  });

  it('The voucher input has maxLength 64', async () => {
    await gotoQuote();
    expect(input().maxLength).toBe(64);
  });

  it('Enter in the voucher input does not submit the checkout form', async () => {
    await gotoQuote();
    typeCode('HOAQUOC30K');
    // fireEvent returns false when preventDefault ran, which is what stops the implicit form submit.
    expect(fireEvent.keyDown(input(), { key: 'Enter' })).toBe(false);
    await screen.findByRole('button', { name: 'Xoá' });
  });

  it("Enter with 'Áp dụng' enabled sends one validate request", async () => {
    await gotoQuote();
    typeCode('HOAQUOC30K');
    fireEvent.keyDown(input(), { key: 'Enter' });
    await screen.findByRole('button', { name: 'Xoá' });
    expect(validateCalls()).toHaveLength(1);
  });

  it('The voucher input carries the mobile size tokens', async () => {
    await gotoQuote();
    expect(input().className).toContain('max-md:text-base');
    expect(input().className).toContain('max-md:min-h-11');
  });

  it("'Áp dụng' carries the mobile size tokens", async () => {
    await gotoQuote();
    expect(applyBtn().className).toContain('max-md:min-h-11');
  });

  it("'Xoá' carries the mobile size tokens", async () => {
    await applied();
    expect(removeBtn().className).toContain('max-md:min-h-11');
  });
});

describe('STOR-163 validate request (verbatim producer bodies)', () => {
  it('HOAQUOC30K on EXPRESS, phone 0900000001: body equals verbatim V1 request', async () => {
    await gotoQuote();
    typePhone('0900000001');
    clickApply('HOAQUOC30K');
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    expect(validateCalls()[0].body).toEqual(VALIDATE_V1_REQUEST);
    await screen.findByRole('button', { name: 'Xoá' });
  });

  it('THUONGDI on EXPRESS, empty phone: body equals verbatim V2 request', async () => {
    await rejected(VALIDATE_V2);
    expect(validateCalls()[0].body).toEqual(VALIDATE_V2_REQUEST);
  });

  it('With an invalid phone, the validate body has no customer_phone key', async () => {
    validateReply = { status: 200, body: VALIDATE_V2 };
    await gotoQuote();
    typePhone('0123');
    clickApply('THUONGDI');
    await screen.findByRole('alert');
    expect(validateCalls()[0].body).not.toHaveProperty('customer_phone');
  });

  it('A valid phone typed with spaces is sent normalized as customer_phone', async () => {
    await gotoQuote();
    typePhone('090 000 0001');
    clickApply('HOAQUOC30K');
    await screen.findByRole('button', { name: 'Xoá' });
    expect(validateCalls()[0].body.customer_phone).toBe('0900000001');
  });
});

describe('STOR-163 apply', () => {
  it('After a V1 reply, the next quote POST carries the applied voucher_code', async () => {
    await applied();
    expect(quoteCalls()[1].body.voucher_code).toBe('HOAQUOC30K');
  });

  it('A quote POST with no applied code has no voucher_code key', async () => {
    await gotoQuote();
    expect(quoteCalls()[0].body).not.toHaveProperty('voucher_code');
  });

  it('After V1 and the Q3 refetch on EXPRESS, the footer shows struck 45.000đ', async () => {
    await applied();
    expect(struck()?.textContent).toBe('45.000đ');
  });

  it('After V1 and the Q3 refetch on EXPRESS, the footer shows 15.000đ paid', async () => {
    await applied();
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 45.000đ 15.000đ');
  });

  it('While a code is applied, the applied code is shown', async () => {
    await applied();
    expect(screen.getByText('HOAQUOC30K')).toBeInTheDocument();
  });

  it("While a code is applied, a 'Xoá' button is shown", async () => {
    await applied();
    expect(removeBtn()).toBeInTheDocument();
  });

  it('While a code is applied, the voucher input is not rendered', async () => {
    await applied();
    expect(screen.queryByRole('textbox', { name: 'Mã giảm phí vận chuyển' })).toBeNull();
  });
});

describe("STOR-163 'Xoá'", () => {
  it("After 'Xoá', the next quote POST body has no voucher_code key", async () => {
    await removed();
    expect(quoteCalls()[2].body).not.toHaveProperty('voucher_code');
  });

  it("After 'Xoá' and the Q1 refetch, the footer shows the full fee", async () => {
    await removed();
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 226.111đ');
  });

  it("After 'Xoá' and the Q1 refetch, no 'Giảm phí vận chuyển:' row shows", async () => {
    await removed();
    expect(screen.queryByText('Giảm phí vận chuyển:')).toBeNull();
  });
});

describe('STOR-163 rejected codes', () => {
  it("A V2 reply shows 'Mã chỉ áp dụng cho Giao tiêu chuẩn' in role=alert", async () => {
    expect(await rejected(VALIDATE_V2)).toHaveTextContent('Mã chỉ áp dụng cho Giao tiêu chuẩn');
  });

  it("A V5 reply shows 'Mã đã hết hạn sử dụng' in role=alert", async () => {
    expect(await rejected(VALIDATE_V5)).toHaveTextContent('Mã đã hết hạn sử dụng');
  });

  it("A V7 reply shows 'Bạn đã dùng mã này đủ số lần cho phép' in role=alert", async () => {
    expect(await rejected(VALIDATE_V7)).toHaveTextContent('Bạn đã dùng mã này đủ số lần cho phép');
  });

  it('A V8 422 (DELIVERY_OPTION_UNAVAILABLE) shows its message in role=alert', async () => {
    validateReply = { status: 422, body: ERR_VALIDATE_V8 };
    await gotoQuote();
    clickApply('HOAQUOC30K');
    expect(await screen.findByRole('alert')).toHaveTextContent(ERR_VALIDATE_V8.message);
  });

  it('A valid:false reply sends no further quote POST', async () => {
    await rejected(VALIDATE_V2);
    expect(quoteCalls()).toHaveLength(1);
  });

  it('A valid:false reply leaves the footer on the full fee', async () => {
    await rejected(VALIDATE_V2);
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 226.111đ');
    expect(struck()).toBeNull();
  });

  it("A new 'Áp dụng' click clears the previous voucher error", async () => {
    await rejected(VALIDATE_V2);
    const release = holdValidate();
    fireEvent.click(applyBtn());
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(screen.queryByRole('alert')).toBeNull();
    release();
    await screen.findByRole('alert');
  });
});

describe("STOR-163 'Đã áp dụng' reads option.voucher_name", () => {
  it("TWO_AUTO on STANDARD: 'Đã áp dụng: Freeship giao thường'", async () => {
    quoteNoCode = QUOTE_V_TWO_AUTO;
    await gotoQuote('STANDARD');
    expect(screen.getByText('Đã áp dụng: Freeship giao thường')).toBeInTheDocument();
  });

  it("TWO_AUTO on EXPRESS: 'Đã áp dụng: Freeship hỏa tốc tháng 11'", async () => {
    quoteNoCode = QUOTE_V_TWO_AUTO;
    await gotoQuote('EXPRESS');
    expect(screen.getByText('Đã áp dụng: Freeship hỏa tốc tháng 11')).toBeInTheDocument();
  });
});

describe('STOR-163 fallback reply to a voucher_code refetch', () => {
  it("On a fallback voucher refetch, the fee row reads 'Chưa tính được phí'", async () => {
    await fallback();
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: Chưa tính được phí');
  });

  it('On a fallback voucher refetch, the order button is disabled', async () => {
    await fallback();
    expect((screen.getByRole('button', { name: /Thanh toán SePay QR/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("On a fallback voucher refetch, 'Xoá' stays available", async () => {
    await fallback();
    expect(removeBtn().disabled).toBe(false);
  });

  it("'Thử lại' after a fallback reposts the same voucher_code", async () => {
    await fallback();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(quoteCalls()).toHaveLength(3));
    expect(quoteCalls()[2].body.voucher_code).toBe('HOAQUOC30K');
  });
});

describe('STOR-163 after the order', () => {
  it('After an order 201, the applied code is cleared', async () => {
    await applied();
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
    typePhone('0987654321');
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn thành mua sắm' }));
    // Back at checkout the cart prop is unchanged here, so the next quote shows what state the code was left in.
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    await waitFor(() => expect(quoteCalls()).toHaveLength(3));
    expect(quoteCalls()[2].body).not.toHaveProperty('voucher_code');
  });
});

// STOR-164: re-validate on option switch, failures, order guards.
const switchTo = (label: 'Giao hàng chuẩn' | 'Giao hỏa tốc') => fireEvent.click(screen.getByText(label));
const alertText = () => screen.queryByRole('alert');
const orderBtn = () => screen.getByRole('button', { name: /Thanh toán SePay QR|Xác nhận đặt hàng/ }) as HTMLButtonElement;
// Flush a held validate reply, so a negative assertion does not pass before the reply lands.
async function flushValidate(release: () => void) {
  await act(async () => { release(); await validateGate; });
}
// Form filled as in the STOR-163 order test, so a submit would reach send-otp without the guard.
function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  typePhone('0987654321');
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
}
const submitForm = () => fireEvent.submit(document.getElementById('checkout-form')!);
const otpCalls = () => calls.filter(c => c.url.endsWith('/send-otp'));
const orderCalls = () => calls.filter(c => c.url.endsWith('/orders'));

describe('STOR-164 re-validate on option switch', () => {
  it('Switching option with a code applied POSTs validate-voucher once', async () => {
    await applied();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    await screen.findByRole('button', { name: 'Xoá' });
    expect(validateCalls()).toHaveLength(2);
  });

  it('That POST carries the newly selected delivery_option', async () => {
    await applied();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(validateCalls()[1].body.delivery_option).toBe('STANDARD');
  });

  it('That POST names the code under the key code', async () => {
    await applied();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(validateCalls()[1].body.code).toBe('HOAQUOC30K');
  });

  it('That POST body has no key voucher_code', async () => {
    await applied();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(validateCalls()[1].body).not.toHaveProperty('voucher_code');
  });

  it('After a V1 reply the code stays applied', async () => {
    await applied();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    await screen.findByRole('button', { name: 'Xoá' });
    expect(screen.getByText('HOAQUOC30K')).toBeInTheDocument();
  });

  it('After a valid:true applied:false reply the code stays applied', async () => {
    await applied();
    validateReply = { status: 200, body: VALIDATE_V1_NOT_APPLIED };
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    await waitFor(() => expect(feeRow()).toHaveTextContent('Phí vận chuyển'));
    expect(screen.getByText('HOAQUOC30K')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xoá' })).toBeInTheDocument();
  });

  it('A V2 reply (valid:false) removes the applied code', async () => {
    await applied();
    validateReply = { status: 200, body: VALIDATE_V2 };
    switchTo('Giao hàng chuẩn');
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
    await waitFor(() => expect(input()).toBeInTheDocument());
  });

  it("After a V2 reply the page shows OMS's message verbatim", async () => {
    await applied();
    validateReply = { status: 200, body: VALIDATE_V2 };
    switchTo('Giao hàng chuẩn');
    expect(await screen.findByRole('alert')).toHaveTextContent(VALIDATE_V2.message);
  });

  it('A V8 422 DELIVERY_OPTION_UNAVAILABLE reply removes the applied code', async () => {
    await applied();
    validateReply = { status: 422, body: ERR_VALIDATE_V8 };
    switchTo('Giao hàng chuẩn');
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  });

  it('After a V8 reply the page shows the OMS message verbatim', async () => {
    await applied();
    validateReply = { status: 422, body: ERR_VALIDATE_V8 };
    switchTo('Giao hàng chuẩn');
    expect(await screen.findByRole('alert')).toHaveTextContent(ERR_VALIDATE_V8.message);
  });

  it('After a drop, the next quote request body has no voucher_code', async () => {
    await applied();
    validateReply = { status: 200, body: VALIDATE_V2 };
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(quoteCalls()).toHaveLength(3));
    expect(quoteCalls()[2].body).not.toHaveProperty('voucher_code');
  });

  it('The reason line is still visible after the post-drop quote loads', async () => {
    await applied();
    validateReply = { status: 200, body: VALIDATE_V2 };
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(quoteCalls()).toHaveLength(3));
    await waitFor(() => expect(feeRow()).toHaveTextContent('78.000đ'));
    expect(alertText()).toHaveTextContent(VALIDATE_V2.message);
  });

  it('A late V2 reply for an old option keeps the code', async () => {
    await applied();
    const release = holdValidate();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    switchTo('Giao hỏa tốc');
    validateReply = { status: 200, body: VALIDATE_V2 };
    await flushValidate(release);
    expect(screen.getByRole('button', { name: 'Xoá' })).toBeInTheDocument();
    expect(alertText()).toBeNull();
  });

  it('A late reply after the code was removed shows no reason', async () => {
    await applied();
    const release = holdValidate();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    fireEvent.click(removeBtn());
    validateReply = { status: 200, body: VALIDATE_V2 };
    await flushValidate(release);
    expect(alertText()).toBeNull();
  });

  it('An apply reply after an option switch triggers a re-validation', async () => {
    await gotoQuote('EXPRESS');
    const release = holdValidate();
    clickApply('HOAQUOC30K');
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    switchTo('Giao hàng chuẩn');
    await flushValidate(release);
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(validateCalls()[1].body.delivery_option).toBe('STANDARD');
  });

  it('The validate body omits customer_phone for an invalid phone', async () => {
    await gotoQuote('EXPRESS');
    typePhone('0123');
    clickApply('HOAQUOC30K');
    await screen.findByRole('button', { name: 'Xoá' });
    await waitFor(() => expect(feeRow()).toHaveTextContent('15.000đ'));
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(validateCalls()[1].body).not.toHaveProperty('customer_phone');
  });
});

describe('STOR-164 order button while re-validating or applying', () => {
  it('The order button is disabled while a re-validation is in flight', async () => {
    await applied();
    const release = holdValidate();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    expect(orderBtn().disabled).toBe(true);
    await flushValidate(release);
  });

  it('The order button is enabled after a valid re-validation reply', async () => {
    await applied();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    await waitFor(() => expect(orderBtn().disabled).toBe(false));
  });

  it('A submit during re-validation does not call send-otp', async () => {
    await applied();
    fillForm();
    const release = holdValidate();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    submitForm();
    await flushValidate(release);
    expect(otpCalls()).toHaveLength(0);
  });

  it('A submit during re-validation does not call orders', async () => {
    await applied();
    fillForm();
    const release = holdValidate();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    submitForm();
    await flushValidate(release);
    expect(orderCalls()).toHaveLength(0);
  });

  it('The order button is disabled while the apply-time validating flag is set', async () => {
    await gotoQuote('EXPRESS');
    const release = holdValidate();
    clickApply('HOAQUOC30K');
    await waitFor(() => expect(validateCalls()).toHaveLength(1));
    expect(orderBtn().disabled).toBe(true);
    await flushValidate(release);
  });

  it('A submit during re-validation with a fresh phone does not call send-otp', async () => {
    await applied();
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
    typePhone('0987654329');
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
    const release = holdValidate();
    switchTo('Giao hàng chuẩn');
    await waitFor(() => expect(validateCalls()).toHaveLength(2));
    submitForm();
    await flushValidate(release);
    expect(otpCalls()).toHaveLength(0);
  });
});
