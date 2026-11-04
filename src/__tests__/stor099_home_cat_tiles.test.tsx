// @vitest-environment jsdom
// STOR-099: ô danh mục trang chủ -- ảnh + phụ đề thương hiệu từ dữ liệu VOMA thật; thiếu thì ẩn phần đó (không hộp rỗng).
// Sản phẩm dựng từ prod_products.fixture.json (id/tier/variant thật) qua mapPmiProduct thật.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import fixture from './fixtures/prod_products.fixture.json';

const real = [...fixture.one_tier_products, ...fixture.two_tier_products] as any[];
const categories = [
  { id: 1, name: 'Vợt', code: 'vot', parent_id: null, display_name: 'Thể Thao > Vợt' },
  { id: 2, name: 'Giày', code: 'giay', parent_id: null, display_name: 'Thể Thao > Giày' },
  { id: 3, name: 'Áo', code: 'ao', parent_id: null, display_name: 'Thể Thao > Áo' },
] as any[];

// Dạng PmiProduct như API: media cover, attribute_values brand, variants có stock/price.
function pmi(i: number, o: { cat: number; brand?: string; image?: string; stock?: number }) {
  const src = real[i];
  return mapPmiProduct(
    {
      id: src.id,
      name: `SP ${src.id}`,
      voma_category_id: o.cat,
      tier_variations: src.tier_variations,
      variants: src.variants.map((v: any, k: number) => ({ ...v, id: src.id * 1000 + k, price: 100000, stock: o.stock ?? 5 })),
      media: o.image ? [{ image_url: o.image, is_cover: true, display_order: 1 }] : [],
      attribute_values: o.brand === undefined ? [] : [{ id: src.id, attribute: { code: 'brand', name: 'Thương hiệu' }, value_string: o.brand }],
    } as any,
    categories,
  )!;
}

function renderHome(products: any[]) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(cleanup);
const tile = (code: string) => screen.getByTestId(`cat-tile-${code}`);
const sub = (code: string) => within(tile(code)).queryByTestId('cat-tile-sub');
const box = (code: string) => tile(code).querySelector('.aspect-square');

describe('STOR-099 ô danh mục: ảnh + phụ đề từ VOMA', () => {
  it('fixture có đủ sản phẩm thật để dựng', () => {
    expect(real.length).toBeGreaterThanOrEqual(6);
  });

  it('ô có ảnh + thương hiệu: <img> object-contain đúng src, phụ đề nối " · ", đã trim, gộp không phân biệt hoa thường', () => {
    renderHome([
      pmi(0, { cat: 1, brand: ' Yonex ', image: '/img/a.jpg' }),
      pmi(1, { cat: 1, brand: 'YONEX', image: '/img/b.jpg' }),
      pmi(2, { cat: 1, brand: 'Li-Ning', image: '/img/c.jpg' }),
    ]);
    const img = within(tile('vot')).getByRole('img');
    expect(img.getAttribute('src')).toBe('/img/a.jpg');
    expect(img.className.split(/\s+/)).toContain('object-contain');
    expect(box('vot')).not.toBeNull();
    expect(sub('vot')!.textContent).toBe('Yonex · Li-Ning');
    expect(sub('vot')!.className.split(/\s+/)).toEqual(expect.arrayContaining(['hidden', 'md:block']));
  });

  it('ô không có thương hiệu: không cat-tile-sub (vẫn có ảnh)', () => {
    renderHome([pmi(0, { cat: 1, image: '/img/a.jpg' }), pmi(1, { cat: 1, brand: '   ', image: '/img/b.jpg' }), pmi(2, { cat: 1, brand: 'No Brand' })]);
    expect(sub('vot')).toBeNull();
    expect(within(tile('vot')).getByRole('img')).toBeTruthy();
  });

  it('ô không có ảnh: không <img>, không khung ảnh (kể cả khi SP hết hàng cũng không có ảnh)', () => {
    renderHome([pmi(0, { cat: 1, brand: 'Yonex' }), pmi(1, { cat: 1, brand: 'Yonex', stock: 0 })]);
    expect(within(tile('vot')).queryByRole('img')).toBeNull();
    expect(box('vot')).toBeNull();
    expect(sub('vot')!.textContent).toBe('Yonex');
  });

  // STOR-132: Published = hiển thị; ảnh/thương hiệu lấy từ SP thật của ngành, SP còn hàng đứng trước.
  it('ảnh: SP còn hàng được ưu tiên; ngành chỉ có ảnh ở SP hết hàng thì dùng ảnh đó', () => {
    renderHome([pmi(0, { cat: 1, image: '/img/het.jpg', stock: 0 }), pmi(1, { cat: 1, image: '/img/con.jpg' }), pmi(2, { cat: 2 }), pmi(3, { cat: 2, image: '/img/g-het.jpg', stock: 0 })]);
    expect(within(tile('vot')).getByRole('img').getAttribute('src')).toBe('/img/con.jpg');
    expect(within(tile('giay')).getByRole('img').getAttribute('src')).toBe('/img/g-het.jpg');
  });

  it('thương hiệu của SP hết hàng vào phụ đề, sau thương hiệu SP còn hàng', () => {
    renderHome([pmi(0, { cat: 1, brand: 'HetHang', image: '/img/b.jpg', stock: 0 }), pmi(1, { cat: 1, brand: 'Yonex', image: '/img/a.jpg' })]);
    expect(sub('vot')!.textContent).toBe('Yonex · HetHang');
  });

  it('ngành chỉ có SP hết hàng: ô hiện với ảnh và thương hiệu thật của ngành đó', () => {
    renderHome([pmi(0, { cat: 1, brand: 'Yonex', image: '/img/a.jpg' }), pmi(1, { cat: 3, brand: 'Victor', image: '/img/ao-het.jpg', stock: 0 })]);
    expect(within(tile('ao')).getByRole('img').getAttribute('src')).toBe('/img/ao-het.jpg');
    expect(sub('ao')!.textContent).toBe('Victor');
  });

  it('mọi ảnh lỗi tải -> ô bỏ khung ảnh', () => {
    renderHome([pmi(0, { cat: 1, brand: 'Yonex', image: '/img/x.jpg' })]);
    fireEvent.error(within(tile('vot')).getByRole('img'));
    expect(within(tile('vot')).queryByRole('img')).toBeNull();
    expect(box('vot')).toBeNull();
  });

  it('ô có ảnh đứng trước ô không ảnh; mỗi nhóm giữ thứ tự getCategoriesSortedByCount (đếm giảm dần)', () => {
    // vot 3 SP (không ảnh), giay 2 SP (ảnh), ao 1 SP (ảnh) -> thứ tự gốc vot, giay, ao
    renderHome([
      pmi(0, { cat: 1 }), pmi(1, { cat: 1 }), pmi(2, { cat: 1 }),
      pmi(3, { cat: 2, image: '/img/g1.jpg' }), pmi(4, { cat: 2, image: '/img/g2.jpg' }),
      pmi(5, { cat: 3, image: '/img/a1.jpg' }),
    ]);
    const order = within(screen.getByTestId('category-tile-grid')).getAllByTestId(/^cat-tile-(?!sub$)/).map(e => e.getAttribute('data-testid'));
    expect(order).toEqual(['cat-tile-giay', 'cat-tile-ao', 'cat-tile-vot']);
  });

  it('tên giữ text-ink-primary trên bg-white; không chip số lượng', () => {
    renderHome([pmi(0, { cat: 1, brand: 'Yonex', image: '/img/a.jpg' })]);
    expect(tile('vot').className.split(/\s+/)).toContain('bg-white');
    expect(tile('vot').querySelector('h3')!.className.split(/\s+/)).toContain('text-ink-primary');
    expect(tile('vot').textContent).not.toMatch(/sản phẩm|\(\d+\)/);
  });

  it('không còn cat-tile-placeholder', () => {
    renderHome([pmi(0, { cat: 1 })]);
    expect(screen.queryByTestId('cat-tile-placeholder')).toBeNull();
  });
});
