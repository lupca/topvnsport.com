// @vitest-environment jsdom
// STOR-055: Hero banner toàn chiều ngang, không tràn chữ ở 1440 và 390, không chữ chiến dịch bịa.
// STOR-107: hero là banner cấu hình (src/config/heroBanners.json), không còn slide sản phẩm VOMA.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { NO_IMAGE_URL } from '../services/sport-api/constants';
import { Product, Category } from '../types';

afterEach(cleanup);

const makeProduct = (id: string, overrides: Partial<Product> = {}): Product =>
  ({
    id,
    name: `Vợt Cầu Lông ${id}`,
    brand: 'Yonex',
    category: 'Vợt Cầu Lông',
    categoryCode: 'VC001491',
    price: 3200000,
    stock: 8,
    characteristics: 'Tấn Công',
    specs: { weight: '4U', balance: 302 },
    image: `https://pim.voma.vn/media/${id}.jpg`,
    ...overrides,
  }) as Product;

const sampleCategories: Category[] = [
  { id: 1, name: 'Vợt Cầu Lông', code: 'VC001491', parent_id: null, display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' },
];

function renderHome(products: Product[]) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories: sampleCategories }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </Provider>,
  );
}

const tokens = (el: Element) => el.className.toString().split(/\s+/);

describe('STOR-055 hero banner không tràn chữ, không dữ liệu sản phẩm', () => {
  it('(a) headline và subline có lớp kẹp dòng (min-w-0, break-words, line-clamp-3); hộp hero overflow-hidden', () => {
    renderHome([makeProduct('1')]);
    const slide = screen.getAllByTestId('hero-banner')[0];
    for (const el of [slide.querySelector('h2')!, slide.querySelector('p')!]) {
      expect(tokens(el)).toEqual(expect.arrayContaining(['min-w-0', 'break-words', 'line-clamp-3']));
    }
    expect(tokens(screen.getByTestId('hero-banner-box'))).toContain('overflow-hidden');
  });

  it('(b) sản phẩm có ảnh NO_IMAGE_URL, ảnh rỗng, hết hàng hay đang giảm giá không bao giờ lọt vào hero: hero chỉ chứa chữ của cấu hình', () => {
    const noImage = makeProduct('no-img', { name: 'Sản Phẩm Ảnh Placeholder', image: NO_IMAGE_URL });
    const emptyImage = makeProduct('empty-img', { name: 'Sản Phẩm Không Ảnh', image: '' });
    const outOfStock = makeProduct('out-stock', { name: 'Sản Phẩm Hết Hàng', stock: 0 });
    const promo = makeProduct('promo', { name: 'Vợt Đang Giảm Giá', price: 3500000, originalPrice: 3500000, salePrice: 2800000, hasActivePromotion: true });
    renderHome([noImage, emptyImage, outOfStock, promo]);
    const hero = screen.getByTestId('hero-banner-section');
    for (const p of [noImage, emptyImage, outOfStock, promo]) expect(hero.textContent).not.toContain(p.name);
    expect(hero.textContent).not.toMatch(/\d[\d.]*đ|Liên hệ để biết giá|Xem chi tiết/);
    expect(hero.querySelectorAll('.line-through').length).toBe(0);
    expect(hero.querySelectorAll('img[src^="http"]').length).toBe(0);
  });

  it('(c) điều khiển có nhãn tiếng Việt (không chứa từ Slide), dot đang chọn aria-current="true", nút dừng đổi Tạm dừng / Phát tiếp', () => {
    renderHome([makeProduct('1')]);
    const hero = screen.getByTestId('hero-banner-section');
    const dots = within(hero).getByTestId('slider-dots').querySelectorAll('button');
    expect(dots.length).toBeGreaterThanOrEqual(3);
    dots.forEach((dot, i) => expect(dot.getAttribute('aria-label')).toBe(`Xem banner ${i + 1}/${dots.length}`));
    expect(dots[0].getAttribute('aria-current')).toBe('true');
    expect(dots[1].getAttribute('aria-current')).toBeNull();

    for (const node of hero.querySelectorAll('[aria-label]')) {
      expect(node.getAttribute('aria-label')).not.toMatch(/slide/i);
    }

    const pause = within(hero).getByTestId('slider-pause-toggle');
    expect(pause.getAttribute('aria-pressed')).toBe('false');
    expect(pause.getAttribute('aria-label')).toBe('Tạm dừng');
    fireEvent.click(pause);
    expect(pause.getAttribute('aria-pressed')).toBe('true');
    expect(pause.getAttribute('aria-label')).toBe('Phát tiếp');
  });

  it('(d) không chữ chiến dịch bịa và không "Astrox 77 Tour" trong src/ (trừ __tests__)', () => {
    renderHome([makeProduct('1')]);
    expect(screen.getByTestId('hero-banner-section').textContent).not.toMatch(/ASTROX SERIES|SẢN PHẨM TIÊU ĐIỂM|DÒNG TẤN CÔNG CHỦ LỰC/i);

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === '__tests__') return [];
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : /\.(ts|tsx|json)$/.test(entry.name) ? [full] : [];
      });
    for (const file of walk(join(process.cwd(), 'src'))) {
      expect(readFileSync(file, 'utf8')).not.toContain('Astrox 77 Tour');
    }
  });
});
