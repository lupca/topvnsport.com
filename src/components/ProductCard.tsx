import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { Eye, ShoppingCart, Activity } from 'lucide-react';
import { getProductPath } from '../utils/productSlug';
import { isRacketCategoryCode } from '../config/storefront';
import { getPriceDisplay } from '../utils/priceDisplay';
import { getSingleSellableSku } from '../features/cart/cartSlice';
import { inferRacketPlayStyle, hasO2OStringing, getPrimaryTierPreview } from '../utils/badmintonReadiness';

interface ProductCardProps {
  key?: string;
  product: Product;

  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
}

export default function ProductCard({ product, onQuickView, onAddToCart }: ProductCardProps) {
  const navigate = useNavigate();
  // Thêm nhanh chỉ khi sản phẩm có ĐÚNG một SKU bán được -- một tầng nhiều
  // lựa chọn hoặc hai tầng phải dẫn khách sang trang chi tiết để chọn đủ,
  // không tự chọn tổ hợp đại diện (options[0]) rồi gửi SKU.
  const canQuickAdd = getSingleSellableSku(product) !== null;
  // Không có giá thật -> 'Liên hệ để biết giá', không cho thêm giỏ.
  const hasPrice = product.price !== undefined;
  const { hasActivePromotion, salePrice, originalPrice, discountPercent } = getPriceDisplay(product);

  const playStyle = inferRacketPlayStyle(product) ?? product.characteristics;
  const supportsO2OStringing = hasO2OStringing(product);
  const tierPreview = getPrimaryTierPreview(product, 4);

  // Visual helper for racket playstyles
  const characteristicStyles: Record<string, { bg: string; dot: string }> = {
    'Tấn Công': { bg: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-500' },
    'Phòng Thủ': { bg: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500' },
    'Phản Tạt': { bg: 'bg-sky-50 text-brand-primary border-sky-200', dot: 'bg-brand-primary' },
    'Toàn Diện': { bg: 'bg-green-50 text-green-600 border-green-100', dot: 'bg-green-500' },
    'Người Mới': { bg: 'bg-brand-light text-brand-primary border-blue-100', dot: 'bg-brand-primary' }
  };

  const badgeStyles = {
    'NEW': 'bg-emerald-500 text-white',
    'HOT': 'bg-brand-primary text-white',
    'SALE': 'bg-red-500 text-white ',
    'LIMITED': 'bg-purple-600 text-white',
    'PRO': 'bg-gray-900 text-yellow-400 border border-yellow-400',
    'TOUR': 'bg-blue-700 text-white',
    'GAME': 'bg-teal-600 text-white',
    'PLAY': 'bg-gray-500 text-white'
  };

  // stock undefined = tồn kho không tải được: không phải hết hàng, nhưng chặn mua.
  const stockUnknown = product.stock === undefined;
  const outOfStock = product.stock !== undefined && product.stock <= 0;

  return (
    <div 
      className="group bg-white rounded-xl border border-gray-200 hover:border-ink-secondary overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300 flex flex-col justify-between h-full relative"
      id={`product-card-${product.id}`}
    >
      {/* Product Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {outOfStock && (
          <span className="text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-sm shadow-xs bg-gray-600 text-white">
            Hết hàng
          </span>
        )}
        {product.badge && !outOfStock && (
          <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-sm shadow-xs ${badgeStyles[product.badge] || 'bg-gray-500 text-white'}`}>
            {product.badge}
          </span>
        )}
        {hasActivePromotion && discountPercent > 0 && !outOfStock && (
          <span
            className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-sm shadow-xs"
            data-testid="discount-badge"
          >
            -{discountPercent}%
          </span>
        )}
      </div>

      {/* Main product photo area */}
      <div
        className="relative aspect-square overflow-hidden bg-gray-50 flex items-center justify-center p-4 cursor-pointer"
        onClick={() => navigate(getProductPath(product))}
        data-testid="product-card-image"
      >
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        {/* Quick actions overlay */}
        {/* Chỉ tồn tại trên thiết bị có hover: trên cảm ứng không có phần tử bấm được mà không nhìn thấy. */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden [@media(hover:hover)]:flex items-center justify-center gap-2.5 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="p-2 bg-white text-gray-800 rounded-full hover:bg-brand-primary hover:text-white shadow-md hover:scale-110 transition duration-200"
            title="Xem nhanh thông số"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (outOfStock || stockUnknown || !hasPrice) return;
              if (!canQuickAdd) {
                navigate(getProductPath(product));
                return;
              }
              onAddToCart(product, e);
            }}
            disabled={outOfStock || stockUnknown || !hasPrice}
            className={`p-2 rounded-full shadow-md transition duration-200 ${
              outOfStock || stockUnknown || !hasPrice
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-white text-gray-800 hover:bg-brand-primary hover:text-white hover:scale-110'
            }`}
            title={outOfStock ? 'Sản phẩm hết hàng' : stockUnknown ? 'Chưa rõ tồn kho' : !hasPrice ? 'Liên hệ để biết giá' : canQuickAdd ? 'Thêm nhanh vào giỏ' : 'Chọn phân loại'}
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content details block */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between" onClick={() => navigate(getProductPath(product))}>
        <div className="space-y-1.5 cursor-pointer">
          {/* Brand & category */}
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-ink-muted">
            {product.brand && <span className="text-brand-primary uppercase tracking-wider" data-testid="brand-label">{product.brand}</span>}
            {product.category && <span data-testid="category-label">{product.category}</span>}
          </div>

          {/* Product Name */}
          <h3 className="font-sans font-bold text-sm text-ink-primary group-hover:text-brand-primary line-clamp-2 transition leading-snug">
            {product.name}
          </h3>

          {/* Core Technical Indicator Tags (for Rackets / Paddles) -- chỉ hiện
              khi sản phẩm thuộc ngành vợt VÀ có ít nhất một thông số thật */}
          {isRacketCategoryCode(product.categoryCode) &&
            (product.specs.weight || typeof product.specs.balance === 'number' || product.specs.stiffness) && (
            <div className="py-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-b border-line-tag my-2 text-[10px] text-ink-muted font-mono">
              {product.specs.weight && (
                <div className="flex items-center gap-1">
                  <span className="text-ink-muted">Trọng lượng:</span>
                  <span className="font-bold text-ink-primary">{product.specs.weight.split(' ')[0]}</span>
                </div>
              )}
              {typeof product.specs.balance === 'number' && (
                <div className="flex items-center gap-1">
                  <span className="text-ink-muted">Điểm CB:</span>
                  <span className="font-bold text-ink-primary">{product.specs.balance}mm</span>
                </div>
              )}
              {product.specs.stiffness && (
                <div className="flex items-center gap-1 col-span-2">
                  <span className="text-ink-muted">Độ cứng:</span>
                  <span className="font-bold text-ink-primary truncate max-w-[120px]">{product.specs.stiffness.split(' ')[0]}</span>
                </div>
              )}
            </div>
          )}

          {/* Wide format shoe indicator -- theo isWide thật, không theo tên ngành */}
          {product.isWide === true && (
            <div className="my-1.5 inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded border border-amber-100 font-medium">
              <Activity className="w-3 h-3" /> Form chân bè (Wide Fit)
            </div>
          )}

          {/* PlayStyle Badge & O2O Stringing */}
          {(playStyle || supportsO2OStringing) && (
            <div className="my-1 flex flex-wrap items-center gap-1.5">
              {playStyle && (
                <span
                  data-testid="playstyle-badge"
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${characteristicStyles[playStyle]?.bg || 'bg-gray-100 text-gray-700'}`}
                >
                  <span className={`w-1 h-1 rounded-full ${characteristicStyles[playStyle]?.dot || 'bg-gray-500'}`}></span>
                  {playStyle}
                </span>
              )}
              {supportsO2OStringing && (
                <span
                  data-testid="o2o-stringing-badge"
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8f1fb] text-brand-primary border border-brand-primary/30"
                >
                  Hỗ trợ đan cước
                </span>
              )}
            </div>
          )}

          {/* Tier preview strip */}
          {tierPreview.length > 0 && (
            <div className="flex flex-wrap gap-1 my-1.5" data-testid="tier-preview-strip">
              {tierPreview.map((option, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-line-tag text-ink-secondary bg-gray-50/50"
                >
                  {option}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pricing Block */}
        <div className="mt-4 flex items-end justify-between pt-2 border-t border-gray-50">
          <div className="min-w-0">
            {!hasPrice ? (
              <span className="text-sm font-bold text-gray-600 font-display" data-testid="no-price">
                Liên hệ để biết giá
              </span>
            ) : hasActivePromotion ? (
              <>
                <span className="text-base font-bold text-red-600 font-display block leading-tight tabular-nums" data-testid="sale-price">
                  {(salePrice ?? 0).toLocaleString('vi-VN')}đ
                </span>
                <span className="text-xs text-gray-400 line-through block leading-none tabular-nums" data-testid="original-price">
                  {(originalPrice ?? 0).toLocaleString('vi-VN')}đ
                </span>
              </>
            ) : (
              <span className="text-base font-extrabold text-brand-primary font-display tabular-nums" data-testid="regular-price">
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
                if (outOfStock || stockUnknown || !hasPrice) return;
                onAddToCart(product, e);
              }}
              disabled={outOfStock || stockUnknown || !hasPrice}
              className={`[@media(hover:hover)]:hidden shrink-0 p-2 rounded-full transition ${
                outOfStock || stockUnknown || !hasPrice
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-primary text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(getProductPath(product));
            }}
            className="hidden sm:inline text-xs font-bold text-gray-900 group-hover:text-brand-primary hover:underline transition"
          >
            Chi tiết &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
