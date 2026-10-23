// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import appDataReducer, { fetchAppData } from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import ProductCard from '../components/ProductCard';
import QuickViewModal from '../components/QuickViewModal';
import MobilePurchaseBar from '../components/product-detail/MobilePurchaseBar';
import { sportApi } from '../services/sportApi';
import { store as appStore } from '../app/store';
import App from '../App';
import { Product } from '../types';

// STOR-015: lỗi tải tồn kho WMS -> tồn không rõ (undefined), báo rõ, chặn mua.
const PIM_PRODUCT = {
  id: 1,
  name: 'Vợt test',
  variants: [
    { id: 11, sku_code: 'SKU-1', price: 100000 },
    { id: 12, sku_code: 'SKU-2', price: 100000 }
  ]
};

let urls: string[] = [];

function stubFetch(stock: 'ok' | 'fail' | 'chunkfail') {
  urls = [];
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    urls.push(url);
    if (url.includes('/public/stock')) {
      if (stock === 'fail' || (stock === 'chunkfail' && url.includes('sku_codes'))) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ stock: { 'SKU-1': 7 } }) };
    }
    if (url.includes('/public/voma-categories')) return { ok: true, status: 200, json: async () => [] };
    if (url.includes('/public/products/')) return { ok: true, status: 200, json: async () => PIM_PRODUCT };
    if (url.includes('/public/products')) {
      return { ok: true, status: 200, json: async () => ({ items: [PIM_PRODUCT], total: 1, page: 1, limit: 100, pages: 1 }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as any;
}

async function runAppData() {
  const store = configureStore({ reducer: { appData: appDataReducer } });
  await store.dispatch(fetchAppData());
  return store.getState().appData;
}

describe('STOR-015 tải tồn kho (service + appData)', () => {
  let err: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    err = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('WMS 500: fetchAllWmsStock ném lỗi thay vì trả null', async () => {
    stubFetch('fail');
    await expect(sportApi.getAllStock()).rejects.toThrow();
  });

  it('WMS 500: fetchAllWmsStock gọi console.error nêu URL kèm status', async () => {
    stubFetch('fail');
    await sportApi.getAllStock().catch(() => {});
    const msg = err.mock.calls.flat().join(' ');
    expect(msg).toContain('/public/stock');
    expect(msg).toContain('500');
  });

  it('WMS 500 đặt stockError', async () => {
    stubFetch('fail');
    expect((await runAppData()).stockError).toBe(true);
  });

  it('WMS 500: productsError vẫn false', async () => {
    stubFetch('fail');
    expect((await runAppData()).productsError).toBe(false);
  });

  it('WMS 500: products vẫn đủ sản phẩm PIM', async () => {
    stubFetch('fail');
    expect((await runAppData()).products).toHaveLength(1);
  });

  it('WMS 500: biến thể stock undefined', async () => {
    stubFetch('fail');
    const s = await runAppData();
    for (const v of s.products[0].variants ?? []) expect(v.stock).toBeUndefined();
    expect(s.products[0].variants).toHaveLength(2);
  });

  it('WMS 500: Product.stock undefined', async () => {
    stubFetch('fail');
    expect((await runAppData()).products[0].stock).toBeUndefined();
  });

  it('WMS 500: gọi /public/stock đúng 1 lần', async () => {
    stubFetch('fail');
    await runAppData();
    expect(urls.filter((u) => u.includes('/public/stock'))).toHaveLength(1);
  });

  it('WMS 200: SKU vắng nhận 0, SKU có nhận đúng số tồn, stockError false', async () => {
    stubFetch('ok');
    const s = await runAppData();
    expect(s.stockError).toBe(false);
    expect(s.products[0].variants?.map((v) => v.stock)).toEqual([7, 0]);
    expect(s.products[0].stock).toBe(7);
  });

  it('getProductById lô WMS 500: stock undefined, không gọi /public/products?page=', async () => {
    stubFetch('chunkfail');
    const product = await sportApi.getProductById('1');
    expect(product).not.toBeNull();
    expect(product!.stock).toBeUndefined();
    expect(product!.variants?.every((v) => v.stock === undefined)).toBe(true);
    expect(urls.some((u) => u.includes('/public/products?page='))).toBe(false);
    expect(err.mock.calls.flat().join(' ')).toContain('500');
  });
});

describe('STOR-015 banner tồn kho', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('WMS 500: banner tồn kho hiện dòng Không tải được tồn kho.', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch('fail');
    render(<Provider store={appStore}><MemoryRouter><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(document.getElementById('load-error-banner')).not.toBeNull());
    expect(document.getElementById('load-error-banner')!.textContent).toContain('Không tải được tồn kho.');
  });

  it('WMS 200: banner không có dòng Không tải được tồn kho.', async () => {
    stubFetch('ok');
    render(<Provider store={appStore}><MemoryRouter><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(urls.some((u) => u.includes('/public/stock'))).toBe(true));
    await waitFor(() => expect(appStore.getState().appData.isLoading).toBe(false));
    expect(document.getElementById('load-error-banner')).toBeNull();
  });
});

const base: Product = {
  id: 'p1',
  slug: 'vot-test',
  name: 'Vợt test',
  brand: 'Yonex',
  category: 'Vợt',
  price: 100000,
  image: 'https://example.com/x.jpg',
  specs: {},
  description: '',
  stock: undefined,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: 'SKU-1', price: 100000, stock: undefined }]
} as Product;

const withStock = (n: number): Product => ({ ...base, stock: n, variants: [{ ...base.variants![0], stock: n }] });

function card(product: Product) {
  render(
    <MemoryRouter>
      <ProductCard product={product} onQuickView={vi.fn()} onAddToCart={vi.fn()} />
    </MemoryRouter>
  );
}

function detail(product: Product) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer },
    preloadedState: {
      appData: { products: [product], branches: [], stringOptions: [], stringOptionsError: false, categories: [], isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null }
    } as any
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/product/${product.slug}`]}>
        <Routes>
          <Route path="/product/:slug" element={<ProductDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('STOR-015 UI khi tồn không rõ', () => {
  afterEach(cleanup);

  it('Tồn undefined: ProductCard không hiện chữ Hết hàng', () => {
    card(base);
    expect(screen.queryByText('Hết hàng')).toBeNull();
  });

  it('Tồn undefined: nút thêm nhanh của ProductCard bị disabled', () => {
    card(base);
    const btn = screen.getByTitle('Chưa rõ tồn kho') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Tồn 0 đã biết: ProductCard vẫn hiện chữ Hết hàng', () => {
    card(withStock(0));
    expect(screen.getByText('Hết hàng')).toBeTruthy();
  });

  it('Tồn undefined: QuickViewModal không hiện chữ Tạm hết hàng', () => {
    render(
      <MemoryRouter>
        <QuickViewModal product={base} onClose={vi.fn()} onAddToCart={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText('Tạm hết hàng')).toBeNull();
    expect(screen.queryByText('Hết hàng')).toBeNull();
    expect((screen.getByRole('button', { name: 'Chưa rõ tồn kho' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Tồn undefined: trang chi tiết không hiện Sản phẩm này tạm hết hàng', () => {
    detail(base);
    expect(screen.queryByText('Sản phẩm này tạm hết hàng')).toBeNull();
    expect(screen.queryByText('Hết hàng')).toBeNull();
  });

  it('Tồn undefined: nút thêm giỏ trang chi tiết hiện Chưa rõ tồn kho và bị disabled', () => {
    detail(base);
    const buttons = screen.getAllByRole('button', { name: 'Chưa rõ tồn kho' }) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeNull();
  });

  it('Tồn 5 đã biết: nút thêm giỏ trang chi tiết bật', () => {
    detail(withStock(5));
    expect((screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Tồn undefined: nút Mua ngay của MobilePurchaseBar bị disabled', () => {
    render(<MobilePurchaseBar productName="x" productImage="" totalDisplayPrice={1} hasPrice stockUnknown onBuyNow={vi.fn()} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Mua ngay')).toBeNull();
  });
});
