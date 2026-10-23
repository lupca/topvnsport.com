// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer, { clearCart } from '../features/cart/cartSlice';
import { getAdminUnitsFromFixture, pickAdminUnits, ADDRESS_SUFFIX } from './fixtures/adminUnits';
import { QUOTE_200_FALLBACK } from './fixtures/shippingQuote';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';

const alertMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));

const sendOtpMock = vi.fn().mockResolvedValue(undefined);
const verifyOtpMock = vi.fn().mockResolvedValue({ success: true, verification_token: 'tok-123' });
const createOrderMock = vi.fn().mockResolvedValue({ id: 1, order_number: 'DH-1' });
vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: (...a: unknown[]) => sendOtpMock(...a),
    verifyOtp: (...a: unknown[]) => verifyOtpMock(...a),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: async () => QUOTE_200_FALLBACK,
    createSepayCheckout: vi.fn()
  }
}));

const SHIRT_SKU = 'SKU-AO-M';
const shirt: Product = {
  id: '1', name: 'Áo Yonex', brand: 'Yonex', category: 'Áo', price: 100000, image: 'x.jpg', specs: {}, description: '', stock: 3,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['M'] }],
  variants: [{ tier_1_option: 'M', tier_2_option: null, sku_code: SHIRT_SKU, price: 100000, stock: 3 }]
};
const RACKET_SKU = 'SKU-VOT-KHUNG';
const racket: Product = {
  id: '2', name: 'Vợt Yonex', brand: 'Yonex', category: 'Vợt', price: 2000000, image: 'y.jpg', specs: {}, description: '', stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Loại Cước', options: ['Khung không dây', 'Đã căng dây'] }],
  variants: [
    { tier_1_option: 'Khung không dây', tier_2_option: null, sku_code: RACKET_SKU, price: 2000000, stock: 5 },
    { tier_1_option: 'Đã căng dây', tier_2_option: null, sku_code: 'SKU-VOT-DAY', price: 2100000 }
  ]
};
const racketPlain: Product = { ...racket, id: '3', name: 'Vợt khác' };

const shirtItem: CartItem = {
  id: 'i1', productId: '1', skuCode: SHIRT_SKU, name: 'Áo Yonex', brand: 'Yonex', image: 'x.jpg', price: 100000,
  selectedWeight: 'M', selectedColor: '', variantLabel: 'Size: M', stringOption: null, tension: 10, quantity: 1
};
const racketItem: CartItem = {
  ...shirtItem, id: 'i2', productId: '2', skuCode: RACKET_SKU, name: 'Vợt Yonex', price: 2000000,
  variantLabel: 'Loại Cước: Khung không dây'
};

const onClearCartSpy = vi.fn();
let storeRef: ReturnType<typeof makeStore>;
function makeStore(items: CartItem[], products: Product[]) {
  return configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer },
    preloadedState: {
      appData: { products, branches: [], stringOptions: [], categories: [], isLoading: false },
      cart: { items, isOpen: true, quickViewProduct: null }
    } as any
  });
}
// Wrapper đọc giỏ từ store như App.tsx, điều khiển isOpen qua nút ngoài.
function Harness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = React.useState(initialOpen);
  const dispatch = useDispatch();
  const items = useSelector((s: any) => s.cart.items) as CartItem[];
  return (
    <>
      <button onClick={() => setOpen(o => !o)}>toggle</button>
      <CartModal isOpen={open} onClose={() => setOpen(false)} cartItems={items} onRemoveItem={() => {}}
        onClearCart={() => { onClearCartSpy(); dispatch(clearCart()); }} />
    </>
  );
}
function setup(items: CartItem[], products: Product[] = [shirt, racket, racketPlain]) {
  storeRef = makeStore(items, products);
  return render(<Provider store={storeRef}><Harness /></Provider>);
}
const qty = (id: string) => (storeRef.getState() as any).cart.items.find((i: CartItem) => i.id === id)?.quantity;

async function fillForm() {
  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Test' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: '  Số 1 Test ' } });
  await pickAdminUnits();
  fireEvent.click(screen.getByText('Thanh toán COD'));
}
async function placeOrder() {
  await fillForm();
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
  await waitFor(() => expect(sendOtpMock).toHaveBeenCalled());
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
}

beforeEach(() => {
  [alertMock, sendOtpMock, createOrderMock, onClearCartSpy].forEach(m => m.mockClear());
});
afterEach(() => cleanup());

describe('STOR-029 số lượng', () => {
  it('tang-so-luong', () => {
    setup([shirtItem]);
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    expect(qty('i1')).toBe(2);
  });
  it('giam-khoa-o-1', () => {
    setup([shirtItem]);
    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).not.toBeDisabled();
  });
  it('tang-khong-vuot-ton', () => {
    setup([{ ...shirtItem, quantity: 3 }]);
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled();
  });
  it('tang-khi-chua-biet-ton-khong-co-tran', () => {
    setup([{ ...racketItem, skuCode: 'SKU-VOT-DAY', variantLabel: 'Loại Cước: Đã căng dây', quantity: 50 }]);
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).not.toBeDisabled();
  });
  it('thanh-tien-theo-so-luong', () => {
    setup([shirtItem]);
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    expect(screen.getAllByText('200.000đ').length).toBeGreaterThan(0);
  });
});

describe('STOR-029 dòng đan cước', () => {
  it('dong-dan-cuoc-hien', () => {
    setup([{ ...racketItem, variantLabel: 'Loại Cước: Đã căng dây', stringOption: { id: 'e', name: 'Exbolt 65', price: 0 } as any, tension: 10.5 }]);
    expect(screen.getByText('• Đan cước: Exbolt 65 (10.5 Kg)')).toBeInTheDocument();
  });
  it('ao-khong-dong-dan', () => {
    setup([shirtItem]);
    expect(screen.queryByText(/đan/i)).toBeNull();
  });
  it('vot-khung-khong-day-khong-lap', () => {
    setup([racketItem]);
    expect(screen.getByText('Loại Cước: Khung không dây')).toBeInTheDocument();
    expect(screen.queryByText(/Không đan lưới/)).toBeNull();
  });
  it('vot-co-tang-cuoc-nhung-phan-loai-khong-neu-thi-hien-khong-dan', () => {
    setup([{ ...racketItem, productId: '3', variantLabel: undefined }]);
    expect(screen.getByText(/Không đan lưới/)).toBeInTheDocument();
  });
});

describe('STOR-029 địa chỉ', () => {
  const toStep2 = () => fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  it('khong-con-select-tinh', () => {
    setup([shirtItem]); toStep2();
    expect(document.querySelectorAll('select').length).toBe(0);
  });
  it('o-phuong-xa', () => {
    setup([shirtItem]); toStep2();
    const el = screen.getByText('Phường/Xã *').parentElement!.querySelector('input')!;
    expect(el).toBeRequired();
  });
  it('o-tinh-thanh', () => {
    setup([shirtItem]); toStep2();
    const el = screen.getByText('Tỉnh/Thành phố *').parentElement!.querySelector('input')!;
    expect(el).toBeRequired();
  });
  it('thieu-phuong-xa-chan-otp', async () => {
    setup([shirtItem]); toStep2();
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'A' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    fireEvent.focus(await screen.findByRole('combobox', { name: 'Tỉnh/Thành phố' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Hà Nội' }));
    // STOR-037: chưa có báo giá nên nút khoá; guard tỉnh/xã vẫn chặn đường submit form (Enter).
    fireEvent.submit(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà').closest('form')!);
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    expect(sendOtpMock).not.toHaveBeenCalled();
  });
  it('thieu-tinh-chan-otp', async () => {
    setup([shirtItem]); toStep2();
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'A' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1' } });
    // STOR-037: chưa có báo giá nên nút khoá; guard tỉnh/xã vẫn chặn đường submit form (Enter).
    fireEvent.submit(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà').closest('form')!);
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    expect(sendOtpMock).not.toHaveBeenCalled();
  });
  it('dia-chi-gui-oms', async () => {
    setup([shirtItem]); await placeOrder();
    expect(createOrderMock.mock.calls[0][0].shipping_address).toBe('Số 1 Test, Phường Ba Đình, Hà Nội');
  });
  it('dia-chi-khach-hang', async () => {
    setup([shirtItem]); await placeOrder();
    expect(createOrderMock.mock.calls[0][0].customer.address).toBe('Số 1 Test, Phường Ba Đình, Hà Nội');
  });
  it('man-thanh-cong-dia-chi', async () => {
    setup([shirtItem]); await placeOrder();
    expect(await screen.findByText(/Số 1 Test, Phường Ba Đình, Hà Nội/)).toBeInTheDocument();
  });
});

describe('STOR-029 nút đáy, đóng giỏ, COD', () => {
  it('nut-day-cung-bo-goc', () => {
    setup([shirtItem]);
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    const back = screen.getByRole('button', { name: 'Quay lại' });
    const confirm = screen.getByRole('button', { name: /Thanh toán SePay|Xác nhận đặt hàng/ });
    expect(back.className).toContain('rounded-sm');
    expect(confirm.className).toContain('rounded-sm');
  });
  it('dong-mo-ve-buoc-1', () => {
    setup([shirtItem]);
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    expect(screen.getByText('Thanh Toán Đơn Hàng')).toBeInTheDocument();
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByText('Giỏ Hàng Của Bạn')).toBeInTheDocument();
  });
  it('giu-du-lieu-form', () => {
    setup([shirtItem]);
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Giữ' } });
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
    expect(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A')).toHaveValue('Nguyễn Giữ');
  });
  it('cod-xoa-gio', async () => {
    setup([shirtItem]); await placeOrder();
    await screen.findByText('ĐẶT HÀNG THÀNH CÔNG!');
    expect(onClearCartSpy).toHaveBeenCalledTimes(1);
    expect((storeRef.getState() as any).cart.items).toEqual([]);
  });
  it('buoc-3-tong-tien', async () => {
    setup([shirtItem]); await placeOrder();
    await screen.findByText('ĐẶT HÀNG THÀNH CÔNG!');
    // 100.000đ hàng + 30.000đ ship, giỏ đã rỗng
    expect(screen.getByText(/Tổng hóa đơn thanh toán: 130\.000đ/)).toBeInTheDocument();
  });
  it('dong-buoc-3-ve-buoc-1', async () => {
    setup([shirtItem]); await placeOrder();
    await screen.findByText('ĐẶT HÀNG THÀNH CÔNG!');
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByText('Giỏ Hàng Của Bạn')).toBeInTheDocument();
    expect(screen.getByText('Giỏ hàng của bạn đang trống.')).toBeInTheDocument();
  });
});
