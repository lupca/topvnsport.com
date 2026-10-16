// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ProductDetailPage from '../components/ProductDetailPage';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { Product, ProductVariant } from '../types';

// STOR-027: tồn gộp theo giá trị khi tầng kia chưa chọn, cước hết hàng, công tắc đan cước.
const COLORS = ['Cannon Black', 'Cannon Red'];
const STRINGS = ['Khung không dây', 'BG65', 'BG80'];

function v(color: string, str: string, price: number, stock: number | undefined): ProductVariant {
  return { tier_1_option: color, tier_2_option: str, sku_code: `${color}-${str}`, price, stock };
}

// Mô phỏng sản phẩm 337: Màu x Loại Cước.
function racket(variants: ProductVariant[]): Product {
  return {
    id: '337', slug: 'vot-337', name: 'Vợt 337', brand: 'Lining', category: 'Vợt', price: 1000000, image: 'x.jpg',
    specs: {}, description: '', reviews: [], stock: 99,
    tier_variations: [
      { tier_index: 1, name: 'Màu Sắc', options: COLORS },
      { tier_index: 2, name: 'Loại Cước', options: STRINGS }
    ],
    variants
  };
}

const grid = (black: number | undefined, red: Record<string, number>, bgDiff = [60000, 60000]) => racket([
  v('Cannon Black', 'Khung không dây', 1000000, black),
  v('Cannon Black', 'BG65', 1000000 + bgDiff[0], black),
  v('Cannon Black', 'BG80', 1100000, black),
  v('Cannon Red', 'Khung không dây', 1000000, red['Khung không dây']),
  v('Cannon Red', 'BG65', 1000000 + bgDiff[1], red.BG65),
  v('Cannon Red', 'BG80', 1100000, red.BG80)
]);

const redStock = { 'Khung không dây': 5, BG65: 5, BG80: 0 };

function renderPdp(p: Product) {
  return render(
    <MemoryRouter>
      <ProductDetailPage product={p} stringOptions={[]} onAddToCartWithSpecs={() => {}} onBackToCatalog={() => {}} />
    </MemoryRouter>
  );
}
const btn = (name: RegExp | string) => screen.getByRole('button', { name }) as HTMLButtonElement;

function mountAssistant(p: Product, tier1: string, active: string, setTier2 = vi.fn()) {
  return render(
    <StringingAssistant
      product={p} hasStringingVariation
      stringingVariation={p.tier_variations![1]} stringingTierIndex={2}
      isDynamicStringingActive={active === '' || !/khung/i.test(active)} activeStringValue={active}
      selectedTier1={tier1} selectedTier2={active} stringOptions={[]} tension={10.5}
      onSetSelectedTier1={() => {}} onSetSelectedTier2={setTier2} onSetTension={() => {}}
    />
  );
}

describe('STOR-027', () => {
  afterEach(cleanup);

  it('T1 màu mọi biến thể tồn 0: disabled khi chưa chọn tầng cước', () => {
    renderPdp(grid(0, redStock));
    const black = btn(/Cannon Black/);
    expect(black.disabled).toBe(true);
    expect(black.textContent).toContain('Hết');
  });

  it('T2 màu có biến thể tồn > 0: chọn được', () => {
    renderPdp(grid(0, redStock));
    const red = btn(/Cannon Red/);
    expect(red.disabled).toBe(false);
    expect(red.textContent).not.toContain('Hết');
  });

  it('T3 màu tồn undefined: không nhãn Hết', () => {
    renderPdp(grid(undefined, redStock));
    const black = btn(/Cannon Black/);
    expect(black.disabled).toBe(false);
    expect(black.textContent).not.toContain('Hết');
  });

  const sparse: Product = {
    id: 'sp', slug: 'sp', name: 'Áo', brand: 'Y', category: 'Áo', price: 1, image: 'x.jpg', specs: {}, description: '',
    reviews: [], stock: 20,
    tier_variations: [
      { tier_index: 1, name: 'Màu Sắc', options: ['Đỏ', 'Xanh'] },
      { tier_index: 2, name: 'Size', options: ['S', 'L'] }
    ],
    variants: [
      { tier_1_option: 'Đỏ', tier_2_option: 'S', sku_code: 'a', price: 1, stock: 3 },
      { tier_1_option: 'Xanh', tier_2_option: 'S', sku_code: 'b', price: 1, stock: 3 },
      { tier_1_option: 'Xanh', tier_2_option: 'L', sku_code: 'c', price: 1, stock: 3 }
    ]
  };

  it('T4 giá trị không tạo được tổ hợp: disabled', () => {
    renderPdp(sparse);
    fireEvent.click(btn('Đỏ'));
    expect(btn(/^L/).disabled).toBe(true);
  });

  it('T5 giá trị không tạo được tổ hợp: không nhãn Hết, không Chưa rõ tồn kho', () => {
    renderPdp(sparse);
    fireEvent.click(btn('Đỏ'));
    expect(btn(/^L/).textContent).not.toContain('Hết');
    expect(document.body.textContent).not.toContain('Chưa rõ tồn kho');
  });

  it('T6 cước tồn 0 theo màu: nhãn Hết', () => {
    const { getByText } = mountAssistant(grid(0, redStock), 'Cannon Red', '');
    expect(getByText('BG80').closest('[aria-disabled]')!.textContent).toContain('Hết');
    expect(getByText('BG65').closest('div.p-2\\.5')!.textContent).not.toContain('Hết');
  });

  it('T7 cước tồn 0: aria-disabled, không gọi setter', () => {
    const setter = vi.fn();
    const { getByText } = mountAssistant(grid(0, redStock), 'Cannon Red', '', setter);
    const row = getByText('BG80').closest('[aria-disabled]')!;
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
    expect(setter).not.toHaveBeenCalled();
    fireEvent.click(getByText('BG65'));
    expect(setter).toHaveBeenCalledWith('BG65');
  });

  it('T8 chưa chọn màu, phụ thu lệch: không hiện số', () => {
    const { getByText } = mountAssistant(grid(5, redStock, [60000, 80000]), '', '');
    const row = getByText('BG65').closest('div.p-2\\.5')!;
    expect(row.textContent).not.toMatch(/\+\d/);
    expect(row.textContent).not.toContain('Miễn phí');
  });

  it('T9 chưa chọn màu, phụ thu đều: hiện số', () => {
    const { getByText } = mountAssistant(grid(5, redStock), '', '');
    expect(getByText('BG65').closest('div.p-2\\.5')!.textContent).toContain('+60.000đ');
  });

  it('T10 mở trang: công tắc đan cước tắt', () => {
    renderPdp(grid(0, redStock));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('T11 bật công tắc: setter tầng cước nhận chuỗi rỗng', () => {
    const setter = vi.fn();
    mountAssistant(grid(5, redStock), 'Cannon Red', 'Khung không dây', setter);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(setter).toHaveBeenCalledWith('');
  });
});
