// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { sportApi } from '../services/sportApi';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, ERR_429, ERR_503, ERR_401, pickAdminUnits } from './fixtures/adminUnits';
import {
  QUOTE_REQUEST, QUOTE_200, QUOTE_200_EXPRESS_UNAVAILABLE, QUOTE_200_STANDARD_UNAVAILABLE, QUOTE_200_BOTH_UNAVAILABLE,
  QUOTE_200_FALLBACK, ERR_SKU_NOT_FOUND, ERR_WARD_MISMATCH, ERR_422_SCHEMA_B, QUOTE_REAL_DEV, WARD_BODY_REAL,
} from './fixtures/shippingQuote';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const SKU = 'TVS-AO-01-M';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
const mkItem = (quantity: number): CartItem => ({
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity, tension: 10, stringOption: null,
});
const ORDER_201 = { id: 7, order_number: 'DH-7', shipping_address: '12 Phố Huế, Phường Ba Đình, Hà Nội', shipping_fee: '78000.00', total_amount: '278000.00' };

type Reply = { status: number; body: unknown } | 'reject';
type QuoteHandler = (body: any, n: number) => Reply | Promise<Reply>;
let calls: { url: string; body: any }[];
let quoteHandler: QuoteHandler;
let wardBody: unknown;
const onClearCart = vi.fn();
const ok = (body: unknown): Reply => ({ status: 200, body });

function reply(r: Reply) {
  if (r === 'reject') throw new TypeError('Failed to fetch');
  return { ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
}
const quoteCalls = () => calls.filter(c => c.url === '/api/oms/shipping-quote');

beforeEach(() => {
  calls = []; alertMock.mockClear(); onClearCart.mockClear();
  quoteHandler = () => ok(QUOTE_200);
  wardBody = WARD_BODY;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) return reply(ok(url.includes('level=ward') ? wardBody : PROVINCE_BODY));
    if (url === '/api/oms/shipping-quote') return reply(await quoteHandler(body, quoteCalls().length));
    const json = url.endsWith('/verify-otp') ? { success: true, verification_token: 'vt' }
      : url.endsWith('/orders') ? ORDER_201 : { success: true };
    return reply(ok(json));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function renderCart(quantity = 2) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  const ui = (q: number) => (
    <Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[mkItem(q)]} onRemoveItem={() => {}} onClearCart={onClearCart} /></Provider>
  );
  const r = render(ui(quantity));
  return { ...r, ui };
}
const toStep2 = () => fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
const toStep1 = () => fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
async function gotoQuote(quantity = 2) {
  const r = renderCart(quantity);
  toStep2();
  await pickAdminUnits();
  return r;
}
const findCard = async (label: string) => (await screen.findByText(label)).closest('button')!;
const feeLine = () => screen.getByText('Phí vận chuyển:').parentElement!;
const totalLine = () => screen.getByText('Tổng cộng thanh toán:').parentElement!;
const submitBtn = () => screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ });
const pickWard = async (name: string) => {
  fireEvent.focus(screen.getByRole('combobox', { name: 'Phường/Xã' }));
  fireEvent.click(await screen.findByRole('option', { name }));
};
const shippingSection = () => screen.getByText('Phương thức vận chuyển').parentElement!;
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

describe('STOR-037 sportApi.getShippingQuote', () => {
  it('AC3 POST /api/oms/shipping-quote, body JSON', async () => {
    const data = await sportApi.getShippingQuote(QUOTE_REQUEST as any);
    expect(data).toEqual(QUOTE_200);
    const f = (fetch as any).mock.calls[0];
    expect(f[0]).toBe('/api/oms/shipping-quote');
    expect(f[1].method).toBe('POST');
    expect(f[1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(f[1].body)).toEqual(QUOTE_REQUEST);
  });

  it('AC4 non-2xx -> throw có .status và .body đã parse', async () => {
    quoteHandler = () => ({ status: 429, body: ERR_429 });
    await expect(sportApi.getShippingQuote(QUOTE_REQUEST as any)).rejects.toMatchObject({ status: 429, body: ERR_429 });
  });

  it('200 không có mảng options -> throw', async () => {
    quoteHandler = () => ok({ currency: 'VND' });
    await expect(sportApi.getShippingQuote(QUOTE_REQUEST as any)).rejects.toThrow();
  });
});

describe('STOR-037 gọi báo giá', () => {
  it('AC5 body request = hợp đồng (B) nguyên văn', async () => {
    await gotoQuote();
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    expect(quoteCalls()[0].body).toEqual(QUOTE_REQUEST);
  });

  it('AC6 chưa chọn xã (kể cả đã chọn tỉnh) -> chưa có request', async () => {
    renderCart();
    toStep2();
    fireEvent.focus(await screen.findByRole('combobox', { name: 'Tỉnh/Thành phố' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
    await screen.findByRole('combobox', { name: 'Phường/Xã' });
    expect(quoteCalls()).toHaveLength(0);
  });

  it('AC26 bước 1 rồi về bước 2 cùng giỏ+xã -> đúng 1 request', async () => {
    await gotoQuote();
    await screen.findByText('Giao hàng chuẩn');
    toStep1(); toStep2();
    await screen.findByText('Giao hàng chuẩn');
    expect(quoteCalls()).toHaveLength(1);
  });

  it('AC27 đổi xã -> request thứ hai với mã xã mới', async () => {
    await gotoQuote();
    await screen.findByText('Giao hàng chuẩn');
    await pickWard('Phường Hoàn Kiếm');
    await waitFor(() => expect(quoteCalls()).toHaveLength(2));
    expect(quoteCalls()[1].body.receiver_ward_code).toBe('ADM1-01.W49887');
  });

  it('AC28 đổi số lượng ở bước 1 rồi về bước 2 -> request mới với số lượng mới', async () => {
    const { rerender, ui } = await gotoQuote(2);
    await screen.findByText('Giao hàng chuẩn');
    toStep1();
    rerender(ui(3));
    toStep2();
    await waitFor(() => expect(quoteCalls()).toHaveLength(2));
    expect(quoteCalls()[1].body.items).toEqual([{ sku_code: SKU, quantity: 3 }]);
  });

  it('AC29 kết quả của lần gọi cũ về sau lần mới -> hiện số của lần mới', async () => {
    const d1 = deferred<Reply>(); const d2 = deferred<Reply>();
    quoteHandler = (_b, n) => (n === 1 ? d1.promise : d2.promise);
    await gotoQuote();
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    await pickWard('Phường Hoàn Kiếm');
    await waitFor(() => expect(quoteCalls()).toHaveLength(2));
    d2.resolve(ok(QUOTE_200));
    expect(await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/)).toBeInTheDocument();
    d1.resolve(ok(QUOTE_200_FALLBACK));
    await new Promise(r => setTimeout(r, 20));
    expect(within(await findCard('Giao hàng chuẩn')).getByText(/78\.000đ/)).toBeInTheDocument();
    expect(feeLine()).toHaveTextContent('78.000đ');
  });
});

describe('STOR-037 hiện số OMS trả', () => {
  it('AC7-9,11,12 body 200 nguyên văn: thẻ chuẩn 78.000đ, hỏa tốc 226.111đ, Dự kiến 2 ngày, dòng phí, tổng', async () => {
    await gotoQuote();
    expect(await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/)).toBeInTheDocument();
    expect(within(await findCard('Giao hỏa tốc')).getByText(/226\.111đ/)).toBeInTheDocument();
    expect(within(await findCard('Giao hàng chuẩn')).getByText(/Dự kiến 2 ngày/)).toBeInTheDocument();
    expect(feeLine()).toHaveTextContent('78.000đ');
    expect(totalLine()).toHaveTextContent('278.000đ');
    expect(screen.queryByText('Phí tạm tính')).toBeNull();
  });

  it('AC10,24,25 fallback 200: không "Dự kiến", thẻ và dòng phí ghi Phí tạm tính', async () => {
    quoteHandler = () => ok(QUOTE_200_FALLBACK);
    await gotoQuote();
    await within(await findCard('Giao hàng chuẩn')).findByText(/30\.000đ/);
    expect(screen.queryByText(/Dự kiến/)).toBeNull();
    expect(within(await findCard('Giao hàng chuẩn')).getByText('Phí tạm tính')).toBeInTheDocument();
    expect(within(await findCard('Giao hỏa tốc')).getByText('Phí tạm tính')).toBeInTheDocument();
    expect(within(feeLine()).getByText('Phí tạm tính')).toBeInTheDocument();
  });

  it('AC13 bấm Giao hỏa tốc -> dòng phí 226.111đ', async () => {
    await gotoQuote();
    await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/);
    fireEvent.click(screen.getByText('Giao hỏa tốc'));
    expect(feeLine()).toHaveTextContent('226.111đ');
    expect(totalLine()).toHaveTextContent('426.111đ');
  });

  it('AC67 body THẬT của OMS dev (fallback, xã ADM1-01.W49827): thẻ chuẩn 30.000đ + Phí tạm tính', async () => {
    quoteHandler = () => ok(QUOTE_REAL_DEV);
    wardBody = WARD_BODY_REAL;
    await gotoQuote();
    const std = await findCard('Giao hàng chuẩn');
    expect(await within(std).findByText(/30\.000đ/)).toBeInTheDocument();
    expect(within(std).getByText('Phí tạm tính')).toBeInTheDocument();
    expect(quoteCalls()[0].body.receiver_ward_code).toBe('ADM1-01.W49827');
  });
});

describe('STOR-037 option không dùng được', () => {
  it('AC17,19 hỏa tốc unavailable: lý do nguyên văn, thẻ khoá', async () => {
    quoteHandler = () => ok(QUOTE_200_EXPRESS_UNAVAILABLE);
    await gotoQuote();
    const ex = await findCard('Giao hỏa tốc');
    expect(await within(ex).findByText('Chưa có dịch vụ giao hỏa tốc cho địa chỉ này.')).toBeInTheDocument();
    expect(ex).toBeDisabled();
    expect(ex).toHaveAttribute('aria-disabled', 'true');
  });

  it('AC18 chuẩn unavailable: lý do nguyên văn trên thẻ chuẩn', async () => {
    quoteHandler = () => ok(QUOTE_200_STANDARD_UNAVAILABLE);
    await gotoQuote();
    expect(await within(await findCard('Giao hàng chuẩn')).findByText('Chưa có dịch vụ giao tiêu chuẩn cho địa chỉ này.')).toBeInTheDocument();
  });

  it('AC20 bấm thẻ khoá -> dòng phí không đổi', async () => {
    quoteHandler = () => ok(QUOTE_200_EXPRESS_UNAVAILABLE);
    await gotoQuote();
    await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/);
    fireEvent.click(screen.getByText('Giao hỏa tốc'));
    expect(feeLine()).toHaveTextContent('78.000đ');
    expect(feeLine()).not.toHaveTextContent('226.111đ');
  });

  it('AC21 đang chọn hỏa tốc, báo giá mới báo hỏa tốc unavailable -> chuyển về chuẩn, dòng phí = phí chuẩn', async () => {
    quoteHandler = (_b, n) => ok(n === 1 ? QUOTE_200 : QUOTE_200_EXPRESS_UNAVAILABLE);
    await gotoQuote();
    await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/);
    fireEvent.click(screen.getByText('Giao hỏa tốc'));
    expect(feeLine()).toHaveTextContent('226.111đ');
    await pickWard('Phường Hoàn Kiếm');
    await waitFor(() => expect(feeLine()).toHaveTextContent('78.000đ'));
    expect((await findCard('Giao hàng chuẩn')).className).toContain('border-brand-primary');
  });

  it('AC22,23 cả hai unavailable: câu rõ + nút đặt đơn khoá', async () => {
    quoteHandler = () => ok(QUOTE_200_BOTH_UNAVAILABLE);
    await gotoQuote();
    expect(await screen.findByText('Địa chỉ này hiện chưa có phương thức giao hàng nào. Vui lòng chọn địa chỉ khác.')).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });
});

describe('STOR-037 lỗi báo giá', () => {
  it.each([
    ['AC30,33 422 SKU_NOT_FOUND', 422, ERR_SKU_NOT_FOUND, 'Không tìm thấy sản phẩm có mã TVS-AO-01-M.', false],
    ['AC31,33 422 RECEIVER_WARD_PROVINCE_MISMATCH', 422, ERR_WARD_MISMATCH, 'Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.', false],
    ['AC32,33 422 schema', 422, ERR_422_SCHEMA_B, 'Không tính được phí vận chuyển cho giỏ hàng và địa chỉ này.', false],
    ['AC34,35 429', 429, ERR_429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.', true],
    ['AC36,37 503', 503, ERR_503, 'Hệ thống vận chuyển chưa phản hồi. Vui lòng thử lại sau.', true],
    ['502 upstream_unreachable', 502, { error: 'upstream_unreachable' }, 'Chưa tính được phí vận chuyển. Vui lòng thử lại.', true],
    ['401 detail chuỗi', 401, ERR_401, 'Chưa tính được phí vận chuyển. Vui lòng thử lại.', true],
    ['500 không body', 500, null, 'Chưa tính được phí vận chuyển. Vui lòng thử lại.', true],
  ])('%s: câu đúng trong khu vận chuyển, Thử lại=%s, nút đặt đơn khoá, không có thẻ', async (_n, status, body, text, retry) => {
    quoteHandler = () => ({ status, body });
    await gotoQuote();
    expect(await within(shippingSection()).findByText(text)).toBeInTheDocument();
    expect(!!within(shippingSection()).queryByRole('button', { name: 'Thử lại' })).toBe(retry);
    expect(submitBtn()).toBeDisabled();
    expect(screen.queryByText('Giao hàng chuẩn')).toBeNull();
    expect(feeLine()).toHaveTextContent('Chọn địa chỉ để tính phí');
  });

  it('AC38,39 mạng reject: câu cố định + Thử lại', async () => {
    quoteHandler = () => 'reject';
    await gotoQuote();
    expect(await within(shippingSection()).findByText('Chưa tính được phí vận chuyển. Vui lòng thử lại.')).toBeInTheDocument();
    expect(within(shippingSection()).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('AC40,41 Thử lại sau 429 -> request mới; 200 -> thẻ chuẩn 78.000đ', async () => {
    quoteHandler = (_b, n) => (n === 1 ? { status: 429, body: ERR_429 } : ok(QUOTE_200));
    await gotoQuote();
    fireEvent.click(await within(shippingSection()).findByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(quoteCalls()).toHaveLength(2));
    expect(await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/)).toBeInTheDocument();
    expect(submitBtn()).not.toBeDisabled();
  });
});

describe('STOR-037 khoá đặt đơn khi chưa có giá', () => {
  it('AC42 đang tải báo giá -> nút khoá', async () => {
    const d = deferred<Reply>();
    quoteHandler = () => d.promise;
    await gotoQuote();
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    expect(submitBtn()).toBeDisabled();
    expect(feeLine()).toHaveTextContent('Đang tính phí...');
    d.resolve(ok(QUOTE_200));
    await waitFor(() => expect(submitBtn()).not.toBeDisabled());
  });

  it('AC43 submit form bước 2 khi báo giá lỗi -> không gọi send-otp', async () => {
    quoteHandler = () => ({ status: 429, body: ERR_429 });
    await gotoQuote();
    await within(shippingSection()).findByText(ERR_429.message);
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '12 Phố Huế' } });
    fireEvent.submit(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà').closest('form')!);
    await new Promise(r => setTimeout(r, 20));
    expect(calls.some(c => c.url.endsWith('/send-otp'))).toBe(false);
  });

  it('AC44 bước 1 chưa có báo giá: "Chọn địa chỉ để tính phí", tổng không có số', () => {
    renderCart();
    expect(feeLine()).toHaveTextContent('Chọn địa chỉ để tính phí');
    expect(totalLine().querySelector('span:last-child')!.textContent).toBe('');
    expect(quoteCalls()).toHaveLength(0);
  });
});

describe('STOR-037 đặt đơn (OMS-131, phí = option đang chọn)', () => {
  async function placeOrder(fast: boolean) {
    await gotoQuote();
    await within(await findCard('Giao hàng chuẩn')).findByText(/78\.000đ/);
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: ' 12 Phố Huế ' } });
    if (fast) fireEvent.click(screen.getByText('Giao hỏa tốc'));
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
    return calls.find(c => c.url.endsWith('/orders'))!.body;
  }

  it('AC14 hỏa tốc COD -> shipping_fee 226111', async () => {
    expect((await placeOrder(true)).shipping_fee).toBe(226111);
  });

  it('AC15 body đơn đúng 6 khoá, không receiver_*/delivery_option; chuẩn -> 78000', async () => {
    const body = await placeOrder(false);
    expect(Object.keys(body).sort()).toEqual(['customer', 'items', 'note', 'shipping_address', 'shipping_fee', 'verification_token']);
    expect(body.shipping_fee).toBe(78000);
    expect(body.note).toBe('Đơn web - Giao tiêu chuẩn | COD');
  });

  it('AC16 bước 3: Tổng hóa đơn = tiền hàng + phí đã báo', async () => {
    await placeOrder(true);
    expect(await screen.findByText(/Tổng hóa đơn thanh toán: 426\.111đ/)).toBeInTheDocument();
  });
});
