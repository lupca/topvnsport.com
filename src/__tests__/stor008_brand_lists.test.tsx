// @vitest-environment jsdom
// STOR-008: menu/bộ lọc thương hiệu dựng từ dữ liệu đã tải.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import appDataReducer from '../features/appData/appDataSlice';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import CatalogPage from '../features/catalog/CatalogPage';
import Header from '../components/Header';
import { Product } from '../types';

const mk = (id: string, brand?: string): Product => ({
  id, name: `SP ${id}`, brand, image: '', price: 1000, specs: {}, description: '', reviews: [], stock: 1
});
const products = [mk('a', 'Yonex'), mk('b', 'VICTOR'), mk('c', 'VICTORY'), mk('d'), mk('e', 'Yonex')];

afterEach(cleanup);

describe('danh sách thương hiệu từ dữ liệu', () => {
  it('Header: đúng các thương hiệu khác rỗng đã tải', () => {
    const { container } = render(
      <MemoryRouter><Header cartCount={0} openCart={() => {}} products={products} categories={[]} /></MemoryRouter>
    );
    fireEvent.click(container.querySelector('svg.lucide-menu')!.closest('button') as HTMLButtonElement);
    const heading = screen.getByText('Thương Hiệu Hot');
    const labels = [...heading.parentElement!.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['VICTOR', 'VICTORY', 'Yonex']);
  });

  it('CatalogPage: bộ lọc liệt kê đúng các thương hiệu khác rỗng đã tải', () => {
    const store = configureStore({
      reducer: { appData: appDataReducer, cart: cartReducer, catalog: catalogReducer },
      preloadedState: {
        appData: { products, blogs: [], branches: [], stringOptions: [], categories: [], isLoading: false },
        cart: { items: [], isOpen: false, quickViewProduct: null }
      } as any
    });
    render(<Provider store={store}><MemoryRouter><CatalogPage /></MemoryRouter></Provider>);
    const heading = screen.getByText('Thương hiệu quốc tế');
    const labels = [...heading.parentElement!.querySelectorAll('label')].map((l) => l.textContent);
    expect(labels).toEqual(['VICTOR', 'VICTORY', 'Yonex']);
  });
});
