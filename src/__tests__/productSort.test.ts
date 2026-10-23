import { describe, it, expect } from 'vitest';
import { sortProducts } from '../utils/productSort';
import { Product } from '../types';

const mk = (id: string, o: Partial<Product> = {}): Product =>
  ({ id, name: id, image: '', category: '', price: 100, specs: {}, description: '', ...o } as Product);
const ids = (l: Product[]) => l.map(p => p.id);

describe('sortProducts', () => {
  it('xếp còn hàng → chưa rõ tồn → hết hàng', () => {
    const r = sortProducts([mk('het', { stock: 0 }), mk('chua', { stock: undefined }), mk('con', { stock: 3 })], 'in-stock-first');
    expect(ids(r)).toEqual(['con', 'chua', 'het']);
  });
  it('giữ thứ tự API trong nhóm', () => {
    const r = sortProducts([mk('a', { stock: 0 }), mk('b', { stock: 1 }), mk('c', { stock: 0 }), mk('d', { stock: 9 })], 'in-stock-first');
    expect(ids(r)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('giá thấp → cao', () => {
    const r = sortProducts([mk('a', { price: 300 }), mk('b', { price: 100 }), mk('c', { price: 200 })], 'price-asc');
    expect(ids(r)).toEqual(['b', 'c', 'a']);
  });
  it('giá cao → thấp', () => {
    const r = sortProducts([mk('a', { price: 300 }), mk('b', { price: 100 }), mk('c', { price: 200 })], 'price-desc');
    expect(ids(r)).toEqual(['a', 'c', 'b']);
  });
  it('dùng giá khách trả thực tế (hàm giá chung)', () => {
    const r = sortProducts([mk('a', { price: 300, computedPrice: 50, originalPrice: 300 }), mk('b', { price: 100 })], 'price-asc');
    expect(ids(r)).toEqual(['a', 'b']);
  });
  it('không giá xếp cuối khi tăng giá', () => {
    const r = sortProducts([mk('x', { price: undefined }), mk('a', { price: 300 }), mk('b', { price: 100 })], 'price-asc');
    expect(ids(r)).toEqual(['b', 'a', 'x']);
  });
  it('không giá xếp cuối khi giảm giá', () => {
    const r = sortProducts([mk('x', { price: undefined }), mk('a', { price: 300 }), mk('b', { price: 100 })], 'price-desc');
    expect(ids(r)).toEqual(['a', 'b', 'x']);
  });
  it('không đổi mảng đầu vào', () => {
    const input = [mk('het', { stock: 0 }), mk('con', { stock: 3 })];
    sortProducts(input, 'in-stock-first');
    expect(ids(input)).toEqual(['het', 'con']);
  });
});
