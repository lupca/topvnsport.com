// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { Product } from '../types';

const alertMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: (...a: unknown[]) => alertMock(...a) } }));
const api = vi.hoisted(() => ({
  getProducts: vi.fn(), getAllStock: vi.fn().mockResolvedValue({}), getCategories: vi.fn().mockResolvedValue([]),
  getBlogs: vi.fn().mockResolvedValue([]), getBranches: vi.fn().mockResolvedValue([]), getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));

import App from '../App';
import ProductDetailPage from '../components/ProductDetailPage';
import ProductDetailTabs from '../components/product-detail/ProductDetailTabs';
import ProductMediaGallery from '../components/ProductMediaGallery';
import MobilePurchaseBar from '../components/product-detail/MobilePurchaseBar';

const scrollIntoView = vi.fn();
beforeAll(() => { Element.prototype.scrollIntoView = scrollIntoView; });
afterEach(() => { cleanup(); scrollIntoView.mockClear(); alertMock.mockClear(); vi.restoreAllMocks(); });

const product: Product = {
  id: 'p28', slug: 'ao-28', name: 'Áo 28', brand: 'Yonex', category: 'Áo', price: 200000, image: 'x.jpg',
  specs: {}, description: 'Mô tả', reviews: [], stock: 20, features: [],
  vomaAttributes: [{ code: 'origin', name: 'Xuất xứ', value: 'Trung Quốc' }],
  tier_variations: [
    { tier_index: 1, name: 'Màu Sắc', options: ['Đỏ', 'Xanh'] },
    { tier_index: 2, name: 'Size', options: ['S', 'M'] }
  ],
  variants: [
    { tier_1_option: 'Đỏ', tier_2_option: 'S', sku_code: 'A', price: 200000, stock: 5 },
    { tier_1_option: 'Đỏ', tier_2_option: 'M', sku_code: 'B', price: 200000, stock: 5 },
    { tier_1_option: 'Xanh', tier_2_option: 'S', sku_code: 'C', price: 200000, stock: 5 },
    { tier_1_option: 'Xanh', tier_2_option: 'M', sku_code: 'D', price: 200000, stock: 5 }
  ]
};

function renderApp(path: string) {
  api.getProducts.mockResolvedValue([product]);
  const store = configureStore({ reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer } });
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>);
}

describe('STOR-028 PDP mobile', () => {
  it('PDP ẩn nav đáy', async () => {
    const { container } = renderApp('/product/ao-28');
    await screen.findByText('Áo 28', { selector: 'h1' }, { timeout: 60000 });
    expect(screen.queryByText('Chọn vợt AI')).toBeNull(); // AC2
    expect((container.firstChild as HTMLElement).className).not.toContain('pb-16'); // AC3
  });

  it('trang khác PDP vẫn có nav đáy và pb-16', async () => {
    const { container } = renderApp('/catalog');
    await screen.findByText('Chọn vợt AI', {}, { timeout: 60000 });
    expect(screen.getByText('Chọn vợt AI')).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('pb-16');
  });

  it('thanh mua sticky bottom-0, không fixed', () => {
    const { container } = render(
      <MobilePurchaseBar productName="x" productImage="x.jpg" totalDisplayPrice={1} hasPrice onBuyNow={vi.fn()} />
    );
    const cls = (container.firstChild as HTMLElement).className.split(/\s+/);
    expect(cls).toContain('sticky');
    expect(cls).toContain('bottom-0');
    expect(cls).not.toContain('fixed');
  });

  it('cuộn tới tầng thiếu', async () => {
    renderApp('/product/ao-28');
    await screen.findByText('Áo 28', { selector: 'h1' }, { timeout: 60000 });
    fireEvent.click(screen.getByRole('button', { name: 'Đỏ' })); // chọn màu, thiếu Size
    fireEvent.click(screen.getByRole('button', { name: 'Mua ngay' }));
    expect(alertMock).toHaveBeenCalledWith('Vui lòng chọn Size');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('tier-select-2')); // AC4
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1); // AC5
  });

  it('không tìm thấy khung tầng -> console.error nêu tên tầng', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp('/product/ao-28');
    await screen.findByText('Áo 28', { selector: 'h1' }, { timeout: 60000 });
    fireEvent.click(screen.getByRole('button', { name: 'Đỏ' }));
    document.getElementById('tier-select-2')!.removeAttribute('id');
    fireEvent.click(screen.getByRole('button', { name: 'Mua ngay' }));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(err.mock.calls.some(c => String(c[0]).includes('Size'))).toBe(true); // AC6
  });

  it('không sao khi 0 đánh giá', async () => {
    const { container } = renderApp('/product/ao-28');
    await screen.findByText('Áo 28', { selector: 'h1' }, { timeout: 60000 });
    expect(container.querySelectorAll('svg.lucide-star').length).toBe(0); // AC7
  });

  it('tab: nhãn không xuống dòng, hàng tab cuộn ngang', () => {
    render(<ProductDetailTabs product={product} isRacket={false} activeTab="details" onTabChange={vi.fn()} />);
    const tabs = screen.getAllByRole('button');
    expect(tabs.length).toBe(3);
    tabs.forEach(b => expect(b.className).toContain('whitespace-nowrap')); // AC8
    expect(tabs[0].parentElement!.className).toContain('overflow-x-auto'); // AC9
  });

  it('features rỗng -> không có "Điểm nổi bật"; có features thì hiện', () => {
    const { rerender } = render(<ProductDetailTabs product={product} isRacket={false} activeTab="details" onTabChange={vi.fn()} />);
    expect(screen.queryByText(/Điểm nổi bật/)).toBeNull(); // AC10
    rerender(<ProductDetailTabs product={{ ...product, features: ['Nhẹ'] }} isRacket={false} activeTab="details" onTabChange={vi.fn()} />);
    expect(screen.getByText('Nhẹ')).toBeTruthy();
    expect(screen.getByText(/Điểm nổi bật/)).toBeTruthy();
  });

  it('thuộc tính chỉ ở tab tech, không lặp ở tab mô tả', () => {
    const { rerender } = render(<ProductDetailTabs product={product} isRacket={false} activeTab="details" onTabChange={vi.fn()} />);
    expect(screen.queryByText('Xuất xứ:')).toBeNull(); // AC11
    expect(screen.queryByText('Trung Quốc')).toBeNull();
    rerender(<ProductDetailTabs product={product} isRacket={false} activeTab="tech" onTabChange={vi.fn()} />);
    expect(screen.getByText('Xuất xứ')).toBeTruthy(); // AC12
    expect(screen.getByText('Trung Quốc')).toBeTruthy();
  });

  it('chữ "Di chuột để zoom" chỉ hiện khi có hover', () => {
    render(<ProductMediaGallery productName="x" image="x.jpg" />);
    const hint = screen.getByText(/Di chuột để zoom/);
    expect(hint.className).toContain('[@media(hover:hover)]:inline'); // AC13
    expect(hint.className).toContain('hidden');
  });
});
