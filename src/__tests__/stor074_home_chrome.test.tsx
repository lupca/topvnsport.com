// @vitest-environment jsdom
// STOR-074: dải cam kết lọc theo dữ liệu, footer 4 cột như thiết kế. (Phần hero caption từ sản phẩm đã bỏ ở STOR-107: hero là banner cấu hình.)
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrustBadges from '../components/TrustBadges';
import Footer from '../components/Footer';
import { Category, Product } from '../types';

afterEach(() => cleanup());

const product = (id: string, o: Partial<Product> = {}): Product =>
  ({ id, name: `Vợt ${id}`, brand: 'Yonex', category: 'Vợt Cầu Lông', categoryCode: 'VC001491', price: 1000000, specs: {}, image: `https://pim.voma.vn/media/${id}.jpg`, ...o }) as Product;

const stringingTier = (options: string[]) => ({ tier_index: 1, name: 'Cước', options: ['Khung không dây', ...options] });

const trustText = (i: number) => screen.getByTestId('trust-row').querySelectorAll('p')[i].textContent;

describe('STOR-074 trust row lọc theo dữ liệu', () => {
  it('đủ dữ liệu -> đúng chữ thiết kế; so khớp không phân biệt hoa thường/khoảng trắng', () => {
    const products = [
      product('b1', { brand: 'YONEX', tier_variations: [stringingTier(['BG 66U', 'EXBOLT 65', 'kizuna z61'])] }),
      product('b2', { brand: 'LI-NING' }),
      product('b3', { brand: 'victor' }),
      product('b4', { brand: 'Kizuna' })
    ];
    render(<TrustBadges products={products} />);
    expect(trustText(0)).toBe('Đại lý uỷ quyền Yonex Sunrise, cam kết chính hãng Li-Ning, Victor, Kizuna. Đền gấp 10 lần nếu phát hiện hàng giả.');
    expect(trustText(1)).toBe('Tùy chọn cước BG66U, Exbolt 65, Kizuna Z61 và mức căng 9.0–13.0kg ngay khi đặt vợt.');
    expect(screen.getByRole('heading', { name: 'Giao Hỏa Tốc & Đồng Kiểm' })).toBeTruthy();
  });

  it('thiếu dữ liệu -> chỉ tên có thật; cước ngoài tầng đan (tầng màu) không tính', () => {
    const products = [
      product('c1', { brand: 'Li-Ning', tier_variations: [stringingTier(['Exbolt 65']), { tier_index: 0, name: 'Màu', options: ['BG66U'] }] })
    ];
    render(<TrustBadges products={products} />);
    expect(trustText(0)).toBe('Đại lý uỷ quyền Yonex Sunrise, cam kết chính hãng Li-Ning. Đền gấp 10 lần nếu phát hiện hàng giả.');
    expect(trustText(1)).toBe('Tùy chọn cước Exbolt 65 và mức căng 9.0–13.0kg ngay khi đặt vợt.');
  });

  it('không có dữ liệu -> không nêu tên nào', () => {
    render(<TrustBadges products={[product('d1', { brand: 'Gowin' })]} />);
    expect(trustText(0)).toBe('Đại lý uỷ quyền Yonex Sunrise. Đền gấp 10 lần nếu phát hiện hàng giả.');
    expect(trustText(1)).toBe('Tùy chọn cước và mức căng 9.0–13.0kg ngay khi đặt vợt.');
  });
});

describe('STOR-074 footer 4 cột', () => {
  const cats: Category[] = [{ id: 1491, code: 'VC001491', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Vợt Cầu Lông' }];

  it('tiêu đề theo thứ tự thiết kế, cột 4 nguyên văn, lưới 1 cột ở mobile và 4 track ở lg', () => {
    const { container } = render(
      <MemoryRouter>
        <Footer categories={cats} products={[product('e1')]} />
      </MemoryRouter>
    );
    const grid = container.querySelector('footer .bg-footer-bg > div') as HTMLElement;
    expect(Array.from(grid.querySelectorAll('h5')).map(h => h.textContent)).toEqual([
      'TOPVNSPORT — BADMINTON SPECIALTY STORE',
      'DANH MỤC CẦU LÔNG',
      'DỊCH VỤ ĐAN VỢT & BẢO HÀNH'
    ]);
    expect(grid.children).toHaveLength(3);
    expect(grid.className.split(' ')).toContain('grid-cols-1');
    expect(grid.className).toContain('lg:grid-cols-[1.5fr_1fr_1fr]');
  });
});
