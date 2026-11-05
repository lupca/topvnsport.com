// @vitest-environment jsdom
// STOR-157: a failed shipping quote (is_fallback, spec 08893767) blocks checkout with no fee shown;
// GA4/Meta purchase value = 201 total_amount (items + fee paid), GA4 shipping = 201 shipping_fee (spec a4918ed8, c4c05162).
// Real CartModal + real src/lib/tracking.ts; only fetch, window.gtag and window.fbq are stubbed.
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
  QUOTE_V_Q1, QUOTE_F1, QUOTE_F3, QUOTE_FALLBACK_TOP_ONLY, QUOTE_FALLBACK_ONE_OPTION, ORDER_201_O1,
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
let orderBody: unknown;
let gtag: ReturnType<typeof vi.fn>;
let fbq: ReturnType<typeof vi.fn>;

const respond = (r: { status: number; body: unknown }) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');
const orderCalls = () => calls.filter(c => c.url.endsWith('/orders'));

beforeEach(() => {
  calls = []; alertMock.mockClear(); localStorage.clear();
  quoteReplies = [{ status: 200, body: QUOTE_V_Q1 }];
  orderBody = ORDER_201_O1;
  gtag = vi.fn(); fbq = vi.fn();
  vi.stubGlobal('gtag', gtag);
  vi.stubGlobal('fbq', fbq);
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
    if (url.endsWith('/orders')) return respond({ status: 201, body: orderBody });
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
const gaPurchase = async () => {
  await waitFor(() => expect(gtag.mock.calls.some(c => c[0] === 'event' && c[1] === 'purchase')).toBe(true));
  return gtag.mock.calls.find(c => c[0] === 'event' && c[1] === 'purchase')![2];
};
const metaPurchase = async () => {
  await waitFor(() => expect(fbq.mock.calls.some(c => c[0] === 'track' && c[1] === 'Purchase')).toBe(true));
  return fbq.mock.calls.find(c => c[0] === 'track' && c[1] === 'Purchase')![2];
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

  it('Enter in the form sends no POST to /api/oms/checkout/orders', async () => {
    await gotoStep2({ status: 200, body: QUOTE_F1 });
    await failureShown();
    fillForm();
    fireEvent.submit(document.getElementById('checkout-form')!);
    await new Promise(r => setTimeout(r, 30));
    expect(calls.filter(c => c.url === '/api/oms/checkout/orders')).toHaveLength(0);
    expect(orderCalls()).toHaveLength(0);
    expect(screen.queryByPlaceholderText('Nhập 6 số OTP')).toBeNull();
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

describe('STOR-157 purchase tracking (order O1, spec a4918ed8)', () => {
  it('GA4 purchase value is 248000', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    expect((await gaPurchase()).value).toBe(248000);
  });

  it('GA4 purchase shipping is 48000', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    expect((await gaPurchase()).shipping).toBe(48000);
  });

  it('Meta Purchase value is 248000', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    expect((await metaPurchase()).value).toBe(248000);
  });

  it('Meta Purchase params have no shipping key', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    expect(await metaPurchase()).not.toHaveProperty('shipping');
  });

  it('Meta Purchase params have no voucher key', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    expect(await metaPurchase()).not.toHaveProperty('voucher');
  });

  it('Meta Purchase params have no discount key', async () => {
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    expect(await metaPurchase()).not.toHaveProperty('discount');
  });

  it('non-finite 201 shipping_fee: GA4 purchase params have no shipping key', async () => {
    orderBody = { ...ORDER_201_O1, shipping_fee: 'NaN' };
    await gotoStep2({ status: 200, body: QUOTE_V_Q1 });
    await placeOrder();
    const params = await gaPurchase();
    expect(params.value).toBe(248000);
    expect(params).not.toHaveProperty('shipping');
  });
});
