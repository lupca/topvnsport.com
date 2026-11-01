// @vitest-environment jsdom
// STOR-053: trang chủ tách "lỗi tải sản phẩm VOMA" khỏi "cửa hàng chưa có sản phẩm".
// sportApi THẬT + fetch giả theo URL (/api/pmi/public/products, voma-categories, /api/wms/public/stock).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { sportApi } from '../services/sportApi';
import App from '../App';

const ERR = 'Cửa hàng chưa tải được sản phẩm lúc này. Vui lòng thử lại sau.';
const EMPTY = 'Cửa hàng chưa có sản phẩm nào đang bán.';
const BANNER_PROD = 'Không tải được danh sách sản phẩm. Vui lòng tải lại trang.';
const BANNER_CAT = 'Không tải được danh mục sản phẩm. Vui lòng tải lại trang.';
const BANNER_STOCK = 'Không tải được tồn kho. Vui lòng tải lại trang.';

const CATS = [
  { id: 10, code: 'VC000010', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' },
  { id: 11, code: 'VC000011', name: 'Giày Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Giày Cầu Lông' }
];
const ITEMS = [
  { id: 1, name: 'Vợt Yonex Astrox 77 Pro', voma_category_id: 10, variants: [{ id: 101, sku_code: 'SKU-A', price: 3250000 }] },
  { id: 2, name: 'Giày Yonex Power Cushion 65Z3', voma_category_id: 11, variants: [{ id: 201, sku_code: 'SKU-B', price: 2890000 }] }
];
const PRICES = ['3.250.000đ', '2.890.000đ'];

type Reply = { status: number; body?: unknown } | 'network';
const PRODUCTS_ITEMS: Reply = { status: 200, body: { items: ITEMS, total: 2, page: 1, limit: 100, pages: 1 } };
const PRODUCTS_EMPTY: Reply = { status: 200, body: { items: [], total: 0, page: 1, limit: 100, pages: 0 } };
const STOCK_OK: Reply = { status: 200, body: { stock: { 'SKU-A': 5, 'SKU-B': 3 } } };

// products: mỗi lần gọi lấy phần tử đầu, phần tử cuối dùng mãi (cho kịch bản Thử lại).
let products: Reply[];
let categories: Reply;
let stock: Reply;

const answer = (r: Reply) => {
  if (r === 'network') throw new TypeError('Failed to fetch');
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

beforeEach(() => {
  products = [PRODUCTS_ITEMS];
  categories = { status: 200, body: CATS };
  stock = STOCK_OK;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input);
    if (url.startsWith('/api/pmi/public/products')) return answer(products.length > 1 ? products.shift()! : products[0]);
    if (url === '/api/pmi/public/voma-categories') return answer(categories);
    if (url.startsWith('/api/wms/public/stock')) return answer(stock);
    throw new Error(`unexpected fetch ${url}`);
  }));
  vi.stubGlobal('scrollTo', vi.fn()); // ScrollToTop; jsdom không có window.scrollTo
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function renderApp(path: string) {
  const store = configureStore({ reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer } });
  render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>);
  return store;
}

describe('STOR-053 trang chủ: lỗi tải sản phẩm', () => {
  it.each<[string, Reply]>([
    ['500', { status: 500, body: { detail: 'boom' } }],
    ['401 (token bị từ chối)', { status: 401, body: { detail: 'unauthorized' } }],
    ['lỗi mạng', 'network']
  ])('products %s -> câu lỗi role=alert + nút Thử lại, không câu shop trống, không dòng banner sản phẩm/danh mục', async (_, reply) => {
    products = [reply];
    renderApp('/');
    const alert = (await screen.findByText(ERR)).closest('[role="alert"]') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(within(alert).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).toBeNull();
    expect(screen.queryByText(BANNER_PROD)).toBeNull();
    expect(screen.queryByText(BANNER_CAT)).toBeNull();
  });

  it('voma-categories 500 (kéo theo lỗi sản phẩm) trên / -> câu lỗi trang chủ, không dòng banner danh mục/sản phẩm', async () => {
    categories = { status: 500 };
    renderApp('/');
    await screen.findByText(ERR);
    expect(screen.queryByText(BANNER_CAT)).toBeNull();
    expect(screen.queryByText(BANNER_PROD)).toBeNull();
  });

  it('products 500 + tồn 500 trên / -> vẫn hiện dòng banner tồn kho, không dòng banner sản phẩm', async () => {
    products = [{ status: 500 }];
    stock = { status: 500 };
    renderApp('/');
    await screen.findByText(ERR);
    expect(screen.getByText(BANNER_STOCK)).toBeInTheDocument();
    expect(screen.queryByText(BANNER_PROD)).toBeNull();
  });

  it('products 500 trên /catalog -> banner App vẫn hiện dòng sản phẩm (ngoài trang chủ giữ nguyên)', async () => {
    products = [{ status: 500 }];
    renderApp('/catalog');
    expect(await screen.findByText(BANNER_PROD)).toBeInTheDocument();
    expect(screen.queryByText(ERR)).toBeNull();
  });

  it('Thử lại gọi lại sportApi.getProducts; lần 2 có hàng -> hiện sản phẩm, hết câu lỗi', async () => {
    const getProducts = vi.spyOn(sportApi, 'getProducts');
    products = [{ status: 500 }, PRODUCTS_ITEMS];
    renderApp('/');
    const alert = (await screen.findByText(ERR)).closest('[role="alert"]') as HTMLElement;
    expect(getProducts).toHaveBeenCalledTimes(1);
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect((await screen.findAllByText(ITEMS[0].name)).length).toBeGreaterThan(0);
    expect(getProducts).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(ERR)).toBeNull();
  });

  it('fetchAppData bị reject (thunk ném) -> productsError=true và trang chủ hiện câu lỗi, không câu shop trống', async () => {
    vi.spyOn(sportApi, 'getBranches').mockRejectedValue(new Error('branches'));
    const store = renderApp('/');
    await screen.findByText(ERR);
    expect(store.getState().appData.productsError).toBe(true);
    expect(screen.queryByText(EMPTY)).toBeNull();
  });
});

describe('STOR-053 trang chủ: 200 rỗng và 200 có hàng', () => {
  it('products 200 total 0 + categories [] -> câu shop trống role=status, không câu lỗi, không Thử lại, không banner', async () => {
    products = [PRODUCTS_EMPTY];
    categories = { status: 200, body: [] };
    renderApp('/');
    const status = await screen.findByText(EMPTY);
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText(ERR)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(document.getElementById('load-error-banner')).toBeNull();
  });

  it('products 200 có hàng (giá + tồn WMS > 0) -> tên, giá trong kệ còn hàng, pill danh mục; không câu lỗi/shop trống', async () => {
    renderApp('/');
    const shelf = await screen.findByTestId('instock-shelf');
    for (const p of ITEMS) expect(within(shelf).getByText(p.name)).toBeInTheDocument();
    for (const price of PRICES) expect(within(shelf).getByText(price)).toBeInTheDocument();
    expect(screen.getByTestId('cate-pill-VC000010')).toHaveTextContent('Vợt Cầu Lông');
    expect(screen.getByTestId('cate-pill-VC000011')).toHaveTextContent('Giày Cầu Lông');
    expect(screen.queryByText(ERR)).toBeNull();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });
});

describe('STOR-053 sportApi.getProducts thật', () => {
  it('200 total 0 -> []', async () => {
    products = [PRODUCTS_EMPTY];
    await expect(sportApi.getProducts()).resolves.toEqual([]);
  });

  it('401 -> reject (không trả [] sau lỗi)', async () => {
    products = [{ status: 401, body: { detail: 'unauthorized' } }];
    await expect(sportApi.getProducts()).rejects.toThrow('401');
  });
});
