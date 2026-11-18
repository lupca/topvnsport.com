// @vitest-environment jsdom
// Home/catalog HTML inlines the catalog WITHOUT the long product descriptions (152 KB of 761 KB, the worst compressing
// part); fetchAppData brings them. The types keep "description not loaded yet" (SummaryProduct) apart from "no
// description" (FullProduct without the field); every reader of the description is covered below.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { renderCatalog, renderHome } from '../../api/page';
import { renderProductPage } from '../../api/product';
import appDataReducer, { AppDataState, buildInitialState, fetchAppData, refetchStock } from '../features/appData/appDataSlice';
import cartReducer, { setQuickViewProduct } from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { saveCatalog } from '../features/appData/catalogCache';
import { catalogHead } from '../utils/productHead';
import { sportApi } from '../services/sportApi';
import App from '../App';
import type { Category, FullProduct } from '../types';

window.scrollTo = vi.fn() as any;

const SHELL = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const CATS = [{ id: 1, code: 'VC1', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Cầu Lông > Vợt Cầu Lông' }] as Category[];
const DESC = 'Cảm giác đánh thực tế cực kỳ nhẹ đầu nên rất hợp lối chơi phòng thủ phản tạt linh hoạt';
const base = (id: string, over: Partial<FullProduct> = {}): FullProduct => ({
  id, slug: `sp-${id}`, name: `Vợt ${id}`, brand: 'Yonex', category: 'Vợt Cầu Lông', categoryCode: 'VC1', price: 100000,
  image: 'https://example.com/x.jpg', gallery: ['https://example.com/x.jpg'], media: [{ imageUrl: 'https://example.com/x.jpg' }],
  specs: {}, stock: 5, defaultSku: `SKU-${id}`, features: ['Nhẹ'],
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: `SKU-${id}`, price: 100000, stock: 5 }], tier_variations: [], ...over
} as FullProduct);
const WITH_DESC = base('590', { description: DESC });
const NO_DESC = base('591'); // the product has none: the key is absent, as the mapper leaves it
const FULL: FullProduct[] = [WITH_DESC, NO_DESC];
const summary = (p: FullProduct) => { const { description: _d, ...rest } = p; return rest; };

const inlined = (html: string) => {
  const win: any = {};
  new Function('window', html.match(/<script>(window\.__CATALOG__=[\s\S]*?)<\/script>/)![1])(win);
  return win.__CATALOG__;
};

describe('payload: no description inlined, everything else kept', () => {
  it('home and catalog: no `description` key on any product, every other field equal to the full product', () => {
    const head = catalogHead('VC1', CATS, FULL)!;
    for (const html of [renderHome(SHELL, CATS, FULL), renderCatalog(SHELL, head, 'VC1', CATS, FULL)]) {
      const payload = inlined(html);
      expect(payload.categories).toEqual(CATS);
      expect(payload.products).toEqual(FULL.map(summary));
      expect(payload.products.some((p: object) => 'description' in p)).toBe(false);
      expect(html).not.toContain(DESC);
    }
  });

  it('the rendered page (#ssr text, head tags, JSON-LD) does not depend on the descriptions at all', () => {
    const stripped = FULL.map(summary) as FullProduct[];
    expect(renderHome(SHELL, CATS, FULL)).toBe(renderHome(SHELL, CATS, stripped));
    const head = catalogHead('VC1', CATS, FULL)!;
    expect(renderCatalog(SHELL, head, 'VC1', CATS, FULL)).toBe(renderCatalog(SHELL, head, 'VC1', CATS, stripped));
  });

  it('a product page still inlines the full product, description included', () => {
    const html = renderProductPage(SHELL, WITH_DESC, 'https://www.topvnsport.com/product/590');
    const product = JSON.parse(html.match(/<script>window\.__PRODUCT__=(.*?)<\/script>/)![1]);
    expect(product).toEqual(WITH_DESC);
    expect(product.description).toBe(DESC);
  });
});

describe('store start and persistence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { delete (window as any).__CATALOG__; localStorage.clear(); });
  const inline = (products: object[]) => { (window as any).__CATALOG__ = { categories: CATS, products }; };

  it('inlined products start as summaries (descriptionPending, no description); nothing is written to localStorage', () => {
    inline(FULL.map(summary));
    const s = buildInitialState(undefined);
    expect(s.products.every(p => p.descriptionPending === true && !('description' in p))).toBe(true);
    expect(s.isLoading).toBe(false);
    expect(s.catalogFromCache).toBe(true);
    expect(localStorage.getItem('tvs.catalog.v2')).toBeNull();
  });

  it('returning visitor: fresh inlined prices/stock win, the cached full catalog supplies the descriptions it has', () => {
    saveCatalog({ products: [{ ...WITH_DESC, price: 1, stock: 1 }, { ...NO_DESC, price: 1 }], branches: [], stringOptions: [], categories: [] });
    inline([...FULL, base('592', { description: 'chỉ có trên máy chủ' })].map(summary).map(p => ({ ...p, price: 200000, stock: 9 })));
    const s = buildInitialState(undefined);
    const [a, b, c] = s.products as FullProduct[];
    expect([a.price, a.stock, a.descriptionPending, a.description]).toEqual([200000, 9, undefined, DESC]);
    expect([b.price, b.descriptionPending, 'description' in b]).toEqual([200000, undefined, false]); // cached "no description" stays "none"
    expect([c.price, c.descriptionPending]).toEqual([200000, true]); // not in the cache: still waiting for the refresh
  });

  const mockApi = (products: Promise<FullProduct[]>) => {
    vi.spyOn(sportApi, 'getCategories').mockResolvedValue(CATS);
    vi.spyOn(sportApi, 'getBranches').mockResolvedValue([]);
    vi.spyOn(sportApi, 'getStringOptions').mockResolvedValue([]);
    vi.spyOn(sportApi, 'getAllStock').mockResolvedValue({});
    vi.spyOn(sportApi, 'getProducts').mockReturnValue(products);
  };
  const storeFrom = (state: AppDataState) => configureStore({ reducer: { appData: appDataReducer }, preloadedState: { appData: state } as any });

  it('after the refresh: store holds the full products (no marker), localStorage holds the same, never a summary', async () => {
    inline(FULL.map(summary));
    mockApi(Promise.resolve(FULL));
    const store = storeFrom(buildInitialState(undefined));
    await store.dispatch(fetchAppData() as any);
    const products = store.getState().appData.products;
    expect(JSON.parse(JSON.stringify(products))).toEqual(JSON.parse(JSON.stringify(FULL)));
    const saved = JSON.parse(localStorage.getItem('tvs.catalog.v2')!).data.products;
    expect(saved).toEqual(JSON.parse(JSON.stringify(FULL)));
    expect(JSON.stringify(saved)).not.toContain('descriptionPending');
  });

  it('failed refresh: summaries stay in the store, error flag set, localStorage is not written with them', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    inline(FULL.map(summary));
    mockApi(Promise.reject(new Error('500')));
    const store = storeFrom(buildInitialState(undefined));
    await store.dispatch(fetchAppData() as any);
    const s = store.getState().appData;
    expect(s.productsError).toBe(true);
    expect(s.products.every(p => p.descriptionPending === true)).toBe(true);
    expect(localStorage.getItem('tvs.catalog.v2')).toBeNull();
  });

  it('a stock refetch while descriptions are pending keeps them pending (and refreshes the stock)', async () => {
    inline(FULL.map(summary));
    mockApi(new Promise(() => {}));
    vi.spyOn(sportApi, 'getAllStock').mockResolvedValue({ 'SKU-590': 2, 'SKU-591': 3 });
    const store = storeFrom(buildInitialState(undefined));
    await store.dispatch(refetchStock() as any);
    const s = store.getState().appData;
    expect(s.products.map(p => [p.stock, p.descriptionPending])).toEqual([[2, true], [3, true]]);
    expect(localStorage.getItem('tvs.catalog.v2')).toBeNull();
  });
});

// Readers, through the real App: the catalog starts as summaries and the refresh is held until `release()`.
describe('readers while the description is not loaded yet', () => {
  let release: (products?: FullProduct[]) => void;
  let fail: () => void;
  const start = (route: string, opts: { hold?: boolean } = {}) => {
    const gate = new Promise<FullProduct[]>((resolve, reject) => { release = (p = FULL) => resolve(p); fail = () => reject(new Error('500')); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(sportApi, 'getCategories').mockResolvedValue(CATS);
    vi.spyOn(sportApi, 'getBranches').mockResolvedValue([]);
    vi.spyOn(sportApi, 'getStringOptions').mockResolvedValue([]);
    vi.spyOn(sportApi, 'getAllStock').mockResolvedValue({});
    vi.spyOn(sportApi, 'getProducts').mockReturnValue(gate);
    (window as any).__CATALOG__ = { categories: CATS, products: FULL.map(summary) };
    const initial = buildInitialState(undefined);
    delete (window as any).__CATALOG__;
    const store = configureStore({
      reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
      preloadedState: { appData: initial } as any
    });
    render(<Provider store={store}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></Provider>);
    void opts;
    return store;
  };
  beforeEach(() => {
    document.head.querySelectorAll('meta[name="description"], script[type="application/ld+json"]').forEach(e => e.remove());
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('product page: the existing skeleton until the description lands, then the description; no head/JSON-LD without it', async () => {
    start('/product/590');
    expect(document.getElementById('page-skeleton')).not.toBeNull();
    expect(screen.queryByText(DESC)).toBeNull();
    expect(screen.queryByTestId('pdp-tabs')).toBeNull();
    expect(screen.queryByText('Không tìm thấy trang')).toBeNull();
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    release();
    await screen.findByText(DESC);
    expect(document.getElementById('page-skeleton')).toBeNull();
    expect(document.head.querySelector('meta[name="description"]')!.getAttribute('content')).toContain('Cảm giác đánh thực tế');
    expect(JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!).description).toBe(DESC);
  });

  it('product page: a product with no description is shown (after the refresh) without a description block', async () => {
    start('/product/591');
    expect(document.getElementById('page-skeleton')).not.toBeNull();
    release();
    await screen.findByTestId('pdp-tabs');
    expect(screen.queryByText('Cảm giác đánh thực tế & Phân tích chuyên sâu:')).toBeNull();
  });

  it('product page, refresh failed: the existing load-failure state with Thử lại, never the page without its description', async () => {
    const store = start('/product/590');
    fail();
    const alert = (await screen.findByText(/Cửa hàng chưa tải được sản phẩm/)).closest('[role="alert"]') as HTMLElement;
    expect(within(alert).getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(store.getState().appData.productsError).toBe(true);
    expect(screen.queryByTestId('pdp-tabs')).toBeNull();
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('quick view: closed while the product is a summary, opens with the description once it lands', async () => {
    const store = start('/catalog');
    store.dispatch(setQuickViewProduct(store.getState().appData.products[0]));
    expect(document.getElementById('quick-view-overlay')).toBeNull();
    release();
    const overlay = await waitFor(() => { const el = document.getElementById('quick-view-overlay'); expect(el).not.toBeNull(); return el!; });
    expect(within(overlay).getByText(DESC)).toBeTruthy();
  });

  it('quick view, refresh failed: stays closed, the existing banner reports the failure', async () => {
    const store = start('/catalog');
    store.dispatch(setQuickViewProduct(store.getState().appData.products[0]));
    fail();
    await waitFor(() => expect(document.getElementById('load-error-banner')?.textContent).toContain('Không tải được danh sách sản phẩm'));
    expect(document.getElementById('quick-view-overlay')).toBeNull();
  });

  it('header search: a word only in a description gives no (partial) results while loading, the full result once loaded', async () => {
    start('/catalog');
    const input = screen.getAllByPlaceholderText(/Tìm vợt Yonex/)[0];
    fireEvent.change(input, { target: { value: 'phản tạt' } });
    expect(screen.queryByText('Kết quả tìm kiếm phù hợp')).toBeNull();
    expect(screen.queryByText(/Không tìm thấy sản phẩm nào khớp/)).toBeNull();
    release();
    const dropdown = (await screen.findByText('Kết quả tìm kiếm phù hợp')).parentElement!;
    // the same answer main gives: only the product whose description holds the words
    expect(within(dropdown).getByText('Vợt 590')).toBeTruthy();
    expect(within(dropdown).queryByText('Vợt 591')).toBeNull();
  });
});
