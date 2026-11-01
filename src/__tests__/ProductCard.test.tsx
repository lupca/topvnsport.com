// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';
import { getProductPath } from '../utils/productSlug';

const mockUnpromotedProduct: Product = {
  id: 'prod-1',
  slug: 'vot-badminton-astrox-88d',
  name: 'Vợt Badminton Astrox 88D Pro',
  brand: 'Yonex',
  image: 'http://localhost:18100/images/astrox88d.jpg',
  category: 'Vợt',
  categoryCode: 'VC001491',
  price: 2500000,
  hasActivePromotion: false,
  characteristics: 'Tấn Công',
  specs: {
    weight: '4U',
    stiffness: 'Cứng',
    balance: 300,
    maxTension: 28
  },
  description: 'Vợt cầu lông cao cấp.',
  stock: 15
};

const mockPromotedProduct: Product = {
  id: 'prod-2',
  slug: 'giay-badminton-65z3',
  name: 'Giày Badminton Power Cushion 65Z3',
  brand: 'Yonex',
  image: 'http://localhost:18100/images/65z3.jpg',
  category: 'Giày',
  price: 2000000,
  salePrice: 1600000,
  computedPrice: 1600000,
  originalPrice: 2000000,
  percentageDiscount: 20,
  hasActivePromotion: true,
  badge: 'HOT',
  isWide: true,
  specs: {
    weight: 'Tiêu chuẩn',
    stiffness: 'Tiêu chuẩn',
    balance: 0,
    maxTension: 0
  },
  description: 'Giày cầu lông chuyên nghiệp.',
  stock: 10,
  // Đúng một biến thể -- đủ điều kiện thêm nhanh (xem getSingleSellableSku).
  variants: [{ tier_1_option: null, tier_2_option: null, sku_code: 'SKU-65Z3-TEST', price: 2000000, stock: 10 }]
};

const mockOutOfStockProduct: Product = {
  ...mockUnpromotedProduct,
  id: 'prod-3',
  stock: 0
};

describe('ProductCard component', () => {
  const onQuickViewMock = vi.fn();
  const onAddToCartMock = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders unpromoted product card with standard price and no discount badge', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockUnpromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    const regularPriceEl = screen.getByTestId('regular-price');
    expect(regularPriceEl).toBeTruthy();
    expect(regularPriceEl.textContent).toContain('2.500.000');

    expect(screen.queryByTestId('sale-price')).toBeNull();
    expect(screen.queryByTestId('original-price')).toBeNull();
    expect(screen.queryByTestId('discount-badge')).toBeNull();
  });

  it('renders promoted product card with sale price, strikethrough original price, and discount badge', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockPromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    const salePriceEl = screen.getByTestId('sale-price');
    expect(salePriceEl).toBeTruthy();
    expect(salePriceEl.textContent).toContain('1.600.000');
    expect(salePriceEl.className).toContain('text-brand-sale');

    const originalPriceEl = screen.getByTestId('original-price');
    expect(originalPriceEl).toBeTruthy();
    expect(originalPriceEl.textContent).toContain('2.000.000');
    expect(originalPriceEl.className).toContain('line-through');
    // STOR-059: thiết kế chủ sản phẩm duyệt dùng ink-muted, cấm text-gray-400 (supersede cd466323).
    expect(originalPriceEl.className).toContain('text-ink-muted');
    expect(originalPriceEl.className).not.toContain('text-gray-400');

    const discountBadgeEl = screen.getByTestId('discount-badge');
    expect(discountBadgeEl).toBeTruthy();
    expect(discountBadgeEl.textContent).toBe('-20%');
    expect(discountBadgeEl.className).toContain('bg-brand-sale');

    expect(screen.queryByTestId('regular-price')).toBeNull();
  });

  it('renders out of stock badge and disables cart action when stock is 0', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockOutOfStockProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Hết hàng')).toBeTruthy();

    const addToCartBtn = screen.getByTitle('Sản phẩm hết hàng');
    expect(addToCartBtn).toBeTruthy();
    fireEvent.click(addToCartBtn);
    expect(onAddToCartMock).not.toHaveBeenCalled();
  });

  it('renders racket spec chips and no play-style text (STOR-059)', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockUnpromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('spec-weight').textContent).toBe('4U');
    expect(screen.getByTestId('spec-balance').textContent).toBe('CB 300mm');
    expect(screen.getByTestId('spec-stiffness').textContent).toBe('Cứng');
    expect(screen.queryByText('Tấn Công')).toBeNull();
    expect(screen.queryByTestId('playstyle-badge')).toBeNull();
  });

  it('renders shoe wide fit indicator when category is Giày and isWide is true', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockPromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Form chân bè \(Wide Fit\)/)).toBeTruthy();
  });

  it('renders wide fit indicator based on isWide alone, regardless of category name', () => {
    const wideRacket: Product = { ...mockUnpromotedProduct, isWide: true };
    render(
      <MemoryRouter>
        <ProductCard product={wideRacket} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Form chân bè \(Wide Fit\)/)).toBeTruthy();
  });

  it('does not render wide fit indicator when isWide is not true', () => {
    render(
      <MemoryRouter>
        <ProductCard product={mockUnpromotedProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Form chân bè \(Wide Fit\)/)).toBeNull();
  });

  it('hides racket spec chips when the product is not in a racket category', () => {
    const nonRacket: Product = { ...mockUnpromotedProduct, categoryCode: 'VC001488' };
    render(
      <MemoryRouter>
        <ProductCard product={nonRacket} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('spec-weight')).toBeNull();
    expect(screen.queryByTestId('spec-balance')).toBeNull();
    expect(screen.queryByTestId('spec-stiffness')).toBeNull();
  });

  it('hides racket spec chips entirely when a racket-category product has no real spec data', () => {
    const racketWithoutSpecs: Product = { ...mockUnpromotedProduct, specs: {} };
    render(
      <MemoryRouter>
        <ProductCard product={racketWithoutSpecs} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('spec-weight')).toBeNull();
    expect(screen.queryByTestId('spec-balance')).toBeNull();
    expect(screen.queryByTestId('spec-stiffness')).toBeNull();
  });

  it('handles Quick View, Add to Cart, and detail navigation click events', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockPromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    const quickViewBtn = screen.getByTitle('Xem nhanh thông số');
    fireEvent.click(quickViewBtn);
    expect(onQuickViewMock).toHaveBeenCalledWith(mockPromotedProduct);

    const addToCartBtn = screen.getByTitle('Thêm nhanh vào giỏ');
    fireEvent.click(addToCartBtn);
    expect(onAddToCartMock).toHaveBeenCalledWith(mockPromotedProduct, expect.any(Object));
  });

  it('F6: nút thêm nhanh hiển thị "Chọn phân loại" và điều hướng sang trang chi tiết khi sản phẩm có nhiều hơn một SKU', () => {
    const multiVariantProduct: Product = {
      ...mockUnpromotedProduct,
      variants: [
        { tier_1_option: 'Đỏ', tier_2_option: null, sku_code: 'SKU-A', price: 1, stock: 1 },
        { tier_1_option: 'Xanh', tier_2_option: null, sku_code: 'SKU-B', price: 1, stock: 1 }
      ]
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<ProductCard product={multiVariantProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />}
          />
          <Route path={getProductPath(multiVariantProduct)} element={<div>DETAIL PAGE MARKER</div>} />
        </Routes>
      </MemoryRouter>
    );

    const btn = screen.getByTitle('Chọn phân loại');
    fireEvent.click(btn);

    expect(onAddToCartMock).not.toHaveBeenCalled();
    expect(screen.getByText('DETAIL PAGE MARKER')).toBeInTheDocument();
  });

  describe('STOR-051 High-Contrast Ink, Badges & Readiness', () => {
    // STOR-059 / quyết định PO: thẻ không còn suy luận lối đánh từ tên (supersede cd466323).
    it('Vợt "Yonex Nanoflare 800 Pro" thiếu characteristics KHÔNG hiện playstyle-badge', () => {
      const nanoflareRacket: Product = {
        ...mockUnpromotedProduct,
        id: 'racket-nanoflare',
        name: 'Vợt Yonex Nanoflare 800 Pro',
        characteristics: undefined,
        specs: {}
      };

      render(
        <MemoryRouter>
          <ProductCard product={nanoflareRacket} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('playstyle-badge')).toBeNull();
      expect(screen.queryByText('Phản Tạt')).toBeNull();
    });

    it('Vợt "Vợt A" với specs rỗng và characteristics undefined không hiện playstyle-badge', () => {
      const racketA: Product = {
        ...mockUnpromotedProduct,
        id: 'racket-a',
        name: 'Vợt A',
        characteristics: undefined,
        specs: {}
      };

      render(
        <MemoryRouter>
          <ProductCard product={racketA} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('playstyle-badge')).toBeNull();
    });

    it('Sản phẩm có tầng cước hiện nút O2O đan cước dẫn sang trang chi tiết', () => {
      const stringingProduct: Product = {
        ...mockUnpromotedProduct,
        id: 'prod-stringing',
        tier_variations: [
          { tier_index: 1, name: 'Phân loại', options: ['4U', '5U'] },
          { tier_index: 2, name: 'Loại Cước', options: ['Khung Không Dây', 'BG65'] }
        ]
      };

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<ProductCard product={stringingProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />} />
            <Route path={getProductPath(stringingProduct)} element={<div>DETAIL PAGE MARKER</div>} />
          </Routes>
        </MemoryRouter>
      );

      const btn = screen.getByTestId('o2o-stringing-button');
      expect(btn.textContent).toContain('Đan cước O2O');
      expect(btn.className).toContain('bg-[#e8f1fb]');
      expect(btn.className).toContain('border-brand-primary');
      fireEvent.click(btn);
      expect(screen.getByText('DETAIL PAGE MARKER')).toBeInTheDocument();
    });

    it('Sản phẩm không có tầng cước không hiện nút O2O', () => {
      render(
        <MemoryRouter>
          <ProductCard product={mockUnpromotedProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('o2o-stringing-button')).toBeNull();
    });

    it('Sản phẩm có tier_variations ["4UG5","3U5"] (không phải tầng màu) hiện chữ tùy chọn, không chấm màu', () => {
      const tieredProduct: Product = {
        ...mockUnpromotedProduct,
        id: 'prod-tiered',
        tier_variations: [
          { tier_index: 1, name: 'Phân loại', options: ['4UG5', '3U5'] }
        ]
      };

      render(
        <MemoryRouter>
          <ProductCard product={tieredProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('variant-text').textContent).toBe('4UG5 · 3U5');
      expect(screen.queryAllByTestId('color-dot')).toHaveLength(0);
    });

    it('áp dụng chuẩn tương phản Yonex High-Contrast Ink lên các phần tử ProductCard', () => {
      const { container } = render(
        <MemoryRouter>
          <ProductCard product={mockUnpromotedProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      const cardRoot = container.firstElementChild as HTMLElement;
      expect(cardRoot.className).toContain('hover:border-ink-primary');

      const nameEl = screen.getByRole('heading', { level: 3 });
      expect(nameEl.className).toContain('font-semibold');
      expect(nameEl.className).toContain('line-clamp-2');
      expect(nameEl.className).toContain('text-ink-primary');

      const weightChip = screen.getByTestId('spec-weight');
      expect(weightChip.className).toContain('border-line-tag');
      expect(weightChip.className).toContain('text-ink-primary');

      const regularPrice = screen.getByTestId('regular-price');
      expect(regularPrice.className).toContain('tabular-nums');
      expect(regularPrice.className).toContain('text-ink-primary');

      // Design README §1
      expect(container.innerHTML).not.toContain('text-gray-400');
      expect(container.innerHTML).not.toContain('font-light');
    });

    it('khẳng định TrustBadges.tsx hết "font-light" và mô tả là text-ink-secondary font-medium (STOR-058)', () => {
      const trustBadgesSource = readFileSync(resolve(__dirname, '../components/TrustBadges.tsx'), 'utf8');
      expect(trustBadgesSource).not.toContain('font-light');
      expect(trustBadgesSource).toContain('text-[13.5px] leading-[1.45] text-ink-secondary font-medium');
      expect(trustBadgesSource).toContain('text-ink-primary');
    });

    it('khẳng định QuickViewModal.tsx hết "font-light" và mô tả là text-ink-secondary font-normal', () => {
      const quickViewSource = readFileSync(resolve(__dirname, '../components/QuickViewModal.tsx'), 'utf8');
      expect(quickViewSource).not.toContain('font-light');
      expect(quickViewSource).toContain('text-xs text-ink-secondary leading-relaxed font-normal whitespace-pre-line break-words');
      expect(quickViewSource).toContain('text-ink-primary');
      expect(quickViewSource).toContain('text-ink-muted');
    });
  });
  describe('STOR-059 6 tầng chỉ từ dữ liệu thật', () => {
    const base: Product = {
      id: 'p59',
      name: 'Sản phẩm 59',
      image: 'http://localhost:18100/images/p59.jpg',
      price: 100000,
      specs: {},
      stock: 3
    };
    const r = (p: Product) =>
      render(
        <MemoryRouter>
          <ProductCard product={p} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );
    const badgeTexts = () =>
      Array.from(screen.getByTestId('product-card-image').firstElementChild!.children).map((el) => el.textContent);

    it('nguồn ProductCard không còn dùng inferRacketPlayStyle / playstyle-badge', () => {
      const src = readFileSync(resolve(__dirname, '../components/ProductCard.tsx'), 'utf8');
      expect(src).not.toContain('inferRacketPlayStyle');
      expect(src).not.toContain('playstyle-badge');
      expect(src).not.toContain('text-gray-400');
      expect(src).not.toContain('font-light');
    });

    it('huy hiệu ảnh: không có badge/khuyến mãi/hết hàng thì không có huy hiệu nào', () => {
      r(base);
      expect(badgeTexts()).toEqual([]);
    });

    it('huy hiệu ảnh: product.badge hiện đúng chữ', () => {
      r({ ...base, badge: 'NEW' });
      expect(badgeTexts()).toEqual(['NEW']);
    });

    it('huy hiệu ảnh: -N% chỉ từ getPriceDisplay', () => {
      r({ ...base, salePrice: 80000, hasActivePromotion: true });
      expect(badgeTexts()).toEqual(['-20%']);
    });

    it('tồn 0: "Hết hàng" đúng một lần, không có tag Sẵn hàng', () => {
      r({ ...base, brand: 'Yonex', stock: 0, badge: 'HOT' });
      expect(screen.getAllByText('Hết hàng')).toHaveLength(1);
      expect(badgeTexts()).toEqual(['Hết hàng']);
      expect(screen.queryByTestId('stock-tag')).toBeNull();
    });

    it('tồn undefined: không "Hết hàng", không tag Sẵn hàng', () => {
      r({ ...base, brand: 'Yonex', stock: undefined });
      expect(screen.getByTestId('brand-label')).toBeInTheDocument();
      expect(screen.queryByText('Hết hàng')).toBeNull();
      expect(screen.queryByTestId('stock-tag')).toBeNull();
    });

    it('tồn > 0: tag Sẵn hàng với chấm CSS', () => {
      r(base);
      const tag = screen.getByTestId('stock-tag');
      expect(tag.textContent).toBe('Sẵn hàng');
      expect(tag.querySelector('span.rounded-full')).not.toBeNull();
    });

    it.each([
      ['rỗng', ''],
      ['NO_IMAGE_URL', 'https://via.placeholder.com/300?text=No+Image']
    ])('ảnh %s -> khung tại chỗ, không tải via.placeholder.com', (_label, image) => {
      const { container } = r({ ...base, image });
      expect(screen.getByTestId('image-placeholder')).toBeInTheDocument();
      expect(container.querySelector('img')).toBeNull();
      expect(container.innerHTML).not.toContain('via.placeholder.com');
    });

    it('ảnh lỗi khi tải -> khung tại chỗ', () => {
      const { container } = r(base);
      fireEvent.error(container.querySelector('img')!);
      expect(screen.getByTestId('image-placeholder')).toBeInTheDocument();
    });

    it('dòng thương hiệu · ngành: chỉ phần có dữ liệu', () => {
      r({ ...base, brand: 'Yonex' });
      expect(screen.getByTestId('brand-label').textContent).toBe('Yonex');
      expect(screen.queryByTestId('category-label')).toBeNull();
      expect(screen.queryByText('·')).toBeNull();
      cleanup();
      r({ ...base, category: 'Vợt' });
      expect(screen.queryByTestId('brand-label')).toBeNull();
      expect(screen.getByTestId('category-label').textContent).toBe('Vợt');
    });

    it('chấm màu: chỉ tầng có tên chứa "màu", màu theo bảng tên chính xác, còn lại hiện chữ', () => {
      r({ ...base, tier_variations: [{ tier_index: 1, name: 'Màu Sắc', options: ['Đen', 'WHITE', 'PEACH NECTAR (Áo)', 'Xanh'] }] });
      const dots = screen.getAllByTestId('color-dot');
      expect(dots.map((d) => d.getAttribute('title'))).toEqual(['Đen', 'WHITE']);
      expect(dots[0].style.background).toBe('rgb(0, 0, 0)');
      expect(screen.getByTestId('variant-text').textContent).toBe('PEACH NECTAR (Áo) · Xanh');
    });

    it('chấm màu: tầng không chứa "màu" thì không có chấm dù tùy chọn trùng tên màu', () => {
      r({ ...base, tier_variations: [{ tier_index: 1, name: 'Phân loại', options: ['Đen', 'Trắng'] }] });
      expect(screen.queryAllByTestId('color-dot')).toHaveLength(0);
      expect(screen.getByTestId('variant-text').textContent).toBe('Đen · Trắng');
    });

    it('chấm màu: tên gần đúng ("Đen (Mạnh mẽ)") không được tô', () => {
      r({ ...base, tier_variations: [{ tier_index: 1, name: 'Màu', options: ['Đen (Mạnh mẽ)'] }] });
      expect(screen.queryAllByTestId('color-dot')).toHaveLength(0);
      expect(screen.getByTestId('variant-text').textContent).toBe('Đen (Mạnh mẽ)');
    });

    it('không tầng biến thể -> không có dòng biến thể', () => {
      r(base);
      expect(screen.queryByTestId('variant-preview-row')).toBeNull();
    });

    it('original-price chỉ khi hasActivePromotion', () => {
      r({ ...base, originalPrice: 150000 });
      expect(screen.queryByTestId('original-price')).toBeNull();
      expect(screen.getByTestId('regular-price')).toBeInTheDocument();
    });

    it.each([
      ['spec-weight', { weight: '4U' }, '4U'],
      ['spec-balance', { balance: 295 }, 'CB 295mm'],
      ['spec-stiffness', { stiffness: 'Trung bình' }, 'Trung bình']
    ])('chip %s chỉ khi giá trị có thật, trên ngành vợt', (testId, specs, text) => {
      r({ ...base, categoryCode: 'VC001491', specs });
      expect(screen.getByTestId(testId).textContent).toBe(text);
      const others = ['spec-weight', 'spec-balance', 'spec-stiffness'].filter((t) => t !== testId);
      others.forEach((t) => expect(screen.queryByTestId(t)).toBeNull());
    });

    it('chip thông số không hiện ngoài ngành vợt', () => {
      r({ ...base, categoryCode: 'VC001488', specs: { weight: '4U', balance: 295, stiffness: 'Cứng' } });
      expect(screen.queryByTestId('spec-weight')).toBeNull();
      expect(screen.queryByTestId('spec-balance')).toBeNull();
      expect(screen.queryByTestId('spec-stiffness')).toBeNull();
    });

    it('nút O2O không hiện khi tên tầng có "cước" nhưng hasO2OStringing false', () => {
      r({ ...base, tier_variations: [{ tier_index: 1, name: 'Loại cước', options: ['BG65', 'BG80'] }] });
      expect(screen.queryByTestId('o2o-stringing-button')).toBeNull();
    });
  });
});
