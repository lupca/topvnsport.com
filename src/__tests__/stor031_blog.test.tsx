// @vitest-environment jsdom
// STOR-031: /blog/:id mở đúng bài; id lạ báo không tìm thấy; ảnh lỗi ẩn; tab cuộn được.
import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { store } from '../app/store';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';

const blogs = [
  { id: 'bai-a', title: 'Bài A', category: 'Tin tức', image: 'http://x/a.jpg', summary: 'tóm tắt A', content: 'nội dung A', author: 'T', date: '1/1', tags: ['t'] },
  { id: 'bai-b', title: 'Bài B', category: 'Tin tức', image: 'http://x/b.jpg', summary: 'tóm tắt B', content: 'nội dung B', author: 'T', date: '1/1', tags: ['t'] },
];

const api = vi.hoisted(() => ({
  getProducts: vi.fn().mockResolvedValue([]),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBlogs: vi.fn(),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));

import App from '../App';

function renderApp(path: string) {
  api.getBlogs.mockResolvedValue(blogs);
  render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>);
}

afterEach(cleanup);

describe('STOR-031 blog', () => {
  test('mở /blog/:id hiện bài', async () => {
    renderApp('/blog/bai-b');
    const reader = await waitFor(() => {
      const el = document.querySelector('#blog-reader-view');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(reader.textContent).toContain('Bài B');
    expect(reader.textContent).not.toContain('Bài A');
  });

  test('/blog hiện danh sách', async () => {
    renderApp('/blog');
    await waitFor(() => expect(document.querySelector('#blog-directory')).not.toBeNull());
    expect(document.querySelector('#blog-reader-view')).toBeNull();
  });

  test('id lạ báo không tìm thấy', async () => {
    renderApp('/blog/khong-ton-tai');
    await waitFor(() => expect(document.querySelector('#blog-not-found')).not.toBeNull());
    expect(document.querySelector('#blog-directory')).toBeNull();
    fireEvent.click(screen.getByText(/Quay lại/));
    await waitFor(() => expect(document.querySelector('#blog-directory')).not.toBeNull());
  });

  test('tab không justify-center trần', async () => {
    renderApp('/blog');
    const tab = await screen.findByText('Tất cả');
    const cls = tab.parentElement!.className.split(/\s+/);
    expect(cls).not.toContain('justify-center');
    expect(cls).toContain('overflow-x-auto');
  });

  test('ảnh thẻ blog lỗi ẩn img', async () => {
    renderApp('/blog');
    const img = (await waitFor(() => {
      const el = document.querySelector('#blog-directory img');
      expect(el).not.toBeNull();
      return el!;
    })) as HTMLImageElement;
    fireEvent.error(img);
    expect(document.querySelector('#blog-directory img[src="http://x/a.jpg"]')).toBeNull();
  });

  test('ảnh blog trang chủ lỗi ẩn img', () => {
    const s = configureStore({
      reducer: { appData: (state = { products: [], blogs, categories: [] }) => state, cart: cartReducer, catalog: catalogReducer },
      preloadedState: {
        cart: { items: [], isOpen: false, quickViewProduct: null },
        catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
      },
    } as any);
    render(<Provider store={s}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
    const sel = 'img[src="http://x/a.jpg"]';
    const img = document.querySelector(sel)!;
    expect(img).not.toBeNull();
    fireEvent.error(img);
    expect(document.querySelector(sel)).toBeNull();
  });
});
