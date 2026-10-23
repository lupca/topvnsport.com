// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import QuickViewModal from '../components/QuickViewModal';
import { Product } from '../types';
import { getProductPath } from '../utils/productSlug';

const base: Product = {
  id: 'p1',
  slug: 'vot-a',
  name: 'Vợt A',
  brand: 'Yonex',
  image: 'http://x/a.jpg',
  category: 'Vợt',
  price: 1000000,
  specs: { weight: '', stiffness: '', balance: 0, maxTension: 0 },
  description: 'Mô tả dài',
  stock: 5,
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: 'SKU-A', price: 1000000, stock: 5 }],
} as Product;

const promo: Product = { ...base, salePrice: 800000 };

const twoSku: Product = {
  ...base,
  variants: [
    { tier_1_option: 'Đỏ', tier_2_option: null, sku_code: 'SKU-R', price: 1000000, stock: 5 },
    { tier_1_option: 'Xanh', tier_2_option: null, sku_code: 'SKU-B', price: 1000000, stock: 5 },
  ],
} as Product;

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderCard(product: Product, onAdd = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/catalog']}>
      <Loc />
      <Routes>
        <Route path="/catalog" element={<ProductCard product={product} onQuickView={vi.fn()} onAddToCart={onAdd} />} />
        <Route path="*" element={<div data-testid="other-route" />} />
      </Routes>
    </MemoryRouter>
  );
  return onAdd;
}

function renderModal(product: Product) {
  render(
    <MemoryRouter>
      <QuickViewModal product={product} onClose={vi.fn()} onAddToCart={vi.fn()} />
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe('STOR-024 ProductCard mobile', () => {
  it('lớp phủ ẩn khi không hover', () => {
    renderCard(base);
    const overlay = screen.getByTitle('Xem nhanh thông số').parentElement as HTMLElement;
    expect(overlay.className).toContain('hidden [@media(hover:hover)]:flex');
    expect(overlay.className).toContain('opacity-0 group-hover:opacity-100');
  });

  it('chạm ảnh mở trang chi tiết', () => {
    renderCard(base);
    fireEvent.click(screen.getByTestId('product-card-image'));
    expect(screen.getByTestId('loc').textContent).toBe(getProductPath(base));
  });

  it('nút giỏ mobile', () => {
    const onAdd = renderCard(base);
    const btn = screen.getByTestId('mobile-add-to-cart');
    expect(btn.className).toContain('[@media(hover:hover)]:hidden');
    fireEvent.click(btn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('nút giỏ mobile không điều hướng', () => {
    renderCard(base);
    fireEvent.click(screen.getByTestId('mobile-add-to-cart'));
    expect(screen.getByTestId('loc').textContent).toBe('/catalog');
  });

  it('sản phẩm hai SKU không có nút giỏ mobile', () => {
    renderCard(twoSku);
    expect(screen.queryByTestId('mobile-add-to-cart')).toBeNull();
  });
});

describe('STOR-024 QuickView', () => {
  it('QuickView giá gạch chung', () => {
    renderModal(promo);
    expect(screen.getByTestId('sale-price').textContent).toBe('800.000đ');
    const orig = screen.getByTestId('original-price');
    expect(orig.textContent).toBe('1.000.000đ');
    expect(orig.className).toContain('line-through');
    expect(screen.getByTestId('discount-badge').textContent).toBe('-20%');
  });

  it('QuickView một vùng cuộn', () => {
    renderModal(promo);
    const el = document.getElementById('quick-view-modal-content') as HTMLElement;
    expect(el.className).not.toContain('overflow-hidden');
    const scrollers = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))].filter((n) =>
      n.className.toString().split(/\s+/).includes('overflow-y-auto')
    );
    expect(scrollers).toEqual([el]);
  });
});
