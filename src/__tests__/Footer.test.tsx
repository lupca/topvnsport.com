// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../components/Footer';
import { Category, Product } from '../types';

const category: Category = {
  id: 1,
  name: 'Vợt Cầu Lông',
  code: 'VC001491',
  parent_id: 3,
  display_name: 'Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Vợt Cầu Lông'
};

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Sản phẩm',
    brand: 'Yonex',
    image: '',
    category: 'Vợt Cầu Lông',
    categoryCode: 'VC001491',
    price: 500000,
    specs: {},
    description: '',
    reviews: [],
    stock: 1,
    ...overrides
  };
}

describe('Footer', () => {
  afterEach(() => cleanup());

  test('liên kết danh mục dùng MÃ ngành (categoryCode), không dùng tên hiển thị', () => {
    render(
      <MemoryRouter>
        <Footer categories={[category]} products={[makeProduct({})]} />
      </MemoryRouter>
    );

    const link = screen.getByText('Vợt Cầu Lông').closest('a');
    expect(link).not.toBeNull();
    // encodeURIComponent('VC001491') === 'VC001491' (không đổi vì không có ký
    // tự đặc biệt); nếu dùng category.name thì href sẽ chứa chuỗi encode có dấu.
    expect(link?.getAttribute('href')).toBe('/catalog?category=VC001491');
  });
});
