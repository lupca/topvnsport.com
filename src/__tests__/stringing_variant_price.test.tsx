// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { Product } from '../types';

const product: Product = {
  id: '337', name: 'Vợt', brand: 'Lining', category: 'Vợt', price: 900000, salePrice: 900000, image: 'x.jpg',
  specs: {}, description: '', reviews: [], stock: 5,
  tier_variations: [
    { tier_index: 1, name: 'Màu', options: ['Đỏ'] },
    { tier_index: 2, name: 'Loại Cước', options: ['Khung trơn', 'BG65'] }
  ],
  variants: [
    { tier_1_option: 'Đỏ', tier_2_option: 'Khung trơn', sku_code: 'S1', price: 900000, stock: 5 },
    { tier_1_option: 'Đỏ', tier_2_option: 'BG65', sku_code: 'S2', price: 950000, stock: 5 }
  ]
};

function mount(p: Product, tier1: string, options: string[]) {
  const noop = () => {};
  return render(
    <StringingAssistant
      product={p} isRacket hasStringingVariation
      stringingVariation={{ tier_index: 2, name: 'Loại Cước', options }} stringingTierIndex={2}
      isDynamicStringingActive activeStringValue="" selectedTier1={tier1} selectedTier2=""
      withStringing selectedString={null} stringOptions={[]} tension={10.5}
      onSetSelectedTier1={noop} onSetSelectedTier2={noop} onSetWithStringing={noop} onSetSelectedString={noop} onSetTension={noop}
    />
  );
}

describe('StringingAssistant giá theo biến thể', () => {
  afterEach(cleanup);

  it('đối chứng: biến thể khớp -> hiện chênh lệch giá thật', () => {
    const { container } = mount(product, 'Đỏ', ['Khung trơn', 'BG65']);
    expect(container.textContent).toContain('+50.000đ');
  });

  it('không biến thể nào khớp lựa chọn -> không hiện giá (không lấy giá sản phẩm)', () => {
    const { container } = mount(product, 'Xanh', ['Khung trơn', 'BG65']);
    expect(container.textContent).not.toContain('Miễn phí');
    expect(container.textContent).not.toMatch(/\d\.\d{3}đ/);
  });

  it('không có lựa chọn "không đan" để so -> không hiện giá (không lấy giá sản phẩm)', () => {
    const { container } = mount(product, 'Đỏ', ['BG65']);
    expect(container.textContent).not.toContain('Miễn phí');
    expect(container.textContent).not.toMatch(/\d\.\d{3}đ/);
  });
});
