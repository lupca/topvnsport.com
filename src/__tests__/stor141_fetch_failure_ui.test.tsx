// @vitest-environment jsdom
// STOR-141: lỗi tải không thành 404 giả / Hết hàng giả; Thử lại riêng cho tồn kho.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import appDataReducer, { AppDataState, refetchStock } from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import ProductDetailRoute from '../features/product/ProductDetailRoute';
import HomePage from '../features/home/HomePage';
import ProductCard from '../components/ProductCard';
import QuickViewModal from '../components/QuickViewModal';
import { sportApi } from '../services/sportApi';
import App from '../App';
import { Product } from '../types';

window.scrollTo = vi.fn() as any; // ScrollToTop trong App; jsdom không có scrollTo

const appData = (over: Partial<AppDataState> = {}): AppDataState => ({
  products: [], branches: [], stringOptions: [], categories: [], isLoading: false,
  categoriesError: false, productsError: false, stringOptionsError: false, stockError: false,
  loadInFlight: false, stockRefetching: false, ...over
});

const makeStore = (over: Partial<AppDataState> = {}) =>
  configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: { appData: appData(over) } as any
  });

const prod = (id: string, stock: number | undefined, extra: Partial<Product> = {}): Product => ({
  id, slug: `sp-${id}`, name: `SP ${id}`, brand: 'Yonex', category: 'Vợt', categoryCode: 'c1', price: 100000,
  image: 'https://example.com/x.jpg', specs: {}, description: '', stock,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: `SKU-${id}`, price: 100000, stock }], ...extra
} as Product);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function pdp(store: ReturnType<typeof makeStore>, slug: string) {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/product/${slug}`]}>
        <Routes><Route path="/product/:slug" element={<ProductDetailRoute />} /></Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('STOR-141 trang chi tiết khi catalog lỗi', () => {
  it('productsError + không khớp: role=alert có Thử lại, không Không tìm thấy trang', () => {
    pdp(makeStore({ productsError: true }), '590');
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(screen.queryByText('Không tìm thấy trang')).toBeNull();
    expect(document.getElementById('not-found')).toBeNull();
  });

  it('Thử lại dispatch fetchAppData', () => {
    const store = makeStore({ productsError: true });
    const spy = vi.spyOn(store, 'dispatch');
    vi.spyOn(sportApi, 'getProducts').mockReturnValue(new Promise(() => {}));
    vi.spyOn(sportApi, 'getCategories').mockReturnValue(new Promise(() => {}));
    vi.spyOn(sportApi, 'getAllStock').mockReturnValue(new Promise(() => {}));
    pdp(store, '590');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(spy).toHaveBeenCalled();
    expect(store.getState().appData.loadInFlight).toBe(true);
    expect(sportApi.getProducts).toHaveBeenCalledTimes(1);
  });

  it('catalog tải thành công, không khớp: vẫn Không tìm thấy trang', () => {
    pdp(makeStore({ products: [prod('1', 3)] }), 'khong-co');
    expect(screen.getByText('Không tìm thấy trang')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});

describe('STOR-141 refetchStock', () => {
  const products = [prod('1', undefined), prod('2', undefined)];

  it('fulfilled: áp tồn lên products, stockError=false, không đụng isLoading', async () => {
    const store = makeStore({ products, stockError: true });
    vi.spyOn(sportApi, 'getAllStock').mockResolvedValue({ 'SKU-1': 4 });
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.getState().appData.isLoading));
    await store.dispatch(refetchStock());
    const s = store.getState().appData;
    expect(s.products.map(p => p.stock)).toEqual([4, 0]);
    expect(s.stockError).toBe(false);
    expect(seen.every(v => v === false)).toBe(true);
  });

  it('rejected: stockError giữ true, products không đổi, không đụng isLoading', async () => {
    const store = makeStore({ products, stockError: true });
    vi.spyOn(sportApi, 'getAllStock').mockRejectedValue(new Error('503'));
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.getState().appData.isLoading));
    await store.dispatch(refetchStock());
    const s = store.getState().appData;
    expect(s.stockError).toBe(true);
    expect(s.products).toBe(products);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(v => v === false)).toBe(true);
  });

  it('single-flight: lần 2 khi đang chờ không gọi thêm GET; không tải lại sản phẩm/danh mục', async () => {
    const store = makeStore({ products, stockError: true });
    let resolve!: (v: Record<string, number>) => void;
    const get = vi.spyOn(sportApi, 'getAllStock').mockReturnValue(new Promise(r => { resolve = r; }));
    const getProducts = vi.spyOn(sportApi, 'getProducts');
    const getCategories = vi.spyOn(sportApi, 'getCategories');
    const first = store.dispatch(refetchStock());
    store.dispatch(refetchStock());
    expect(get).toHaveBeenCalledTimes(1);
    resolve({});
    await first;
    expect(getProducts).not.toHaveBeenCalled();
    expect(getCategories).not.toHaveBeenCalled();
  });
});

describe('STOR-141 banner: Thử lại tồn kho', () => {
  it('stock lỗi -> dòng tồn kho có Thử lại; bấm chỉ tải lại tồn, dòng mất sau 200', async () => {
    const store = makeStore({ isLoading: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(sportApi, 'getCategories').mockResolvedValue([]);
    vi.spyOn(sportApi, 'getBranches').mockResolvedValue([]);
    vi.spyOn(sportApi, 'getStringOptions').mockResolvedValue([]);
    const getProducts = vi.spyOn(sportApi, 'getProducts').mockResolvedValue([prod('1', undefined)]);
    const getStock = vi.spyOn(sportApi, 'getAllStock').mockRejectedValueOnce(new Error('503'));
    render(<Provider store={store}><MemoryRouter initialEntries={['/catalog']}><App /></MemoryRouter></Provider>);
    const banner = await waitFor(() => {
      const el = document.getElementById('load-error-banner');
      expect(el).not.toBeNull();
      return el!;
    });
    const line = within(banner).getByText(/Không tải được tồn kho\./);
    const retry = within(line).getByRole('button', { name: 'Thử lại' });

    getStock.mockResolvedValueOnce({ 'SKU-1': 2 });
    fireEvent.click(retry);
    expect(document.getElementById('api-loading-state')).toBeNull();
    await waitFor(() => expect(store.getState().appData.stockError).toBe(false));
    expect(screen.queryByText(/Không tải được tồn kho\./)).toBeNull();
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getStock).toHaveBeenCalledTimes(2);
    expect(store.getState().appData.products[0].stock).toBe(2);
  });
});

function home(over: Partial<AppDataState>) {
  render(
    <Provider store={makeStore(over)}>
      <MemoryRouter initialEntries={['/']}><HomePage /></MemoryRouter>
    </Provider>
  );
}

describe('STOR-141 kệ Tất cả khi tồn lỗi', () => {
  const categories = [{ id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Thể Thao > Vợt' }] as any;
  const grid = () => within(screen.getByTestId('featured-grid'));

  it('stockError: kệ không lọc theo tồn, có câu role=status phía trên lưới', () => {
    home({ products: [prod('1', undefined), prod('2', undefined)], categories, stockError: true });
    expect(grid().getByText('SP 1')).toBeTruthy();
    expect(grid().getByText('SP 2')).toBeTruthy();
    const msg = screen.getByText('Chưa tải được tình trạng hàng.');
    expect(msg.getAttribute('role')).toBe('status');
    const shelfGrid = screen.getByTestId('featured-grid');
    expect(msg.compareDocumentPosition(shelfGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Không có sản phẩm còn hàng phù hợp bộ lọc.')).toBeNull();
    expect(screen.queryByText('Hết hàng')).toBeNull();
  });

  it('không stockError: kệ Tất cả chỉ giữ stock > 0, không có câu tồn lỗi', () => {
    home({ products: [prod('1', 3), prod('2', 0)], categories });
    expect(grid().getByText('SP 1')).toBeTruthy();
    expect(grid().queryByText('SP 2')).toBeNull();
    expect(screen.queryByText('Chưa tải được tình trạng hàng.')).toBeNull();
  });
});

describe('STOR-141 tồn không rõ khác tồn 0', () => {
  const card = (p: Product) => render(<MemoryRouter><ProductCard product={p} onQuickView={vi.fn()} onAddToCart={vi.fn()} /></MemoryRouter>);
  const quick = (p: Product) => render(<MemoryRouter><QuickViewModal product={p} onClose={vi.fn()} onAddToCart={vi.fn()} /></MemoryRouter>);
  const page = (p: Product) => pdp(makeStore({ products: [p], stockError: p.stock === undefined }), p.slug!);
  const views: [string, (p: Product) => void][] = [['ProductCard', card], ['QuickViewModal', quick], ['trang chi tiết', page]];

  for (const [name, view] of views) {
    it(`${name}: tồn không rõ -> không Hết hàng, không Còn hàng`, () => {
      view(prod('1', undefined));
      expect(screen.queryByText(/Hết hàng/)).toBeNull();
      expect(screen.queryByText(/Còn hàng/)).toBeNull();
    });

    it(`${name}: tồn 0 đã biết -> vẫn Hết hàng`, () => {
      view(prod('1', 0));
      expect(screen.getAllByText('Hết hàng').length).toBeGreaterThan(0);
    });
  }
});

