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
    expect(salePriceEl.className).toContain('text-red-600');

    const originalPriceEl = screen.getByTestId('original-price');
    expect(originalPriceEl).toBeTruthy();
    expect(originalPriceEl.textContent).toContain('2.000.000');
    expect(originalPriceEl.className).toContain('line-through');
    expect(originalPriceEl.className).toContain('text-gray-400');

    const discountBadgeEl = screen.getByTestId('discount-badge');
    expect(discountBadgeEl).toBeTruthy();
    expect(discountBadgeEl.textContent).toBe('-20%');
    expect(discountBadgeEl.className).toContain('bg-red-600');

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

  it('renders racket specific specs and characteristics badge', () => {
    render(
      <MemoryRouter>
        <ProductCard
          product={mockUnpromotedProduct}
          onQuickView={onQuickViewMock}
          onAddToCart={onAddToCartMock}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Trọng lượng:')).toBeTruthy();
    expect(screen.getByText('Điểm CB:')).toBeTruthy();
    expect(screen.getByText('300mm')).toBeTruthy();
    expect(screen.getByText('Tấn Công')).toBeTruthy();
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

    expect(screen.queryByText('Trọng lượng:')).toBeNull();
  });

  it('hides racket spec chips entirely when a racket-category product has no real spec data', () => {
    const racketWithoutSpecs: Product = { ...mockUnpromotedProduct, specs: {} };
    render(
      <MemoryRouter>
        <ProductCard product={racketWithoutSpecs} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Trọng lượng:')).toBeNull();
    expect(screen.queryByText('Điểm CB:')).toBeNull();
    expect(screen.queryByText('Độ cứng:')).toBeNull();
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

    const detailBtn = screen.getByText('Chi tiết →');
    fireEvent.click(detailBtn);
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
    it('Vợt "Yonex Nanoflare 800 Pro" thiếu characteristics tự hiện playstyle-badge "Phản Tạt"', () => {
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

      const badge = screen.getByTestId('playstyle-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('Phản Tạt');
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

    it('Sản phẩm có tầng cước hiện o2o-stringing-badge với nội dung "Hỗ trợ đan cước"', () => {
      const stringingProduct: Product = {
        ...mockUnpromotedProduct,
        id: 'prod-stringing',
        tier_variations: [
          { tier_index: 1, name: 'Phân loại', options: ['4U', '5U'] },
          { tier_index: 2, name: 'Loại Cước', options: ['Khung Không Dây', 'BG65'] }
        ]
      };

      render(
        <MemoryRouter>
          <ProductCard product={stringingProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      const badge = screen.getByTestId('o2o-stringing-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('Hỗ trợ đan cước');
      expect(badge.className).toContain('bg-[#e8f1fb]');
      expect(badge.className).toContain('text-brand-primary');
      expect(badge.className).toContain('border-brand-primary/30');
    });

    it('Sản phẩm không có tầng cước không hiện o2o-stringing-badge', () => {
      render(
        <MemoryRouter>
          <ProductCard product={mockUnpromotedProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('o2o-stringing-badge')).toBeNull();
    });

    it('Sản phẩm có tier_variations ["4UG5","3U5"] hiện tier-preview-strip với 2 chip', () => {
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

      const strip = screen.getByTestId('tier-preview-strip');
      expect(strip).toBeInTheDocument();
      expect(strip.children.length).toBe(2);
      expect(strip.children[0].textContent).toBe('4UG5');
      expect(strip.children[1].textContent).toBe('3U5');
      expect(strip.children[0].className).toContain('border-line-tag');
      expect(strip.children[0].className).toContain('text-ink-secondary');
    });

    it('áp dụng chuẩn tương phản Yonex High-Contrast Ink lên các phần tử ProductCard', () => {
      const { container } = render(
        <MemoryRouter>
          <ProductCard product={mockUnpromotedProduct} onQuickView={onQuickViewMock} onAddToCart={onAddToCartMock} />
        </MemoryRouter>
      );

      const cardRoot = container.firstElementChild as HTMLElement;
      expect(cardRoot.className).toContain('border-gray-200');
      expect(cardRoot.className).toContain('hover:border-ink-secondary');

      const brandEl = screen.getByTestId('brand-label');
      expect(brandEl.parentElement?.className).toContain('text-ink-muted');

      const nameEl = screen.getByRole('heading', { level: 3 });
      expect(nameEl.className).toContain('font-bold');
      expect(nameEl.className).toContain('text-sm');
      expect(nameEl.className).toContain('text-ink-primary');

      const weightLabel = screen.getByText('Trọng lượng:');
      expect(weightLabel.className).toContain('text-ink-muted');
      const weightVal = screen.getByText('4U');
      expect(weightVal.className).toContain('font-bold');
      expect(weightVal.className).toContain('text-ink-primary');
      expect(weightLabel.closest('.border-line-tag')).toBeInTheDocument();

      const regularPrice = screen.getByTestId('regular-price');
      expect(regularPrice.className).toContain('tabular-nums');
    });

    it('khẳng định TrustBadges.tsx hết "font-light" và mô tả là text-xs text-ink-muted font-medium', () => {
      const trustBadgesSource = readFileSync(resolve(__dirname, '../components/TrustBadges.tsx'), 'utf8');
      expect(trustBadgesSource).not.toContain('font-light');
      expect(trustBadgesSource).toContain('text-xs text-ink-muted font-medium');
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
});
