// @vitest-environment jsdom
// STOR-145 (goal 2c881ad4, MOB-E 5c6e5961 / MOB-F): ở 360-430px thẻ sản phẩm, thanh công cụ và trạng thái rỗng
// của danh mục có vùng bấm >= 44px (min-h-11) và chữ >= 14px (text-sm; select text-base = 16px+), mỗi giá trị cũ
// sống lại dưới md: để 1440 không đổi. Bộ lọc (ngăn kéo mobile) đổi dưới lg, giữ giá trị cũ dưới lg:.
// Số đo thật (Playwright) nằm trong báo cáo STOR-145; ở đây khóa từng lớp để đột biến xóa lớp nào cũng đỏ.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import CatalogPage from '../features/catalog/CatalogPage';
import ProductCard from '../components/ProductCard';
import { Category, Product } from '../types';

const cls = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/);
const expectClasses = (el: Element | null, want: string[]) => {
  expect(el).not.toBeNull();
  for (const c of want) expect(cls(el), c).toContain(c);
};

const racket: Category = { id: 1, name: 'Vợt Cầu Lông', code: 'VC001491', parent_id: 3, display_name: 'Cầu Lông > Vợt Cầu Lông' };

const card: Product = {
  id: 'p1',
  slug: 'vot-a',
  name: 'Vợt A',
  brand: 'Yonex',
  image: '',
  category: 'Vợt cầu lông',
  categoryCode: 'VC001491',
  price: 1000000,
  salePrice: 800000,
  badge: 'HOT',
  specs: { weight: '4U', stiffness: 'Trung bình', balance: 295, maxTension: 0 },
  description: '',
  stock: 5,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: 'SKU-A', price: 1000000, stock: 5 }],
  tier_variations: [{ tier_index: 1, name: 'Loại Cước', options: ['Khung Không Dây'] }],
} as Product;

function renderCard(product: Product = card) {
  render(
    <MemoryRouter>
      <ProductCard product={product} onQuickView={vi.fn()} onAddToCart={vi.fn()} />
    </MemoryRouter>
  );
}

function renderCatalog(products: Product[], catalog: Record<string, unknown> = {}) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      appData: { products, branches: [], stringOptions: [], categories: [racket], isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { ...catalogReducer(undefined, { type: 'init' }), ...catalog },
    } as any,
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogPage />
      </MemoryRouter>
    </Provider>
  );
}

afterEach(cleanup);

describe('STOR-145 ProductCard: 44px + 14px dưới md, giá trị cũ dưới md:', () => {
  it('nút thêm giỏ mobile: min-w-11 min-h-11, md: về kích thước p-2 cũ, vẫn chỉ hiện trên thiết bị không hover', () => {
    renderCard();
    expectClasses(screen.getByTestId('mobile-add-to-cart'), ['min-w-11', 'min-h-11', 'md:min-w-auto', 'md:min-h-auto', 'p-2', '[@media(hover:hover)]:hidden']);
    // icon giữa vùng 44px (nút là inline-block, svg là block)
    expectClasses(screen.getByTestId('mobile-add-to-cart').querySelector('svg'), ['max-md:mx-auto']);
  });
  it('nút đan cước: min-h-11 text-sm, md:min-h-auto md:text-[11.5px]', () => {
    renderCard();
    expectClasses(screen.getByTestId('o2o-stringing-button'), ['min-h-11', 'md:min-h-auto', 'text-[0.875rem]', 'md:text-[11.5px]']);
  });
  it('tên: text-[0.875rem] md:text-[15.5px], min-h-[43px] md:min-h-[44px]', () => {
    renderCard();
    expectClasses(screen.getByRole('heading', { name: 'Vợt A' }), ['text-[0.875rem]', 'md:text-[15.5px]', 'min-h-[43px]', 'md:min-h-[44px]']);
  });
  it('giá gạch: text-[0.875rem] md:text-[12.5px]; giá bán giữ 14.5px (đã >= 14px)', () => {
    renderCard();
    expectClasses(screen.getByTestId('original-price'), ['text-[0.875rem]', 'md:text-[12.5px]']);
    expectClasses(screen.getByTestId('sale-price'), ['text-[14.5px]', 'sm:text-[17.5px]']);
  });
  it('nhãn HOT và -%: text-[0.875rem] md:text-[11px]', () => {
    renderCard();
    expectClasses(screen.getByTestId('product-badge'), ['text-[0.875rem]', 'md:text-[11px]']);
    expectClasses(screen.getByTestId('discount-badge'), ['text-[0.875rem]', 'md:text-[11px]']);
  });
  it('hàng thương hiệu: text-[0.875rem] md:text-[11.5px], xuống dòng dưới md (flex-wrap md:flex-nowrap); nhãn tồn: text-[0.875rem] md:text-[10.5px]', () => {
    renderCard();
    expectClasses(screen.getByTestId('brand-label').closest('div'), ['text-[0.875rem]', 'md:text-[11.5px]', 'flex-wrap', 'md:flex-nowrap']);
    expectClasses(screen.getByTestId('stock-tag'), ['text-[0.875rem]', 'md:text-[10.5px]']);
  });
  it('khung chưa có ảnh: text-[0.875rem] md:text-[11px]', () => {
    renderCard();
    expectClasses(screen.getByTestId('image-placeholder'), ['text-[0.875rem]', 'md:text-[11px]']);
  });
  it('hàng biến thể (chỉ hiện từ sm): text-[0.875rem] md:text-[11.5px], chữ biến thể text-[0.875rem] md:text-[11px]', () => {
    renderCard({ ...card, tier_variations: [{ tier_index: 1, name: 'Phân loại', options: ['4U', '5U'] }] } as Product);
    expectClasses(screen.getByTestId('variant-preview-row'), ['text-[0.875rem]', 'md:text-[11.5px]']);
    expectClasses(screen.getByTestId('variant-text'), ['text-[0.875rem]', 'md:text-[11px]']);
  });
});

describe('STOR-145 CatalogPage: thanh công cụ và trạng thái rỗng dưới md', () => {
  it('nút Bộ lọc: min-h-11 text-sm, md:min-h-auto md:text-xs; số đếm text-[0.875rem] md:text-[10px]', () => {
    renderCatalog([card], { selectedCategory: 'VC001491' });
    const btn = screen.getAllByRole('button', { name: /^Bộ lọc/ })[0];
    expectClasses(btn, ['min-h-11', 'md:min-h-auto', 'text-sm', 'md:text-xs']);
    expectClasses(btn.querySelector('span'), ['text-[0.875rem]', 'md:text-[10px]', 'min-w-5', 'h-5', 'md:min-w-4', 'md:h-4']);
  });
  it('select sắp xếp: min-h-11 text-base, md:min-h-auto md:text-xs', () => {
    renderCatalog([card]);
    expectClasses(screen.getByRole('combobox', { name: 'Sắp xếp' }), ['min-h-11', 'md:min-h-auto', 'text-base', 'md:text-xs']);
  });
  it('"N sản phẩm": text-sm md:text-xs; hàng công cụ được xuống dòng dưới md', () => {
    renderCatalog([card]);
    const count = screen.getByText('1 sản phẩm');
    expectClasses(count, ['text-sm', 'md:text-xs']);
    expectClasses(count.parentElement, ['flex-wrap', 'md:flex-nowrap']);
  });
  it('ghi chú tìm kiếm text-sm md:text-xs; nút xóa X min-w-11 min-h-11 md:min-w-auto md:min-h-auto p-1', () => {
    renderCatalog([card], { searchQuery: 'zzzz' });
    const note = screen.getByText(/Đang tìm kết quả lọc theo từ khóa/);
    expectClasses(note, ['text-sm', 'md:text-xs']);
    expectClasses(note.parentElement!.querySelector('button'), ['shrink-0', 'min-w-11', 'min-h-11', 'md:min-w-auto', 'md:min-h-auto', 'p-1']);
    expectClasses(note.parentElement!.querySelector('button svg'), ['max-md:mx-auto']);
  });
  it('đầu trang: nhãn "TopVNSport Product Directory" text-sm md:text-xs; đoạn mô tả text-sm', () => {
    renderCatalog([card]);
    expectClasses(screen.getByText('TopVNSport Product Directory'), ['text-sm', 'md:text-xs']);
    expectClasses(screen.getByText(/Lọc nhanh thông số cây vợt/), ['text-sm']);
  });
  it('trạng thái rỗng "Làm mới bộ lọc": min-h-11 text-sm, md:min-h-auto md:text-xs', () => {
    renderCatalog([card], { searchQuery: 'zzzz' });
    expectClasses(screen.getByRole('button', { name: 'Làm mới bộ lọc' }), ['min-h-11', 'md:min-h-auto', 'text-sm', 'md:text-xs']);
  });
});

describe('STOR-145 FilterPanel: 44px + 14px (select 16px) dưới lg, giá trị cũ dưới lg:', () => {
  // Sidebar (hidden lg:block) cùng dựng filterPanel, nên đo bản đầu tiên là đủ cho cả ngăn kéo.
  const setup = () => {
    renderCatalog([card], { selectedCategory: 'VC001491' });
  };
  it('tiêu đề, Xóa bộ lọc', () => {
    setup();
    expectClasses(screen.getAllByText('Bộ lọc sản phẩm')[0], ['text-sm', 'lg:text-xs']);
    expectClasses(screen.getAllByRole('button', { name: 'Xóa bộ lọc' })[0], ['min-h-11', 'lg:min-h-auto', 'text-[0.875rem]', 'lg:text-[11px]']);
  });
  it.each(['Thương hiệu quốc tế', 'Phân loại sản phẩm', 'Trọng lượng (U)', 'Điểm Cân Bằng', 'Độ Cứng Thân (Stiffness)'])('tiêu đề %s: text-[0.875rem] lg:text-[11px]', (h) => {
    setup();
    expectClasses(screen.getAllByText(h)[0], ['text-[0.875rem]', 'lg:text-[11px]']);
  });
  it('nhãn thương hiệu: min-h-11 text-sm, lg:min-h-auto lg:text-xs', () => {
    setup();
    expectClasses(screen.getAllByText('Yonex', { selector: 'label span' })[0].closest('label'), ['min-h-11', 'lg:min-h-auto', 'text-sm', 'lg:text-xs']);
  });
  it('nút phân loại: min-h-11 text-sm, lg:min-h-auto lg:text-xs; số đếm text-[0.875rem] lg:text-[10px]', () => {
    setup();
    const btn = screen.getAllByRole('button', { name: /^Vợt Cầu Lông/ })[0];
    expectClasses(btn, ['min-h-11', 'lg:min-h-auto', 'text-sm', 'lg:text-xs']);
    expectClasses(btn.querySelector('.font-mono'), ['text-[0.875rem]', 'lg:text-[10px]']);
  });
  it('ngân sách: hàng chữ text-[0.875rem] lg:text-[11px], thanh trượt h-11 lg:h-1, nhãn mốc text-[0.875rem] lg:text-[10px]', () => {
    setup();
    expectClasses(screen.getAllByText('Ngân sách tối đa')[0].parentElement, ['text-[0.875rem]', 'lg:text-[11px]']);
    expectClasses(screen.getAllByRole('slider')[0], ['h-11', 'lg:h-1', 'bg-transparent', 'lg:bg-gray-100']);
    expectClasses(screen.getAllByText('100Kđ')[0].parentElement, ['text-[0.875rem]', 'lg:text-[10px]']);
  });
  it('nút trọng lượng: min-w-11 min-h-11 text-sm, lg:min-w-auto lg:min-h-auto lg:text-[10px]', () => {
    setup();
    expectClasses(screen.getAllByRole('button', { name: '4U' })[0], ['min-w-11', 'min-h-11', 'lg:min-w-auto', 'lg:min-h-auto', 'text-[0.875rem]', 'lg:text-[10px]']);
  });
  it.each(['Mọi điểm cân bằng', 'Mọi độ cứng'])('select %s: min-h-11 text-base, lg:min-h-auto lg:text-xs', (first) => {
    setup();
    const select = screen.getAllByRole('combobox').find((s) => (s as HTMLSelectElement).options[0].text === first);
    expectClasses(select ?? null, ['min-h-11', 'lg:min-h-auto', 'text-base', 'lg:text-xs']);
  });
});
