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
  // Nguồn hiển thị là thuộc tính VOMA; attributes cũ chứa mã sàn KHÔNG được hiện.
  attributes: [{ id: '9', code: 'origin', name: 'Quốc gia xuất xứ', value: '1000850' }],
  vomaAttributes: [
    { code: 'brand', name: 'Thương hiệu', value: 'Yonex' },
    { code: 'origin', name: 'Xuất xứ', value: 'Trung Quốc' }
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

  it.each(['details', 'tech'] as const)('tab %s hiện tên giá trị VOMA, không hiện mã 1000850 của attributes cũ', (tab) => {
    const { container } = render(
      <ProductDetailTabs product={racketProduct} isRacket={true} activeTab={tab} onTabChange={vi.fn()} />
    );
    expect(screen.getByText('Trung Quốc')).toBeTruthy();
    expect(container.textContent).not.toContain('1000850');
  });

  it.each(['details', 'tech'] as const)('tab %s: không có vomaAttributes và không có spec vợt -> câu trống hiện có', (tab) => {
    render(
      <ProductDetailTabs
        product={{ ...racketProduct, vomaAttributes: undefined }}
        isRacket={false}
        activeTab={tab}
        onTabChange={vi.fn()}
      />
    );
    expect(screen.getByText('Sản phẩm chưa có thông số kỹ thuật chi tiết.')).toBeTruthy();
  });
});
