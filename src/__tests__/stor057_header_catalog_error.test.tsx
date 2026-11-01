// @vitest-environment jsdom
// STOR-057: Header menu danh mục báo lỗi tải (desktop nav & mobile drawer), không để trống im lặng.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { sportApi } from '../services/sportApi';
import Header from '../components/Header';
import App from '../App';

const CATALOG_ERR = 'Chưa tải được danh mục sản phẩm.';

const CATS = [
  { id: 10, code: 'VC001491', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' },
  { id: 11, code: 'VC001427', name: 'Giày Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Giày Cầu Lông' },
  { id: 12, code: 'VC000012', name: 'Phụ Kiện Cầu Lông', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Phụ Kiện Cầu Lông' }
];

const ITEMS = [
  { id: 1, name: 'Vợt Yonex Astrox 77 Pro', voma_category_id: 10, variants: [{ id: 101, sku_code: 'SKU-A', price: 3250000 }] },
  { id: 2, name: 'Vợt Yonex Nanoflare 800 Pro', voma_category_id: 10, variants: [{ id: 102, sku_code: 'SKU-A2', price: 3450000 }] },
  { id: 3, name: 'Giày Yonex Power Cushion 65Z3', voma_category_id: 11, variants: [{ id: 201, sku_code: 'SKU-B', price: 2890000 }] }
];

type Reply = { status: number; body?: unknown } | 'network';
const PRODUCTS_ITEMS: Reply = { status: 200, body: { items: ITEMS, total: 3, page: 1, limit: 100, pages: 1 } };
const PRODUCTS_EMPTY: Reply = { status: 200, body: { items: [], total: 0, page: 1, limit: 100, pages: 0 } };
const STOCK_OK: Reply = { status: 200, body: { stock: { 'SKU-A': 5, 'SKU-A2': 2, 'SKU-B': 3 } } };

let products: Reply[];
let categories: Reply[];
let stock: Reply;

const answer = (r: Reply) => {
  if (r === 'network') throw new TypeError('Failed to fetch');
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

beforeEach(() => {
  products = [PRODUCTS_ITEMS];
  categories = [{ status: 200, body: CATS }];
  stock = STOCK_OK;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input);
    if (url.startsWith('/api/pmi/public/products')) return answer(products.length > 1 ? products.shift()! : products[0]);
    if (url === '/api/pmi/public/voma-categories') return answer(categories.length > 1 ? categories.shift()! : categories[0]);
    if (url.startsWith('/api/wms/public/stock')) return answer(stock);
    throw new Error(`unexpected fetch ${url}`);
  }));
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderApp(path = '/catalog') {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer }
  });
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
  return { store, ...view };
}

function getDesktopNav(container: HTMLElement): HTMLElement {
  const nav = container.querySelector('#topvnsport-header nav');
  expect(nav).not.toBeNull();
  return nav as HTMLElement;
}

function openMobileDrawer(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Open mobile menu' }));
  const drawer = document.getElementById('mobile-sidebar-drawer');
  expect(drawer).not.toBeNull();
  return drawer as HTMLElement;
}

describe('STOR-057 Header menu danh mục: trạng thái lỗi tải (500 / network)', () => {
  it('products 500 (categories 200) -> desktop nav và mobile drawer đều hiện câu lỗi + nút Thử lại', async () => {
    products = [{ status: 500, body: { detail: 'upstream error' } }];
    const { container } = renderApp('/catalog');

    const nav = await waitFor(() => getDesktopNav(container));
    expect(within(nav).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'VỢT CẦU LÔNG' })).toBeNull();

    const drawer = openMobileDrawer();
    expect(within(drawer).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Vợt Cầu Lông' })).toBeNull();
  });

  it('voma-categories 500 -> desktop nav và mobile drawer đều hiện câu lỗi + nút Thử lại', async () => {
    categories = [{ status: 500, body: { detail: 'categories failed' } }];
    const { container } = renderApp('/catalog');

    const nav = await waitFor(() => getDesktopNav(container));
    expect(within(nav).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();

    const drawer = openMobileDrawer();
    expect(within(drawer).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('Header nhận riêng categoriesError=true (productsError=false) hoặc productsError=true (categoriesError=false) đều hiện lỗi ở cả desktop nav và drawer', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <Header
          cartCount={0}
          openCart={() => {}}
          products={[]}
          categories={CATS}
          categoriesError={true}
          productsError={false}
        />
      </MemoryRouter>
    );

    const nav1 = getDesktopNav(container);
    expect(within(nav1).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(nav1).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();

    const drawer1 = openMobileDrawer();
    expect(within(drawer1).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(drawer1).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <Header
          cartCount={0}
          openCart={() => {}}
          products={[]}
          categories={CATS}
          categoriesError={false}
          productsError={true}
        />
      </MemoryRouter>
    );

    const nav2 = getDesktopNav(container);
    expect(within(nav2).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(nav2).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(within(drawer1).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(within(drawer1).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('bấm Thử lại trên desktop nav dispatch fetchAppData() và gọi sportApi.getProducts lần 2; khi có hàng thì hiện danh mục, ẩn lỗi', async () => {
    const getProductsSpy = vi.spyOn(sportApi, 'getProducts');
    products = [{ status: 500 }, PRODUCTS_ITEMS];
    const { container } = renderApp('/catalog');

    const nav = await waitFor(() => getDesktopNav(container));
    expect(within(nav).getByText(CATALOG_ERR)).toBeInTheDocument();
    expect(getProductsSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(within(nav).getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      const updatedNav = getDesktopNav(container);
      expect(within(updatedNav).getByRole('link', { name: 'VỢT CẦU LÔNG' })).toBeInTheDocument();
    });
    expect(getProductsSpy).toHaveBeenCalledTimes(2);
    const updatedNav = getDesktopNav(container);
    expect(within(updatedNav).queryByText(CATALOG_ERR)).toBeNull();
    expect(within(updatedNav).queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('bấm Thử lại trong mobile drawer dispatch fetchAppData() và gọi sportApi.getProducts lần 2', async () => {
    const getProductsSpy = vi.spyOn(sportApi, 'getProducts');
    products = [{ status: 500 }, PRODUCTS_ITEMS];
    const { container } = renderApp('/catalog');

    await waitFor(() => getDesktopNav(container));
    expect(getProductsSpy).toHaveBeenCalledTimes(1);

    const drawer = openMobileDrawer();
    const retryBtn = within(drawer).getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryBtn);

    await waitFor(() => expect(getProductsSpy).toHaveBeenCalledTimes(2));
    const updatedNav = getDesktopNav(container);
    await waitFor(() => {
      expect(within(updatedNav).getByRole('link', { name: 'VỢT CẦU LÔNG' })).toBeInTheDocument();
    });
  });
});

describe('STOR-057 Header menu danh mục: 200-empty và 200-with-items', () => {
  it('200-empty -> desktop nav và mobile drawer không có nút danh mục, không có câu lỗi, không có nút Thử lại', async () => {
    products = [PRODUCTS_EMPTY];
    const { container } = renderApp('/catalog');

    const nav = await waitFor(() => getDesktopNav(container));
    expect(within(nav).queryAllByRole('button')).toHaveLength(0);
    expect(within(nav).queryByText(CATALOG_ERR)).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Thử lại' })).toBeNull();

    const drawer = openMobileDrawer();
    expect(within(drawer).queryByText('Danh Mục Sản Phẩm')).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Vợt Cầu Lông' })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Giày Cầu Lông' })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Phụ Kiện Cầu Lông' })).toBeNull();
    expect(within(drawer).queryByText(CATALOG_ERR)).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('200-with-items -> desktop nav và mobile drawer chỉ hiện danh mục có sản phẩm > 0, không câu lỗi, không nút Thử lại', async () => {
    products = [PRODUCTS_ITEMS];
    const { container } = renderApp('/catalog');

    const nav = await waitFor(() => getDesktopNav(container));
    const navLinks = within(nav).getAllByRole('link').map(a => a.textContent);
    expect(navLinks).toEqual(['BADMINTON (TRANG CHỦ)', 'VỢT CẦU LÔNG', 'GIÀY CẦU LÔNG']);
    expect(within(nav).queryAllByRole('button')).toHaveLength(0);
    expect(within(nav).queryByText(CATALOG_ERR)).toBeNull();
    expect(within(nav).queryByRole('button', { name: 'Thử lại' })).toBeNull();

    const drawer = openMobileDrawer();
    const catHeading = within(drawer).getByText('Danh Mục Sản Phẩm');
    const drawerCatButtons = [...catHeading.parentElement!.querySelectorAll('button')].map(b => b.textContent);
    expect(drawerCatButtons).toEqual(['Vợt Cầu Lông', 'Giày Cầu Lông']);
    expect(within(drawer).queryByRole('button', { name: 'Phụ Kiện Cầu Lông' })).toBeNull();
    expect(within(drawer).queryByText(CATALOG_ERR)).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});
