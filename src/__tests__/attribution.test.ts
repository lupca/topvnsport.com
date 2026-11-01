// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import { QUOTE_200 } from './fixtures/shippingQuote';
import CartModal, { CartItem } from '../components/CartModal';
import { Product } from '../types';
import { PROVINCE_BODY, WARD_BODY, pickAdminUnits } from './fixtures/adminUnits';
import {
  captureAttribution,
  readAttribution,
  ATTRIBUTION_STORAGE_KEY,
  ATTRIBUTION_EXPIRY_MS,
  ALLOWED_ATTRIBUTION_KEYS,
} from '../lib/attribution.ts';

vi.mock('@topvnsport/ui-kit', () => ({
  popupService: { alert: vi.fn().mockResolvedValue(undefined) },
}));

const SKU = 'SKU-VOT-1';
const mockProduct: Product = {
  id: '1',
  name: 'Vợt Cầu Lông Yonex',
  brand: 'Yonex',
  category: 'Vợt',
  price: 2000000,
  image: 'x.jpg',
  specs: {},
  description: '',
  stock: 5,
  tier_variations: [{ tier_index: 1, name: 'Size', options: ['4U'] }],
  variants: [{ tier_1_option: '4U', tier_2_option: null, sku_code: SKU, price: 2000000, stock: 5 }],
} as any;

const mockItem: CartItem = {
  id: 'i1',
  productId: '1',
  skuCode: SKU,
  name: 'Vợt Cầu Lông Yonex',
  brand: 'Yonex',
  image: 'x.jpg',
  price: 2000000,
  selectedWeight: '4U',
  selectedColor: '',
  variantLabel: 'Size: 4U',
  quantity: 1,
  tension: 11,
  stringOption: null,
};

let capturedCalls: { url: string; body: any }[] = [];
const onClearCart = vi.fn();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  capturedCalls = [];
  onClearCart.mockClear();

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: any) => {
      if (url.startsWith('/api/oms/admin-units')) {
        const json = url.includes('level=ward') ? WARD_BODY : PROVINCE_BODY;
        return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
      }
      if (url === '/api/oms/shipping-quote') {
        return { ok: true, status: 200, json: async () => QUOTE_200, text: async () => JSON.stringify(QUOTE_200) };
      }
      const body = init?.body ? JSON.parse(init.body) : undefined;
      capturedCalls.push({ url, body });
      const json = url.endsWith('/verify-otp')
        ? { success: true, verification_token: 'valid-vt' }
        : url.endsWith('/orders')
          ? { id: 8, order_number: 'DH-ATTRIB-1', total_amount: 2000000, shipping_fee: 30000 }
          : { success: true };
      return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) };
    })
  );
  vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function completeCheckout() {
  const store = configureStore({
    reducer: { appData: appDataReducer },
    preloadedState: {
      appData: { products: [mockProduct], branches: [], stringOptions: [], categories: [], isLoading: false },
    } as any,
  });

  render(
    React.createElement(
      Provider,
      { store },
      React.createElement(CartModal, {
        isOpen: true,
        onClose: () => {},
        cartItems: [mockItem],
        onRemoveItem: () => {},
        onClearCart: onClearCart,
      })
    )
  );

  fireEvent.click(screen.getByRole('button', { name: /Tiến hành thanh toán/ }));
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), { target: { value: 'Lê Văn A' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: 0912345678'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByPlaceholderText('Ví dụ: Số 12 Chùa Hà'), { target: { value: 'Số 10 Tràng Tiền' } });
  await pickAdminUnits();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Xác nhận đặt hàng|Thanh toán SePay/ })).not.toBeDisabled()
  );
  fireEvent.click(screen.getByText('Thanh toán COD'));
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
  fireEvent.change(await screen.findByPlaceholderText('Nhập 6 số OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));
  await waitFor(() => expect(capturedCalls.some(c => c.url.endsWith('/orders'))).toBe(true));
}

describe('Attribution Module (STOR-065)', () => {
  it('Landing with the six params stores them with a timestamp in localStorage', () => {
    const query =
      '?utm_source=facebook&utm_medium=cpc&utm_campaign=summer_promo&utm_content=hero_banner&gclid=test_gclid_123&fbclid=test_fbclid_456&ignored_param=xyz';
    const result = captureAttribution(query);

    expect(result).toEqual({
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'summer_promo',
      utm_content: 'hero_banner',
      gclid: 'test_gclid_123',
      fbclid: 'test_fbclid_456',
    });

    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(typeof parsed.ts).toBe('number');
    expect(parsed.attribution).toEqual({
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'summer_promo',
      utm_content: 'hero_banner',
      gclid: 'test_gclid_123',
      fbclid: 'test_fbclid_456',
    });
    expect(parsed.attribution).not.toHaveProperty('ignored_param');

    const read = readAttribution();
    expect(read).toEqual({
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'summer_promo',
      utm_content: 'hero_banner',
      gclid: 'test_gclid_123',
      fbclid: 'test_fbclid_456',
    });
  });

  it('A new landing with any of the params overwrites the stored values', () => {
    captureAttribution('?utm_source=facebook&utm_medium=cpc&utm_campaign=old_campaign&gclid=old_gclid');
    expect(readAttribution()).toEqual({
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'old_campaign',
      gclid: 'old_gclid',
    });

    // New landing with new params
    const updated = captureAttribution('?utm_source=google&utm_campaign=new_winter_sale');
    expect(updated).toEqual({
      utm_source: 'google',
      utm_campaign: 'new_winter_sale',
    });

    const read = readAttribution();
    expect(read).toEqual({
      utm_source: 'google',
      utm_campaign: 'new_winter_sale',
    });
    expect(read).not.toHaveProperty('utm_medium');
    expect(read).not.toHaveProperty('gclid');
  });

  it('Stored attribution older than 30 days is ignored', () => {
    vi.useFakeTimers();
    captureAttribution('?utm_source=tiktok&utm_medium=video');
    expect(readAttribution()).toEqual({ utm_source: 'tiktok', utm_medium: 'video' });

    // Advance 30 days + 1 second
    vi.advanceTimersByTime(ATTRIBUTION_EXPIRY_MS + 1000);

    const read = readAttribution();
    expect(read).toBeUndefined();
  });

  it('Stored attribution older than 30 days is removed from localStorage', () => {
    vi.useFakeTimers();
    captureAttribution('?utm_source=tiktok&utm_medium=video');
    expect(localStorage.getItem(ATTRIBUTION_STORAGE_KEY)).toBeTruthy();

    // Advance 31 days
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

    readAttribution();
    expect(localStorage.getItem(ATTRIBUTION_STORAGE_KEY)).toBeNull();
  });

  it('The order body includes attribution with only the six allowed string keys when stored', async () => {
    captureAttribution('?utm_source=facebook&utm_medium=cpc&utm_campaign=sale&gclid=gl123&fbclid=fb123&other=hack');
    await completeCheckout();

    const orderCall = capturedCalls.find(c => c.url.endsWith('/orders'));
    expect(orderCall).toBeDefined();
    expect(orderCall!.body).toHaveProperty('attribution');
    expect(orderCall!.body.attribution).toEqual({
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'sale',
      gclid: 'gl123',
      fbclid: 'fb123',
    });
    // Ensure no unexpected keys
    const attributionKeys = Object.keys(orderCall!.body.attribution);
    for (const k of attributionKeys) {
      expect(ALLOWED_ATTRIBUTION_KEYS).toContain(k);
    }
  });

  it('The order body has no attribution key when nothing valid is stored', async () => {
    // Nothing in storage
    localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    await completeCheckout();

    const orderCall = capturedCalls.find(c => c.url.endsWith('/orders'));
    expect(orderCall).toBeDefined();
    expect(orderCall!.body).not.toHaveProperty('attribution');
    expect(orderCall!.body).not.toHaveProperty('attribution', null);
    expect(orderCall!.body).not.toHaveProperty('attribution', {});
  });
});
