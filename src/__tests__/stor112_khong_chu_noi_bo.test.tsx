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

import App from '../App';

const BANNED = /VOMA|PIM|WMS|OMS|\bsync\b|\bAPI\b|đồng bộ|tương phản|AAA|UI\/UX|v2\.0|hệ thống/i;
// Duy nhất chuỗi này được phép chứa "hệ thống" (liên kết cửa hàng ở chân trang; task dựng lại chân trang sẽ quyết định).
const ALLOWED = 'Hệ thống cửa hàng trải nghiệm';

// Chữ khách thấy: nội dung văn bản + placeholder/title/aria-label/alt.
function shopperText(): string {
  const attrs = Array.from(document.body.querySelectorAll('[placeholder],[title],[aria-label],[alt]'))
    .flatMap((el) => ['placeholder', 'title', 'aria-label', 'alt'].map((a) => el.getAttribute(a) ?? ''));
  return [document.body.textContent ?? '', ...attrs].join('\n').split(ALLOWED).join('');
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

let paymentsNetworkFail = false;
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
  sessionStorage.clear();
  api.getProducts.mockResolvedValue([RACKET, SHOE]);
  api.getCategories.mockResolvedValue(CATS);
  api.getBranches.mockResolvedValue([
    { id: 'b1', name: 'Chi nhánh Hà Nội', address: '12 Chùa Hà, Hà Nội', phone: '0976007006', schedule: '08:00 - 22:00', city: 'Hà Nội' },
  ]);
  paymentsNetworkFail = false;
  const j = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/oms/admin-units')) return j(200, url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY);
    if (url === '/api/oms/shipping-quote') return j(200, QUOTE_200);
    if (url.endsWith('/verify-otp')) return j(200, { success: true, verification_token: 'vt' });
    if (url.endsWith('/orders')) return j(201, { id: 7, order_number: 'DH-7', total_amount: 2030000, shipping_fee: 30000 });
    if (url.endsWith('/payments') && paymentsNetworkFail) throw new TypeError('Failed to fetch');
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

  it('chân trang: còn cột thương hiệu, danh mục, dịch vụ; còn link cửa hàng trải nghiệm', async () => {
    mount('/');
    await screen.findByText('SẢN PHẨM NỔI BẬT');
    const footer = document.querySelector('footer') as HTMLElement;
    expect(footer.textContent).toContain('097 6007006 (08:00 - 22:00)');
    expect(footer.textContent).toContain(ALLOWED);
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

  async function toCheckout() {
    mount('/', true);
    fireEvent.click(await screen.findByRole('button', { name: /Tiến hành thanh toán/ }, { timeout: 5000 }));
    fireEvent.change(await screen.findByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    await pickAdminUnits();
    await waitFor(() => expect(screen.getByRole('button', { name: /Thanh toán SePay/ })).not.toBeDisabled());
  }

  it('giỏ hàng bước thanh toán', async () => {
    await toCheckout();
    expectClean('checkout');
  });

  it('lỗi mạng khi mở thanh toán (câu thật của sportApi) và lời nhắc đơn đã tạo', async () => {
    paymentsNetworkFail = true;
    await toCheckout();
    fireEvent.click(screen.getByRole('button', { name: /Thanh toán SePay/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await screen.findByText(/Chưa mở được trang thanh toán:/);
    expectClean('checkout-network-error');
    expect(screen.getByRole('alert').textContent).toContain('Không kết nối được tới cửa hàng');
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
