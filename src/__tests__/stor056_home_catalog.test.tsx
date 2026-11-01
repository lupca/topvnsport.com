// @vitest-environment jsdom
// STOR-056: trang chủ — chip "Tất cả" + chip ngành lọc tại chỗ, kệ SẢN PHẨM NỔI BẬT (thương hiệu / O2O / sắp xếp / bộ đếm),
// ô danh mục ảnh thật từ VOMA. Không lối đánh, không dữ liệu bịa.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import HomePage from '../features/home/HomePage';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { NO_IMAGE_URL } from '../services/sport-api/constants';
import { SORT_OPTIONS, sortProducts } from '../utils/productSort';

const STRING_TIER = { tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'BG 65'] };
const prod = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: `SP ${id}`, brand: 'BrandA', image: `/img/${id}.jpg`, price: 100000, specs: {}, stock: 1, categoryCode: 'c1', ...extra }) as any;
const categories = [
  { id: 1, name: 'Vợt', code: 'c1', parent_id: null, display_name: 'Thể Thao > Vợt' },
  { id: 2, name: 'Giày', code: 'c2', parent_id: null, display_name: 'Thể Thao > Giày' },
  { id: 3, name: 'Cước', code: 'c3', parent_id: null, display_name: 'Thể Thao > Cước' },
];

const Probe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};
const Here = () => <div data-testid="here">{useLocation().pathname}</div>;

function renderHome(products: any[], cats: any[] = categories) {
  const store = configureStore({
    reducer: { appData: (state = { products, categories: cats }) => state, cart: cartReducer, catalog: catalogReducer },
    preloadedState: {
      cart: { items: [], isOpen: false, quickViewProduct: null },
      catalog: { selectedCategory: null, searchKeyword: '', priceRange: [0, 10000000], sortBy: 'featured' },
    },
  } as any);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<><HomePage /><Here /></>} />
          <Route path="/catalog" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

afterEach(cleanup);

const shelf = () => screen.getByTestId('instock-shelf');
const names = () => within(screen.getByTestId('featured-grid')).queryAllByText(/^SP \w+$/).map(e => e.textContent);
const counter = () => screen.getByTestId('result-counter').textContent;

describe('STOR-056 chip danh mục', () => {
  const ps = [
    prod('1'),
    prod('2', { categoryCode: 'c2' }),
    prod('3', { categoryCode: 'c2', stock: 0 }),
    prod('4', { categoryCode: undefined }),
    prod('5', { categoryCode: 'c3', stock: 0 }),
  ];

  it('chip đầu là "Tất cả", số = SP còn hàng = Y của bộ đếm lúc đầu', () => {
    renderHome(ps);
    const first = within(screen.getByTestId('cate-select-bar')).getAllByRole('tab')[0];
    expect(first).toBe(screen.getByTestId('cate-pill-ALL'));
    expect(first.textContent).toBe('Tất cả(3)');
    expect(counter()).toBe('Hiển thị 3 / 3 sản phẩm');
  });

  it('chip ngành đếm SP còn hàng; ngành 0 còn hàng bị ẩn', () => {
    renderHome(ps);
    expect(screen.getByTestId('cate-pill-c1').textContent).toBe('Vợt(1)');
    expect(screen.getByTestId('cate-pill-c2').textContent).toBe('Giày(1)');
    expect(screen.queryByTestId('cate-pill-c3')).toBeNull();
  });

  it('"Tất cả" đang chọn lúc đầu, kiểu đen active; chip khác không', () => {
    renderHome(ps);
    const all = screen.getByTestId('cate-pill-ALL');
    expect(all.getAttribute('aria-selected')).toBe('true');
    expect(all.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-ink-primary', 'text-white']));
    expect(screen.getByTestId('cate-pill-c2').className.split(/\s+/)).not.toContain('bg-ink-primary');
  });

  it('bấm chip ngành: chỉ SP ngành đó, chip đó thành active, URL vẫn /', () => {
    renderHome(ps);
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(names()).toEqual(['SP 2']);
    expect(screen.getByTestId('cate-pill-c2').className.split(/\s+/)).toContain('bg-ink-primary');
    expect(screen.getByTestId('cate-pill-ALL').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId('here').textContent).toBe('/');
    expect(screen.queryByTestId('loc')).toBeNull();
    fireEvent.click(screen.getByTestId('cate-pill-ALL'));
    expect(names()).toEqual(['SP 1', 'SP 2', 'SP 4']);
  });
});

describe('STOR-056 kệ SẢN PHẨM NỔI BẬT', () => {
  it('h2 "SẢN PHẨM NỔI BẬT", không nút "Xem tất cả"', () => {
    renderHome([prod('1')]);
    expect(within(shelf()).getByRole('heading', { level: 2 }).textContent).toBe('SẢN PHẨM NỔI BẬT');
    expect(within(shelf()).queryByText(/Xem tất cả/i)).toBeNull();
  });

  it('không playstyle-filter-bar / chip lối đánh, kể cả khi SP có characteristics', () => {
    renderHome([prod('1', { name: 'Vợt Astrox 88D', characteristics: 'Tấn Công', specs: { balance: 305 } })]);
    expect(screen.queryByTestId('playstyle-filter-bar')).toBeNull();
    expect(screen.queryAllByTestId(/^playstyle-chip-/)).toHaveLength(0);
    expect(within(screen.getByTestId('quick-filter-bar')).queryByText(/Tấn Công|Phản Tạt|Toàn Diện/)).toBeNull();
  });

  it('mã nguồn HomePage không gọi inferRacketPlayStyle', () => {
    expect(readFileSync('src/features/home/HomePage.tsx', 'utf8')).not.toMatch(/inferRacketPlayStyle/);
  });

  it('chip thương hiệu từ SP còn hàng, gộp khác hoa thường (nhãn = chuỗi gặp đầu)', () => {
    const ps = [prod('1', { brand: 'Yonex' }), prod('2', { brand: ' LI-NING ' }), prod('3', { brand: 'VICTOR', stock: 0 }), prod('4', { brand: undefined }), prod('5', { brand: 'YONEX' })];
    renderHome(ps);
    const chips = screen.queryAllByTestId(/^quick-chip-brand:/).map(e => e.textContent);
    expect(chips).toEqual(['Yonex', 'LI-NING']);
  });

  it('bấm chip thương hiệu: lọc không phân biệt hoa thường', () => {
    renderHome([prod('1', { brand: 'Yonex' }), prod('2', { brand: 'LI-NING' }), prod('3', { brand: 'YONEX' })]);
    fireEvent.click(screen.getByTestId('quick-chip-brand:yonex'));
    expect(names()).toEqual(['SP 1', 'SP 3']);
    fireEvent.click(screen.getByTestId('quick-chip-brand:li-ning'));
    expect(names()).toEqual(['SP 2']);
    fireEvent.click(screen.getByTestId('quick-chip-ALL'));
    expect(names()).toEqual(['SP 1', 'SP 2', 'SP 3']);
  });

  it('chip "Có đan cước O2O" chỉ hiện khi có SP còn hàng hasO2OStringing', () => {
    renderHome([prod('1'), prod('2', { stock: 0, tier_variations: [STRING_TIER] })]);
    expect(screen.queryByText('Có đan cước O2O')).toBeNull();
    cleanup();
    renderHome([prod('1'), prod('2', { tier_variations: [STRING_TIER] })]);
    expect(screen.getByTestId('quick-chip-O2O').textContent).toBe('Có đan cước O2O');
  });

  it('bấm "Có đan cước O2O": chỉ SP hasO2OStringing', () => {
    renderHome([prod('1'), prod('2', { tier_variations: [STRING_TIER] }), prod('3', { tier_variations: [{ tier_index: 1, name: 'Màu', options: ['Đỏ'] }] })]);
    fireEvent.click(screen.getByTestId('quick-chip-O2O'));
    expect(names()).toEqual(['SP 2']);
  });

  it('tối đa 8 thẻ; bộ đếm "Hiển thị X / Y sản phẩm" (X = thẻ hiện, Y = SP còn hàng khớp lọc)', () => {
    const ps = [
      ...Array.from({ length: 10 }, (_, i) => prod(`a${i}`)),
      ...Array.from({ length: 3 }, (_, i) => prod(`b${i}`, { categoryCode: 'c2' })),
      prod('z', { stock: 0 }),
    ];
    renderHome(ps);
    expect(names()).toHaveLength(8);
    expect(counter()).toBe('Hiển thị 8 / 13 sản phẩm');
    fireEvent.click(screen.getByTestId('cate-pill-c2'));
    expect(names()).toHaveLength(3);
    expect(counter()).toBe('Hiển thị 3 / 3 sản phẩm');
  });

  it('đổi sắp xếp theo SORT_OPTIONS: lưới đúng thứ tự sortProducts', () => {
    const ps = [prod('1', { price: 300000 }), prod('2', { price: 100000, stock: 0 }), prod('3', { price: 200000 }), prod('4', { price: 500000 })];
    renderHome(ps);
    const select = screen.getByTestId('sort-select') as HTMLSelectElement;
    expect([...select.options].map(o => o.value)).toEqual(SORT_OPTIONS.map(o => o.value));
    expect(select.value).toBe('in-stock-first');
    for (const { value } of SORT_OPTIONS) {
      fireEvent.change(select, { target: { value } });
      expect(names()).toEqual(sortProducts(ps, value).filter(p => p.stock > 0).map(p => p.name));
    }
    fireEvent.change(select, { target: { value: 'price-asc' } });
    expect(names()).toEqual(['SP 3', 'SP 1', 'SP 4']);
  });
});

describe('STOR-056 ô danh mục', () => {
  it('tối đa 8 ô, lưới grid-cols-2 lg:grid-cols-4', () => {
    const cats = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `N${i}`, code: `k${i}`, parent_id: null, display_name: `Gốc > N${i}` }));
    renderHome(cats.map((c, i) => prod(String(i), { categoryCode: c.code })), cats);
    const grid = screen.getByTestId('category-tile-grid');
    expect(grid.children).toHaveLength(8);
    expect(grid.className.split(/\s+/)).toEqual(expect.arrayContaining(['grid-cols-2', 'lg:grid-cols-4']));
  });

  it('ảnh ô = ảnh bìa của SP còn hàng trong ngành (bỏ SP hết hàng / ảnh NO_IMAGE_URL)', () => {
    renderHome([
      prod('1', { image: '/img/het.jpg', stock: 0 }),
      prod('2', { image: NO_IMAGE_URL }),
      prod('3', { image: '/img/con.jpg' }),
    ]);
    const tile = screen.getByTestId('cat-tile-c1');
    expect(within(tile).getByRole('img').getAttribute('src')).toBe('/img/con.jpg');
    expect(within(tile).queryByTestId('cat-tile-placeholder')).toBeNull();
  });

  it('không có ảnh dùng được -> placeholder trung tính, không <img>', () => {
    renderHome([prod('1', { image: NO_IMAGE_URL }), prod('2', { image: '/img/x.jpg', stock: 0 }), prod('3', { categoryCode: 'c2', image: '' })]);
    for (const code of ['c1', 'c2']) {
      const tile = screen.getByTestId(`cat-tile-${code}`);
      expect(within(tile).queryByRole('img')).toBeNull();
      expect(within(tile).getByTestId('cat-tile-placeholder')).toBeTruthy();
    }
  });

  it('ảnh lỗi tải (onError) -> placeholder trung tính', () => {
    renderHome([prod('1', { image: '/img/404.jpg' })]);
    const tile = screen.getByTestId('cat-tile-c1');
    fireEvent.error(within(tile).getByRole('img'));
    expect(within(tile).queryByRole('img')).toBeNull();
    expect(within(tile).getByTestId('cat-tile-placeholder')).toBeTruthy();
  });

  it('ô không có phụ đề, pill số lượng, chữ monogram: chỉ ảnh + tên', () => {
    renderHome([prod('1'), prod('2')]);
    const tile = screen.getByTestId('cat-tile-c1');
    expect(tile.textContent).toBe('Vợt');
    expect(tile.textContent).not.toMatch(/sản phẩm|Thể Thao|^V$/);
  });

  it('nút "XEM TẤT CẢ SẢN PHẨM CẦU LÔNG" -> /catalog', () => {
    renderHome([prod('1')]);
    fireEvent.click(screen.getByRole('button', { name: 'XEM TẤT CẢ SẢN PHẨM CẦU LÔNG' }));
    expect(screen.getByTestId('loc').textContent).toBe('/catalog');
  });
});
