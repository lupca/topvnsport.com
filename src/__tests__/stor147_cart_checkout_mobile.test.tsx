// @vitest-environment jsdom
// STOR-147 (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): the cart drawer and AdminUnitPicker below md get 44px tap targets,
// 14px small text and 16px/44px inputs. Each guarded max-md: token is asserted on its element in the state that renders it.
// Removing a token from the source must turn this file red (docs/stor147-shots/mutate.sh); restoring it turns it green.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import AdminUnitPicker from '../components/AdminUnitPicker';
import { getAdminUnitsFromFixture, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200_FLAT } from './fixtures/shippingQuote';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));
const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const createOrderMock = vi.fn();
const sepayMock = vi.fn();
const quoteMock = vi.fn();
vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: (...a: unknown[]) => sendOtpMock(...a),
    verifyOtp: (...a: unknown[]) => verifyOtpMock(...a),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: (...a: unknown[]) => quoteMock(...a),
    createSepayCheckout: (...a: unknown[]) => sepayMock(...a),
  },
}));

const mkProduct = (id: string, sku: string) => ({
  id, name: `Vợt ${id}`, brand: 'Yonex', category: 'Vợt', price: 1000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: sku, price: 1000000, stock: 5 }],
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
}) as unknown as Product;
const mkItem = (id: string, sku: string): CartItem => ({
  id: `i${id}`, productId: id, skuCode: sku, name: `Vợt ${id}`, brand: 'Yonex', image: 'x.jpg', price: 1000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', stringOption: null, tension: 11, quantity: 2,
});
const ITEM = mkItem('1', 'SKU-1');
const PENDING = { order: { orderNumber: 'DH-9', shippingAddress: 'Số 1, Phường Ba Đình, Hà Nội', total: 1030000, shippingFee: 30000, adjusted: false, method: 'sepay' }, error: 'Cổng SePay đang bảo trì' };

function mount(items: CartItem[]) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [mkProduct('1', 'SKU-1')], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={items} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
}

// Điền form bước 2 (tên, SĐT, địa chỉ) và chọn Hà Nội -> Phường Ba Đình.
async function fillCheckout() {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
  await pickAdminUnits();
  await waitFor(() => expect(screen.getByRole('button', { name: /Thanh toán SePay QR/ })).not.toBeDisabled());
}
const toCheckout = () => fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));

// Mọi token phải nằm trong class của đúng phần tử.
function guard(el: HTMLElement | null, label: string, ...tokens: string[]) {
  expect(el, `${label} rendered`).toBeTruthy();
  const have = (el as HTMLElement).className.toString().split(/\s+/);
  for (const t of tokens) expect(have, `${label} has ${t}`).toContain(t);
}
const closeBtn = () => document.querySelector('#cart-drawer-modal .p-4.border-b > button') as HTMLElement;
const MIN_TAP = ['max-md:min-w-11', 'max-md:min-h-11'];

beforeEach(() => {
  sessionStorage.clear();
  [sendOtpMock, verifyOtpMock, createOrderMock, sepayMock, quoteMock].forEach(m => m.mockReset());
  sendOtpMock.mockResolvedValue({ success: true });
  verifyOtpMock.mockResolvedValue({ success: true, verification_token: 'tok' });
  createOrderMock.mockResolvedValue({ id: 1, order_number: 'DH-9', total_amount: 1030000, shipping_fee: 30000 });
  sepayMock.mockResolvedValue({ action: 'https://pay.example/c', fields: { a: 'b' } });
  quoteMock.mockResolvedValue(QUOTE_200_FLAT);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('STOR-147 bước 1 (giỏ): nút đóng, tăng/giảm, xoá, nhãn', () => {
  it('giỏ trống: nút đóng X và "Mua Sắm Ngay" đủ 44px, chữ 14px', () => {
    mount([]);
    guard(closeBtn(), 'close X', 'max-md:min-w-11', 'max-md:min-h-11', 'max-md:inline-flex', 'max-md:items-center', 'max-md:justify-center');
    guard(screen.getByRole('button', { name: /Mua Sắm Ngay/ }), 'Mua Sắm Ngay', 'max-md:text-sm', 'max-md:min-h-11');
  });

  it('giỏ có hàng: nút đóng, −, +, xoá đủ 44px; dòng giỏ và ghi chú 14px', () => {
    mount([ITEM]);
    guard(closeBtn(), 'close X', 'max-md:min-w-11', 'max-md:min-h-11', 'max-md:inline-flex', 'max-md:items-center', 'max-md:justify-center');
    guard(screen.getByRole('button', { name: 'Giảm số lượng' }), 'quantity minus', ...MIN_TAP);
    guard(screen.getByRole('button', { name: 'Tăng số lượng' }), 'quantity plus', ...MIN_TAP);
    guard(screen.getByTitle('Xóa sản phẩm'), 'remove item', 'max-md:min-w-11', 'max-md:min-h-11', 'max-md:flex', 'max-md:items-center', 'max-md:justify-center');
    guard(screen.getByRole('button', { name: /Tiến hành thanh toán/ }), 'checkout CTA', 'max-md:text-sm', 'max-md:min-h-11');
    // Round-1 finding 26b59220: the 44px −/+/remove widen the row past the drawer at 360px unless the middle column
    // may shrink and the qty/price row may wrap (measured by docs/stor147-shots/measure.cjs cart-long).
    const qtyRow = screen.getByRole('button', { name: 'Giảm số lượng' }).parentElement!.parentElement as HTMLElement;
    guard(qtyRow, 'qty/price row', 'max-md:flex-wrap', 'max-md:gap-y-1');
    guard(qtyRow.parentElement, 'cart line middle column', 'max-md:min-w-0');
    guard(screen.getByText(/Đan cước|Phân loại|SL:/, { selector: 'p' }).closest('div')!, 'cart line text', 'max-md:text-sm');
  });

  it('có đơn chờ: "Thanh toán lại" và "Bỏ nhắc" đủ 44px, dải nhắc 14px', () => {
    sessionStorage.setItem('pending_sepay_order', JSON.stringify(PENDING));
    mount([ITEM]);
    guard(screen.getByRole('button', { name: 'Thanh toán lại' }), 'reminder pay again', 'max-md:min-h-11');
    guard(screen.getByRole('button', { name: 'Bỏ nhắc' }), 'reminder dismiss', 'max-md:min-h-11');
    guard(screen.getByRole('button', { name: 'Thanh toán lại' }).closest('[role=status]') as HTMLElement, 'reminder strip', 'max-md:text-sm');
  });
});

describe('STOR-147 bước 2 (thanh toán): ô nhập 16px/44px, nhãn 14px, nút đáy 44px', () => {
  it('ô nhập và nhãn; ô phường khoá khi chưa chọn tỉnh', async () => {
    mount([ITEM]);
    toCheckout();
    const name = screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A');
    const phone = screen.getByPlaceholderText('Ví dụ: 0912345678');
    const addr = screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà');
    for (const [label, el] of [['name', name], ['phone', phone], ['address', addr]] as const) {
      guard(el as HTMLElement, `${label} input`, 'max-md:text-base', 'max-md:min-h-11');
    }
    guard(screen.getByText('Họ và tên người nhận *'), 'name label', 'max-md:text-sm');
    guard(screen.getByText('Số điện thoại liên hệ *'), 'phone label', 'max-md:text-sm');
    guard(screen.getByText('Địa chỉ cụ thể (Số nhà, Ngõ/Hẻm, Đường) *'), 'address label', 'max-md:text-sm');
    guard(screen.getByText('Thông tin nhận hàng'), 'section heading', 'max-md:text-sm');
    guard(screen.getByText('Chọn tỉnh/thành phố và phường/xã để xem phí giao hàng.'), 'shipping hint', 'max-md:text-sm');
    expect(screen.getByRole('combobox', { name: 'Phường/Xã' })).toBeDisabled();
    const province = screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' }) as HTMLElement;
    guard(province, 'province input', 'max-md:text-base', 'max-md:min-h-11');
    const ward = screen.getByRole('combobox', { name: 'Phường/Xã' }) as HTMLElement;
    guard(ward, 'ward input', 'max-md:text-base', 'max-md:min-h-11');
    guard(screen.getByRole('button', { name: 'Quay lại' }), 'back button', 'max-md:text-sm', 'max-md:min-h-11');
    guard(screen.getByRole('button', { name: /Thanh toán SePay QR/ }), 'submit button', 'max-md:text-sm', 'max-md:min-h-11');
  });

  it('lỗi báo giá có thể thử lại: "Thử lại" đủ 44px, khối lỗi 14px', async () => {
    quoteMock.mockRejectedValueOnce(Object.assign(new Error('Hệ thống bận'), { kind: 'http', status: 503 }));
    mount([ITEM]);
    toCheckout();
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    await pickAdminUnits();
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    guard(retry, 'quote retry', 'max-md:min-h-11');
    guard(retry.closest('[role=alert]') as HTMLElement, 'quote error block', 'max-md:text-sm');
  });
});

describe('STOR-147 COD và SePay: nút 44px, chữ 14px ở bước 3', () => {
  it('COD: "Xác nhận đặt hàng" -> OTP -> "Hoàn thành mua sắm" đủ 44px; "Đặt hàng thành công" 14px', async () => {
    mount([ITEM]);
    toCheckout();
    await fillCheckout();
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    const done = await screen.findByRole('button', { name: 'Hoàn thành mua sắm' });
    guard(done, 'done button', 'max-md:text-sm', 'max-md:min-h-11');
    guard(screen.getByText('Cảm ơn bạn đã tin tưởng TopVNSport. Cửa hàng đang đóng gói và chuẩn bị bàn giao cho bưu cục vận chuyển.'), 'success copy', 'max-md:text-sm');
  });

  it('COD không rõ kết quả: "Tôi đã kiểm tra..." đủ 44px', async () => {
    createOrderMock.mockRejectedValueOnce(Object.assign(new Error('mất kết nối'), { kind: 'network' }));
    mount([ITEM]);
    toCheckout();
    await fillCheckout();
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    const ok = await screen.findByRole('button', { name: /Tôi đã kiểm tra/ });
    guard(ok, 'uncertain confirm', 'max-md:min-h-11');
  });

  it('SePay lỗi 503: "Thanh toán lại" và "Quay về giỏ hàng" đủ 44px, chữ 14px', async () => {
    sepayMock.mockRejectedValueOnce(Object.assign(new Error('Cổng SePay đang bảo trì'), { kind: 'http', status: 503 }));
    mount([ITEM]);
    toCheckout();
    await fillCheckout();
    fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay QR/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    const again = await screen.findByRole('button', { name: 'Thanh toán lại' });
    guard(again, 'sepay retry', 'max-md:text-sm', 'max-md:min-h-11');
    guard(screen.getByRole('button', { name: 'Quay về giỏ hàng' }), 'sepay back to cart', 'max-md:text-sm', 'max-md:min-h-11');
  });

  it('SePay 502: thông báo lỗi 14px, không đổi đơn', async () => {
    sepayMock.mockRejectedValueOnce(Object.assign(new Error('Bad gateway'), { kind: 'http', status: 502 }));
    mount([ITEM]);
    toCheckout();
    await fillCheckout();
    fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay QR/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await screen.findByRole('button', { name: 'Thanh toán lại' });
    guard(screen.getByText('Chưa mở được trang thanh toán').parentElement!.querySelector('[role=alert]') as HTMLElement, 'sepay error line', 'max-md:text-sm');
  });
});

describe('STOR-147 AdminUnitPicker (tỉnh/phường): nhãn 14px, ô 16px/44px, lời lỗi, dòng chọn 44px', () => {
  const units = [
    { code: 'ADM1-01', level: 'province', name: 'Hà Nội', parent_code: null },
    { code: 'ADM1-79', level: 'province', name: 'Thành phố Hồ Chí Minh', parent_code: null },
  ] as any;
  function picker(over: Record<string, unknown> = {}) {
    const props = {
      label: 'Tỉnh/Thành phố', placeholder: 'Chọn', units: null, value: null, query: '', onQueryChange: vi.fn(), onChange: vi.fn(),
      loading: false, error: null, onRetry: vi.fn(), ...over,
    };
    render(<AdminUnitPicker {...(props as any)} />);
    return props;
  }

  it('nhãn và ô nhập', () => {
    picker({ units });
    guard(screen.getByText('Tỉnh/Thành phố *'), 'picker label', 'max-md:text-sm');
    guard(screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' }), 'picker input', 'max-md:text-base', 'max-md:min-h-11');
  });

  it('đang tải: dòng trạng thái 14px', () => {
    picker({ loading: true });
    guard(screen.getByText('Đang tải…'), 'loading line', 'max-md:text-sm');
  });

  it('lỗi tải: khối lỗi 14px, "Thử lại" đủ 44px và gọi onRetry', () => {
    const p = picker({ error: 'Không tải được danh sách' });
    guard(screen.getByRole('alert'), 'load error block', 'max-md:text-sm');
    const retry = screen.getByRole('button', { name: 'Thử lại' });
    guard(retry, 'picker retry', 'max-md:min-h-11');
    fireEvent.click(retry);
    expect(p.onRetry).toHaveBeenCalledTimes(1);
  });

  it('lỗi của OMS cho ô này: 14px, không có nút Thử lại', () => {
    picker({ units, fieldError: 'Địa chỉ không hợp lệ' });
    guard(screen.getByText('Địa chỉ không hợp lệ'), 'field error', 'max-md:text-sm');
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('danh sách: dòng chọn 14px và đủ 44px', () => {
    picker({ units });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' }));
    guard(screen.getByRole('option', { name: 'Hà Nội' }), 'option row', 'max-md:text-sm', 'max-md:min-h-11');
  });

  it('không có kết quả: dòng 14px', () => {
    picker({ units, query: 'zzz' });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' }));
    guard(screen.getByText('Không có kết quả'), 'no result line', 'max-md:text-sm');
  });
});

describe('STOR-147 quét tĩnh: mọi class có chữ 10/11px hoặc xs đều có max-md:text-sm hoặc max-md:text-base', () => {
  it('CartModal.tsx và AdminUnitPicker.tsx', () => {
    const files = ['../components/CartModal.tsx', '../components/AdminUnitPicker.tsx'];
    const small = /\btext-\[1[01]px\]|\btext-xs\b/;
    const misses: string[] = [];
    let checked = 0;
    for (const f of files) {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const cls = m[1] ?? m[2];
        if (!small.test(cls)) continue;
        checked++;
        if (!/(^|\s)max-md:text-(sm|base)(\s|$)/.test(cls)) misses.push(`${path.basename(f)}: ${cls.slice(0, 70)}`);
      }
    }
    expect(misses).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(50);
  });
});
