// @vitest-environment jsdom
// STOR-157: a failed shipping quote (is_fallback, spec 08893767) blocks checkout with no fee shown.
// Real CartModal; only fetch is stubbed.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, ERR_503, pickAdminUnits } from './fixtures/adminUnits';
import {
  QUOTE_V_Q1, QUOTE_V_Q7, QUOTE_F1, QUOTE_F3, QUOTE_FALLBACK_TOP_ONLY, QUOTE_FALLBACK_ONE_OPTION,
  ERR_SHIPPING_VOUCHER_NOT_APPLICABLE,
} from './fixtures/shippingQuote';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const FAILED = 'Chưa tính được phí vận chuyển. Vui lòng thử lại.';
const SKU = 'TVS-AO-01-M';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
// Cart: 2 x 100.000đ = 200.000đ of goods.
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 2, tension: 10, stringOption: null,
};

type Reply = { status: number; body: unknown } | 'reject' | 'nobody500';
let calls: { url: string; body: any }[];
let quoteReplies: Reply[];

const respond = (r: { status: number; body: unknown }) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');
const orderCalls = () => calls.filter(c => c.url.endsWith('/orders'));

beforeEach(() => {
  calls = []; alertMock.mockClear(); localStorage.clear(); sessionStorage.clear();
  quoteReplies = [{ status: 200, body: QUOTE_V_Q1 }];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return respond({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') {
      const r = quoteReplies[Math.min(quoteCalls().length - 1, quoteReplies.length - 1)];
      if (r === 'reject') throw new TypeError('Failed to fetch');
      if (r === 'nobody500') return { ok: false, status: 500, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); }, text: async () => '' };
      return respond(r);
    }
    if (url.endsWith('/verify-otp')) return respond({ status: 200, body: { success: true, verification_token: 'vt-157' } });
    // 422 keeps the OTP token and re-quotes, which is how a token holder lands on a failed quote.
    if (url.endsWith('/orders')) return respond({ status: 422, body: ERR_SHIPPING_VOUCHER_NOT_APPLICABLE });
    return respond({ status: 200, body: { success: true } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function gotoStep2(...replies: Reply[]) {
  quoteReplies = replies;
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await pickAdminUnits();
}
const shippingSection = () => screen.getByText('Phương thức vận chuyển').parentElement!;
const feeRow = () => screen.getByText('Phí vận chuyển:').parentElement!;
const totalRow = () => screen.getByText('Tổng cộng thanh toán:').parentElement!;
// The order button reads 'Xác nhận đặt hàng' once COD is chosen (SePay is the default label).
const submitBtn = () => {
  fireEvent.click(screen.getByText('Thanh toán COD'));
  return screen.getByRole('button', { name: 'Xác nhận đặt hàng' });
};
const card = (label: string) => screen.getByText(label).closest('button')! as HTMLButtonElement;
// Waits for the failure sentence, so every absence check after it runs on the settled failure state.
const failureShown = async () => within(shippingSection()).findByText(FAILED);
const ZERO_DONG = /(^|[^0-9.])0đ/;

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
}

async function placeOrder() {
  await waitFor(() => expect(card('Giao hàng chuẩn').disabled).toBe(false));
  fillForm();
  fireEvent.click(submitBtn());
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(orderCalls()).toHaveLength(1));
}
const pressEnter = async () => {
  fireEvent.submit(document.getElementById('checkout-form')!);
  await new Promise(r => setTimeout(r, 30));
};

describe('STOR-157 F1 quote (spec 08893767: 200, is_fallback true, 30000/50000)', () => {
  it('shipping section shows the failure sentence', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    expect(await failureShown()).toBeInTheDocument();
  });

  it("shipping section shows a 'Thử lại' button", async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    expect(within(shippingSection()).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it("'Xác nhận đặt hàng' is disabled", async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    expect(submitBtn()).toBeDisabled();
  });

  it("cart modal has no '30.000đ' text", async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    expect(feeRow().textContent).not.toContain('30.000đ');
    expect(totalRow().textContent).not.toContain('30.000đ');
    expect(document.body.textContent).not.toContain('30.000đ');
  });

  it("cart modal has no '50.000đ' text", async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    expect(feeRow().textContent).not.toContain('50.000đ');
    expect(totalRow().textContent).not.toContain('50.000đ');
    expect(document.body.textContent).not.toContain('50.000đ');
  });

  it('no token: Enter in the form sends no POST to /send-otp', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    fillForm();
    await pressEnter();
    expect(calls.filter(c => c.url.endsWith('/send-otp'))).toHaveLength(0);
  });

  it('no token: Enter in the form opens no OTP input', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    fillForm();
    await pressEnter();
    expect(screen.queryByPlaceholderText('Nhập 6 số OTP')).toBeNull();
  });

  it('token held and re-quoted into F1: exactly one POST to /orders', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 }, { status: 200, body: QUOTE_F1 });
    await placeOrder();
    await failureShown();
    await pressEnter();
    expect(orderCalls()).toHaveLength(1);
  });
});

describe('STOR-157 F3 quote (spec 08893767: is_fallback true, fees 0)', () => {
  it('shipping section shows the failure sentence', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F3 });
    expect(await failureShown()).toBeInTheDocument();
  });

  it('no cart modal text matches /(^|[^0-9.])0đ/', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F3 });
    await failureShown();
    expect(feeRow().textContent).not.toMatch(ZERO_DONG);
    expect(totalRow().textContent).not.toMatch(ZERO_DONG);
    expect(document.body.textContent).not.toMatch(ZERO_DONG);
    // The items total is on screen, so the regex does run against real money text.
    expect(document.body.textContent).toContain('200.000đ');
  });
});

describe('STOR-157 single is_fallback flags (synthetic)', () => {
  it('top-level is_fallback true shows the failure sentence', async () => {
    await gotoStep2({ status: 200, body: QUOTE_FALLBACK_TOP_ONLY });
    expect(await failureShown()).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });

  it('per-option is_fallback true shows the failure sentence', async () => {
    await gotoStep2({ status: 200, body: QUOTE_FALLBACK_ONE_OPTION });
    expect(await failureShown()).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });
});

describe('STOR-157 retry', () => {
  it("'Thử lại' after F1 sends a second POST to /api/oms/shipping-quote", async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 }, { status: 200, body: QUOTE_V_Q1 });
    await failureShown();
    expect(quoteCalls()).toHaveLength(1);
    fireEvent.click(within(shippingSection()).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(quoteCalls()).toHaveLength(2));
  });

  it('retry returning Q1 (spec c55789ce): STANDARD card shows 78.000đ', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 }, { status: 200, body: QUOTE_V_Q1 });
    await failureShown();
    fireEvent.click(within(shippingSection()).getByRole('button', { name: 'Thử lại' }));
    expect(await within(shippingSection()).findByText(/78\.000đ/)).toBeInTheDocument();
    expect(card('Giao hàng chuẩn')).toHaveTextContent('78.000đ');
  });

  it("retry returning Q1: 'Xác nhận đặt hàng' is enabled", async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 }, { status: 200, body: QUOTE_V_Q1 });
    await failureShown();
    fireEvent.click(within(shippingSection()).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(submitBtn()).not.toBeDisabled());
  });
});

describe('STOR-157 transport errors', () => {
  it('network error on the quote shows the failure sentence', async () => {
    await gotoStep2('reject');
    expect(await failureShown()).toBeInTheDocument();
  });

  it('HTTP 500 without a body shows the failure sentence', async () => {
    await gotoStep2('nobody500');
    expect(await failureShown()).toBeInTheDocument();
  });

  it('503 SHIPPING_UNAVAILABLE shows the OMS message (spec b1477aa6)', async () => {
    await gotoStep2({ status: 503, body: ERR_503 });
    expect(await within(shippingSection()).findByText('Hệ thống vận chuyển chưa phản hồi. Vui lòng thử lại sau.')).toBeInTheDocument();
  });
});

describe('STOR-157 real zero fee (spec c55789ce Q7)', () => {
  it("fee 0 with is_fallback false keeps 'Xác nhận đặt hàng' enabled", async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q7 });
    await waitFor(() => expect(card('Giao hàng chuẩn').disabled).toBe(false));
    expect(submitBtn()).not.toBeDisabled();
    expect(within(shippingSection()).queryByText(FAILED)).toBeNull();
    expect(feeRow().textContent).toMatch(ZERO_DONG);
  });
});
