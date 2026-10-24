// @vitest-environment jsdom
// STOR-049: [S3] 5d27893e "Báo giá 422 địa chỉ người nhận" + [S1] fae8d7ae (B) OMS-139. Body 422 nguyên văn.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200 } from './fixtures/shippingQuote';
import { ORDER_201_STANDARD_COD } from './fixtures/checkoutOrderC';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const MSG_WARD = 'Phường/xã đã chọn không thuộc tỉnh/thành đã chọn.';
const MSG_MAP = 'Mã đơn vị hành chính ADM1-01.W49886 chưa có ánh xạ địa chỉ cho hãng VIETTEL_POST.';
const mk = (code: string, message: string, field_path: string | null) =>
  ({ code, message, field_path, detail: { code, message, field_path } });
const ERR_WARD = mk('RECEIVER_WARD_PROVINCE_MISMATCH', MSG_WARD, 'receiver_ward_code');
const ERR_MAP_WARD = mk('ADDRESS_NOT_MAPPED', MSG_MAP, 'receiver_ward_code');
const ERR_MAP_PROV = mk('ADDRESS_NOT_MAPPED', MSG_MAP, 'receiver_province_code');
const ERR_MAP_NULL = mk('ADDRESS_NOT_MAPPED', MSG_MAP, null);
const QUOTE_REJECTED = 'Không tính được phí vận chuyển cho giỏ hàng và địa chỉ này.';

const SKU = 'TVS-AO-01-M';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 9,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 9 }],
} as any;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 2, tension: 11, stringOption: null,
};

type Reply = { status: number; body: unknown };
let calls: { url: string; body: any }[];
let quoteReplies: Reply[]; // theo thứ tự lần gọi; hết thì dùng phần tử cuối
let orderReply: Reply;
const reply = (r: Reply) => ({ ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) });
const quotesOf = () => calls.filter(c => c.url === '/api/oms/shipping-quote');
const ordersOf = () => calls.filter(c => c.url.endsWith('/orders'));

beforeEach(() => {
  sessionStorage.clear();
  calls = []; alertMock.mockClear();
  quoteReplies = [{ status: 200, body: QUOTE_200 }];
  orderReply = { status: 201, body: ORDER_201_STANDARD_COD };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
    if (url.startsWith('/api/oms/admin-units')) return reply({ status: 200, body: url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY });
    if (url === '/api/oms/shipping-quote') return reply(quoteReplies[Math.min(quotesOf().length, quoteReplies.length) - 1]);
    if (url.endsWith('/orders')) return reply(orderReply);
    return reply({ status: 200, body: url.endsWith('/verify-otp') ? { success: true, verification_token: 'vt' } : { success: true } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function gotoPicked() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Đường Giải Phóng' } });
  await pickAdminUnits();
}
const submitBtn = () => screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ });
const shippingSection = () => screen.getByText('Phương thức vận chuyển').parentElement!;
const box = (label: string) => screen.getByRole('combobox', { name: label }).parentElement!;
const quote422 = (body: unknown) => { quoteReplies = [{ status: 422, body }]; };

describe('STOR-049 báo giá 422 địa chỉ -> lỗi ở ô', () => {
  it('[S3] receiver_ward_code: lời OMS dưới ô Phường/Xã (alert), aria-invalid; khối vận chuyển chỉ QUOTE_REJECTED, không Thử lại, nút khoá', async () => {
    quote422(ERR_MAP_WARD);
    await gotoPicked();
    expect(await within(box('Phường/Xã')).findByRole('alert')).toHaveTextContent(MSG_MAP);
    expect(screen.getByRole('combobox', { name: 'Phường/Xã' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' })).not.toHaveAttribute('aria-invalid', 'true');
    expect(within(shippingSection()).getByText(QUOTE_REJECTED)).toBeInTheDocument();
    expect(within(shippingSection()).queryByText(MSG_MAP)).toBeNull();
    expect(within(shippingSection()).queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(within(box('Phường/Xã')).queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(submitBtn()).toBeDisabled();
  });
  it('[S3] receiver_province_code: lời OMS dưới ô Tỉnh/Thành (alert), aria-invalid', async () => {
    quote422(ERR_MAP_PROV);
    await gotoPicked();
    expect(await within(box('Tỉnh/Thành phố')).findByRole('alert')).toHaveTextContent(MSG_MAP);
    expect(screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'Phường/Xã' })).not.toHaveAttribute('aria-invalid', 'true');
    expect(within(shippingSection()).getByText(QUOTE_REJECTED)).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });
  it('[S3] field_path null: lời OMS nguyên văn ở khối vận chuyển, không ô nào lỗi, không Thử lại, nút khoá', async () => {
    quote422(ERR_MAP_NULL);
    await gotoPicked();
    expect(await within(shippingSection()).findByText(MSG_MAP)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Phường/Xã' })).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' })).not.toHaveAttribute('aria-invalid', 'true');
    expect(within(shippingSection()).queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(submitBtn()).toBeDisabled();
  });
  it('[S3] đổi xã sau 422 receiver_ward_code -> lời dưới ô mất', async () => {
    quote422(ERR_WARD);
    await gotoPicked();
    await within(box('Phường/Xã')).findByRole('alert');
    quoteReplies = [{ status: 200, body: QUOTE_200 }];
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường/Xã' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Phường Hoàn Kiếm' }));
    await waitFor(() => expect(within(box('Phường/Xã')).queryByRole('alert')).toBeNull());
    expect(screen.getByRole('combobox', { name: 'Phường/Xã' })).not.toHaveAttribute('aria-invalid', 'true');
  });
});

describe('STOR-049 /orders 422 địa chỉ -> báo giá chạy lại', () => {
  it.each([
    ['(a) ADDRESS_NOT_MAPPED + receiver_ward_code', ERR_MAP_WARD, MSG_MAP],
    ['(b) RECEIVER_WARD_PROVINCE_MISMATCH + receiver_ward_code', ERR_WARD, MSG_WARD],
    ['(c) ADDRESS_NOT_MAPPED + field_path null', ERR_MAP_NULL, MSG_MAP],
    ['(d) receiver_province_code', ERR_MAP_PROV, MSG_MAP],
  ])('%s: popup lời OMS, shipping-quote gọi lại', async (_n, body, msg) => {
    await gotoPicked();
    await screen.findByText('Giao hàng chuẩn');
    orderReply = { status: 422, body };
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(submitBtn());
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(ordersOf()).toHaveLength(1));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(msg));
    await waitFor(() => expect(quotesOf()).toHaveLength(2));
  });
});
