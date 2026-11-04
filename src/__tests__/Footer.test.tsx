// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../components/Footer';
import { getVisibleMainNav } from '../config/storefront';
import { Category, Product } from '../types';

function cat(id: number, code: string, name: string): Category {
  return { id, code, name, parent_id: null, display_name: `Thể Thao > Cầu Lông > ${name}` };
}

function makeProduct(id: string, categoryCode: string): Product {
  return { id, name: 'Sản phẩm', brand: 'Yonex', image: '', categoryCode, price: 500000, specs: {}, description: '', stock: 1 };
}

// Ngành live trên VOMA + Giày (VC001427), mỗi ngành có một sản phẩm.
const CATS = [cat(1491, 'VC001491', 'Vợt Cầu Lông'), cat(1427, 'VC001427', 'Giày Cầu Lông'), cat(1489, 'VC001489', 'Lưới Cầu Lông'), cat(5, 'VC000005', 'Tất')];
const PRODUCTS = CATS.map(c => makeProduct(c.code, c.code));

function renderFooter(categories = CATS, products = PRODUCTS) {
  return render(
    <MemoryRouter>
      <Footer categories={categories} products={products} />
    </MemoryRouter>
  );
}

const column = (title: string) => screen.getByRole('heading', { name: title }).parentElement as HTMLElement;

describe('Footer', () => {
  afterEach(() => cleanup());

  test('phần tử con đầu tiên của <footer> là dải cam kết: 4 mục border-l-[3px], lưới 1/2/4 cột', () => {
    const { container } = renderFooter();
    const footer = container.querySelector('footer') as HTMLElement;
    const trust = footer.firstElementChild as HTMLElement;
    expect(trust.getAttribute('data-testid')).toBe('trust-row');
    const grid = trust.firstElementChild as HTMLElement;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-4');
    expect(grid.children).toHaveLength(4);
    for (const item of Array.from(grid.children)) expect(item.className).toContain('border-l-[3px]');
    // Fixture chỉ có Yonex, không có tầng cước: chỉ tên có trong dữ liệu được hiện (spec 37f60f5b).
    expect(trust.textContent).not.toMatch(/BG66|Exbolt|Kizuna|Victor|Li-Ning/);
    expect(trust.textContent).toContain('Đại lý uỷ quyền Yonex Sunrise.');
    expect(trust.textContent).toContain('Tùy chọn cước và mức căng');
  });

  test('lưới footer lg có đúng số track bằng số cột render (không để track trống)', () => {
    const { container, unmount } = renderFooter();
    const grid = () => container.querySelector('footer .bg-footer-bg > div') as HTMLElement;
    expect(grid().children).toHaveLength(3);
    expect(grid().className).toContain('lg:grid-cols-[1.5fr_1fr_1fr]');
    expect(grid().className).not.toContain('lg:grid-cols-[1.5fr_1fr]');
    unmount();
    const hidden = renderFooter([cat(1489, 'VC001489', 'Lưới Cầu Lông')], [makeProduct('n1', 'VC001489')]);
    const grid2 = hidden.container.querySelector('footer .bg-footer-bg > div') as HTMLElement;
    expect(grid2.children).toHaveLength(2);
    expect(grid2.className).toContain('lg:grid-cols-[1.5fr_1fr]');
    expect(grid2.className).not.toContain('lg:grid-cols-[1.5fr_1fr_1fr]');
  });

  test('có khối bg-footer-bg với ba cột, không có cột tiêu chuẩn UI/UX', () => {
    const { container } = renderFooter();
    expect(container.querySelector('footer .bg-footer-bg')).not.toBeNull();
    for (const title of ['TOPVNSPORT — BADMINTON SPECIALTY STORE', 'DANH MỤC CẦU LÔNG', 'DỊCH VỤ ĐAN VỢT & BẢO HÀNH']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: /UI\/UX/ })).toBeNull();
    expect(container.textContent).not.toMatch(/VOMA|PIM|Đồng bộ|tương phản|AAA/i);
    expect(container.textContent).toContain('097 6007006 (08:00 - 22:00)');
  });

  test('cột DANH MỤC CẦU LÔNG = footerLabel của getVisibleMainNav theo thứ tự, link dùng MÃ ngành', () => {
    renderFooter();
    const links = within(column('DANH MỤC CẦU LÔNG')).getAllByRole('link');
    const expected = getVisibleMainNav(CATS).filter(e => e.footerLabel);
    expect(links.map(a => a.textContent)).toEqual(expected.map(e => e.footerLabel));
    expect(links.map(a => a.textContent)).toEqual(['Vợt Cầu Lông Yonex / Li-Ning', 'Giày Cầu Lông Chuyên Dụng']);
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/catalog?category=VC001491', '/catalog?category=VC001427']);
  });

  test('ngành không có sản phẩm thì không vào cột danh mục', () => {
    renderFooter(CATS, [makeProduct('r1', 'VC001491')]);
    expect(within(column('DANH MỤC CẦU LÔNG')).getAllByRole('link').map(a => a.textContent)).toEqual(['Vợt Cầu Lông Yonex / Li-Ning']);
  });

  test('không ngành nào khớp MAIN_NAV -> không render cột DANH MỤC CẦU LÔNG', () => {
    renderFooter([cat(1489, 'VC001489', 'Lưới Cầu Lông')], [makeProduct('n1', 'VC001489')]);
    expect(screen.queryByRole('heading', { name: 'DANH MỤC CẦU LÔNG' })).toBeNull();
  });

  test('cột dịch vụ chỉ có hai link: đan cước -> ngành vợt, cửa hàng -> /stores', () => {
    renderFooter();
    const links = within(column('DỊCH VỤ ĐAN VỢT & BẢO HÀNH')).getAllByRole('link');
    expect(links.map(a => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Cấu hình cước đan trực tuyến', '/catalog?category=VC001491'],
      ['Hệ thống cửa hàng trải nghiệm', '/stores']
    ]);
  });

  test('không có dòng bản quyền/ĐKKD/email bịa', () => {
    const { container } = renderFooter();
    expect(container.textContent).not.toContain('©');
    expect(container.textContent).not.toContain('ĐKKD');
    expect(container.textContent).not.toContain('support@');
  });

  test('index.css @theme có --color-footer-bg: #111111', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const theme = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')));
    expect(theme).toContain('--color-footer-bg: #111111;');
  });
});
