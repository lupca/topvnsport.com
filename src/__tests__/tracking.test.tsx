// @vitest-environment jsdom
import React, { StrictMode, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import * as tracking from '../lib/tracking.ts';
import cartReducer, { addCartItemAndOpen } from '../features/cart/cartSlice.ts';
import appDataReducer from '../features/appData/appDataSlice.ts';
import CartModal, { CartItem } from '../components/CartModal.tsx';
import OtpModal from '../components/OtpModal.tsx';
import { sportApi } from '../services/sportApi.ts';
import { Product } from '../types.ts';

vi.mock('@topvnsport/ui-kit', () => ({
  popupService: { alert: vi.fn().mockResolvedValue(undefined) },
}));

const mockProduct: Product = {
  id: '10',
  name: 'Vợt Yonex Astrox 88D Pro',
  brand: 'Yonex',
  category: 'Vợt',
  price: 3500000,
  image: 'img.jpg',
  specs: {},
  description: '',
  stock: 2,
  tier_variations: [{ tier_index: 1, name: 'Trọng lượng', options: ['4U'] }],
  variants: [{ tier_1_option: '4U', tier_2_option: null, sku_code: 'SKU-88D', price: 3500000, stock: 2 }],
} as any;

const mockCartItem: CartItem = {
  id: 'cart-1',
  productId: '10',
  skuCode: 'SKU-88D',
  name: 'Vợt Yonex Astrox 88D Pro',
  brand: 'Yonex',
  image: 'img.jpg',
  price: 3500000,
  selectedWeight: '4U',
  selectedColor: '',
  variantLabel: 'Trọng lượng: 4U',
  quantity: 1,
  tension: 11,
  stringOption: null,
};

let gtagSpy: ReturnType<typeof vi.fn>;
let fbqSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.head.innerHTML = '';
  delete (window as any).dataLayer;
  delete (window as any).gtag;
  delete (window as any).fbq;
  delete (window as any)._fbq;
  tracking._resetTrackingForTesting();

  gtagSpy = vi.fn();
  fbqSpy = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]' })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setupSpiedTracking(gaId = 'G-TESTID123', pixelId = 'PIXEL-TEST456') {
  tracking._resetTrackingForTesting();
  tracking.initTracking(gaId, pixelId);
  window.gtag = gtagSpy;
  window.fbq = fbqSpy;
}

describe('Tracking Module Specification (STOR-065)', () => {
  it('src/lib/tracking.ts exports the seven event functions', () => {
    expect(typeof tracking.pageView).toBe('function');
    expect(typeof tracking.viewItem).toBe('function');
    expect(typeof tracking.addToCart).toBe('function');
    expect(typeof tracking.beginCheckout).toBe('function');
    expect(typeof tracking.zaloAuthStart).toBe('function');
    expect(typeof tracking.zaloAuthDone).toBe('function');
    expect(typeof tracking.purchase).toBe('function');
  });

  it('index.html contains no gtag.js script tag and no fbevents.js script tag', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');
    expect(indexHtml).not.toContain('gtag.js');
    expect(indexHtml).not.toContain('fbevents.js');
  });

  it('Only src/lib/tracking.ts references gtag, fbq, googletagmanager, or facebook script hosts in application source', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const walk = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          if (!file.includes('__tests__') && file !== 'tests') {
            results = results.concat(walk(fullPath));
          }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      });
      return results;
    };

    const files = walk(srcDir).filter(f => !f.endsWith('src/lib/tracking.ts'));
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content, `File ${file} should not reference gtag`).not.toMatch(/\bgtag\b/);
      expect(content, `File ${file} should not reference fbq`).not.toMatch(/\bfbq\b/);
      expect(content, `File ${file} should not reference googletagmanager`).not.toContain('googletagmanager');
      expect(content, `File ${file} should not reference facebook script host`).not.toContain('connect.facebook.net');
    }
  });

  it('With both IDs unset, no tracking script is injected and calling every exported function throws nothing', () => {
    tracking.initTracking('', '');
    expect(document.head.querySelectorAll('script')).toHaveLength(0);

    expect(() => {
      tracking.pageView('/test');
      tracking.viewItem({ id: '1', name: 'Product', price: 100 });
      tracking.addToCart({ id: '1', name: 'Product', price: 100, quantity: 1 });
      tracking.beginCheckout({ items: [{ id: '1', name: 'Product', price: 100, quantity: 1 }], value: 100 });
      tracking.zaloAuthStart();
      tracking.zaloAuthDone();
      tracking.purchase({ order_number: 'DH-001', value: 100, items: [] });
    }).not.toThrow();
  });

  it('With VITE_GA4_ID set, exactly one gtag.js script exists in head and send_page_view is false', () => {
    tracking.initTracking('G-ABCXYZ', '');
    tracking.initTracking('G-ABCXYZ', ''); // duplicate init

    const scripts = document.head.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('src')).toContain('id=G-ABCXYZ');

    expect(window.dataLayer).toBeDefined();
    // gtag was called with config, gaId, { send_page_view: false }
    const configCall = window.dataLayer.find(call => call[0] === 'config' && call[1] === 'G-ABCXYZ');
    expect(configCall).toBeDefined();
    // gtag.js ignores plain arrays; entries must be Arguments objects
    expect(Object.prototype.toString.call(configCall)).toBe('[object Arguments]');
    expect(window.dataLayer.every(e => Object.prototype.toString.call(e) === '[object Arguments]')).toBe(true);
    expect(configCall[2]).toEqual({ send_page_view: false });
  });

  it('With VITE_META_PIXEL_ID set, exactly one fbevents.js script exists in head and no fbq PageView is sent on init', () => {
    tracking.initTracking('', '1234567890');
    tracking.initTracking('', '1234567890'); // duplicate init

    const scripts = document.head.querySelectorAll('script[src*="connect.facebook.net/en_US/fbevents.js"]');
    expect(scripts).toHaveLength(1);

    expect(window.fbq).toBeDefined();
    const queue = window.fbq.queue;
    expect(queue).toBeDefined();
    const initCall = queue.find((call: any[]) => call[0] === 'init' && call[1] === '1234567890');
    expect(initCall).toBeDefined();

    const pageViewCall = queue.find((call: any[]) => call[1] === 'PageView');
    expect(pageViewCall).toBeUndefined();
  });

  it('A full load under StrictMode sends exactly one GA4 page_view and one Meta PageView', () => {
    setupSpiedTracking();

    function RouteTracker() {
      const location = useLocation();
      useEffect(() => {
        tracking.pageView(location.pathname + location.search);
      }, [location.pathname, location.search]);
      return <div>Home</div>;
    }

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <RouteTracker />
        </MemoryRouter>
      </StrictMode>
    );

    const gaPageViews = gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'page_view');
    expect(gaPageViews).toHaveLength(1);
    expect(gaPageViews[0][2]).toEqual({ page_path: '/' });

    const metaPageViews = fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'PageView');
    expect(metaPageViews).toHaveLength(1);
  });

  it('Navigating to a second route sends one more GA4 page_view and one more Meta PageView', () => {
    setupSpiedTracking();

    function TestApp() {
      const location = useLocation();
      const navigate = useNavigate();
      useEffect(() => {
        tracking.pageView(location.pathname);
      }, [location.pathname]);
      return <button onClick={() => navigate('/catalog')}>Go to Catalog</button>;
    }

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <TestApp />
        </MemoryRouter>
      </StrictMode>
    );

    expect(gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'page_view')).toHaveLength(1);
    expect(fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'PageView')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Go to Catalog/ }));

    expect(gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'page_view')).toHaveLength(2);
    expect(fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'PageView')).toHaveLength(2);
  });

  it('Opening a product sends GA4 view_item and Meta ViewContent with correct items, currency VND, value, content_ids', () => {
    setupSpiedTracking();

    tracking.viewItem({
      id: 'prod-99',
      name: 'Vợt Cầu Lông Cao Cấp',
      price: 2500000,
    });

    const gaViewItem = gtagSpy.mock.calls.find(c => c[0] === 'event' && c[1] === 'view_item');
    expect(gaViewItem).toBeDefined();
    expect(gaViewItem![2]).toEqual({
      currency: 'VND',
      value: 2500000,
      items: [
        {
          item_id: 'prod-99',
          item_name: 'Vợt Cầu Lông Cao Cấp',
          price: 2500000,
        },
      ],
    });

    const metaViewContent = fbqSpy.mock.calls.find(c => c[0] === 'track' && c[1] === 'ViewContent');
    expect(metaViewContent).toBeDefined();
    expect(metaViewContent![2]).toEqual({
      content_ids: ['prod-99'],
      content_name: 'Vợt Cầu Lông Cao Cấp',
      content_type: 'product',
      value: 2500000,
      currency: 'VND',
    });
  });

  it('A successful add to cart sends GA4 add_to_cart and Meta AddToCart, while a stock-rejected add to cart sends nothing', () => {
    setupSpiedTracking();

    const store = configureStore({
      reducer: { cart: cartReducer },
      preloadedState: {
        cart: { items: [], isOpen: false, quickViewProduct: null },
      },
    });

    // 1. Successful add
    store.dispatch(
      addCartItemAndOpen({
        id: 'item-1',
        productId: 'prod-10',
        skuCode: 'SKU-88D',
        name: 'Vợt Astrox',
        brand: 'Yonex',
        image: 'img.jpg',
        price: 3500000,
        selectedWeight: '4U',
        selectedColor: '',
        stringOption: null,
        tension: 11,
        quantity: 1,
        stock: 2,
      })
    );

    const gaAddToCart = gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'add_to_cart');
    expect(gaAddToCart).toHaveLength(1);
    expect(gaAddToCart[0][2]).toEqual({
      currency: 'VND',
      value: 3500000,
      items: [{ item_id: 'prod-10', item_name: 'Vợt Astrox', price: 3500000, quantity: 1 }],
    });

    const metaAddToCart = fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'AddToCart');
    expect(metaAddToCart).toHaveLength(1);
    expect(metaAddToCart[0][2]).toEqual({
      content_ids: ['prod-10'],
      content_name: 'Vợt Astrox',
      content_type: 'product',
      value: 3500000,
      currency: 'VND',
    });

    // 2. Stock rejected add (attempting to add 5 more when stock is 2, and 1 already in cart)
    store.dispatch(
      addCartItemAndOpen({
        id: 'item-1',
        productId: 'prod-10',
        skuCode: 'SKU-88D',
        name: 'Vợt Astrox',
        brand: 'Yonex',
        image: 'img.jpg',
        price: 3500000,
        selectedWeight: '4U',
        selectedColor: '',
        stringOption: null,
        tension: 11,
        quantity: 5,
        stock: 2,
      })
    );

    // No new add_to_cart events dispatched
    expect(gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'add_to_cart')).toHaveLength(1);
    expect(fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'AddToCart')).toHaveLength(1);
  });

  it('Moving the cart modal to the checkout step sends GA4 begin_checkout and Meta InitiateCheckout', async () => {
    setupSpiedTracking();

    const store = configureStore({
      reducer: { appData: appDataReducer, cart: cartReducer },
      preloadedState: {
        appData: { products: [mockProduct], branches: [], stringOptions: [], categories: [], isLoading: false },
        cart: { items: [mockCartItem], isOpen: true, quickViewProduct: null },
      } as any,
    });

    render(
      <Provider store={store}>
        <CartModal
          isOpen
          onClose={() => {}}
          cartItems={[mockCartItem]}
          onRemoveItem={() => {}}
          onClearCart={() => {}}
        />
      </Provider>
    );

    const proceedBtn = screen.getByRole('button', { name: /Tiến hành thanh toán/ });
    fireEvent.click(proceedBtn);

    const gaBeginCheckout = gtagSpy.mock.calls.find(c => c[0] === 'event' && c[1] === 'begin_checkout');
    expect(gaBeginCheckout).toBeDefined();
    expect(gaBeginCheckout![2].currency).toBe('VND');
    expect(gaBeginCheckout![2].value).toBe(3500000);
    expect(gaBeginCheckout![2].items).toEqual([
      { item_id: '10', item_name: 'Vợt Yonex Astrox 88D Pro', price: 3500000, quantity: 1 },
    ]);

    const metaInitiateCheckout = fbqSpy.mock.calls.find(c => c[0] === 'track' && c[1] === 'InitiateCheckout');
    expect(metaInitiateCheckout).toBeDefined();
    expect(metaInitiateCheckout![2].content_ids).toEqual(['10']);
    expect(metaInitiateCheckout![2].content_type).toBe('product');
    expect(metaInitiateCheckout![2].value).toBe(3500000);
    expect(metaInitiateCheckout![2].currency).toBe('VND');
  });

  it('A successful sendOtp sends zalo_auth_start once; a failed sendOtp sends no zalo_auth event', async () => {
    setupSpiedTracking();
    sessionStorage.setItem('otp_cooldown_expiry_0987654321', (Date.now() - 1000).toString());

    vi.spyOn(sportApi, 'sendOtp').mockRejectedValueOnce(new Error('Send OTP Failed'));

    render(
      <OtpModal
        isOpen
        phoneNumber="0987654321"
        onClose={() => {}}
        onSuccess={() => {}}
        needsResend
      />
    );

    const resendBtn = screen.getByText('Gửi lại mã');
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(gtagSpy.mock.calls.filter(c => c[1] === 'zalo_auth_start')).toHaveLength(0);
      expect(fbqSpy.mock.calls.filter(c => c[1] === 'zalo_auth_start')).toHaveLength(0);
    });

    vi.spyOn(sportApi, 'sendOtp').mockResolvedValueOnce({ success: true } as any);
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(gtagSpy.mock.calls.filter(c => c[1] === 'zalo_auth_start')).toHaveLength(1);
      expect(fbqSpy.mock.calls.filter(c => c[1] === 'zalo_auth_start')).toHaveLength(1);
    });
  });

  it('A successful verifyOtp sends zalo_auth_done once; a failed verifyOtp sends no zalo_auth event', async () => {
    setupSpiedTracking();

    vi.spyOn(sportApi, 'verifyOtp').mockRejectedValueOnce(new Error('Invalid OTP'));

    render(
      <OtpModal
        isOpen
        phoneNumber="0987654321"
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );

    const input = screen.getByPlaceholderText('Nhập 6 số OTP');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));

    await waitFor(() => {
      expect(gtagSpy.mock.calls.filter(c => c[1] === 'zalo_auth_done')).toHaveLength(0);
      expect(fbqSpy.mock.calls.filter(c => c[1] === 'zalo_auth_done')).toHaveLength(0);
    });

    vi.spyOn(sportApi, 'verifyOtp').mockResolvedValueOnce({
      success: true,
      verification_token: 'valid-token',
    } as any);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận OTP' }));

    await waitFor(() => {
      expect(gtagSpy.mock.calls.filter(c => c[1] === 'zalo_auth_done')).toHaveLength(1);
      expect(fbqSpy.mock.calls.filter(c => c[1] === 'zalo_auth_done')).toHaveLength(1);
    });
  });

  it('purchase sends GA4 purchase with transaction_id equal to order_number, value, currency VND and items', () => {
    setupSpiedTracking();

    tracking.purchase({
      order_number: 'DH-TEST-999',
      value: 1200000,
      items: [
        {
          productId: 'prod-1',
          name: 'Vợt Lining',
          price: 1200000,
          quantity: 1,
        },
      ],
    });

    const gaPurchase = gtagSpy.mock.calls.find(c => c[0] === 'event' && c[1] === 'purchase');
    expect(gaPurchase).toBeDefined();
    expect(gaPurchase![2]).toEqual({
      transaction_id: 'DH-TEST-999',
      value: 1200000,
      currency: 'VND',
      items: [
        {
          item_id: 'prod-1',
          item_name: 'Vợt Lining',
          price: 1200000,
          quantity: 1,
        },
      ],
    });
  });

  it('purchase sends Meta Purchase with value, currency VND, content_ids, and eventID equal to order_number', () => {
    setupSpiedTracking();

    tracking.purchase({
      order_number: 'DH-TEST-999',
      value: 1200000,
      items: [
        {
          productId: 'prod-1',
          name: 'Vợt Lining',
          price: 1200000,
          quantity: 1,
        },
      ],
    });

    const metaPurchase = fbqSpy.mock.calls.find(c => c[0] === 'track' && c[1] === 'Purchase');
    expect(metaPurchase).toBeDefined();
    expect(metaPurchase![2].value).toBe(1200000);
    expect(metaPurchase![2].currency).toBe('VND');
    expect(metaPurchase![2].content_ids).toEqual(['prod-1']);
    expect(metaPurchase![2].content_type).toBe('product');
    expect(metaPurchase![3]).toEqual({ eventID: 'DH-TEST-999' });
  });

  it('Calling purchase twice for one order_number sends one GA4 purchase and one Meta Purchase', () => {
    setupSpiedTracking();

    const orderData = {
      order_number: 'DH-DUP-01',
      value: 500000,
      items: [{ productId: 'p1', name: 'Áo', price: 500000, quantity: 1 }],
    };

    tracking.purchase(orderData);
    tracking.purchase(orderData); // duplicate call

    expect(gtagSpy.mock.calls.filter(c => c[0] === 'event' && c[1] === 'purchase')).toHaveLength(1);
    expect(fbqSpy.mock.calls.filter(c => c[0] === 'track' && c[1] === 'Purchase')).toHaveLength(1);
  });

  it('A reload followed by purchase for the same order_number sends nothing', () => {
    setupSpiedTracking();

    const orderData = {
      order_number: 'DH-RELOAD-02',
      value: 800000,
      items: [{ productId: 'p2', name: 'Giày', price: 800000, quantity: 1 }],
    };

    tracking.purchase(orderData);
    expect(gtagSpy.mock.calls.filter(c => c[1] === 'purchase')).toHaveLength(1);

    // Simulate page reload: re-init tracking, clear spies
    gtagSpy.mockClear();
    fbqSpy.mockClear();
    tracking._resetTrackingForTesting();
    setupSpiedTracking();

    // Call purchase again for the same order_number
    tracking.purchase(orderData);

    // Guard in localStorage prevents re-sending
    expect(gtagSpy.mock.calls.filter(c => c[1] === 'purchase')).toHaveLength(0);
    expect(fbqSpy.mock.calls.filter(c => c[1] === 'Purchase')).toHaveLength(0);
  });

  it('PRIVACY: no phone, name, address or email in any GA4 or Meta payload', () => {
    setupSpiedTracking();

    const piiStrings = ['0912345678', '0987654321', 'Nguyễn Văn A', 'Số 10 Tràng Tiền', 'customer@example.com'];

    // Fire all tracking functions
    tracking.pageView('/checkout');
    tracking.viewItem({ id: 'prod-1', name: 'Vợt Cầu Lông', price: 1000000 });
    tracking.addToCart({ id: 'prod-1', name: 'Vợt Cầu Lông', price: 1000000, quantity: 1 });
    tracking.beginCheckout({ items: [{ id: 'prod-1', name: 'Vợt Cầu Lông', price: 1000000, quantity: 1 }], value: 1000000 });
    tracking.zaloAuthStart();
    tracking.zaloAuthDone();
    tracking.purchase({
      order_number: 'DH-PRIVACY-01',
      value: 1000000,
      items: [{ productId: 'prod-1', name: 'Vợt Cầu Lông', price: 1000000, quantity: 1 }],
    });

    const allGtagArgs = gtagSpy.mock.calls.map(c => JSON.stringify(c));
    const allFbqArgs = fbqSpy.mock.calls.map(c => JSON.stringify(c));
    const allSerialized = [...allGtagArgs, ...allFbqArgs].join(' ');

    for (const pii of piiStrings) {
      expect(allSerialized).not.toContain(pii);
    }

    // Verify key names do not include phone, name, customer, address, email
    for (const serialized of [...allGtagArgs, ...allFbqArgs]) {
      const parsed = JSON.parse(serialized);
      const walkKeys = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
          expect(['phone', 'customer', 'customer_name', 'address', 'shipping_address', 'email']).not.toContain(k.toLowerCase());
          walkKeys(obj[k]);
        }
      };
      parsed.forEach((arg: any) => walkKeys(arg));
    }
  });
});
