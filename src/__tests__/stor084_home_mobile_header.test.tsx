import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import MainNav from '../components/MainNav';
import MobileBottomNav from '../features/navigation/MobileBottomNav';
import HeroBanner from '../features/home/HeroBanner';
import { STRINGING_CTA_PATH } from '../config/storefront';
import { Category, Product } from '../types';

const cls = (el: Element) => el.className.split(/\s+/).filter(Boolean);

const HEADER_CATEGORIES: Category[] = [
  { id: 1, name: 'racket', code: 'VC001491', parent_id: null, display_name: 'Vợt Cầu Lông' },
  { id: 2, name: 'shoe', code: 'VC001420', parent_id: null, display_name: 'Giày Cầu Lông' }
];

const SLIDER_PRODUCTS: Product[] = [
  {
    id: 'p1',
    slug: 'yonex-astrox-100zz',
    name: 'Vợt Cầu Lông Yonex Astrox 100ZZ Kurenai Chính Hãng',
    price: 4200000,
    originalPrice: 4600000,
    image: '/img1.png',
    category: 'Vợt Cầu Lông',
    categoryCode: 'VC001491',
    brand: 'Yonex',
    inStock: true,
    stock: 5,
    specs: {},
    description: 'Dòng vợt tấn công đỉnh cao dành cho vận động viên chuyên nghiệp.'
  },
  {
    id: 'p2',
    slug: 'lining-axforce-90',
    name: 'Vợt Cầu Lông Lining Axforce 90 Dragon Max',
    price: 3900000,
    image: '/img2.png',
    category: 'Vợt Cầu Lông',
    categoryCode: 'VC001491',
    brand: 'Lining',
    inStock: true,
    stock: 3,
    specs: {},
    description: 'Khung vợt đàn hồi cao hỗ trợ đập cầu uy lực.'
  }
];

function renderHeaderAt(pathname: string, cartCount = 2) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header
        cartCount={cartCount}
        openCart={vi.fn()}
        products={SLIDER_PRODUCTS}
        categories={HEADER_CATEGORIES}
      />
    </MemoryRouter>
  );
}

describe('STOR-084 Home page 390px header block, bottom nav, and hero size', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Header: ẩn dòng tìm kiếm dưới md chỉ trên trang chủ (/)', () => {
    it('ở "/" ẩn Main Header Row (hidden md:flex) và input tìm kiếm (hidden md:block), giữ nút Đan cước và Giỏ (N)', () => {
      renderHeaderAt('/', 3);
      const input = screen.getByPlaceholderText(/Tìm vợt Yonex/i);
      expect(cls(input)).toContain('hidden');
      expect(cls(input)).toContain('md:block');

      const mainHeaderRow = input.closest('[data-testid="header-main-row"]')!;
      expect(cls(mainHeaderRow)).toContain('hidden');
      expect(cls(mainHeaderRow)).toContain('md:flex');
      expect(cls(mainHeaderRow)).not.toContain('flex');

      expect(screen.getByRole('button', { name: 'Đan cước' })).toBeTruthy();
      expect(screen.getByText('Giỏ (3)').closest('button')).toBeTruthy();
    });

    it.each(['/catalog', '/stores'])('ở "%s" hiển thị Main Header Row và input tìm kiếm ở mobile (không có hidden)', (route) => {
      renderHeaderAt(route, 2);
      const input = screen.getByPlaceholderText(/Tìm vợt Yonex/i);
      expect(cls(input)).not.toContain('hidden');
      expect(cls(input)).not.toContain('md:block');

      const mainHeaderRow = input.closest('[data-testid="header-main-row"]')!;
      expect(cls(mainHeaderRow)).toContain('flex');
      expect(cls(mainHeaderRow)).not.toContain('hidden');
      expect(cls(mainHeaderRow)).not.toContain('md:flex');
    });
  });

  describe('MainNav: ẩn nav và stringing-strip dưới md chỉ trên trang chủ (/)', () => {
    const ITEMS = [
      { code: 'VC001491', label: 'Vợt Cầu Lông' },
      { code: 'VC001420', label: 'Giày Cầu Lông' }
    ];

    it('ở "/" cả nav Điều hướng chính và [data-testid=stringing-strip] đều có hidden md:block', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <MainNav items={ITEMS} />
        </MemoryRouter>
      );
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
      const strip = screen.getByTestId('stringing-strip');
      expect(cls(nav)).toContain('hidden');
      expect(cls(nav)).toContain('md:block');
      expect(cls(strip)).toContain('hidden');
      expect(cls(strip)).toContain('md:block');
    });

    it.each(['/catalog', '/stores'])('ở "%s" nav Điều hướng chính và [data-testid=stringing-strip] không có hidden', (route) => {
      render(
        <MemoryRouter initialEntries={[route]}>
          <MainNav items={ITEMS} />
        </MemoryRouter>
      );
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
      const strip = screen.getByTestId('stringing-strip');
      expect(cls(nav)).not.toContain('hidden');
      expect(cls(nav)).not.toContain('md:block');
      expect(cls(strip)).not.toContain('hidden');
      expect(cls(strip)).not.toContain('md:block');
    });
  });

  describe('MobileBottomNav: 4 nhãn và điểm đến theo tab Mobile của bản thiết kế', () => {
    it('hiển thị đúng thứ tự nhãn BADMINTON, Vợt & Cước, Đan Vợt O2O, Giỏ hàng và điều hướng đúng đích', () => {
      const navigate = vi.fn();
      const onOpenCart = vi.fn();
      const { container } = render(
        <MobileBottomNav pathname="/" navigate={navigate as any} cartCount={2} onOpenCart={onOpenCart} />
      );

      const buttons = Array.from(container.querySelectorAll('button'));
      const labels = buttons.map((btn) => btn.querySelector(':scope > span')?.textContent);
      expect(labels).toEqual(['BADMINTON', 'Vợt & Cước', 'Đan Vợt O2O', 'Giỏ hàng']);

      fireEvent.click(screen.getByText('BADMINTON').closest('button')!);
      expect(navigate).toHaveBeenLastCalledWith('/');

      fireEvent.click(screen.getByText('Vợt & Cước').closest('button')!);
      expect(navigate).toHaveBeenLastCalledWith(STRINGING_CTA_PATH);
      expect(STRINGING_CTA_PATH).toBe('/catalog?category=VC001491');

      fireEvent.click(screen.getByText('Đan Vợt O2O').closest('button')!);
      expect(navigate).toHaveBeenLastCalledWith('/stores');

      fireEvent.click(screen.getByText('Giỏ hàng').closest('button')!);
      expect(onOpenCart).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['/', 'BADMINTON'],
      ['/catalog', 'Vợt & Cước'],
      ['/stores', 'Đan Vợt O2O']
    ])('khi pathname="%s" thì nút "%s" có trạng thái active (text-brand-primary font-extrabold)', (pathname, activeLabel) => {
      render(<MobileBottomNav pathname={pathname} navigate={vi.fn() as any} cartCount={0} onOpenCart={vi.fn()} />);
      for (const label of ['BADMINTON', 'Vợt & Cước', 'Đan Vợt O2O']) {
        const btn = screen.getByText(label).closest('button')!;
        if (label === activeLabel) {
          expect(cls(btn)).toContain('text-brand-primary');
          expect(cls(btn)).toContain('font-extrabold');
          expect(cls(btn)).not.toContain('text-ink-secondary');
        } else {
          expect(cls(btn)).toContain('text-ink-secondary');
          expect(cls(btn)).not.toContain('text-brand-primary');
        }
      }
    });
  });

  describe('HeroBanner: hộp hero cố định 290px dưới md, tỉ lệ 1440/520 từ md, điều khiển nằm trong hộp (STOR-107)', () => {
    it('hộp max-md:h-[290px] md:aspect-[1440/520], track tuyệt đối trong hộp; dots và nút dừng là con của hộp nên không cộng thêm chiều cao', () => {
      render(
        <MemoryRouter>
          <HeroBanner />
        </MemoryRouter>
      );
      const box = screen.getByTestId('hero-banner-box');
      expect(cls(box)).toEqual(expect.arrayContaining(['overflow-hidden', 'max-md:h-[290px]', 'md:aspect-[1440/520]']));
      expect(cls(screen.getByTestId('hero-banner-track'))).toEqual(expect.arrayContaining(['absolute', 'inset-0']));
      expect(box.contains(screen.getByTestId('slider-dots'))).toBe(true);
      expect(box.contains(screen.getByTestId('slider-pause-toggle'))).toBe(true);
    });
  });
});
