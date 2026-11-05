import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { Eye, ShoppingCart, ImageOff } from 'lucide-react';
import { getProductPath } from '../utils/productSlug';
import { getPriceDisplay } from '../utils/priceDisplay';
import { getSingleSellableSku } from '../features/cart/cartSlice';
import { hasO2OStringing, getPrimaryTierPreview } from '../utils/badmintonReadiness';
import { isStringingTier } from './product-detail/helpers';

interface ProductCardProps {
  key?: string;
  product: Product;

  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
}

// Chấm màu CHỈ khi tên tùy chọn khớp đúng nguyên văn; mọi tùy chọn khác hiện
// chữ (không đoán màu từ tên -- 37f60f5b/db4c9460). 'Xanh' trơn cố ý không có:
// xanh dương hay xanh lá đều được, đoán là bịa.
const COLOR_HEX: Record<string, string> = {
  'Đen': '#000000', 'Trắng': '#ffffff', 'Đỏ': '#dc2626', 'Vàng': '#facc15',
  'Hồng': '#f472b6', 'Tím': '#7c3aed', 'Xám': '#9ca3af', 'Xanh Dương': '#1d4ed8',
  'Xanh Navy': '#1e3a8a',
  'BLACK': '#000000', 'Black': '#000000', 'WHITE': '#ffffff', 'White': '#ffffff',
  'Red': '#dc2626', 'Blue': '#1d4ed8', 'Yellow': '#facc15', 'Gray': '#9ca3af'
};

const BADGE_BG: Partial<Record<NonNullable<Product['badge']>, string>> = {
  SALE: 'bg-brand-sale',
  NEW: 'bg-brand-primary',
  HOT: 'bg-brand-primary'
};

const badgeClass = 'font-display text-[0.875rem] md:text-[11px] font-extrabold tracking-[0.04em] uppercase px-1.5 sm:px-2 py-0.5 text-white';

export default function ProductCard({ product, onQuickView, onAddToCart }: ProductCardProps) {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);
  // Thêm nhanh chỉ khi sản phẩm có ĐÚNG một SKU bán được -- một tầng nhiều
  // lựa chọn hoặc hai tầng phải dẫn khách sang trang chi tiết để chọn đủ,
  // không tự chọn tổ hợp đại diện (options[0]) rồi gửi SKU.
  const canQuickAdd = getSingleSellableSku(product) !== null;
  // Không có giá thật -> 'Liên hệ để biết giá', không cho thêm giỏ.
  const hasPrice = product.price !== undefined;
  const { hasActivePromotion, salePrice, originalPrice, discountPercent } = getPriceDisplay(product);
  const supportsO2OStringing = hasO2OStringing(product);

  // stock undefined = tồn kho không tải được: không phải hết hàng, nhưng chặn mua.
  const stockUnknown = product.stock === undefined;
  const outOfStock = product.stock !== undefined && product.stock <= 0;
  const inStock = product.stock !== undefined && product.stock > 0;
  const cartBlocked = outOfStock || stockUnknown || !hasPrice;

  // Ảnh mapper gắn khi PIM không có ảnh (NO_IMAGE_URL) là ảnh ngoài -- thay bằng khung tại chỗ.
  const hasImage = Boolean(product.image) && !product.image.includes('via.placeholder.com') && !imageFailed;

  // Tầng 4: chấm màu chỉ cho tầng có tên chứa 'màu' (không phải tầng cước).
  const colorTier = (product.tier_variations ?? []).find(
    (t) => Array.isArray(t.options) && t.name.normalize('NFC').toLowerCase().includes('màu') && !isStringingTier(t)
  );
  const colorOptions = [...new Set((colorTier?.options ?? []).map((o) => o.trim()).filter((o) => o !== ''))];
  const colorDots = colorOptions.filter((o) => COLOR_HEX[o]).slice(0, 5);
  const variantText = colorTier
    ? colorOptions.filter((o) => !COLOR_HEX[o]).slice(0, 2)
    : getPrimaryTierPreview(product, 2);

  const goToDetail = () => navigate(getProductPath(product));

  return (
    <div
      className="group bg-white border border-[#e4e4e7] hover:border-ink-primary hover:-translate-y-[3px] hover:shadow-[0_14px_30px_rgba(0,0,0,0.09)] transition-all duration-200 flex flex-col h-full relative"
      id={`product-card-${product.id}`}
    >
      {/* Tầng 1: ảnh 1:1 + huy hiệu trái + thanh tác vụ khi hover */}
      <div
        className="relative aspect-square overflow-hidden bg-[#f8f9fa] border-b border-[#e4e4e7] group-hover:border-ink-primary flex items-center justify-center p-2.5 sm:p-5 cursor-pointer"
        onClick={goToDetail}
        data-testid="product-card-image"
      >
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
          {outOfStock && <span className={`${badgeClass} bg-ink-muted`}>Hết hàng</span>}
          {product.badge && !outOfStock && (
            <span className={`${badgeClass} ${BADGE_BG[product.badge] ?? 'bg-ink-primary'}`} data-testid="product-badge">
              {product.badge}
            </span>
          )}
          {hasActivePromotion && discountPercent > 0 && !outOfStock && (
            <span className={`${badgeClass} bg-brand-sale`} data-testid="discount-badge">
              -{discountPercent}%
            </span>
          )}
        </div>

        {hasImage ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-muted text-[0.875rem] md:text-[11px] font-semibold"
            data-testid="image-placeholder"
          >
            <ImageOff className="w-8 h-8" aria-hidden="true" />
            Chưa có ảnh
          </div>
        )}

        {/* Chỉ tồn tại trên thiết bị có hover: trên cảm ứng không có phần tử bấm được mà không nhìn thấy. */}
        <div className="absolute inset-x-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden [@media(hover:hover)]:flex gap-1.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="flex-1 flex items-center justify-center gap-1 bg-black/90 hover:bg-brand-primary text-white text-xs font-bold py-2 rounded"
            title="Xem nhanh thông số"
          >
            <Eye className="w-4 h-4" /> Xem nhanh
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (cartBlocked) return;
              if (!canQuickAdd) {
                goToDetail();
                return;
              }
              onAddToCart(product, e);
            }}
            disabled={cartBlocked}
            className={`px-3 flex items-center justify-center rounded ${
              cartBlocked ? 'bg-gray-300 text-ink-muted cursor-not-allowed' : 'bg-black/90 hover:bg-brand-primary text-white'
            }`}
            title={outOfStock ? 'Sản phẩm hết hàng' : stockUnknown ? 'Chưa rõ tồn kho' : !hasPrice ? 'Liên hệ để biết giá' : canQuickAdd ? 'Thêm nhanh vào giỏ' : 'Chọn phân loại'}
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-1.5 pt-2 pb-2.5 sm:px-3.5 sm:pt-3.5 sm:pb-4 flex-1 flex flex-col cursor-pointer" onClick={goToDetail}>
        {/* Tầng 2: thương hiệu · ngành hàng + tồn kho */}
        {(product.brand || product.category || inStock) && (
          <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-1 mb-1 font-mono text-[0.875rem] md:text-[11.5px] font-bold uppercase tracking-[0.04em] text-brand-primary">
            <span className="min-w-0 truncate">
              {product.brand && <span data-testid="brand-label">{product.brand}</span>}
              {product.brand && product.category && <span className="hidden sm:inline"> · </span>}
              {product.category && <span className="hidden sm:inline" data-testid="category-label">{product.category}</span>}
            </span>
            {inStock && (
              <span
                className="shrink-0 inline-flex items-center gap-1 normal-case tracking-normal text-[0.875rem] md:text-[10.5px] text-[#166534] bg-[#dcfce7] px-1.5 py-px rounded"
                data-testid="stock-tag"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" aria-hidden="true" />
                Sẵn hàng
              </span>
            )}
          </div>
        )}

        {/* Tầng 3: tên 2 dòng */}
        <h3 className="text-[0.875rem] md:text-[15.5px] font-semibold leading-[1.42] text-ink-primary group-hover:text-brand-primary line-clamp-2 min-h-[43px] md:min-h-[44px] mb-1.5 sm:mb-2">
          {product.name}
        </h3>

        {/* Tầng 4: xem trước biến thể thật */}
        {(colorDots.length > 0 || variantText.length > 0) && (
          <div
            className="hidden sm:flex items-center justify-between gap-2 mb-2 pb-2 border-b border-dashed border-[#e4e4e7] text-[0.875rem] md:text-[11.5px] font-semibold text-ink-secondary"
            data-testid="variant-preview-row"
          >
            <span className="inline-flex items-center gap-1.5">
              {colorDots.map((c) => (
                <span
                  key={c}
                  title={c}
                  data-testid="color-dot"
                  className="w-3 h-3 rounded-full border border-ink-primary inline-block"
                  style={{ background: COLOR_HEX[c] }}
                />
              ))}
            </span>
            {variantText.length > 0 && (
              <span className="font-mono text-[0.875rem] md:text-[11px] truncate" data-testid="variant-text">
                {variantText.join(' · ')}
              </span>
            )}
          </div>
        )}

        {/* Tầng 5: giá */}
        <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2.5">
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
            {!hasPrice ? (
              <span className="text-sm font-bold text-ink-secondary font-display" data-testid="no-price">
                Liên hệ để biết giá
              </span>
            ) : hasActivePromotion ? (
              <>
                <span className="font-display text-[14.5px] sm:text-[17.5px] font-extrabold text-brand-sale tabular-nums" data-testid="sale-price">
                  {(salePrice ?? 0).toLocaleString('vi-VN')}đ
                </span>
                <span className="text-[0.875rem] md:text-[12.5px] font-semibold text-ink-muted line-through tabular-nums" data-testid="original-price">
                  {(originalPrice ?? 0).toLocaleString('vi-VN')}đ
                </span>
              </>
            ) : (
              <span className="font-display text-[14.5px] sm:text-[17.5px] font-extrabold text-ink-primary tabular-nums" data-testid="regular-price">
                {(originalPrice ?? 0).toLocaleString('vi-VN')}đ
              </span>
            )}
          </div>

          {canQuickAdd && (
            <button
              type="button"
              data-testid="mobile-add-to-cart"
              aria-label="Thêm vào giỏ"
              onClick={(e) => {
                e.stopPropagation();
                if (cartBlocked) return;
                onAddToCart(product, e);
              }}
              disabled={cartBlocked}
              className={`[@media(hover:hover)]:hidden shrink-0 min-w-11 min-h-11 md:min-w-auto md:min-h-auto p-2 rounded-full transition ${
                cartBlocked ? 'bg-gray-200 text-ink-muted cursor-not-allowed' : 'bg-brand-primary text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4 max-md:mx-auto" />
            </button>
          )}
        </div>

        {/* Tầng 6: nút đan cước O2O, chỉ khi sản phẩm có tầng cước (PO 2026-11-02: không còn chip thông số) */}
        <div className="mt-auto flex flex-wrap gap-1 sm:gap-[5px]">
          {supportsO2OStringing && (
            <button
              type="button"
              data-testid="o2o-stringing-button"
              onClick={(e) => {
                e.stopPropagation();
                goToDetail();
              }}
              className="w-full mt-0.5 flex items-center justify-between gap-1 border border-brand-primary bg-[#e8f1fb] text-brand-secondary hover:bg-brand-primary hover:text-white min-h-11 md:min-h-auto text-[0.875rem] md:text-[11.5px] font-bold px-1.5 sm:px-[7px] py-[3px] transition"
            >
              <span className="sm:hidden">Chọn cước &amp; kg</span>
              <span className="hidden sm:inline">Đan cước O2O</span>
              <span><span className="hidden sm:inline">Chọn kg </span>&rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
