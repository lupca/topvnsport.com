import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import MainNav from '../components/MainNav';
import MobileBottomNav from '../features/navigation/MobileBottomNav';
import BadmintonCenterSlider from '../features/home/BadmintonCenterSlider';
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

      const mainHeaderRow = input.closest('div.max-w-7xl')!;
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

      const mainHeaderRow = input.closest('div.max-w-7xl')!;
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

  describe('BadmintonCenterSlider: thu gọn caption bar và controls dưới md để tổng chiều cao <= 452px, giữ nguyên md+', () => {
    it('caption bar nằm ngang ở mobile (flex-row items-center px-3 py-2), ẩn eyebrow & sub dưới md, nút CTA gọn (w-auto px-3 py-1.5 text-[11.5px]) và controls mt-2 md:mt-4', () => {
      const { container } = render(
        <MemoryRouter>
          <BadmintonCenterSlider products={SLIDER_PRODUCTS} />
        </MemoryRouter>
      );

      const captionBar = screen.getByTestId('slider-caption-bar');
      expect(cls(captionBar)).toEqual(
        expect.arrayContaining(['flex-row', 'items-center', 'md:flex-row', 'md:items-center', 'gap-2.5', 'md:gap-5', 'px-3', 'py-2', 'md:px-6', 'md:py-4'])
      );
      expect(cls(captionBar)).not.toContain('flex-col');
      expect(cls(captionBar)).not.toContain('items-stretch');
      expect(cls(captionBar)).not.toContain('px-4');
      expect(cls(captionBar)).not.toContain('py-3');

      const eyebrow = container.querySelector('.slide-caption-eyebrow')!;
      expect(cls(eyebrow)).toEqual(expect.arrayContaining(['hidden', 'md:block']));

      const title = container.querySelector('.slide-caption-title')!;
      expect(cls(title)).toEqual(expect.arrayContaining(['text-[13px]', 'md:text-[19px]', 'line-clamp-1', 'md:line-clamp-1']));
      expect(cls(title)).not.toContain('text-[17px]');
      expect(cls(title)).not.toContain('line-clamp-2');

      const sub = container.querySelector('.slide-caption-sub')!;
      // md:line-clamp-1 đặt display: -webkit-box ở md+; không dùng md:block vì sẽ ghi đè display: -webkit-box ở 1440px
      expect(cls(sub)).toEqual(expect.arrayContaining(['hidden', 'md:line-clamp-1']));
      expect(cls(sub)).not.toContain('md:block');

      const cta = screen.getByTestId('slider-cta');
      expect(cls(cta)).toEqual(
        expect.arrayContaining(['w-auto', 'md:w-auto', 'px-3', 'py-1.5', 'md:px-5', 'md:py-[11px]', 'text-[11.5px]', 'md:text-[13px]'])
      );
      expect(cls(cta)).not.toContain('w-full');

      const controls = container.querySelector('.slider-controls')!;
      expect(cls(controls)).toEqual(expect.arrayContaining(['mt-2', 'md:mt-4']));
      expect(cls(controls)).not.toContain('mt-4');
    });
  });
});
