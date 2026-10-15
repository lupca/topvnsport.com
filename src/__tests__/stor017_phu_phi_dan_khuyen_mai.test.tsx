// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { Product } from '../types';

function makeProduct(noString: object, string: object): Product {
  return {
    id: '337', name: 'Vợt', brand: 'Cannon', category: 'Vợt', price: 1100000, salePrice: 1100000, image: 'x.jpg',
    specs: {}, description: '', reviews: [], stock: 5,
    tier_variations: [
      { tier_index: 1, name: 'Màu', options: ['Deep Teal'] },
      { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'Exbolt 65'] }
    ],
    variants: [
      { tier_1_option: 'Deep Teal', tier_2_option: 'Khung không dây', sku_code: 'S1', stock: 5, ...noString },
      { tier_1_option: 'Deep Teal', tier_2_option: 'Exbolt 65', sku_code: 'S2', stock: 5, ...string }
    ]
  } as Product;
}

function mount(p: Product, tier1 = 'Deep Teal') {
  const noop = () => {};
  return render(
    <StringingAssistant
      product={p} isRacket hasStringingVariation
      stringingVariation={{ tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'Exbolt 65'] }} stringingTierIndex={2}
      isDynamicStringingActive activeStringValue="" selectedTier1={tier1} selectedTier2=""
      withStringing selectedString={null} stringOptions={[]} stringOptionsError={false} tension={10.5}
      onSetSelectedTier1={noop} onSetSelectedTier2={noop} onSetWithStringing={noop} onSetSelectedString={noop} onSetTension={noop}
    />
  );
}

describe('StringingAssistant phụ phí đan theo khuyến mãi', () => {
  afterEach(cleanup);

  it('khuyến mãi +180.000đ (computedPrice ×0,9 cả hai phía)', () => {
    const { container } = mount(makeProduct({ price: 1100000, computedPrice: 990000 }, { price: 1300000, computedPrice: 1170000 }));
    expect(container.textContent).toContain('+180.000đ');
    expect(container.textContent).not.toContain('+200.000đ');
  });

  it('không có computedPrice -> chênh theo giá gốc', () => {
    const { container } = mount(makeProduct({ price: 1100000 }, { price: 1150000 }));
    expect(container.textContent).toContain('+50.000đ');
  });

  it('giá 0 không hiện nhãn dù có computedPrice', () => {
    const { container } = mount(makeProduct({ price: 1100000, computedPrice: 990000 }, { price: 0, computedPrice: 1170000 }));
    expect(container.textContent).not.toContain('Miễn phí');
    expect(container.textContent).not.toMatch(/\d\.\d{3}đ/);
  });

  it('biến thể không khớp -> không hiện nhãn', () => {
    const { container } = mount(makeProduct({ price: 1100000, computedPrice: 990000 }, { price: 1300000, computedPrice: 1170000 }), 'Xanh');
    expect(container.textContent).not.toContain('Miễn phí');
    expect(container.textContent).not.toMatch(/\d\.\d{3}đ/);
  });
});
