// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
    reviews: [],
    stock: 5,
    ...overrides
  };
}

function renderCatalogPage(categories: Category[], products: Product[]) {
  const store = configureStore({
    reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      appData: { products, blogs: [], branches: [], stringOptions: [], categories, isLoading: false },
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

describe('CatalogPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lọc sản phẩm theo MÃ ngành (categoryCode), không theo tên hiển thị', () => {
    const products = [
      makeProduct({ id: 'racket-a', name: 'Vợt A', categoryCode: 'VC001491' }),
      makeProduct({ id: 'other-b', name: 'Cước B', categoryCode: 'VC001488' })
    ];
    renderCatalogPage([racketCategory, otherCategory], products);

    // Ban đầu (Tất cả) thấy cả hai sản phẩm
    expect(screen.getByText('Vợt A')).toBeTruthy();
    expect(screen.getByText('Cước B')).toBeTruthy();

    // Bấm vào nút danh mục "Vợt Cầu Lông" trong sidebar (nhãn hiển thị = tên,
    // nhưng state lưu MÃ 'VC001491')
    fireEvent.click(screen.getByText('Vợt Cầu Lông'));

    expect(screen.getByText('Vợt A')).toBeTruthy();
    expect(screen.queryByText('Cước B')).toBeNull();
  });

  it('ẩn bộ lọc thông số (trọng lượng/cân bằng/độ cứng) khi không sản phẩm nào trong ngành có dữ liệu thật', () => {
    const products = [
      makeProduct({ id: 'racket-a', name: 'Vợt A', categoryCode: 'VC001491', specs: {} }),
      makeProduct({ id: 'racket-b', name: 'Vợt B', categoryCode: 'VC001491', specs: {} })
    ];
    renderCatalogPage([racketCategory], products);

    fireEvent.click(screen.getByText('Vợt Cầu Lông'));

    expect(screen.queryByText('Trọng lượng (U)')).toBeNull();
    expect(screen.queryByText('Điểm Cân Bằng')).toBeNull();
    expect(screen.queryByText('Độ Cứng Thân (Stiffness)')).toBeNull();
  });

  it('hiện bộ lọc thông số khi có ít nhất một sản phẩm trong ngành mang giá trị thông số đó', () => {
    const products = [
      makeProduct({ id: 'racket-a', name: 'Vợt A', categoryCode: 'VC001491', specs: { weight: '4U (80-84g)', balance: 300, stiffness: 'Cứng' } }),
      makeProduct({ id: 'racket-b', name: 'Vợt B', categoryCode: 'VC001491', specs: {} })
    ];
    renderCatalogPage([racketCategory], products);

    fireEvent.click(screen.getByText('Vợt Cầu Lông'));

    expect(screen.getByText('Trọng lượng (U)')).toBeTruthy();
    expect(screen.getByText('Điểm Cân Bằng')).toBeTruthy();
    expect(screen.getByText('Độ Cứng Thân (Stiffness)')).toBeTruthy();
  });
});
