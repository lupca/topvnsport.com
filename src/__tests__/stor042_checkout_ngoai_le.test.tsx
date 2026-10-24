// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import { getAdminUnitsFromFixture, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200_FALLBACK } from './fixtures/shippingQuote';
import CartModal, { CartItem } from '../components/CartModal';
import OtpModal, { getStoredOtpCode, getStoredCooldown, setStoredOtpCode, setStoredCooldownExpiry } from '../components/OtpModal';
import { Product } from '../types';
import cartReducer, { addCartItemAndOpen, closeCart } from '../features/cart/cartSlice';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const createOrderMock = vi.fn();
const sepayMock = vi.fn();
vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: (...a: unknown[]) => sendOtpMock(...a),
    verifyOtp: (...a: unknown[]) => verifyOtpMock(...a),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: async () => QUOTE_200_FALLBACK,
    createSepayCheckout: (...a: unknown[]) => sepayMock(...a)
  }
}));

const SKU = 'SKU-042';
const product = {
  id: '42', name: 'Vợt 42', brand: 'Yonex', category: 'Vợt', price: 1000000, image: 'x.jpg', specs: {}, description: '', stock: 5,
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SKU, price: 1000000, stock: 5 }],
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }]
} as unknown as Product;
const item: CartItem = {
  id: 'i42', productId: '42', skuCode: SKU, name: 'Vợt 42', brand: 'Yonex', image: 'x.jpg', price: 1000000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', stringOption: null, tension: 11, quantity: 1
};

const clearCart = vi.fn();
let submitSpy: ReturnType<typeof vi.spyOn>;

function err(msg: string, extra: Record<string, unknown>) {
  return Object.assign(new Error(msg), extra);
}

function mount(cartItem: CartItem = item, prod: Product = product) {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: { appData: { products: [prod], branches: [], stringOptions: [], categories: [], isLoading: false } } as any
  });
  const el = (open: boolean) => (
    <Provider store={store}>
      <CartModal isOpen={open} onClose={() => {}} cartItems={[cartItem]} onRemoveItem={() => {}} onClearCart={clearCart} />
    </Provider>
  );
  const r = render(el(true));
  return { ...r, setOpen: (open: boolean) => r.rerender(el(open)) };
}
const phoneInput = () => screen.getByPlaceholderText('Ví dụ: 0912345678') as HTMLInputElement;
const orderBtn = () => screen.getByRole('button', { name: /Thanh toán SePay QR|Xác nhận đặt hàng|Đang xử lý/ }) as HTMLButtonElement;

async function fillForm(method: 'sepay' | 'cod' = 'sepay') {
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Khách Test' } });
  fireEvent.change(phoneInput(), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Test' } });
  await pickAdminUnits();
  if (method === 'cod') fireEvent.click(screen.getByText('Thanh toán COD'));
}
async function clickOrder() {
  await waitFor(() => expect(orderBtn()).not.toBeDisabled());
  fireEvent.click(orderBtn());
}
async function enterOtp() {
  const input = await screen.findByPlaceholderText('Nhập 6 số OTP');
  fireEvent.change(input, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
}
// Điền form + qua OTP -> createOrder được gọi lần đầu.
async function driveToOrder(method: 'sepay' | 'cod' = 'sepay') {
  await fillForm(method);
  await clickOrder();
  await enterOtp();
  await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  sessionStorage.clear();
  [alertMock, sendOtpMock, verifyOtpMock, createOrderMock, sepayMock, clearCart].forEach(m => m.mockReset());
  alertMock.mockResolvedValue(undefined);
  sendOtpMock.mockResolvedValue({ success: true });
  verifyOtpMock.mockResolvedValue({ success: true, verification_token: 'tok-1' });
  createOrderMock.mockResolvedValue({ id: 1, order_number: 'DH-9', total_amount: 1030000, shipping_fee: 30000 });
  sepayMock.mockResolvedValue({ action: 'https://pay.example/checkout', fields: { a: 'b' } });
  submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('STOR-042 lỗi 1: SePay đơn đã tạo mà /payments lỗi -> không đặt trùng', () => {
  it('giữ mã đơn, xoá giỏ, báo lời OMS; "Thanh toán lại" chỉ gọi payments với đúng mã đơn', async () => {
    sepayMock.mockRejectedValueOnce(err('Cổng SePay đang bảo trì', { kind: 'http', status: 502, body: { code: 'X', message: 'Cổng SePay đang bảo trì' } }));
    mount();
    await driveToOrder();
    expect(await screen.findByText(/Đã tạo đơn DH-9\. Chưa mở được trang thanh toán: Cổng SePay đang bảo trì/)).toBeInTheDocument();
    expect(clearCart).toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalledWith(expect.stringContaining('Có lỗi xảy ra khi tạo đơn'));

    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    await waitFor(() => expect(sepayMock).toHaveBeenCalledTimes(2));
    expect(sepayMock).toHaveBeenLastCalledWith('DH-9');
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
  });

  it('không có lời OMS trong body -> dùng err.message', async () => {
    sepayMock.mockRejectedValueOnce(err('Hết thời gian chờ cổng thanh toán', { kind: 'timeout' }));
    mount();
    await driveToOrder();
    expect(await screen.findByText(/Chưa mở được trang thanh toán: Hết thời gian chờ cổng thanh toán/)).toBeInTheDocument();
  });

  it('lỗi không có chữ nào -> câu cố định tiếng Việt', async () => {
    sepayMock.mockRejectedValueOnce({});
    mount();
    await driveToOrder();
    expect(await screen.findByText('Đã tạo đơn DH-9. Chưa mở được trang thanh toán: Cổng thanh toán chưa phản hồi. Vui lòng bấm "Thanh toán lại".')).toBeInTheDocument();
  });
});

describe('STOR-042 lỗi 2: /orders lỗi mạng/timeout/5xx -> không chắc đơn đã tạo, khoá đặt lại mù', () => {
  it.each([
    ['timeout', err('Quá thời gian chờ', { kind: 'timeout' })],
    ['network', err('Mất kết nối', { kind: 'network' })],
    ['5xx', err('Lỗi máy chủ', { kind: 'http', status: 503, body: null })]
  ])('%s: báo "Chưa chắc đơn đã được tạo", khoá nút, không kẹt "Đang xử lý"', async (_n, e) => {
    createOrderMock.mockRejectedValueOnce(e);
    mount();
    await driveToOrder();
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Chưa chắc đơn đã được tạo')));
    expect(screen.getByText(/Chưa chắc đơn đã được tạo/)).toBeInTheDocument();
    const btn = orderBtn();
    expect(btn).toBeDisabled();
    expect(btn.textContent).not.toMatch(/Đang xử lý/);
    fireEvent.click(btn);
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it('khách tự xác nhận đã kiểm tra -> mở khoá nút', async () => {
    createOrderMock.mockRejectedValueOnce(err('x', { kind: 'timeout' }));
    mount();
    await driveToOrder();
    fireEvent.click(await screen.findByRole('button', { name: /đã kiểm tra/i }));
    expect(orderBtn()).not.toBeDisabled();
  });
});

describe('STOR-042 lỗi 3: 201 thiếu order_number', () => {
  it('SePay: không gọi payments, báo tường minh', async () => {
    createOrderMock.mockResolvedValueOnce({ id: 1 });
    mount();
    await driveToOrder('sepay');
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('mã đơn')));
    expect(sepayMock).not.toHaveBeenCalled();
  });
  it('COD: không sang bước thành công không mã', async () => {
    createOrderMock.mockResolvedValueOnce({ id: 1 });
    mount();
    await driveToOrder('cod');
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('mã đơn')));
    expect(screen.queryByText('ĐẶT HÀNG THÀNH CÔNG!')).not.toBeInTheDocument();
  });
});

describe('STOR-042 lỗi 4/5/6: 403, đổi SĐT, 400/429', () => {
  it('403 VERIFICATION_TOKEN: hiện lời OMS, xoá token -> lần sau gửi OTP mới', async () => {
    // Đã qua 60s kể từ lần gửi OTP: không còn chờ gửi lại.
    createOrderMock.mockImplementationOnce(async () => {
      sessionStorage.removeItem('otp_cooldown_expiry_0987654321');
      throw err('Mã xác thực đã hết hạn, hãy xác thực lại', { status: 403, body: { code: 'VERIFICATION_TOKEN_EXPIRED', message: 'Mã xác thực đã hết hạn, hãy xác thực lại' } });
    });
    mount();
    await driveToOrder('cod');
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Mã xác thực đã hết hạn, hãy xác thực lại'));
    await clickOrder();
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(2));
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it('đổi SĐT sau khi đã có token -> token bị xoá, đặt lại phải gửi OTP', async () => {
    createOrderMock.mockRejectedValueOnce(err('bad', { status: 400, body: { message: 'Sai dữ liệu' } }));
    mount();
    await driveToOrder('cod');
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    fireEvent.change(phoneInput(), { target: { value: '0912345678' } });
    await clickOrder();
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(2));
    expect(sendOtpMock).toHaveBeenLastCalledWith('0912345678');
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it.each([400, 429])('%s có message chuỗi -> hiện lời OMS', async (status) => {
    createOrderMock.mockRejectedValueOnce(err(`Lời OMS ${status}`, { status, body: { message: `Lời OMS ${status}` } }));
    mount();
    await driveToOrder('cod');
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(`Lời OMS ${status}`));
  });
});

describe('STOR-042 lỗi 7: Enter trong form bước 2', () => {
  it('nút đặt hàng thuộc form (type=submit) nên Enter gửi như bấm nút', async () => {
    mount();
    await fillForm('cod');
    const btn = orderBtn();
    expect(btn.type).toBe('submit');
    expect(btn.form).toBe(phoneInput().form);
    expect(btn.form).not.toBeNull();
    fireEvent.submit(phoneInput().form!);
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(1));
  });
});

describe('STOR-042 lỗi 8: OtpModal', () => {
  const phone = '0987654321';
  const renderOtp = (props: Partial<React.ComponentProps<typeof OtpModal>> = {}) =>
    render(<OtpModal isOpen phoneNumber={phone} onClose={vi.fn()} onSuccess={vi.fn()} {...props} />);

  it('ô OTP có inputMode numeric + one-time-code; dán "123 456" còn đủ 6 số', () => {
    renderOtp();
    const input = screen.getByPlaceholderText('Nhập 6 số OTP') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    fireEvent.change(input, { target: { value: '123 456' } });
    expect(input.value).toBe('123456');
    fireEvent.change(input, { target: { value: '12345678' } });
    expect(input.value).toBe('123456');
  });

  it('verify 200 thiếu verification_token -> báo lỗi, không onSuccess', async () => {
    verifyOtpMock.mockResolvedValueOnce({ success: true });
    const onSuccess = vi.fn();
    renderOtp({ onSuccess });
    fireEvent.change(screen.getByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    expect(await screen.findByText(/không trả về mã xác thực/)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('xác thực thành công -> xoá mã đã lưu', async () => {
    renderOtp();
    fireEvent.change(screen.getByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    expect(getStoredOtpCode(phone)).toBe('123456');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(getStoredOtpCode(phone)).toBe(''));
  });

  it('đóng modal -> xoá mã đã lưu', () => {
    const onClose = vi.fn();
    const { container } = renderOtp({ onClose });
    fireEvent.change(screen.getByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(container.querySelector('button[type="button"]')!);
    expect(onClose).toHaveBeenCalled();
    expect(getStoredOtpCode(phone)).toBe('');
  });

  it('gửi lại OTP mới -> xoá mã cũ trong ô và trong storage', async () => {
    setStoredCooldownExpiry(phone, 0);
    sessionStorage.setItem(`otp_cooldown_expiry_${phone}`, String(Date.now() - 1000));
    setStoredOtpCode(phone, '111111');
    renderOtp();
    expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toHaveValue('111111');
    fireEvent.click(screen.getByText('Gửi lại mã'));
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toHaveValue(''));
    expect(getStoredOtpCode(phone)).toBe('');
  });

  it('mở lại modal -> lỗi cũ được xoá', async () => {
    verifyOtpMock.mockRejectedValueOnce({ status: 400, message: 'Mã sai' });
    const { rerender } = renderOtp();
    fireEvent.change(screen.getByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    expect(await screen.findByText('Mã sai')).toBeInTheDocument();
    rerender(<OtpModal isOpen={false} phoneNumber={phone} onClose={vi.fn()} onSuccess={vi.fn()} />);
    rerender(<OtpModal isOpen phoneNumber={phone} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByText('Mã sai')).not.toBeInTheDocument();
  });
});

describe('STOR-042 lỗi 9: đóng OtpModal rồi đặt lại trong 60s', () => {
  it('không gọi lại send-otp, modal mở lại, đếm ngược tính từ lần gửi thật', async () => {
    mount();
    await fillForm('cod');
    await clickOrder();
    await screen.findByPlaceholderText('Nhập 6 số OTP');
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(getStoredCooldown('0987654321')).toBeGreaterThan(55);
    // 45 giây sau lần gửi thật còn 15s
    setStoredCooldownExpiry('0987654321', 15);
    fireEvent.click(document.querySelector('#otp-verification-modal button[type="button"]')!);
    expect(screen.queryByPlaceholderText('Nhập 6 số OTP')).not.toBeInTheDocument();
    await clickOrder();
    expect(await screen.findByPlaceholderText('Nhập 6 số OTP')).toBeInTheDocument();
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Gửi lại sau \(1[45]s\)/)).toBeInTheDocument();
  });

  it('hết 60s -> đặt lại thì gửi OTP mới', async () => {
    mount();
    await fillForm('cod');
    await clickOrder();
    await screen.findByPlaceholderText('Nhập 6 số OTP');
    sessionStorage.setItem('otp_cooldown_expiry_0987654321', String(Date.now() - 1000));
    fireEvent.click(document.querySelector('#otp-verification-modal button[type="button"]')!);
    await clickOrder();
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(2));
  });
});

describe('STOR-042 vòng 2 - F4: 403 token khi vừa gửi OTP (< 60s)', () => {
  it('báo còn N giây, mở modal chờ gửi lại (ô trống, khoá), không gửi/xác nhận mã cũ', async () => {
    createOrderMock.mockRejectedValueOnce(err('Mã hết hạn', { status: 403, body: { code: 'VERIFICATION_TOKEN_EXPIRED', message: 'Mã hết hạn' } }));
    mount();
    await driveToOrder('cod');
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/^Mã xác thực đã hết hạn\. Bạn có thể nhận mã mới sau \d+ giây\.$/)));
    const input = await screen.findByPlaceholderText('Nhập 6 số OTP') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xác nhận OTP' })).toBeDisabled();
    expect(screen.getByText(/Gửi lại sau \(\d+s\)/)).toBeInTheDocument();
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    // Hết cooldown -> gửi lại được, ô nhập mở khoá
    sessionStorage.setItem('otp_cooldown_expiry_0987654321', String(Date.now() - 1000));
    await waitFor(() => expect(screen.getByText('Gửi lại mã')).not.toBeDisabled(), { timeout: 3000 });
    fireEvent.click(screen.getByText('Gửi lại mã'));
    await waitFor(() => expect(sendOtpMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByPlaceholderText('Nhập 6 số OTP')).not.toBeDisabled());
  });
});

describe('STOR-042 vòng 2 - F5: đơn SePay chờ thanh toán sống qua đóng/mở giỏ', () => {
  async function toPaymentError() {
    sepayMock.mockRejectedValueOnce(err('Cổng SePay đang bảo trì', { kind: 'http', status: 400, body: { code: 'X', message: 'Cổng SePay đang bảo trì' } }));
    const m = mount();
    await driveToOrder();
    await screen.findByRole('button', { name: 'Thanh toán lại' });
    return m;
  }
  it('đóng rồi mở lại giỏ: vẫn thấy mã đơn + "Thanh toán lại" chỉ gọi payments', async () => {
    const { setOpen } = await toPaymentError();
    setOpen(false);
    expect(screen.queryByRole('button', { name: 'Thanh toán lại' })).not.toBeInTheDocument();
    setOpen(true);
    expect(await screen.findByText(/Đã tạo đơn DH-9\. Chưa mở được trang thanh toán: Cổng SePay đang bảo trì/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    await waitFor(() => expect(sepayMock).toHaveBeenLastCalledWith('DH-9'));
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(submitSpy).toHaveBeenCalled());
    expect(sessionStorage.getItem('pending_sepay_order')).toBeNull();
  });
  it('khách bấm "Hoàn thành mua sắm" (chủ động bỏ) -> xoá đơn chờ, mở lại không còn màn lỗi', async () => {
    const { setOpen } = await toPaymentError();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành mua sắm' }));
    expect(sessionStorage.getItem('pending_sepay_order')).toBeNull();
    setOpen(false);
    setOpen(true);
    expect(screen.queryByRole('button', { name: 'Thanh toán lại' })).not.toBeInTheDocument();
  });
});

describe('STOR-042 vòng 2 - mục 6: lời cho over_stock/out_of_stock', () => {
  const withStock = (stock: number) => ({ ...product, variants: [{ ...(product as any).variants[0], stock }] }) as unknown as Product;
  it('vượt tồn -> "Chỉ còn N sản phẩm..." và khoá thanh toán', () => {
    mount({ ...item, quantity: 3 }, withStock(2));
    expect(screen.getByText('Chỉ còn 2 sản phẩm. Vui lòng giảm số lượng.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tiến hành thanh toán/ })).toBeDisabled();
  });
  it('hết hàng -> "Phân loại này đã hết hàng..."', () => {
    mount(item, withStock(0));
    expect(screen.getByText('Phân loại này đã hết hàng. Vui lòng xoá khỏi giỏ.')).toBeInTheDocument();
  });
});

describe('STOR-042 vòng 2 - mục 6: thêm giỏ bị từ chối vì tồn thì không mở giỏ', () => {
  const mk = () => configureStore({ reducer: { cart: cartReducer } });
  it('stock=0: items không đổi, stockNotice được ghi, isOpen=false', () => {
    const store = mk();
    store.dispatch(addCartItemAndOpen({ ...item, stock: 0 }) as any);
    const st = store.getState().cart;
    expect(st.items).toHaveLength(0);
    expect(st.stockNotice).toBeTruthy();
    expect(st.isOpen).toBe(false);
  });
  it('thêm được: items có món và isOpen=true', () => {
    const store = mk();
    store.dispatch(addCartItemAndOpen({ ...item, stock: 5 }) as any);
    expect(store.getState().cart.items).toHaveLength(1);
    expect(store.getState().cart.isOpen).toBe(true);
  });
  it('đã có 2/2 trong giỏ, thêm nữa bị từ chối: không mở giỏ', () => {
    const store = mk();
    store.dispatch(addCartItemAndOpen({ ...item, quantity: 2, stock: 2 }) as any);
    store.dispatch(closeCart());
    store.dispatch(addCartItemAndOpen({ ...item, quantity: 1, stock: 2 }) as any);
    expect(store.getState().cart.isOpen).toBe(false);
  });
});
