// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { store } from '../app/store';

const api = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  getBlogs: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));

import App from '../App';

describe('App banner lỗi tải', () => {
  afterEach(cleanup);

  it('danh mục + sản phẩm lỗi -> hiện cả hai câu trên trang', async () => {
    api.getProducts.mockRejectedValue(new Error('x'));
    api.getCategories.mockRejectedValue(new Error('x'));
    render(<Provider store={store}><MemoryRouter><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(screen.getByText('Không tải được danh mục sản phẩm. Vui lòng tải lại trang.')).toBeInTheDocument());
    expect(screen.getByText('Không tải được danh sách sản phẩm. Vui lòng tải lại trang.')).toBeInTheDocument();
  });
});
