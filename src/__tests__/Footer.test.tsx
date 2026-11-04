// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../components/Footer';
import { getVisibleMainNav, STRINGING_CTA_PATH } from '../config/storefront';
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

// Thông tin cửa hàng đã được duyệt (04/11): địa chỉ, hotline công khai, giờ hotline, gian hàng Shopee.
const BRAND = 'TOPVNSPORT — BADMINTON SPECIALTY STORE';
const ADDRESS = 'Số 1, ngõ 141/3, phố Lê Văn Hiến, Phường Đông Ngạc, Hà Nội';
const HOTLINE = '097 6007006';
const HOURS = '08:00 - 22:00';
const SHOPEE = 'https://shopee.vn/shop/1406345225';
const PHONE_RE = /(?:\+84|0)(?:[\s.-]?\d){8,10}/g;
const HOURS_RE = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g;
const ADDRESS_RE = /ngõ|phố|phường|quận/i;
const PLACEHOLDER_RE = /lorem|0981\.234\.567|example\.com|xxx|đang cập nhật/i;

// Phần tử sâu nhất có chữ khớp re (một "dòng" chữ khách thấy).
const linesMatching = (root: HTMLElement, re: RegExp) =>
  Array.from(root.querySelectorAll('*'))
    .filter(el => re.test(el.textContent ?? '') && !Array.from(el.children).some(c => re.test(c.textContent ?? '')))
    .map(el => el.textContent);

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
    for (const title of [BRAND, 'DANH MỤC CẦU LÔNG', 'DỊCH VỤ ĐAN VỢT']) {
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

  test('cột DỊCH VỤ ĐAN VỢT chỉ có link đan cước -> STRINGING_CTA_PATH; không có tiêu đề BẢO HÀNH', () => {
    renderFooter();
    const links = within(column('DỊCH VỤ ĐAN VỢT')).getAllByRole('link');
    expect(links.map(a => [a.textContent, a.getAttribute('href')])).toEqual([['Cấu hình cước đan trực tuyến', STRINGING_CTA_PATH]]);
    expect(screen.queryByRole('heading', { name: /BẢO HÀNH/i })).toBeNull();
  });

  test('cột thương hiệu: dòng đại lý, địa chỉ, hotline tel: kèm giờ hotline, Shopee mở tab mới, link /stores', () => {
    renderFooter();
    const col = column(BRAND);
    expect(Array.from(col.querySelectorAll('p')).map(p => p.textContent)).toEqual([
      'Đại lý uỷ quyền Yonex Sunrise.',
      ADDRESS,
      `Hotline tư vấn: ${HOTLINE} (${HOURS})`,
      'Gian hàng trên Shopee',
      'Cửa hàng trải nghiệm'
    ]);
    const tel = within(col).getByRole('link', { name: HOTLINE });
    expect(tel.getAttribute('href')).toBe('tel:0976007006');
    const shopee = within(col).getByRole('link', { name: 'Gian hàng trên Shopee' });
    expect(shopee.getAttribute('href')).toBe(SHOPEE);
    expect(shopee.getAttribute('target')).toBe('_blank');
    expect(shopee.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(col).getByRole('link', { name: 'Cửa hàng trải nghiệm' }).getAttribute('href')).toBe('/stores');
  });

  test('toàn footer chỉ có các link đã duyệt: không mạng xã hội, email, trang chính sách', () => {
    const { container } = renderFooter();
    const hrefs = Array.from(container.querySelectorAll('footer a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['tel:0976007006', SHOPEE, '/stores', '/catalog?category=VC001491', '/catalog?category=VC001427', STRINGING_CTA_PATH]);
    const html = (container.querySelector('footer') as HTMLElement).outerHTML;
    expect(html).not.toMatch(/facebook|fb\.com|zalo|youtube|youtu\.be|tiktok|mailto:|@/i);
  });

  test('không có chữ giữ chỗ, bản quyền, mã số thuế/ĐKKD', () => {
    const { container } = renderFooter();
    const footer = container.querySelector('footer') as HTMLElement;
    expect(footer.outerHTML).not.toMatch(PLACEHOLDER_RE);
    expect(footer.textContent).not.toMatch(/©|ĐKKD|GPKD|MST|mã số thuế|đăng ký kinh doanh|giấy phép kinh doanh/i);
  });

  test('khuôn số điện thoại, giờ, địa chỉ: mỗi loại chỉ có đúng một giá trị đã duyệt', () => {
    const { container } = renderFooter();
    const footer = container.querySelector('footer') as HTMLElement;
    const text = footer.textContent ?? '';
    expect(text.match(PHONE_RE)).toEqual([HOTLINE]);
    expect(Array.from(footer.querySelectorAll('a[href^="tel:"]')).map(a => a.getAttribute('href'))).toEqual(['tel:0976007006']);
    expect(text.match(HOURS_RE)).toEqual([HOURS]);
    expect(linesMatching(footer, ADDRESS_RE)).toEqual([ADDRESS]);
  });

  test('index.css @theme có --color-footer-bg: #111111', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const theme = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')));
    expect(theme).toContain('--color-footer-bg: #111111;');
  });
});
