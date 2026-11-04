// @vitest-environment jsdom
// STOR-131: Published = hiển thị. /catalog mặc định (không chọn ngân sách) phải ra ĐỦ thẻ = total PIM.
// Gốc lỗi prod 04/11/2026: maxPrice mặc định 6.000.000đ ẩn 544 (6,5M), 545 (6,7M), 623 (6,45M), 633 (từ 6,7M).
// Hết hàng = gắn nhãn + khoá nút giỏ, KHÔNG ẩn. Body fetch là body prod thật (đã cắt gọn), qua getProducts THẬT.
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { act, render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer, { resetCatalogFilters, setMaxPrice, setSearchQuery } from '../features/catalog/catalogSlice';
import CatalogPage from '../features/catalog/CatalogPage';
import { sportApi } from '../services/sport-api';
import { parseWmsStock } from '../services/sport-api/wmsStock';
import type { Product } from '../types';
import FIXTURE from './fixtures/stor131_published.fixture.json';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn().mockResolvedValue(undefined) } }));
Element.prototype.scrollIntoView = vi.fn();

const j = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
let products: Product[];

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/pmi/public/products?')) return j(FIXTURE.products);
    if (url === '/api/wms/public/stock') return j(FIXTURE.stock);
    if (url.startsWith('/api/pmi/public/voma-categories')) return j(FIXTURE.categories);
    throw new Error(`unexpected fetch ${url}`);
  }));
  products = await sportApi.getProducts();
  vi.unstubAllGlobals();
});
afterEach(cleanup);

function renderCatalog() {
  // catalog = đúng trạng thái mặc định của store thật (không preload maxPrice).
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      appData: { products, branches: [], stringOptions: [], categories: [], isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null }
    } as any
  });
  render(<Provider store={store}><MemoryRouter><CatalogPage /></MemoryRouter></Provider>);
  return store;
}
const cardIds = () => Array.from(document.querySelectorAll('[id^="product-card-"]')).map(e => e.id.replace('product-card-', ''));
const card = (id: number) => document.getElementById(`product-card-${id}`) as HTMLElement;

describe('STOR-131 catalog hiện mọi SP Published', () => {
  it('getProducts thật trả đủ total PIM', () => {
    expect(products).toHaveLength(FIXTURE.products.total);
  });

  it('mặc định: số thẻ = total PIM', () => {
    renderCatalog();
    expect(cardIds()).toHaveLength(FIXTURE.products.total);
    expect(screen.getByText(`${FIXTURE.products.total} sản phẩm`)).toBeTruthy();
  });

  it.each([544, 545, 623, 633])('mặc định: có thẻ SP %i', (id) => {
    renderCatalog();
    expect(card(id)).toBeTruthy();
  });

  it('tìm "Astrox 99 Pro" với bộ lọc mặc định ra 544', () => {
    const store = renderCatalog();
    fireEvent.click(screen.getAllByText('Xóa bộ lọc')[0]);
    act(() => { store.dispatch(setSearchQuery('Astrox 99 Pro')); });
    expect(cardIds()).toEqual(['544']);
  });

  it('slice: maxPrice ban đầu null; resetCatalogFilters về null', () => {
    const init = catalogReducer(undefined, { type: '@@init' });
    expect(init.maxPrice).toBeNull();
    expect(catalogReducer({ ...init, maxPrice: 500000 }, resetCatalogFilters()).maxPrice).toBeNull();
  });

  it('thanh trượt chưa chạm: nhãn "Tất cả mức giá", đầu phải = giá cao nhất làm tròn lên', () => {
    renderCatalog();
    expect(screen.getByText('Tất cả mức giá')).toBeTruthy();
    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('6700000');
    expect(slider.value).toBe('6700000');
    expect(screen.getByText('6.7Mđ')).toBeTruthy();
  });

  it('chọn ngân sách vẫn lọc: setMaxPrice(6000000) ẩn 4 SP > 6M', () => {
    const store = renderCatalog();
    act(() => { store.dispatch(setMaxPrice(6000000)); });
    expect(cardIds().sort()).toEqual(['629', '632']);
  });

  it('hết hàng: 544, 633 gắn nhãn, nằm sau thẻ còn hàng, nút giỏ khoá', () => {
    renderCatalog();
    const ids = cardIds();
    const lastInStock = Math.max(...['632', '623', '545'].map(id => ids.indexOf(id)));
    for (const id of [544, 633]) {
      expect(within(card(id)).getByText('Hết hàng')).toBeTruthy();
      expect(ids.indexOf(String(id))).toBeGreaterThan(lastInStock);
      const btn = within(card(id)).getAllByTitle('Sản phẩm hết hàng');
      expect(btn.length).toBeGreaterThan(0);
      btn.forEach(b => expect((b as HTMLButtonElement).disabled).toBe(true));
    }
    for (const id of [545, 623]) expect(within(card(id)).queryByText('Hết hàng')).toBeNull();
  });

  it('633 không có dòng tồn: SKU vắng = 0, không phải "chưa rõ"', () => {
    expect(products.find(p => p.id === '633')!.stock).toBe(0);
  });

  it('tồn âm qua getProducts thật kẹp về 0 (629)', () => {
    expect(products.find(p => p.id === '629')!.stock).toBe(0);
  });

  it('parseWmsStock nhánh stock: tồn âm -> 0', () => {
    expect(parseWmsStock({ stock: { A: -3, B: 4 } })).toEqual({ A: 0, B: 4 });
  });

  it('parseWmsStock nhánh items: tồn âm -> 0', () => {
    expect(parseWmsStock({ items: [{ sku_code: 'A', qty_available: -3 }, { sku_code: 'B', qty_on_hand: -1 }, { sku_code: 'C', qty_available: 2 }] }))
      .toEqual({ A: 0, B: 0, C: 2 });
  });
});
