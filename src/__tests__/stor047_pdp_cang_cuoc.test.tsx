// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import { buildConfiguredCartItem } from '../features/cart/cartSlice';
import { getAdminUnitsFromFixture, pickAdminUnits } from './fixtures/adminUnits';
import { QUOTE_200_FALLBACK } from './fixtures/shippingQuote';
import fixture from './fixtures/stor047_stringing_tiers.fixture.json';
import ProductDetailPage from '../components/ProductDetailPage';
import CartModal from '../components/CartModal';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));

const createOrderMock = vi.fn().mockResolvedValue({ id: 1, order_number: 'DH-1' });
vi.mock('../services/sportApi', () => ({
  sportApi: {
    sendOtp: vi.fn().mockResolvedValue(undefined),
    verifyOtp: vi.fn().mockResolvedValue({ success: true, verification_token: 'tok-123' }),
    createOrder: (...args: unknown[]) => createOrderMock(...args),
    getAdminUnits: (...a: [string, string?]) => getAdminUnitsFromFixture(a[0]),
    getShippingQuote: async () => QUOTE_200_FALLBACK,
    createSepayCheckout: vi.fn()
  }
}));

// Vợt #310 với tầng và biến thể nguyên văn từ PIM prod.
const t = (name: string) => {
  const x = fixture.tiers.find((y) => y.product_id === 310 && y.name === name)!;
  return { tier_index: name === 'Màu Sắc' ? 1 : 2, name: x.name, options: x.options };
};
const product310: Product = {
  id: '310', slug: 'vot-310', name: 'Yonex Astrox Lite 45i', brand: 'Yonex', category: 'Vợt', price: 780000, image: 'x.jpg',
  specs: {}, description: '', stock: 10,
  tier_variations: [t('Màu Sắc'), t('Căng Cước')],
  variants: fixture.racket310_variants.map((v) => ({ ...v, stock: 10 }))
};

describe('STOR-047 PDP vợt có tầng "Căng Cước"', () => {
  beforeEach(() => createOrderMock.mockClear());
  afterEach(cleanup);

  it('chọn cước -> hiện ô độ căng; đơn gửi OMS có "Đan cước <sku>: <cước> <kg> Kg"', async () => {
    const added: any[] = [];
    render(
      <MemoryRouter>
        <ProductDetailPage product={product310} stringOptions={[]} onBackToCatalog={() => {}}
          onAddToCartWithSpecs={(...a) => added.push(a)} />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Chọn lực căng/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Blue/ }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Exbolt 65'));
    expect(screen.getByText(/Chọn lực căng/)).toBeTruthy();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Thêm vào giỏ hàng/ }));

    expect(added).toHaveLength(1);
    const [p, weight, color, stringChoice, tension] = added[0];
    const item = buildConfiguredCartItem(p, weight, color, stringChoice, tension)!;
    expect(item.skuCode).toBe('VCLYAL45IRM3MMCKTTVH-ACEM-BLUE-EXBOLT-65');
    cleanup();

    const store = configureStore({
      reducer: { appData: appDataReducer },
      preloadedState: { appData: { products: [product310], branches: [], stringOptions: [], categories: [], isLoading: false } } as any
    });
    render(
      <Provider store={store}>
        <CartModal isOpen onClose={() => {}} cartItems={[item]} onRemoveItem={() => {}} onClearCart={() => {}} />
      </Provider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán|Đang tải/ }));
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Nguyễn Test' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 1 Test' } });
    await pickAdminUnits();
    fireEvent.click(screen.getByText('Thanh toán COD'));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
    expect(createOrderMock.mock.calls[0][0].note).toContain(
      'Đan cước VCLYAL45IRM3MMCKTTVH-ACEM-BLUE-EXBOLT-65: Exbolt 65 12 Kg'
    );
  });
});
