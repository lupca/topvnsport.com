// @vitest-environment jsdom
// STOR-022: Header mobile -- giá gạch gợi ý, Enter/xoá từ khoá, bỏ Lối chơi, drawer.
import React from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Header from '../components/Header';
import { Category, Product } from '../types';

const mk = (id: string, extra: Partial<Product> = {}): Product => ({
  id, name: `Vot Yonex ${id}`, brand: 'Yonex', image: '', price: 145000, specs: {}, description: '', stock: 1, categoryCode: 'c1', ...extra
} as Product);
const cat = (id: number, code: string): Category => ({ id, name: code, code, parent_id: null, display_name: `Nhóm ${code}` });
const categories = [cat(1, 'c1'), cat(2, 'c2')];
const products = [mk('a'), mk('b', { categoryCode: 'c2' })];

let loc = '';
const Probe = () => { const l = useLocation(); loc = l.pathname + l.search; return null; };

function setup(prods = products, url = '/') {
  const r = render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Header cartCount={0} openCart={() => {}} products={prods} categories={categories} />
    </MemoryRouter>
  );
  return r;
}
const openDrawer = () => fireEvent.click(screen.getByLabelText('Open mobile menu'));
const input = () => screen.getByPlaceholderText(/Tìm vợt/) as HTMLInputElement;
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });
const drawerCats = () => [...screen.getByText('Danh Mục Sản Phẩm').parentElement!.querySelectorAll('button')];

beforeEach(() => {
  window.innerWidth = 390; window.innerHeight = 844;
  document.body.style.overflow = '';
});
afterEach(() => { cleanup(); document.body.style.overflow = ''; });

describe('gợi ý tìm kiếm: giá gạch', () => {
  it('S1: salePrice bằng price -> không có node line-through', () => {
    const { container } = setup([mk('a', { salePrice: 145000 })]);
    type('yonex');
    expect(screen.getByText('145.000đ')).toBeTruthy();
    expect(container.querySelector('.line-through')).toBeNull();
  });
  it('S2: có KM thật -> hiện giá gốc gạch', () => {
    const { container } = setup([mk('a', { price: 200000, originalPrice: 200000, computedPrice: 150000, hasActivePromotion: true })]);
    type('yonex');
    expect(screen.getByText('150.000đ')).toBeTruthy();
    expect(container.querySelector('.line-through')!.textContent).toBe('200.000đ');
  });
});

describe('Enter và xoá từ khoá', () => {
  it('E1: Enter trên " yonex " -> /catalog?search=yonex', () => {
    setup(); type(' yonex ');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(loc).toBe('/catalog?search=yonex');
  });
  it('E2: Enter với chuỗi toàn khoảng trắng -> không điều hướng', () => {
    setup(); type('   ');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(loc).toBe('/');
  });
  it('E3: Enter đóng dropdown gợi ý', () => {
    setup(); type('yonex');
    expect(screen.queryByText('Kết quả tìm kiếm phù hợp')).not.toBeNull();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(screen.queryByText('Kết quả tìm kiếm phù hợp')).toBeNull();
  });
  it('C1: ô rỗng -> không có nút xoá', () => {
    setup();
    expect(screen.queryByLabelText('Xoá từ khoá')).toBeNull();
  });
  it('C2: bấm nút xoá -> ô rỗng', () => {
    setup(); type('yonex');
    fireEvent.click(screen.getByLabelText('Xoá từ khoá'));
    expect(input().value).toBe('');
  });
});

describe('drawer', () => {
  it('D1: không có tiêu đề Lối Chơi và không link characteristics', () => {
    const { container } = setup(); openDrawer();
    expect(screen.queryByText(/Lối Chơi/i)).toBeNull();
    expect(container.ownerDocument.body.innerHTML).not.toContain('characteristics');
  });
  it('D2: nút danh mục không có chevron-down', () => {
    setup(); openDrawer();
    const btns = drawerCats();
    expect(btns.length).toBe(2);
    btns.forEach(b => expect(b.querySelector('svg.lucide-chevron-down')).toBeNull());
  });
  it('D3: ở /catalog?category=c2 chỉ nút c2 sáng', () => {
    setup(products, '/catalog?category=c2'); openDrawer();
    const lit = drawerCats().filter(b => b.className.includes('bg-brand-light'));
    expect(lit.map(b => b.textContent)).toEqual(['Nhóm c2']);
  });
  it('L1: mở drawer -> body overflow hidden', () => {
    setup(); openDrawer();
    expect(document.body.style.overflow).toBe('hidden');
  });
  it('L2: đóng drawer -> trả lại giá trị cũ', () => {
    document.body.style.overflow = 'scroll';
    const { container } = setup(); openDrawer();
    fireEvent.click(container.ownerDocument.querySelector('svg.lucide-x')!.closest('button')!);
    expect(document.body.style.overflow).toBe('scroll');
  });
  it('L3: unmount khi drawer mở -> trả lại overflow', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = setup(); openDrawer();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
