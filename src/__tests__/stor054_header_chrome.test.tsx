// @vitest-environment jsdom
// STOR-054: thanh đen trên cùng + header (nút Tìm kiếm, Tư vấn Đan Cước, giỏ đen) theo /design/index.html.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import Header from '../components/Header';
import { Category, Product } from '../types';

const products = [{ id: 'a', name: 'Vot Yonex a', brand: 'Yonex', image: '', price: 145000, specs: {}, description: '', stock: 1, categoryCode: 'c1' } as Product];
const categories: Category[] = [{ id: 1, name: 'c1', code: 'c1', parent_id: null, display_name: 'Nhóm c1' }];

let loc = '';
const Probe = () => { const l = useLocation(); loc = l.pathname + l.search; return null; };

function setup(openCart = vi.fn()) {
  const r = render(
    <MemoryRouter initialEntries={['/']}>
      <Probe />
      <Header cartCount={3} openCart={openCart} products={products} categories={categories} />
    </MemoryRouter>
  );
  return { ...r, openCart, text: r.container.textContent || '' };
}
const input = () => screen.getByPlaceholderText('Tìm vợt Yonex, Lining, cước đan, giày cầu lông...') as HTMLInputElement;
const cartButtons = () => screen.getAllByLabelText('Giỏ hàng');

afterEach(() => { cleanup(); loc = ''; });

describe('T1/T2 thanh đen trên cùng', () => {
  it('nền đen, giữ lời cam kết hiện tại, link đặt lịch và hotline', () => {
    setup();
    const bar = screen.getByTestId('topbar');
    expect(bar.className).toContain('bg-ink-primary');
    expect(bar.textContent).toContain('Cam kết 100% chính hãng - Đền gấp 10 nếu giả');
    expect(within(bar).getByText('Đặt lịch đan vợt O2O').getAttribute('href')).toBe('/stores');
    expect(within(bar).getByText('Hotline: 097 6007006').getAttribute('href')).toBe('tel:0976007006');
  });
  it('bấm Đặt lịch đan vợt O2O và pill showroom -> /stores', () => {
    setup();
    fireEvent.click(screen.getByText('Đặt lịch đan vợt O2O'));
    expect(loc).toBe('/stores');
    cleanup(); setup();
    fireEvent.click(screen.getByText('Showroom Hà Nội · Đan vợt lấy ngay 30p'));
    expect(loc).toBe('/stores');
  });
  it('dải đen mobile ghi Đan vợt chuẩn quốc tế 30p', () => {
    setup();
    const strip = screen.getByTestId('mobile-top-strip');
    expect(strip.className).toContain('bg-ink-primary');
    expect(strip.textContent).toBe('Đan vợt chuẩn quốc tế 30p');
  });
});

describe('T3 bỏ lời hứa không có dữ liệu', () => {
  it('không chấm xanh, không mở cửa, không bảo hành/đơn hàng, không Đền 1000%', () => {
    const { container, text } = setup();
    expect(container.querySelector('.live-dot')).toBeNull();
    for (const s of ['Đang mở cửa', 'mở cửa', 'Tra cứu bảo hành', 'Kiểm tra đơn hàng', 'Đền 1000%']) {
      expect(text).not.toContain(s);
    }
  });
});

describe('T4 nút Tìm kiếm', () => {
  it('" yonex " + Tìm kiếm -> /catalog?search=yonex', () => {
    setup();
    fireEvent.change(input(), { target: { value: ' yonex ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(loc).toBe('/catalog?search=yonex');
  });
  it('ô trống -> không điều hướng', () => {
    setup();
    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(loc).toBe('/');
  });
});

describe('T5 nút đan cước', () => {
  it('Tư vấn Đan Cước -> /stores', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tư vấn Đan Cước' }));
    expect(loc).toBe('/stores');
  });
  it('Đan cước (mobile) -> /stores', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Đan cước' }));
    expect(loc).toBe('/stores');
  });
});

describe('T6 giỏ đen', () => {
  it('desktop: pill đen "Giỏ hàng" + số 3, bấm gọi openCart một lần', () => {
    const { openCart } = setup();
    const pill = cartButtons().find(b => b.textContent === 'Giỏ hàng3')!;
    expect(pill.className).toContain('bg-ink-primary');
    fireEvent.click(pill);
    expect(openCart).toHaveBeenCalledTimes(1);
  });
  it('mobile: pill đen "Giỏ (3)", bấm gọi openCart một lần', () => {
    const { openCart } = setup();
    const pill = cartButtons().find(b => b.textContent === 'Giỏ (3)')!;
    expect(pill.className).toContain('bg-ink-primary');
    fireEvent.click(pill);
    expect(openCart).toHaveBeenCalledTimes(1);
  });
});

describe('T7 bỏ dòng Xu hướng, Sản Phẩm, tim', () => {
  it('không có Xu hướng, Sản Phẩm, svg.lucide-heart', () => {
    const { container, text } = setup();
    expect(text).not.toContain('Xu hướng');
    expect(text).not.toContain('Sản Phẩm');
    expect(container.querySelector('svg.lucide-heart')).toBeNull();
  });
});
