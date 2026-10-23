// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import CatalogPage from '../features/catalog/CatalogPage';
import { Category, Product } from '../types';

const racketCategory: Category = {
  id: 1,
  name: 'Vợt Cầu Lông',
  code: 'VC001491',
  parent_id: 3,
  display_name: 'Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Vợt Cầu Lông'
};

const otherCategory: Category = {
  id: 2,
  name: 'Khác',
  code: 'VC001488',
  parent_id: 3,
  display_name: 'Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Khác'
};

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id || 'p',
    name: overrides.name || 'Sản phẩm',
    brand: 'Yonex',
    image: '',
    category: overrides.category || 'Vợt cầu lông',
    categoryCode: overrides.categoryCode,
    price: 500000,
    specs: overrides.specs || {},
    description: '',
    stock: 5,
    ...overrides
  };
}

function renderCatalogPage(categories: Category[], products: Product[]) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      appData: { products, branches: [], stringOptions: [], categories, isLoading: false },
      cart: { items: [], isOpen: false, quickViewProduct: null }
    } as any
  });

  render(
    <Provider store={store}>
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>
    </Provider>
  );
}


const brandProducts = [
  makeProduct({ id: 'het', name: 'Hết A', brand: 'Yonex', stock: 0 }),
  makeProduct({ id: 'con', name: 'Còn B', brand: 'Lining', stock: 4 }),
  makeProduct({ id: 'con2', name: 'Còn C', brand: 'Yonex', stock: 2 })
];
const openDrawer = () => fireEvent.click(screen.getByRole('button', { name: /^Bộ lọc/ }));

describe('STOR-023 catalog mobile', () => {
  afterEach(() => cleanup());

  it('sidebar ẩn dưới lg', () => {
    renderCatalogPage([racketCategory], brandProducts);
    const sidebar = screen.getByText('Thương hiệu quốc tế').closest('.hidden');
    expect(sidebar?.className).toContain('hidden lg:block');
  });
  it('dialog vắng khi đóng', () => {
    renderCatalogPage([racketCategory], brandProducts);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('mở ngăn kéo thấy bộ lọc', () => {
    renderCatalogPage([racketCategory], brandProducts);
    openDrawer();
    expect(within(screen.getByRole('dialog')).getByText('Thương hiệu quốc tế')).toBeTruthy();
  });
  it('huy hiệu đếm tiêu chí', () => {
    renderCatalogPage([racketCategory], brandProducts);
    openDrawer();
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Yonex'));
    expect(screen.getByRole('button', { name: /^Bộ lọc\s*1$/ })).toBeTruthy();
  });
  it('huy hiệu bỏ qua từ khoá', () => {
    const store = configureStore({
      reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
      preloadedState: {
        appData: { products: brandProducts, branches: [], stringOptions: [], categories: [racketCategory], isLoading: false },
        cart: { items: [], isOpen: false, quickViewProduct: null },
        catalog: { ...catalogReducer(undefined, { type: 'x' }), searchQuery: 'Còn' }
      } as any
    });
    render(<Provider store={store}><MemoryRouter><CatalogPage /></MemoryRouter></Provider>);
    expect(screen.getByRole('button', { name: /^Bộ lọc$/ })).toBeTruthy();
  });
  it('đếm kết quả khớp số thẻ', () => {
    renderCatalogPage([racketCategory], brandProducts);
    openDrawer();
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Yonex'));
    expect(screen.getByText('2 sản phẩm')).toBeTruthy();
    expect(document.querySelectorAll('.grid-cols-2 > *').length).toBe(2);
  });
  it('nút Xem N sản phẩm khớp đếm', () => {
    renderCatalogPage([racketCategory], brandProducts);
    openDrawer();
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Lining'));
    expect(screen.getByRole('button', { name: 'Xem 1 sản phẩm' })).toBeTruthy();
    expect(screen.getByText('1 sản phẩm')).toBeTruthy();
  });
  it('nút Xem N sản phẩm đóng dialog', () => {
    renderCatalogPage([racketCategory], brandProducts);
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Xem 3 sản phẩm' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('lưới mobile 2 cột', () => {
    renderCatalogPage([racketCategory], brandProducts);
    expect(document.querySelector('.grid-cols-2')).not.toBeNull();
  });
  it('thẻ đầu còn hàng', () => {
    renderCatalogPage([racketCategory], brandProducts);
    const first = document.querySelector('.grid-cols-2')!.firstElementChild!;
    expect(first.textContent).toContain('Còn B');
    expect(first.textContent).not.toContain('Hết A');
  });
});
