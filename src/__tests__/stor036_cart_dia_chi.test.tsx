// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, ERR_422_QUERY, ERR_429, ERR_503, ERR_422_SCHEMA, ERR_401, pickAdminUnits } from './fixtures/adminUnits';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const SKU = 'SKU-AO-M';
const product: Product = {
  id: '1', name: 'Áo', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 100000, stock: 5 }],
} as any;
const item: CartItem = {
  id: 'i1', productId: '1', skuCode: SKU, name: 'Áo', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 1, tension: 10, stringOption: null,
};
// 201 nguyên văn hợp đồng (C), nhánh legacy: OrderOut hiện tại.
const ORDER_201 = { id: 7, order_number: 'DH-7', shipping_address: '12 Phố Huế, Phường Ba Đình, Hà Nội', shipping_fee: '30000.00', total_amount: '130000.00' };

type Reply = { status: number; body: unknown } | 'reject';
let calls: { url: string; body: any }[];
let unitReplies: Record<string, Reply[]>; // theo 'province' | 'ward' ; phần tử cuối lặp lại
const onClearCart = vi.fn();

function reply(r: Reply) {
  if (r === 'reject') throw new TypeError('Failed to fetch');
  return { ok: r.status < 400, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
}
beforeEach(() => {
  calls = []; alertMock.mockClear(); onClearCart.mockClear();
  unitReplies = { province: [{ status: 200, body: PROVINCE_BODY }], ward: [{ status: 200, body: WARD_BODY }] };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    if (url.startsWith('/api/oms/admin-units')) {
      const q = unitReplies[url.includes('level=ward') ? 'ward' : 'province'];
      return reply(q.length > 1 ? q.shift()! : q[0]);
    }
    const json = url.endsWith('/verify-otp') ? { success: true, verification_token: 'vt' }
      : url.endsWith('/orders') ? ORDER_201 : { success: true };
    return reply({ status: 200, body: json });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function renderCart() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [product], branches: [], stringOptions: [], categories: [], isLoading: false } } as any,
  });
  const ui = (open: boolean) => (
    <Provider store={store}><CartModal isOpen={open} onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={onClearCart} /></Provider>
  );
  const r = render(ui(true));
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  return { ...r, ui };
}
const provinceBox = () => screen.getByRole('combobox', { name: 'Tỉnh/Thành phố' });
const wardBox = () => screen.getByRole('combobox', { name: 'Phường/Xã' });
const unitCalls = () => calls.filter(c => c.url.startsWith('/api/oms/admin-units')).map(c => c.url);

describe('STOR-036 CartModal chọn tỉnh/xã', () => {
  it('AC9/10 không còn ô tự do; ô tỉnh lấy từ admin-units', async () => {
    renderCart();
    expect(screen.queryByPlaceholderText('Nhập phường/xã')).toBeNull();
    expect(screen.queryByPlaceholderText('Nhập tỉnh/thành phố')).toBeNull();
    fireEvent.focus(provinceBox());
    expect(await screen.findByRole('option', { name: 'Hà Nội' })).toBeInTheDocument();
    expect(unitCalls()).toEqual(['/api/oms/admin-units?level=province&limit=500']);
  });

  it('AC11 chọn tỉnh -> GET level=ward&parent=<code>', async () => {
    renderCart();
    fireEvent.focus(provinceBox());
    fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
    await waitFor(() => expect(unitCalls()).toContain('/api/oms/admin-units?level=ward&parent=ADM1-01&limit=500'));
  });

  it('AC13 gõ "ha noi" ra Hà Nội', async () => {
    renderCart();
    fireEvent.focus(provinceBox());
    await screen.findByRole('option', { name: 'Hà Nội' });
    fireEvent.change(provinceBox(), { target: { value: 'ha noi' } });
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Hà Nội']);
  });

  it('AC12 gõ "ba dinh" ra Phường Ba Đình (đ->d)', async () => {
    renderCart();
    fireEvent.focus(provinceBox());
    fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
    fireEvent.focus(wardBox());
    await screen.findByRole('option', { name: 'Phường Hoàn Kiếm' });
    fireEvent.change(wardBox(), { target: { value: 'ba dinh' } });
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Phường Ba Đình']);
  });

  it('AC15 đổi tỉnh -> xã null + chữ tìm xã rỗng (ward-clear)', async () => {
    renderCart();
    await pickAdminUnits();
    expect(wardBox()).toHaveValue('Phường Ba Đình');
    fireEvent.focus(provinceBox());
    fireEvent.click(await screen.findByRole('option', { name: 'Thành phố Hồ Chí Minh' }));
    expect(wardBox()).toHaveValue('');
    // Điền đủ chữ để alert chỉ có thể đến từ guard tỉnh/xã: xã cũ (Ba Đình) đã bị
    // xoá khỏi state -> chặn gửi OTP, không ship tới '…, Phường Ba Đình, TP HCM'.
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ }));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('phường/xã')));
    expect(alertMock).not.toHaveBeenCalledWith(expect.stringContaining('họ tên'));
    expect(calls.some(c => c.url.endsWith('/send-otp'))).toBe(false);
  });

  it('AC62 đóng ở bước 2 rồi mở lại: tỉnh/xã đã chọn còn nguyên', async () => {
    const { rerender, ui } = renderCart();
    await pickAdminUnits();
    rerender(ui(false));
    rerender(ui(true));
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    expect(provinceBox()).toHaveValue('Hà Nội');
    expect(wardBox()).toHaveValue('Phường Ba Đình');
  });

  describe('lỗi tải danh mục', () => {
    it.each([
      ['AC17 422 INVALID_ADMIN_UNIT_QUERY', 422, ERR_422_QUERY, ERR_422_QUERY.message],
      ['AC18 429 RATE_LIMITED', 429, ERR_429, ERR_429.message],
      ['AC19 503 SHIPPING_UNAVAILABLE', 503, ERR_503, ERR_503.message],
      ['AC20 502 proxy không có message', 502, { error: 'upstream_unreachable' }, 'Không tải được danh sách tỉnh/thành phố.'],
      ['AC20 422 schema', 422, ERR_422_SCHEMA, 'Không tải được danh sách tỉnh/thành phố.'],
      ['AC20 401 detail chuỗi', 401, ERR_401, 'Không tải được danh sách tỉnh/thành phố.'],
      ['AC20 500', 500, null, 'Không tải được danh sách tỉnh/thành phố.'],
    ])('%s: hiện câu đúng, có Thử lại, không có option', async (_n, status, body, text) => {
      unitReplies.province = [{ status, body }];
      renderCart();
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
      fireEvent.focus(provinceBox());
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('AC20 fetch reject -> câu cố định', async () => {
      unitReplies.province = ['reject'];
      renderCart();
      expect(await screen.findByText('Không tải được danh sách tỉnh/thành phố.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    });

    it('AC21-23 lỗi tải xã: câu cố định phường/xã, Thử lại gọi lại rồi 200 hiện danh sách', async () => {
      unitReplies.ward = [{ status: 503, body: null }, { status: 200, body: WARD_BODY }];
      renderCart();
      fireEvent.focus(provinceBox());
      fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
      expect(await screen.findByText('Không tải được danh sách phường/xã.')).toBeInTheDocument();
      fireEvent.focus(wardBox());
      expect(screen.queryAllByRole('option')).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      fireEvent.focus(wardBox());
      expect(await screen.findByRole('option', { name: 'Phường Ba Đình' })).toBeInTheDocument();
      expect(unitCalls().filter(u => u.includes('level=ward'))).toHaveLength(2);
    });

    it('AC22 Thử lại tỉnh: gọi lại và hiện danh sách', async () => {
      unitReplies.province = [{ status: 429, body: ERR_429 }, { status: 200, body: PROVINCE_BODY }];
      renderCart();
      fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
      fireEvent.focus(provinceBox());
      expect(await screen.findByRole('option', { name: 'Hà Nội' })).toBeInTheDocument();
      expect(unitCalls()).toHaveLength(2);
    });
  });

  describe('chặn đặt đơn khi thiếu tỉnh/xã (guard)', () => {
    const fillText = () => {
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'A' } });
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
      fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    };
    it('AC24 thiếu xã -> alert, không send-otp', async () => {
      renderCart(); fillText();
      fireEvent.focus(provinceBox());
      fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ }));
      await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('phường/xã')));
      expect(calls.some(c => c.url.endsWith('/send-otp'))).toBe(false);
    });
    it('AC25 thiếu tỉnh -> alert, không send-otp', async () => {
      renderCart(); fillText();
      fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ }));
      await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('tỉnh/thành phố')));
      expect(calls.some(c => c.url.endsWith('/send-otp'))).toBe(false);
    });
  });

  async function placeOrder(fast = false) {
    renderCart();
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: ' 12 Phố Huế ' } });
    await pickAdminUnits();
    if (fast) fireEvent.click(screen.getByText('Giao hỏa tốc'));
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/orders'))).toBe(true));
    return calls.find(c => c.url.endsWith('/orders'))!.body;
  }

  it('AC26-31,33 body đơn = OMS-131, địa chỉ ghép từ name OMS, không receiver_*/delivery_option; 201 -> bước 3', async () => {
    const body = await placeOrder();
    const addr = '12 Phố Huế, Phường Ba Đình, Hà Nội';
    expect(body.shipping_address).toBe(addr);
    expect(body.customer.address).toBe(addr);
    expect(Object.keys(body).sort()).toEqual(['customer', 'items', 'note', 'shipping_address', 'shipping_fee', 'verification_token']);
    expect(body).not.toHaveProperty('receiver_province_code');
    expect(body).not.toHaveProperty('receiver_ward_code');
    expect(body).not.toHaveProperty('delivery_option');
    expect(body.shipping_fee).toBe(30000);
    expect(await screen.findByText(new RegExp(addr))).toBeInTheDocument();
  });

  it('AC32 hỏa tốc -> shipping_fee 50000', async () => {
    expect((await placeOrder(true)).shipping_fee).toBe(50000);
  });
});
