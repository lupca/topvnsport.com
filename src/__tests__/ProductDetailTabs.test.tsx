// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProductDetailTabs from '../components/product-detail/ProductDetailTabs';
import { Product } from '../types';

const racketProduct: Product = {
  id: 'p1',
  name: 'Vợt Yonex Astrox 88D Pro',
  brand: 'Yonex',
  image: '',
  category: 'Vợt Cầu Lông',
  categoryCode: 'VC001491',
  price: 2000000,
  // Đúng thực tế prod hiện nay: sản phẩm ngành vợt KHÔNG có thuộc tính lớp
  // cân/độ cứng/cân bằng/sức căng.
  specs: {},
  description: 'Mô tả sản phẩm.',
  attributes: [
    { id: '1', code: 'brand', name: 'Thương hiệu', value: 'Yonex' },
    { id: '2', code: 'origin', name: 'Xuất xứ', value: 'Việt Nam' }
  ],
  reviews: [],
  stock: 10
};

describe('ProductDetailTabs', () => {
  afterEach(() => cleanup());

  it('luôn hiện attributes thật (Thương hiệu, Xuất xứ...) cho sản phẩm ngành vợt, không báo "chưa có thông số"', () => {
    render(
      <ProductDetailTabs
        product={racketProduct}
        isRacket={true}
        activeTab="details"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Thương hiệu:')).toBeTruthy();
    expect(screen.getByText('Yonex')).toBeTruthy();
    expect(screen.getByText('Xuất xứ:')).toBeTruthy();
    expect(screen.queryByText('Sản phẩm chưa có thông số kỹ thuật chi tiết.')).toBeNull();
  });

  it('tab đánh giá hiện số thật, không bịa số khi mảng reviews rỗng', () => {
    render(
      <ProductDetailTabs
        product={racketProduct}
        isRacket={true}
        activeTab="details"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.queryByText(/Đánh giá tay vợt \(\d+\)/)).toBeNull();
    expect(screen.getByText('Đánh giá tay vợt')).toBeTruthy();
  });
});
