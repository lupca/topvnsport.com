// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { CreateOrderPayload, ShippingQuote, ShippingQuoteOption } from '../services/sport-api/types';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import {
  QUOTE_200, QUOTE_V_Q1, QUOTE_V_Q2, QUOTE_V_Q3, QUOTE_V_Q7, QUOTE_V_Q8, ERR_SHIPPING_VOUCHER_NOT_APPLICABLE,
} from './fixtures/shippingQuote';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

// Cart: 2 x 100.000đ = 200.000đ of goods.
const SKU = 'TVS-AO-01-M';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 2, tension: 10, stringOption: null,
};

type Reply = { status: number; body: unknown };
let calls: { url: string; body: any }[];
let quoteBody: unknown;
let orderReply: Reply;

const reply = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');

beforeEach(() => {
  calls = []; alertMock.mockClear();
  quoteBody = QUOTE_V_Q3;
  orderReply = { status: 201, body: { id: 155, order_number: 'DH-155', shipping_fee: '15000.00', total_amount: '215000.00' } };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') return reply({ status: 200, body: quoteBody });
    if (url.endsWith('/verify-otp')) return reply({ status: 200, body: { success: true, verification_token: 'vt-155' } });
    if (url.endsWith('/orders')) return reply(orderReply);
    return reply({ status: 200, body: { success: true } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function gotoQuote(body: unknown, option: 'STANDARD' | 'EXPRESS' = 'STANDARD') {
  quoteBody = body;
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await pickAdminUnits();
  await screen.findByText('Giao hỏa tốc');
  await waitFor(() => expect(card('Giao hàng chuẩn').disabled).toBe(false));
  if (option === 'EXPRESS') fireEvent.click(screen.getByText('Giao hỏa tốc'));
}
const card = (label: string) => screen.getByText(label).closest('button')! as HTMLButtonElement;
const row = (label: string) => screen.getByText(label).parentElement!;
const feeRow = () => row('Phí vận chuyển:');
const struckIn = (el: HTMLElement) => el.querySelector('.line-through');
const shippingSection = () => screen.getByText('Phương thức vận chuyển').parentElement!;

async function submitOrder() {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
  return calls.find(c => c.url.endsWith('/orders'))!.body;
}

describe('STOR-155 types', () => {
  it('Quote types declare the voucher fields', () => {
    // Compile-time: npm run typecheck fails if a key is missing from types.ts.
    const opt: ShippingQuoteOption = { ...QUOTE_V_Q3.options[1] };
    const quote: ShippingQuote = { ...QUOTE_V_Q3, voucher: QUOTE_V_Q3.voucher as NonNullable<ShippingQuote['voucher']> };
    const echo: CreateOrderPayload['shipping_discount'] = 30000;
    expect([opt.shipping_fee_original, opt.shipping_discount, opt.voucher_message, quote.voucher?.name, echo])
      .toEqual([45000, 30000, null, 'Freeship hỏa tốc tháng 11', 30000]);
  });
});

describe('STOR-155 footer: original fee struck, discount row, fee paid (all from the server)', () => {
  it('A discount shows the original fee struck through (Q3 EXPRESS 45.000đ)', async () => {
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(struckIn(feeRow())?.textContent).toBe('45.000đ');
  });

  it('A discount shows the fee paid after it (Q3 EXPRESS 15.000đ)', async () => {
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 45.000đ 15.000đ');
    const paid = within(feeRow()).getByText('15.000đ');
    expect(paid.className).not.toContain('line-through');
  });

  it("A discount shows a 'Giảm phí vận chuyển' row with a negative amount (Q3 EXPRESS −30.000đ)", async () => {
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(row('Giảm phí vận chuyển:')).toHaveTextContent('Giảm phí vận chuyển: −30.000đ');
  });

  it('Discount 0 shows no struck fee and no discount row (Q1 STANDARD, Q3 STANDARD 35.000đ unstruck)', async () => {
    await gotoQuote(QUOTE_V_Q1);
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 78.000đ');
    expect(struckIn(feeRow())).toBeNull();
    expect(screen.queryByText('Giảm phí vận chuyển:')).toBeNull();
    cleanup();
    await gotoQuote(QUOTE_V_Q3);
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 35.000đ');
    expect(struckIn(feeRow())).toBeNull();
    expect(screen.queryByText('Giảm phí vận chuyển:')).toBeNull();
  });

  it('Q7 STANDARD (full free-ship, no cap) shows 0đ paid, 35.000đ struck and −35.000đ discount', async () => {
    await gotoQuote(QUOTE_V_Q7);
    expect(feeRow()).toHaveTextContent('Phí vận chuyển: 35.000đ 0đ');
    expect(struckIn(feeRow())?.textContent).toBe('35.000đ');
    expect(row('Giảm phí vận chuyển:')).toHaveTextContent('−35.000đ');
    expect(row('Tổng cộng thanh toán:')).toHaveTextContent('200.000đ');
  });

  it('Total equals items plus server shipping_fee (Q3 EXPRESS 200.000 + 15.000)', async () => {
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(row('Tổng cộng thanh toán:').querySelector('span:last-child')!.textContent).toBe('215.000đ');
  });

  it('Items total is the same with Q3 as Q1 (a voucher never touches goods)', async () => {
    await gotoQuote(QUOTE_V_Q1, 'EXPRESS');
    const q1 = row('Tổng tiền hàng:').textContent;
    cleanup();
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(row('Tổng tiền hàng:').textContent).toBe(q1);
    expect(row('Tổng tiền hàng:')).toHaveTextContent('Tổng tiền hàng: 200.000đ');
    expect(screen.queryByText('Giảm giá sản phẩm:')).toBeNull();
  });
});

describe('STOR-155 option buttons', () => {
  it('Option buttons show their own struck fee (Q3: EXPRESS struck, STANDARD not; Q7: the reverse)', async () => {
    await gotoQuote(QUOTE_V_Q3);
    expect(struckIn(card('Giao hỏa tốc'))?.textContent).toBe('45.000đ');
    expect(card('Giao hỏa tốc')).toHaveTextContent('15.000đ');
    expect(struckIn(card('Giao hàng chuẩn'))).toBeNull();
    cleanup();
    await gotoQuote(QUOTE_V_Q7);
    expect(struckIn(card('Giao hàng chuẩn'))?.textContent).toBe('35.000đ');
    expect(card('Giao hàng chuẩn')).toHaveTextContent('35.000đ0đ');
    expect(struckIn(card('Giao hỏa tốc'))).toBeNull();
  });
});

describe('STOR-155 voucher texts (verbatim from the server)', () => {
  it("An auto voucher shows 'Đã áp dụng: <name>' with no typing", async () => {
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(screen.getByText('Đã áp dụng: Freeship hỏa tốc tháng 11')).toBeInTheDocument();
    expect(quoteCalls()[0].body).not.toHaveProperty('voucher_code');
    cleanup();
    await gotoQuote(QUOTE_V_Q7);
    expect(screen.getByText('Đã áp dụng: Chỉ giao thường')).toBeInTheDocument();
  });

  it('voucher_message is shown verbatim (Q3 STANDARD, Q7 EXPRESS)', async () => {
    await gotoQuote(QUOTE_V_Q3);
    expect(within(shippingSection()).getByText('Mã chỉ áp dụng cho Giao hoả tốc')).toBeInTheDocument();
    expect(screen.queryByText(/Đã áp dụng/)).toBeNull();
    cleanup();
    await gotoQuote(QUOTE_V_Q7, 'EXPRESS');
    expect(within(shippingSection()).getByText('Mã chỉ áp dụng cho Giao tiêu chuẩn')).toBeInTheDocument();
  });

  it('Invalid voucher.message is shown verbatim (Q2; Q8 once, not twice)', async () => {
    await gotoQuote(QUOTE_V_Q2);
    expect(within(shippingSection()).getByText('Mã giảm phí vận chuyển không tồn tại hoặc không đúng')).toBeInTheDocument();
    cleanup();
    await gotoQuote(QUOTE_V_Q8);
    expect(within(shippingSection()).getAllByText('Đơn hàng chưa đạt giá trị tối thiểu 500.000đ để dùng mã')).toHaveLength(1);
  });
});

describe('STOR-155 order request (spec a4918ed8 §5 echo)', () => {
  it('The order request sends the shown discount (Q3 EXPRESS: fee 15000, discount 30000)', async () => {
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    const body = await submitOrder();
    expect(body.shipping_fee).toBe(15000);
    expect(body.shipping_discount).toBe(30000);
    expect(body.delivery_option).toBe('EXPRESS');
  });

  it('A body without the voucher fields (QUOTE_200) sends no shipping_discount key', async () => {
    await gotoQuote(QUOTE_200);
    const body = await submitOrder();
    expect(body.shipping_fee).toBe(78000);
    expect(body).not.toHaveProperty('shipping_discount');
  });

  it('A 422 NOT_APPLICABLE shows the server message', async () => {
    orderReply = { status: 422, body: ERR_SHIPPING_VOUCHER_NOT_APPLICABLE };
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    await submitOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Ưu đãi phí vận chuyển không còn hiệu lực. Vui lòng thử lại.'));
  });

  it('After that 422 the quote is fetched again', async () => {
    orderReply = { status: 422, body: ERR_SHIPPING_VOUCHER_NOT_APPLICABLE };
    await gotoQuote(QUOTE_V_Q3, 'EXPRESS');
    expect(quoteCalls()).toHaveLength(1);
    await submitOrder();
    await waitFor(() => expect(quoteCalls()).toHaveLength(2));
  });
});
