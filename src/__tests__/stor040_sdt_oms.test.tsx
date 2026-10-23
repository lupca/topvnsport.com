// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { sportApi } from '../services/sportApi';
import { PHONE_REGEX, isValidPhone, normalizePhone, PHONE_ERROR_MESSAGE } from '../utils/phone';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const SKU = 'SKU-VOT-1';
const product: Product = {
  id: '1', name: 'Vợt', brand: 'Yonex', category: 'Vợt', price: 2000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 2000000, stock: 5 }],
} as any;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Vợt', brand: 'Yonex', image: 'x.jpg', price: 2000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 1, tension: 11,
  stringOption: { id: 's', name: 'BG80', price: 0 } as any,
};

let calls: { url: string; body: any }[];

beforeEach(() => {
  calls = [];
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    const json = url.endsWith('/verify-otp') ? { success: true, verification_token: 'vt' }
      : url.endsWith('/orders') ? { id: 7, order_number: 'DH-7' }
      : { success: true };
    return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function openStep2() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  render(<Provider store={store}><CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
}
const phoneInput = () => screen.getByPlaceholderText('Ví dụ: 0912345678') as HTMLInputElement;
const orderBtn = () => screen.getByRole('button', { name: /Xác nhận đặt hàng/ }) as HTMLButtonElement;
const fillOthers = () => {
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Test' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
  fireEvent.change(screen.getByPlaceholderText('Nhập phường/xã'), { target: { value: 'Phường A' } });
  fireEvent.change(screen.getByPlaceholderText('Nhập tỉnh/thành phố'), { target: { value: 'Tỉnh B' } });
  fireEvent.click(screen.getByText('Thanh toán COD'));
};
const type = (v: string) => fireEvent.change(phoneInput(), { target: { value: v } });

describe('STOR-040 luật SĐT (phone.ts)', () => {
  it('AC1 nguồn regex', () => expect(PHONE_REGEX.source).toBe('^(0|\\+84|84)[35789]\\d{8}$'));
  it.each([
    ['0912345678', true], ['84912345678', true], ['+84912345678', true], ['0912 345 678', true], ['0912.345-678', true],
    ['0212345678', false], ['091234567', false], ['09123456789', false], ['', false], ['abc', false],
  ])('isValidPhone(%j) = %s', (raw, ok) => expect(isValidPhone(raw)).toBe(ok));
  it('normalizePhone chỉ bỏ khoảng trắng, chấm, gạch ngang', () => {
    expect(normalizePhone(' 0912.345-678 ')).toBe('0912345678');
    expect(normalizePhone('+84 (91)')).toBe('+84(91)');
  });
});

describe('STOR-040 ô SĐT bước 2', () => {
  it('inputMode tel', () => { openStep2(); expect(phoneInput().getAttribute('inputmode')).toBe('tel'); });

  it('sai + blur: lỗi, viền đỏ, aria-invalid', () => {
    openStep2(); type('0212345678'); fireEvent.blur(phoneInput());
    expect(screen.getByRole('alert').textContent).toBe(PHONE_ERROR_MESSAGE);
    expect(phoneInput().className).toContain('border-red-500');
    expect(phoneInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('trống chưa chạm: không lỗi, không viền đỏ', () => {
    openStep2();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(phoneInput().className).not.toContain('border-red-500');
  });

  it('gõ đủ độ dài sai, chưa blur: lỗi hiện; gõ dở: chưa hiện', () => {
    openStep2(); type('091234567');
    expect(screen.queryByRole('alert')).toBeNull();
    type('0212345678');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('nút đặt hàng khoá khi SĐT sai, mở khi đúng', () => {
    openStep2(); fillOthers(); type('0212345678');
    expect(orderBtn().disabled).toBe(true);
    type('0912345678');
    expect(orderBtn().disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('submit form với SĐT sai: không gọi sendOtp, không fetch send-otp', async () => {
    const spy = vi.spyOn(sportApi, 'sendOtp');
    openStep2(); fillOthers(); type('0212345678');
    fireEvent.submit(phoneInput().closest('form')!);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    expect(calls.some(c => c.url.includes('send-otp'))).toBe(false);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it("'0912 345 678': send-otp, OtpModal, verify-otp, orders đều mang 0912345678", async () => {
    openStep2(); fillOthers(); type('0912 345 678');
    fireEvent.click(orderBtn());
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    expect(screen.getByText('0912345678', { selector: 'strong' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
    const by = (s: string) => calls.find(c => c.url.endsWith(s))!.body;
    expect(by('/send-otp').phone_number).toBe('0912345678');
    expect(by('/orders').customer.phone).toBe('0912345678');
    expect(JSON.stringify(by('/verify-otp'))).toContain('0912345678');
  });
});
