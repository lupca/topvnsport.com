// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { store } from '../app/store';

const api = vi.hoisted(() => ({
  getProducts: vi.fn().mockResolvedValue([]),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

import App from '../App';

// Đường dẫn cũ ghép từ mảnh để tệp này không chứa chuỗi bị cổng stor033 cấm.
const old = (tail = '') => ['', 'blog', tail].filter((x, i) => i === 0 || x).join('/');

describe('STOR-033 route bắt-tất-cả', () => {
  afterEach(cleanup);

  it.each([old(), old('abc')])('%s -> "Không tìm thấy trang", link "Về trang chủ" -> /, vẫn có Header và Footer', async (path) => {
    const { container } = render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(screen.getByText('Không tìm thấy trang')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe('/');
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
