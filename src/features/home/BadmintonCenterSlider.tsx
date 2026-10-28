import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Product } from '../../types';
import { inferRacketPlayStyle } from '../../utils/badmintonReadiness';
import { getPriceDisplay } from '../../utils/priceDisplay';
import { getProductPath } from '../../utils/productSlug';

export interface BadmintonCenterSliderProps {
  products: Product[];
}

export default function BadmintonCenterSlider({ products }: BadmintonCenterSliderProps) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || products.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % products.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, products.length]);

  if (!products || products.length === 0) {
    return null;
  }

  const safeIndex = ((activeIndex % products.length) + products.length) % products.length;
  const activeProduct = products[safeIndex];
  const playStyle = inferRacketPlayStyle(activeProduct) ?? activeProduct.characteristics;
  const { salePrice, originalPrice, hasActivePromotion } = getPriceDisplay(activeProduct);

  const handlePrev = () => {
    setActiveIndex(prev => (prev - 1 + products.length) % products.length);
  };

  const handleNext = () => {
    setActiveIndex(prev => (prev + 1) % products.length);
  };

  return (
    <section data-testid="badminton-center-slider" className="max-w-7xl mx-auto px-4 md:px-8">
      <div className="relative overflow-hidden">
        {/* Slides Track */}
        <div className="flex items-center justify-center gap-3 md:gap-6 py-2">
          {products.map((product, idx) => {
            const isActive = idx === safeIndex;
            if (isActive) {
              return (
                <div
                  key={product.id || idx}
                  data-testid="center-slide-active"
                  className="w-full max-w-4xl rounded-3xl border border-line-strong bg-white p-5 md:p-8 opacity-100 scale-100 shadow-md transition-all duration-300 flex flex-col md:flex-row gap-6 items-center"
                >
                  <div className="w-full md:w-1/2 aspect-square max-h-72 rounded-2xl bg-gray-50 flex items-center justify-center p-4 overflow-hidden border border-line-tag">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-ink-muted font-bold text-sm">{product.name}</div>
                    )}
                  </div>

                  <div className="w-full md:w-1/2 flex flex-col gap-3 justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                      {(product.brand || product.category) && (
                        <div className="text-ink-muted font-mono font-bold uppercase text-xs tracking-wider">
                          {product.brand && <span>{product.brand}</span>}
                          {product.brand && product.category && <span className="mx-1">•</span>}
                          {product.category && <span>{product.category}</span>}
                        </div>
                      )}
                      {playStyle && (
                        <span
                          data-testid="slider-playstyle-badge"
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border border-line-tag bg-pill-bg text-ink-primary"
                        >
                          {playStyle}
                        </span>
                      )}
                    </div>

                    <h2
                      data-testid="slider-active-title"
                      className="font-display font-black text-xl md:text-3xl text-ink-primary tracking-tight"
                    >
                      {product.name}
                    </h2>

                    {product.price !== undefined ? (
                      <div className="flex items-baseline gap-2">
                        <span className="font-display font-extrabold text-brand-primary tabular-nums text-xl md:text-3xl">
                          {(salePrice ?? originalPrice ?? 0).toLocaleString('vi-VN')}đ
                        </span>
                        {hasActivePromotion && originalPrice && originalPrice > (salePrice ?? 0) && (
                          <span className="text-sm text-gray-400 line-through tabular-nums">
                            {originalPrice.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-ink-muted">Liên hệ để biết giá</span>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        data-testid="slider-cta"
                        onClick={() => navigate(getProductPath(product))}
                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-ink-primary hover:bg-brand-primary text-white font-bold text-sm transition-colors duration-200 shadow-sm"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={product.id || idx}
                data-testid={`center-slide-${idx}`}
                onClick={() => setActiveIndex(idx)}
                className="w-36 md:w-48 shrink-0 rounded-2xl border border-line-tag bg-gray-50 p-3 opacity-40 scale-95 transition-all duration-300 cursor-pointer hover:opacity-75 flex flex-col items-center justify-center text-center gap-2"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveIndex(idx);
                  }
                }}
              >
                <div className="w-full aspect-square rounded-xl bg-white flex items-center justify-center p-2 overflow-hidden border border-line-tag">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-ink-muted text-xs font-bold line-clamp-2">{product.name}</div>
                  )}
                </div>
                <p className="font-display font-bold text-xs text-ink-primary truncate w-full">
                  {product.name}
                </p>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            type="button"
            data-testid="slider-prev"
            aria-label="Slide trước"
            onClick={handlePrev}
            className="p-2 rounded-full border border-line-tag hover:border-line-strong bg-white text-ink-primary transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div data-testid="slider-dots" className="slick-dots flex items-center gap-2">
            {products.map((_, idx) => (
              <button
                key={idx}
                type="button"
                data-testid={`slider-dot-${idx}`}
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setActiveIndex(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  idx === safeIndex ? 'w-8 bg-ink-primary' : 'w-2.5 bg-line-tag hover:bg-ink-muted'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            data-testid="slider-pause-toggle"
            aria-pressed={isPaused}
            aria-label={isPaused ? 'Phát trình chiếu' : 'Tạm dừng trình chiếu'}
            onClick={() => setIsPaused(p => !p)}
            className="p-2 rounded-full border border-line-tag hover:border-line-strong bg-white text-ink-primary transition"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            type="button"
            data-testid="slider-next"
            aria-label="Slide tiếp"
            onClick={handleNext}
            className="p-2 rounded-full border border-line-tag hover:border-line-strong bg-white text-ink-primary transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
