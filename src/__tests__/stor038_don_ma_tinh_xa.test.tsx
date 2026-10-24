// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200, QUOTE_200_FALLBACK, QUOTE_200_BOTH_UNAVAILABLE } from './fixtures/shippingQuote';
import {
  CONTRACT_C_BODY, ORDER_201_STANDARD_COD, ORDER_201_EXPRESS_SEPAY, ERR_DELIVERY_OPTION_UNAVAILABLE,
  ERR_C_WARD_MISMATCH, ERR_C_SKU_NOT_FOUND, ERR_C_SCHEMA_MISSING_CODE, ERR_403_TOKEN,
} from './fixtures/checkoutOrderC';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const SKU = 'TVS-AO-01-M';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
const mkItem = (extra: Partial<CartItem> = {}): CartItem => ({
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 2, tension: 11, stringOption: null, ...extra,
});

type Reply = { status: number; body: unknown };
let calls: { url: string; body: any }[];
let quoteBody: unknown;
let orderReply: Reply;
const onClearCart = vi.fn();
const reply = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const ordersOf = () => calls.filter(c => c.url.endsWith('/orders'));
const quotesOf = () => calls.filter(c => c.url === '/api/oms/shipping-quote');

beforeEach(() => {
  sessionStorage.clear();
  calls = []; alertMock.mockClear(); onClearCart.mockClear();
  quoteBody = QUOTE_200;
  orderReply = { status: 201, body: ORDER_201_STANDARD_COD };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') return reply({ status: 200, body: quoteBody });
    if (url.endsWith('/orders')) return reply(orderReply);
    if (url.endsWith('/payments')) return reply({ status: 200, body: { action: 'https://sepay.example/pay', fields: { a: 'b' } } });
    return reply({ status: 200, body: url.endsWith('/verify-otp') ? { success: true, verification_token: 'vt' } : { success: true } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function renderCart(items: CartItem[] = [mkItem()]) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  return render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={items} onRemoveItem={() => {}} onClearCart={onClearCart} /></Provider>);
}
const submitBtn = () => screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ });
const feeLine = () => screen.getByText('Phí vận chuyển:').parentElement!;

async function fillAndPick(items?: CartItem[]) {
  renderCart(items);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Đường Giải Phóng' } });
  await pickAdminUnits();
  await screen.findByText('Giao hàng chuẩn');
}
async function sendOtpAndOrder(opts: { fast?: boolean; payment?: 'COD' | 'SePay'; items?: CartItem[] } = {}) {
  await fillAndPick(opts.items);
  if (opts.fast) fireEvent.click(screen.getByText('Giao hỏa tốc'));
  fireEvent.click(screen.getByText(opts.payment === 'SePay' ? 'SePay QR Code' : 'Thanh toán COD'));
  fireEvent.click(submitBtn());
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(ordersOf().length).toBeGreaterThan(0));
  return ordersOf()[0].body;
}

describe('STOR-038 body đặt đơn mang mã tỉnh/xã, delivery_option, payment_method', () => {
  it('AC1 receiver_province_code = mã tỉnh đã chọn', async () => {
    expect((await sendOtpAndOrder()).receiver_province_code).toBe('ADM1-01');
  });
  it('AC2 receiver_ward_code = mã xã đã chọn', async () => {
    expect((await sendOtpAndOrder()).receiver_ward_code).toBe('ADM1-01.W49886');
  });
  it('AC3 thẻ Giao hỏa tốc -> EXPRESS', async () => {
    expect((await sendOtpAndOrder({ fast: true })).delivery_option).toBe('EXPRESS');
  });
  it('AC4 thẻ Giao hàng chuẩn -> STANDARD', async () => {
    expect((await sendOtpAndOrder()).delivery_option).toBe('STANDARD');
  });
  it('AC5 Thanh toán COD -> payment_method COD', async () => {
    expect((await sendOtpAndOrder({ payment: 'COD' })).payment_method).toBe('COD');
  });
  it('AC6 SePay QR Code -> payment_method SEPAY', async () => {
    expect((await sendOtpAndOrder({ payment: 'SePay' })).payment_method).toBe('SEPAY');
  });
  it('AC7 tập khoá = 10 khoá của body mẫu (C), kể cả shipping_fee', async () => {
    const body = await sendOtpAndOrder();
    const sample = JSON.parse(CONTRACT_C_BODY);
    expect(Object.keys(body).sort()).toEqual(Object.keys(sample).sort());
    expect(Object.keys(body)).toHaveLength(10);
    expect(body).toHaveProperty('shipping_fee');
  });
  describe('so với body mẫu (C) nguyên văn (spec fae8d7ae)', () => {
    const sample = JSON.parse(CONTRACT_C_BODY);
    it('AC8 tập khoá khớp', async () => {
      expect(Object.keys(await sendOtpAndOrder()).sort()).toEqual(Object.keys(sample).sort());
    });
    it('AC9 items khớp', async () => { expect((await sendOtpAndOrder()).items).toEqual(sample.items); });
    it('AC10 receiver_province_code khớp', async () => { expect((await sendOtpAndOrder()).receiver_province_code).toBe(sample.receiver_province_code); });
    it('AC11 receiver_ward_code khớp', async () => { expect((await sendOtpAndOrder()).receiver_ward_code).toBe(sample.receiver_ward_code); });
    it('AC12 delivery_option khớp', async () => { expect((await sendOtpAndOrder()).delivery_option).toBe(sample.delivery_option); });
    it('AC13 payment_method khớp', async () => { expect((await sendOtpAndOrder()).payment_method).toBe(sample.payment_method); });
  });
});

describe('STOR-038 note', () => {
  it('AC14 COD không đan cước -> note đúng "COD"', async () => {
    expect((await sendOtpAndOrder()).note).toBe('COD');
  });
  it('AC15 SePay + đan cước -> "SePay QR Code | Đan cước <sku>: <cước> <kg> Kg"', async () => {
    const items = [mkItem({ stringOption: { id: 's', name: 'BG80', price: 0 } as any, tension: 11 })];
    expect((await sendOtpAndOrder({ payment: 'SePay', items })).note).toBe(`SePay QR Code | Đan cước ${SKU}: BG80 11 Kg`);
  });
  it('AC16 dòng dựng note trong CartModal.tsx không còn Giao hỏa tốc / Giao tiêu chuẩn', () => {
    const lines = readFileSync('src/components/CartModal.tsx', 'utf8').split('\n').filter(l => /^\s*note:/.test(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(/Giao hỏa tốc|Giao tiêu chuẩn/);
  });
});

describe('STOR-038 bước 3 theo response 201', () => {
  it('AC17 fixture 201 nguyên văn: shipping_fee và total_amount là chuỗi thập phân', () => {
    expect(ORDER_201_STANDARD_COD.shipping_fee).toBe('78000.00');
    expect(ORDER_201_STANDARD_COD.total_amount).toBe('278000.00');
    expect(ORDER_201_EXPRESS_SEPAY.total_amount).toBe('426111.00');
  });
  it('AC18 hiện Phí vận chuyển = shipping_fee 201 (78.000đ)', async () => {
    await sendOtpAndOrder();
    expect(await screen.findByText('Phí vận chuyển:', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Phí vận chuyển:', { selector: 'strong' }).parentElement).toHaveTextContent('78.000đ');
  });
  it('AC19 Tổng hóa đơn thanh toán = total_amount 201, không phải tổng client', async () => {
    quoteBody = QUOTE_200_FALLBACK; // client thấy 200.000 + 30.000 = 230.000đ
    await sendOtpAndOrder();
    expect(await screen.findByText(/Tổng hóa đơn thanh toán: 278\.000đ/)).toBeInTheDocument();
    expect(screen.queryByText(/230\.000đ/, { selector: 'p' })).toBeNull();
  });
  it('AC20 total 201 khác tổng khách thấy -> câu cập nhật + phí mới', async () => {
    quoteBody = QUOTE_200_FALLBACK;
    await sendOtpAndOrder();
    expect(await screen.findByText(/^Phí vận chuyển đã được cập nhật theo báo giá mới nhất: 78\.000đ/)).toBeInTheDocument();
  });
  it('AC21 total 201 bằng tổng khách thấy -> không có câu cập nhật', async () => {
    await sendOtpAndOrder();
    await screen.findByText(/Tổng hóa đơn thanh toán: 278\.000đ/);
    expect(screen.queryByText(/Phí vận chuyển đã được cập nhật theo báo giá mới nhất/)).toBeNull();
  });
  it('AC22 total_amount không hữu hạn -> không hiện tổng client tự tính', async () => {
    orderReply = { status: 201, body: { ...ORDER_201_STANDARD_COD, total_amount: 'abc' } };
    await sendOtpAndOrder();
    const line = (await screen.findByText(/Tổng hóa đơn thanh toán:/)).textContent!;
    expect(line).toBe('Tổng hóa đơn thanh toán: Chưa nhận được tổng tiền từ hệ thống — cửa hàng sẽ xác nhận lại với bạn.');
    expect(screen.queryByText(/278\.000đ/)).toBeNull();
    expect(screen.queryByText(/1\.\d{3}\.000đ/)).toBeNull();
  });
  it('shipping_fee 201 không hữu hạn -> dòng phí nói rõ, không câu "đã được cập nhật" rỗng', async () => {
    orderReply = { status: 201, body: { ...ORDER_201_STANDARD_COD, shipping_fee: 'abc' } };
    await sendOtpAndOrder();
    const line = (await screen.findByText(/Phí vận chuyển:/)).closest('p')!.textContent!;
    expect(line).toBe('• Phí vận chuyển: Chưa nhận được phí vận chuyển từ hệ thống — cửa hàng sẽ xác nhận lại với bạn.');
    expect(screen.queryByText(/đã được cập nhật theo báo giá mới nhất/)).toBeNull();
  });
  it('AC23 SePay: sau 201 vẫn POST /payments với order_number của 201', async () => {
    await sendOtpAndOrder({ payment: 'SePay' });
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/payments'))).toBe(true));
    expect(calls.find(c => c.url.endsWith('/payments'))!.body).toEqual({ order_number: ORDER_201_STANDARD_COD.order_number });
  });
});

describe('STOR-038 422 của (C)', () => {
  const fixedFallback = 'Đơn hàng chưa được chấp nhận. Vui lòng kiểm tra lại thông tin rồi thử lại.';
  it.each([
    ['AC24 DELIVERY_OPTION_UNAVAILABLE', ERR_DELIVERY_OPTION_UNAVAILABLE.message],
    ['AC26 RECEIVER_WARD_PROVINCE_MISMATCH', 'Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.'],
    ['AC27 SKU_NOT_FOUND', 'Không tìm thấy sản phẩm có mã TVS-AO-01-M.'],
    ['AC28 schema detail[0].msg', 'Địa chỉ người nhận thiếu mã tỉnh/thành hoặc phường/xã chuẩn.'],
  ])('%s: popup hiện message OMS nguyên văn; ở bước 2; không xoá giỏ', async (name, message) => {
    const body = { 'AC24 DELIVERY_OPTION_UNAVAILABLE': ERR_DELIVERY_OPTION_UNAVAILABLE, 'AC26 RECEIVER_WARD_PROVINCE_MISMATCH': ERR_C_WARD_MISMATCH,
      'AC27 SKU_NOT_FOUND': ERR_C_SKU_NOT_FOUND, 'AC28 schema detail[0].msg': ERR_C_SCHEMA_MISSING_CODE }[name];
    orderReply = { status: 422, body };
    await sendOtpAndOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(message));
    expect(screen.getByText('Thanh Toán Đơn Hàng')).toBeInTheDocument(); // AC29
    expect(screen.queryByText('ĐẶT HÀNG THÀNH CÔNG!')).toBeNull();
    expect(onClearCart).not.toHaveBeenCalled(); // AC30
  });
  it('AC25 DELIVERY_OPTION_UNAVAILABLE -> báo giá lại đúng một lần nữa; 422 khác thì không', async () => {
    orderReply = { status: 422, body: ERR_DELIVERY_OPTION_UNAVAILABLE };
    await sendOtpAndOrder();
    await waitFor(() => expect(quotesOf()).toHaveLength(2));
  });
  it('AC25b RECEIVER_WARD_PROVINCE_MISMATCH -> báo giá lại (STOR-049: field_path receiver_ward_code)', async () => {
    orderReply = { status: 422, body: ERR_C_WARD_MISMATCH };
    await sendOtpAndOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    await waitFor(() => expect(quotesOf()).toHaveLength(2));
  });
  it('AC31 sau 422 bấm đặt lại: POST /orders lần hai đi luôn, không send-otp lần nữa', async () => {
    orderReply = { status: 422, body: ERR_C_WARD_MISMATCH };
    await sendOtpAndOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    await waitFor(() => expect(submitBtn()).not.toBeDisabled());
    fireEvent.click(submitBtn());
    await waitFor(() => expect(ordersOf()).toHaveLength(2));
    expect(calls.filter(c => c.url.endsWith('/send-otp'))).toHaveLength(1);
    expect(ordersOf()[1].body.verification_token).toBe('vt');
  });
  it('422 body không có message nào -> câu cố định, không popup rỗng', async () => {
    orderReply = { status: 422, body: null };
    await sendOtpAndOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(fixedFallback));
  });
  it('AC32 403 OTP vừa gửi < 60s: báo còn N giây gửi lại (STOR-042)', async () => {
    orderReply = { status: 403, body: ERR_403_TOKEN };
    await sendOtpAndOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Bạn có thể nhận mã mới sau')));
  });
});

describe('STOR-038 dòng Phí vận chuyển khi chưa có giá', () => {
  it('AC64 đã chọn xã, báo giá lỗi -> "Chưa tính được phí"', async () => {
    quoteBody = null;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
      return reply({ status: 503, body: { message: 'Hệ thống vận chuyển chưa phản hồi. Vui lòng thử lại sau.' } });
    }));
    renderCart();
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    await pickAdminUnits();
    await screen.findByText('Hệ thống vận chuyển chưa phản hồi. Vui lòng thử lại sau.');
    expect(feeLine()).toHaveTextContent('Chưa tính được phí');
    expect(feeLine()).not.toHaveTextContent('Chọn địa chỉ để tính phí');
  });
  it('AC65 cả hai option không dùng được -> "Không có phương thức giao"', async () => {
    quoteBody = QUOTE_200_BOTH_UNAVAILABLE;
    renderCart();
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    await pickAdminUnits();
    await screen.findByText(/chưa có phương thức giao hàng nào/);
    expect(feeLine()).toHaveTextContent('Không có phương thức giao');
  });
  it('AC66 chưa chọn xã -> "Chọn địa chỉ để tính phí"', () => {
    renderCart();
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    expect(feeLine()).toHaveTextContent('Chọn địa chỉ để tính phí');
  });
  it.each([[422, 'Không tính được phí vận chuyển cho giỏ hàng và địa chỉ này.'], [500, 'Chưa tính được phí vận chuyển. Vui lòng thử lại.']])(
    'AC67 message OMS rỗng (HTTP %s) -> câu cố định, không dòng lỗi rỗng', async (status, fixed) => {
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
        return reply({ status, body: { code: 'X', message: '' } });
      }));
      renderCart();
      fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
      await pickAdminUnits();
      const section = screen.getByText('Phương thức vận chuyển').parentElement!;
      expect(await within(section).findByText(fixed)).toBeInTheDocument();
      const alerts = within(section).getAllByRole('alert');
      for (const a of alerts) expect(a.textContent!.trim()).not.toBe('');
      for (const p of Array.from(section.querySelectorAll('p'))) expect(p.textContent!.trim()).not.toBe('');
    });
});
