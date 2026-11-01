// @vitest-environment jsdom
// STOR-055: Hero banner carousel toàn chiều ngang từ sản phẩm thật VOMA, không tràn chữ ở 1440 và 390
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import HomePage from '../features/home/HomePage';
import BadmintonCenterSlider from '../features/home/BadmintonCenterSlider';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { NO_IMAGE_URL } from '../services/sport-api/constants';
import { Product, Category } from '../types';
import { getProductPath } from '../utils/productSlug';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

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

function renderSlider(products: Product[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BadmintonCenterSlider products={products} />} />
        <Route path="/product/:slug" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderHome(products: Product[], categories: Category[] = sampleCategories) {
  const store = configureStore({
    reducer: {
      appData: (state = { products, categories }) => state,
      cart: cartReducer,
      catalog: catalogReducer,
    },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product/:slug" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('STOR-055 Hero banner carousel từ sản phẩm thật VOMA, không tràn chữ', () => {
  it('(a) Tên sản phẩm 160 ký tự giữ nguyên textContent và có đủ lớp kẹp dòng (line-clamp-1 md:line-clamp-2, min-w-0, break-words)', () => {
    const longName =
      'Cước Đan Vợt Cầu Lông Yonex BG80 Power BG66 Ultimax Exbolt 63 65 68 Titanium Chính Hãng Nội Địa Nhật Bản Siêu Nảy Kiểm Soát Cầu Chuẩn Thi Đấu Quốc Tế Bền Bỉ 2026';
    expect(longName.length).toBeGreaterThanOrEqual(150);

    renderSlider([makeProduct('long-1', { name: longName }), makeProduct('p-2')]);

    const title = screen.getByTestId('slider-active-title');
    expect(title.textContent).toBe(longName);

    const titleTokens = title.className.split(/\s+/);
    expect(titleTokens).toEqual(
      expect.arrayContaining(['min-w-0', 'break-words', 'line-clamp-1', 'md:line-clamp-2']),
    );

    const chip = screen.getByTestId('slider-product-chip');
    expect(chip.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-w-0', 'overflow-hidden']));

    const activeSlide = screen.getByTestId('center-slide-active');
    expect(activeSlide.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-w-0', 'overflow-hidden']));
  });

  it('(b) Sản phẩm còn hàng nhưng có ảnh NO_IMAGE_URL hoặc rỗng không được đưa vào slide hero trên HomePage', () => {
    const pNoImage = makeProduct('no-img', {
      name: 'Sản Phẩm Ảnh Placeholder',
      stock: 15,
      image: NO_IMAGE_URL,
    });
    const pEmptyImage = makeProduct('empty-img', {
      name: 'Sản Phẩm Không Ảnh',
      stock: 12,
      image: '',
    });
    const pOutOfStock = makeProduct('out-stock', {
      name: 'Sản Phẩm Hết Hàng',
      stock: 0,
      image: 'https://pim.voma.vn/media/out.jpg',
    });
    const pValid1 = makeProduct('valid-1', { name: 'Vợt Thật Có Ảnh 1', stock: 5 });
    const pValid2 = makeProduct('valid-2', { name: 'Vợt Thật Có Ảnh 2', stock: 4 });

    renderHome([pNoImage, pEmptyImage, pOutOfStock, pValid1, pValid2]);

    const hero = screen.getByTestId('badminton-center-slider');
    expect(within(hero).getByTestId('slider-active-title').textContent).toBe(pValid1.name);
    expect(within(hero).getByTestId('slider-dot-0')).toBeTruthy();
    expect(within(hero).getByTestId('slider-dot-1')).toBeTruthy();
    expect(within(hero).queryByTestId('slider-dot-2')).toBeNull();
    expect(hero.textContent).not.toContain(pNoImage.name);
    expect(hero.textContent).not.toContain(pEmptyImage.name);
    expect(hero.textContent).not.toContain(pOutOfStock.name);

    cleanup();
    renderHome([pNoImage]);
    expect(screen.queryByTestId('badminton-center-slider')).toBeNull();
  });

  it('(c) Giá gạch ngang chỉ hiện khi hasActivePromotion là true (từ getPriceDisplay); thiếu giá hiện Liên hệ để biết giá', () => {
    const noPromo = makeProduct('no-promo', {
      price: 3000000,
      originalPrice: 3000000,
      salePrice: 3000000,
      hasActivePromotion: false,
    });
    renderSlider([noPromo]);
    const heroNoPromo = screen.getByTestId('badminton-center-slider');
    expect(within(heroNoPromo).queryByTestId('slider-original-price')).toBeNull();
    expect(heroNoPromo.querySelectorAll('.line-through').length).toBe(0);

    cleanup();
    const withPromo = makeProduct('with-promo', {
      price: 3500000,
      originalPrice: 3500000,
      salePrice: 2800000,
      computedPrice: 2800000,
      hasActivePromotion: true,
    });
    renderSlider([withPromo]);
    const heroPromo = screen.getByTestId('badminton-center-slider');
    expect(heroPromo.textContent).toContain('2.800.000đ');
    const struck = within(heroPromo).getByTestId('slider-original-price');
    expect(struck.textContent).toBe('3.500.000đ');
    expect(struck.className).toContain('line-through');

    cleanup();
    const noPrice = makeProduct('no-price', { price: undefined });
    renderSlider([noPrice]);
    expect(screen.getByTestId('badminton-center-slider').textContent).toContain('Liên hệ để biết giá');
  });

  it('(d) Điều khiển có nhãn tiếng Việt, không chứa từ Slide, chấm active có aria-current="true", nút tạm dừng đổi Tạm dừng / Phát tiếp, mọi CTA dẫn tới getProductPath', () => {
    const p1 = makeProduct('p1', { name: 'Vợt Cầu Lông P1' });
    const p2 = makeProduct('p2', { name: 'Vợt Cầu Lông P2' });
    renderSlider([p1, p2]);

    const hero = screen.getByTestId('badminton-center-slider');
    const prevBtn = within(hero).getByTestId('slider-prev');
    const nextBtn = within(hero).getByTestId('slider-next');
    const dot0 = within(hero).getByTestId('slider-dot-0');
    const dot1 = within(hero).getByTestId('slider-dot-1');
    const pauseBtn = within(hero).getByTestId('slider-pause-toggle');

    expect(prevBtn.getAttribute('aria-label')).toBe('Sản phẩm trước');
    expect(nextBtn.getAttribute('aria-label')).toBe('Sản phẩm tiếp theo');
    expect(dot0.getAttribute('aria-label')).toBe('Xem sản phẩm 1/2');
    expect(dot1.getAttribute('aria-label')).toBe('Xem sản phẩm 2/2');
    expect(dot0.getAttribute('aria-current')).toBe('true');
    expect(dot1.getAttribute('aria-current')).toBeNull();

    const labelledNodes = Array.from(hero.querySelectorAll('[aria-label]'));
    expect(labelledNodes.length).toBeGreaterThanOrEqual(4);
    for (const node of labelledNodes) {
      const label = node.getAttribute('aria-label') || '';
      expect(label).not.toMatch(/slide/i);
      expect(label).not.toMatch(/Nổi bật|Hot|Bán chạy|Tiêu điểm/i);
    }

    expect(pauseBtn.getAttribute('aria-pressed')).toBe('false');
    expect(pauseBtn.textContent).toContain('Tạm dừng');
    fireEvent.click(pauseBtn);
    expect(pauseBtn.getAttribute('aria-pressed')).toBe('true');
    expect(pauseBtn.textContent).toContain('Phát tiếp');

    const ctaButtons = within(hero).getAllByRole('button', { name: 'Xem chi tiết' });
    expect(ctaButtons.length).toBe(2);
    for (const btn of ctaButtons) {
      cleanup();
      renderSlider([p1, p2]);
      const freshBtn = within(screen.getByTestId('badminton-center-slider')).getAllByRole('button', {
        name: 'Xem chi tiết',
      })[ctaButtons.indexOf(btn)];
      fireEvent.click(freshBtn);
      expect(screen.getByTestId('loc').textContent).toBe(getProductPath(p1));
    }
  });

  it('(e) Khi có đúng 2 sản phẩm, không có data-testid nào bị lặp lại trong hero và không có chữ chiến dịch bịa hay Astrox 77 Tour trong src/', () => {
    const p1 = makeProduct('p1');
    const p2 = makeProduct('p2');
    renderSlider([p1, p2]);

    const hero = screen.getByTestId('badminton-center-slider');
    const testIds = Array.from(hero.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
    expect(new Set(testIds).size).toBe(testIds.length);

    expect(hero.querySelector('.slide-caption-title')).toBeNull();
    expect(hero.querySelector('.slide-caption-sub')).toBeNull();
    expect(hero.textContent).not.toMatch(/ASTROX SERIES|SẢN PHẨM TIÊU ĐIỂM|DÒNG TẤN CÔNG CHỦ LỰC/i);

    const srcRoot = join(process.cwd(), 'src');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === '__tests__') return [];
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
      });
    for (const file of walk(srcRoot)) {
      expect(readFileSync(file, 'utf8')).not.toContain('Astrox 77 Tour');
    }
  });

  it('(f) Autoplay tự chuyển sang sản phẩm kế tiếp sau 4500ms và dừng lại khi đang Tạm dừng', () => {
    vi.useFakeTimers();
    const p1 = makeProduct('p1', { name: 'Sản phẩm 1' });
    const p2 = makeProduct('p2', { name: 'Sản phẩm 2' });
    renderSlider([p1, p2]);

    expect(screen.getByTestId('slider-active-title').textContent).toBe('Sản phẩm 1');

    act(() => {
      vi.advanceTimersByTime(4499);
    });
    expect(screen.getByTestId('slider-active-title').textContent).toBe('Sản phẩm 1');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('slider-active-title').textContent).toBe('Sản phẩm 2');

    fireEvent.click(screen.getByTestId('slider-pause-toggle'));
    expect(screen.getByTestId('slider-pause-toggle').getAttribute('aria-pressed')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(screen.getByTestId('slider-active-title').textContent).toBe('Sản phẩm 2');
  });
});
