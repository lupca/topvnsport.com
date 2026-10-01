import React, { useEffect, useMemo, useState } from 'react';
import { Product, StringOption } from '../types';
import ProductMediaGallery from './ProductMediaGallery';
import TrustSealsPanel from './TrustSealsPanel';
import ProductPurchaseSection from './product-detail/ProductPurchaseSection';
import ProductDetailTabs, { DetailTab } from './product-detail/ProductDetailTabs';
import MobilePurchaseBar from './product-detail/MobilePurchaseBar';
import { inferStringMeta, isNoStringOption, isStringingTierName } from './product-detail/helpers';
import { isRacketCategoryCode } from '../config/storefront';

interface ProductDetailPageProps {
  product: Product;
  stringOptions: StringOption[];
  stringOptionsError: boolean;
  onAddToCartWithSpecs: (product: Product, selectedWeight: string, selectedColor: string, stringChoice: StringOption | null, tension: number) => void;
  onBackToCatalog: () => void;
  
}

export default function ProductDetailPage({ product, stringOptions, stringOptionsError, onAddToCartWithSpecs }: Omit<ProductDetailPageProps, 'onBackToCatalog'|'onBookTestAtStore'>) {
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  // Không bịa trọng lượng theo ngành -- lấy từ thông số thật của sản phẩm nếu
  // có, còn lại dùng sentinel "Tiêu chuẩn" chung của hệ thống (giống màu sắc).
  // Không có ô chọn nào ghi lại giá trị này (không bịa lựa chọn khi thiếu dữ
  // liệu thật -- xem ProductPurchaseSection), nên đây là giá trị suy ra thẳng
  // từ sản phẩm, không cần state.
  const selectedWeight = product.specs.weight || 'Tiêu chuẩn';
  const [selectedColor, setSelectedColor] = useState(
    product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn'
  );

  // Chỉ tự chọn sẵn khi tầng đó có ĐÚNG một lựa chọn (không có gì để chọn
  // thật sự) -- có từ hai lựa chọn trở lên thì để trống, bắt khách phải tự
  // chọn (để nhánh "Vui lòng chọn {tên tầng}" có hiệu lực khi bấm thêm giỏ
  // mà chưa chọn).
  const [selectedTier1, setSelectedTier1] = useState<string>(() => {
    const t1 = product.tier_variations?.find(tv => tv.tier_index === 1);
    return t1 && t1.options.length === 1 ? t1.options[0] : '';
  });
  const [selectedTier2, setSelectedTier2] = useState<string>(() => {
    const t2 = product.tier_variations?.find(tv => tv.tier_index === 2);
    return t2 && t2.options.length === 1 ? t2.options[0] : '';
  });

  const stringingVariation = product.tier_variations?.find(
    (tv) => isStringingTierName(tv.name)
  );
  const hasStringingVariation = !!stringingVariation;
  const stringingTierIndex = stringingVariation?.tier_index;

  const activeStringValue = stringingTierIndex === 1 ? selectedTier1 : selectedTier2;
  const isDynamicStringingActive = hasStringingVariation && !isNoStringOption(activeStringValue);

  const [withStringing, setWithStringing] = useState(false);
  const [selectedString, setSelectedString] = useState<StringOption | null>(null);
  const [tension, setTension] = useState(10.5);
  const isRacket = isRacketCategoryCode(product.categoryCode);

  useEffect(() => {
    const t1 = product.tier_variations?.find(tv => tv.tier_index === 1);
    setSelectedTier1(t1 && t1.options.length === 1 ? t1.options[0] : '');

    const t2 = product.tier_variations?.find(tv => tv.tier_index === 2);
    setSelectedTier2(t2 && t2.options.length === 1 ? t2.options[0] : '');

    setWithStringing(false);
    setSelectedString(null);
    setTension(10.5);
  }, [product]);

  const matchedVariant = product.variants?.find((v) => {
    const t1Match = !product.tier_variations?.some(tv => tv.tier_index === 1) || v.tier_1_option === selectedTier1;
    const t2Match = !product.tier_variations?.some(tv => tv.tier_index === 2) || v.tier_2_option === selectedTier2;
    return t1Match && t2Match;
  });

  const getVariantStock = (tier1: string, tier2: string): number => {
    const variant = product.variants?.find((v) => {
      const t1Match = !product.tier_variations?.some(tv => tv.tier_index === 1) || v.tier_1_option === tier1;
      const t2Match = !product.tier_variations?.some(tv => tv.tier_index === 2) || v.tier_2_option === tier2;
      return t1Match && t2Match;
    });
    return variant?.stock ?? product.stock ?? 0;
  };

  const currentStock = matchedVariant?.stock ?? product.stock ?? 0;
  const isOutOfStock = currentStock <= 0;

  // Giá thật quyết định theo biến thể đang chọn (giá 0 = chưa có giá); chưa chọn
  // được biến thể thì theo giá thật của sản phẩm.
  const hasPrice = matchedVariant ? matchedVariant.price > 0 : product.price !== undefined;
  const baseOriginalPrice = product.originalPrice ?? product.price ?? 0;
  const baseSalePrice = product.computedPrice ?? product.salePrice ?? product.price ?? 0;

  const originalPriceToUse = matchedVariant?.originalPrice ?? matchedVariant?.price ?? baseOriginalPrice;
  const salePriceToUse = matchedVariant?.computedPrice ?? matchedVariant?.price ?? baseSalePrice;

  const displayBasePrice = salePriceToUse;
  const displayOriginalPrice = originalPriceToUse;
  
  const hasDiscount = Boolean(
    (matchedVariant?.hasActivePromotion || product.hasActivePromotion) ||
    (displayBasePrice < displayOriginalPrice)
  );

  const discountPercent = matchedVariant?.percentageDiscount ?? product.percentageDiscount ?? 
    (hasDiscount && displayOriginalPrice > 0 ? Math.round(((displayOriginalPrice - displayBasePrice) / displayOriginalPrice) * 100) : 0);

  const stringPrice = (!hasStringingVariation && withStringing && selectedString) ? selectedString.price : 0;
  const totalDisplayPrice = displayBasePrice + stringPrice;

  const resolvedColor = product.tier_variations && product.tier_variations.length > 0
    ? selectedTier1
    : selectedColor;

  const resolvedWeight = product.tier_variations && product.tier_variations.length > 0
    ? selectedTier2
    : selectedWeight;

  const resolvedStringChoice = hasStringingVariation
    ? (isDynamicStringingActive ? {
        id: activeStringValue,
        name: activeStringValue,
        brand: product.brand,
        // Không bịa loại/độ dày -- chỉ điền khi khớp được sản phẩm cước thật
        // trong catalog (stringOptions), còn lại để undefined.
        ...inferStringMeta(activeStringValue, stringOptions),
        price: 0,
        colors: []
      } : null)
    : (withStringing ? selectedString : null);

  const mediaByTier1 = useMemo(
    () => (product.media || []).filter((item) => Boolean(item.tier1Option && item.imageUrl)),
    [product.media]
  );
  const mediaByTier2 = useMemo(
    () => (product.media || []).filter((item) => Boolean(item.tier2Option && item.imageUrl)),
    [product.media]
  );

  const selectedVisualOption = mediaByTier1.length > 0
    ? selectedTier1
    : mediaByTier2.length > 0
      ? selectedTier2
      : selectedColor;

  const imageByVisualOption = useMemo(() => {
    const map: Record<string, string> = {};

    if (mediaByTier1.length > 0) {
      mediaByTier1.forEach((item) => {
        const option = item.tier1Option || '';
        if (!option || map[option]) return;
        map[option] = item.imageUrl;
      });
      return map;
    }

    if (mediaByTier2.length > 0) {
      mediaByTier2.forEach((item) => {
        const option = item.tier2Option || '';
        if (!option || map[option]) return;
        map[option] = item.imageUrl;
      });
      return map;
    }

    return map;
  }, [mediaByTier1, mediaByTier2]);

  const handleAddToCart = () => {
    if (!hasPrice) return;
    onAddToCartWithSpecs(product, resolvedWeight, resolvedColor, resolvedStringChoice, tension);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 animate-in fade-in duration-300" id="product-detail-page">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <ProductMediaGallery
            productName={product.name}
            image={product.image}
            gallery={product.gallery}
            selectedVisualOption={selectedVisualOption}
            imageByVisualOption={imageByVisualOption}
          />

          <TrustSealsPanel />
        </div>

        <div className="lg:col-span-7">
          <ProductPurchaseSection
            product={product}
            isRacket={isRacket}
            totalDisplayPrice={totalDisplayPrice}
            hasPrice={hasPrice}
            displayOriginalPrice={displayOriginalPrice}
            hasDiscount={hasDiscount}
            discountPercent={discountPercent}
            stringPrice={stringPrice}
            selectedTier1={selectedTier1}
            selectedTier2={selectedTier2}
            selectedColor={selectedColor}
            withStringing={withStringing}
            selectedString={selectedString}
            tension={tension}
            stringOptions={stringOptions}
            stringOptionsError={stringOptionsError}
            hasStringingVariation={hasStringingVariation}
            stringingVariation={stringingVariation}
            stringingTierIndex={stringingTierIndex}
            isDynamicStringingActive={isDynamicStringingActive}
            activeStringValue={activeStringValue}
            isOutOfStock={isOutOfStock}
            onSetSelectedTier1={setSelectedTier1}
            onSetSelectedTier2={setSelectedTier2}
            onSetSelectedColor={setSelectedColor}
            onSetWithStringing={setWithStringing}
            onSetSelectedString={setSelectedString}
            onSetTension={setTension}
            onAddToCart={handleAddToCart}
            getVariantStock={getVariantStock}
          />
        </div>
      </div>

      <ProductDetailTabs
        product={product}
        isRacket={isRacket}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <MobilePurchaseBar
        productName={product.name}
        productImage={product.image}
        totalDisplayPrice={totalDisplayPrice}
        hasPrice={hasPrice}
        isOutOfStock={isOutOfStock}
        onBuyNow={handleAddToCart}
      />

    </div>
  );
}
