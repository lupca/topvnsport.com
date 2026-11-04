// @vitest-environment jsdom
// STOR-112: khách không thấy chữ nội bộ/kỹ thuật (VOMA, PIM, WMS, OMS, sync, API, đồng bộ, hệ thống, tương phản, AAA, UI/UX, v2.0).
// Render <App/> thật (store thật, chỉ giả nguồn dữ liệu và fetch) ở từng màn rồi quét chữ khách nhìn thấy.
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200 } from './fixtures/shippingQuote';

const api = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn(),
  getBranches: vi.fn(),
  getStringOptions: vi.fn().mockResolvedValue([]),
}));
// Giữ sportApi thật cho sendOtp/createOrder/getAdminUnits (đi qua fetch giả) để câu lỗi mạng là câu thật của sportApi.
vi.mock('../services/sportApi', async (orig) => {
  const actual = await orig<typeof import('../services/sportApi')>();
  return { sportApi: { ...actual.sportApi, ...api } };
});
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

import { popupService } from '@topvnsport/ui-kit';
import App from '../App';

const BANNED = /VOMA|PIM|WMS|OMS|\bsync\b|\bAPI\b|đồng bộ|tương phản|AAA|UI\/UX|v2\.0|hệ thống/i;

// Chữ khách thấy: nội dung văn bản + placeholder/title/aria-label/alt.
function shopperText(): string {
  const attrs = Array.from(document.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]'))
    .flatMap((el) => ['placeholder', 'title', 'aria-label', 'alt'].map((a) => el.getAttribute(a) ?? ''));
  return [document.body.textContent ?? '', ...attrs].join('\n');
}
function expectClean(where: string) {
  const text = shopperText();
  const m = BANNED.exec(text);
  const snippet = m ? text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ') : '';
  expect(m, `${where}: chữ nội bộ "${m?.[0]}" trong "…${snippet}…"`).toBeNull();
}

const CATS = [{ id: 1, name: 'Vợt Cầu Lông', code: 'VC001491', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' }];
const RACKET = {
  id: 'r1', name: 'Vợt Yonex Test', brand: 'Yonex', image: '/img/r1.jpg', categoryCode: 'VC001491', price: 2000000, specs: {}, description: 'Vợt nhẹ', stock: 5,
  tier_variations: [{ tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'BG 65'] }],
  variants: [
    { tier_1_option: '', tier_2_option: 'Khung không dây', sku_code: 'R1-A', price: 2000000, stock: 5 },
    { tier_1_option: '', tier_2_option: 'BG 65', sku_code: 'R1-B', price: 2050000, stock: 5 },
  ],
};
const SHOE = {
  id: '1', name: 'Giày Test', brand: 'Yonex', image: 'x.jpg', categoryCode: 'VC001491', price: 2000000, specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: 'SKU-REAL', price: 2000000, stock: 5 }],
};
const CART_ITEM = {
  id: 'i1', productId: '1', skuCode: 'SKU-REAL', name: 'Giày Test', brand: 'Yonex', image: 'x.jpg', price: 2000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', quantity: 1, tension: 11, stringOption: null,
};

// Cách /payments trả lời: ok | network (fetch ném lỗi) | hang (không trả lời) | bad-json (200 không phải JSON) | http500 / http503 (không có code).
type PaymentsMode = 'ok' | 'network' | 'hang' | 'bad-json' | 'http500' | 'http503';
let paymentsMode: PaymentsMode = 'ok';
let ordersNoNumber = false; // 201 thiếu order_number
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
  sessionStorage.clear();
  api.getProducts.mockResolvedValue([RACKET, SHOE]);
  api.getCategories.mockResolvedValue(CATS);
  api.getBranches.mockResolvedValue([
    { id: 'b1', name: 'Chi nhánh Hà Nội', address: '12 Chùa Hà, Hà Nội', phone: '0976007006', schedule: '08:00 - 22:00', city: 'Hà Nội' },
  ]);
  paymentsMode = 'ok';
  ordersNoNumber = false;
  vi.mocked(popupService.alert).mockClear();
  const j = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/oms/admin-units')) return j(200, url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY);
    if (url === '/api/oms/shipping-quote') return j(200, QUOTE_200);
    if (url.endsWith('/verify-otp')) return j(200, { success: true, verification_token: 'vt' });
    if (url.endsWith('/orders') && ordersNoNumber) return j(201, { id: 7, total_amount: 2030000, shipping_fee: 30000 });
    if (url.endsWith('/orders')) return j(201, { id: 7, order_number: 'DH-7', total_amount: 2030000, shipping_fee: 30000 });
    if (url.endsWith('/payments') && paymentsMode === 'network') throw new TypeError('Failed to fetch');
    if (url.endsWith('/payments') && paymentsMode === 'hang') return new Promise(() => {});
    if (url.endsWith('/payments') && paymentsMode === 'bad-json') return { ok: true, status: 200, json: async () => { throw new SyntaxError('x'); }, text: async () => 'x' };
    if (url.endsWith('/payments') && paymentsMode === 'http503') return j(503, { detail: 'Service Unavailable' });
    if (url.endsWith('/payments') && paymentsMode === 'http500') return j(500, { detail: 'Internal Server Error' });
    return j(200, { success: true });
  }));
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mount(path: string, cartOpen = false) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: cartOpen ? { cart: { items: [CART_ITEM], isOpen: true, quickViewProduct: null } } : undefined,
  } as any);
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>);
}

describe('STOR-112 chữ khách thấy không có từ nội bộ', () => {
  it('màn tải ban đầu', async () => {
    api.getProducts.mockReturnValue(new Promise(() => {}));
    const { container } = mount('/');
    await waitFor(() => expect(container.querySelector('#api-loading-state')).not.toBeNull());
    expect(container.textContent).toContain('Đang tải sản phẩm...');
    expectClean('loading');
  });

  it('trang chủ (Header, banner, thẻ sản phẩm có tầng cước, Footer, thanh đáy mobile)', async () => {
    mount('/');
    await screen.findByText('SẢN PHẨM NỔI BẬT');
    expect(document.querySelector('header')).not.toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
    expect(screen.getByTestId('featured-subtitle-mobile')).toBeInTheDocument();
    expectClean('home');
  });

  it('chân trang: hotline tel: và giờ hotline, không có từ nội bộ', async () => {
    mount('/');
    await screen.findByText('SẢN PHẨM NỔI BẬT');
    const footer = document.querySelector('footer') as HTMLElement;
    const tel = footer.querySelector('a[href^="tel:"]') as HTMLElement;
    expect(tel.getAttribute('href')).toBe('tel:0976007006');
    expect(tel.textContent).toBe('097 6007006');
    expect(tel.parentElement?.textContent).toBe('Hotline tư vấn: 097 6007006 (08:00 - 22:00)');
    expectClean('footer');
  });

  it('trang danh mục', async () => {
    mount('/catalog');
    await screen.findByText('Vợt Yonex Test');
    expectClean('catalog');
  });

  it('trang chi tiết sản phẩm có tầng cước', async () => {
    mount('/product/r1');
    await screen.findByRole('heading', { level: 1, name: 'Vợt Yonex Test' });
    expectClean('pdp');
  });

  it('trang cửa hàng', async () => {
    mount('/stores');
    await screen.findAllByText('Chi nhánh Hà Nội');
    expectClean('stores');
  });

  it('trang không tìm thấy', async () => {
    mount('/khong-co-trang-nay');
    await screen.findByText('Không tìm thấy trang');
    expectClean('not-found');
  });

  it('giỏ hàng bước giỏ', async () => {
    mount('/', true);
    await screen.findByRole('button', { name: /Tiến hành thanh toán/ }, { timeout: 5000 });
    expectClean('cart');
  });

  async function toCheckout(method: 'sepay' | 'cod' = 'sepay') {
    mount('/', true);
    fireEvent.click(await screen.findByRole('button', { name: /Tiến hành thanh toán/ }, { timeout: 5000 }));
    fireEvent.change(await screen.findByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    await pickAdminUnits();
    if (method === 'cod') fireEvent.click(screen.getByText('Thanh toán COD'));
    await waitFor(() => expect(screen.getByRole('button', { name: method === 'cod' ? /Xác nhận đặt hàng/ : /Thanh toán SePay/ })).not.toBeDisabled());
  }
  // Bấm đặt hàng -> nhập OTP -> xác nhận (tới lúc gọi /orders).
  async function confirmOtp(method: 'sepay' | 'cod') {
    fireEvent.click(screen.getByRole('button', { name: method === 'cod' ? /Xác nhận đặt hàng/ : /Thanh toán SePay/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  }
  // Câu khách thấy trong popup: popupService.alert nhận đúng chuỗi này.
  function expectAlerted(text: RegExp, where: string) {
    const calls = vi.mocked(popupService.alert).mock.calls.map((c) => String(c[0]));
    const hit = calls.find((c) => text.test(c));
    expect(hit, `${where}: không thấy popup khớp ${text}; có: ${JSON.stringify(calls)}`).toBeDefined();
    const m = BANNED.exec(hit as string);
    expect(m, `${where}: chữ nội bộ "${m?.[0]}" trong popup "${hit}"`).toBeNull();
  }

  it('giỏ hàng bước thanh toán', async () => {
    await toCheckout();
    expectClean('checkout');
  });

  // SePay: đơn đã tạo, /payments lỗi -> câu của sportApi hiện trong dòng cảnh báo cạnh "Đã tạo đơn …".
  async function paymentsFails(mode: PaymentsMode, expected: RegExp, where: string) {
    paymentsMode = mode;
    await toCheckout();
    fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    if (mode === 'hang') vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
      // Hết giờ 20 giây của sportApi: tiến thời gian sau khi chuỗi gọi đã tới /payments.
      if (mode === 'hang') for (let i = 0; i < 3; i++) await vi.advanceTimersByTimeAsync(20_001);
    } finally { vi.useRealTimers(); }
    await screen.findByText(/Chưa mở được trang thanh toán:/);
    expect(screen.getByRole('alert').textContent, where).toMatch(expected);
    expectClean(where);
  }
  it('/payments lỗi mạng', () => paymentsFails('network', /Không kết nối được tới cửa hàng/, 'payments-network'));
  it('/payments không trả lời quá 20 giây', () => paymentsFails('hang', /Cửa hàng phản hồi quá lâu/, 'payments-timeout'));
  it('/payments trả 200 không phải JSON', () => paymentsFails('bad-json', /Cửa hàng trả về dữ liệu không hợp lệ/, 'payments-invalid'));
  it('/payments trả 503 không có code', () => paymentsFails('http503', /Cửa hàng đang tạm thời không phản hồi/, 'payments-503'));
  it('/payments trả 500 không có code', () => paymentsFails('http500', /Cửa hàng gặp lỗi khi xử lý đơn/, 'payments-500'));

  it('đặt hàng COD thành công: lời cảm ơn bước 3', async () => {
    await toCheckout('cod');
    await confirmOtp('cod');
    await screen.findByText(/ĐẶT HÀNG THÀNH CÔNG/, {}, { timeout: 5000 });
    expect(document.body.textContent).toContain('Cửa hàng đang đóng gói');
    expectClean('order-success');
  });

  it('201 không có mã đơn: popup + dòng cảnh báo trên màn', async () => {
    ordersNoNumber = true;
    await toCheckout('cod');
    await confirmOtp('cod');
    await waitFor(() => expectAlerted(/cửa hàng đã phản hồi nhưng chưa gửi mã đơn hàng/, 'missing-order-number'));
    expectClean('missing-order-number');
  });

  it('tiêu đề trang và index.html không có từ nội bộ', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const visible = [html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '', ...Array.from(html.matchAll(/<meta[^>]*content="([^"]*)"/g)).map((m) => m[1])];
    expect(visible[0]).toContain('TopVNSport');
    expect(visible.join('\n')).not.toMatch(BANNED);
    mount('/');
    expect(document.title).not.toMatch(BANNED);
  });
});
