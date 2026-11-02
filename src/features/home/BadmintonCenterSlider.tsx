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
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, products.length]);

  if (!products || products.length === 0) {
    return null;
  }

  const count = products.length;
  const safeIndex = ((activeIndex % count) + count) % count;
  const activeProduct = products[safeIndex];
  const prevIndex = (safeIndex - 1 + count) % count;
  const nextIndex = (safeIndex + 1) % count;
  const showPrevPeek = count > 2;
  const showNextPeek = count > 1;

  const playStyle = inferRacketPlayStyle(activeProduct) ?? activeProduct.characteristics;
  const { salePrice, originalPrice, hasActivePromotion } = getPriceDisplay(activeProduct);
  const productPath = getProductPath(activeProduct);

  const handlePrev = () => {
    setActiveIndex(prev => (prev - 1 + count) % count);
  };

  const handleNext = () => {
    setActiveIndex(prev => (prev + 1) % count);
  };

  const renderPeekSlide = (idx: number) => {
    const peekProduct = products[idx];
    return (
      <div
        key={peekProduct.id || idx}
        data-testid={`center-slide-${idx}`}
        onClick={() => setActiveIndex(idx)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveIndex(idx);
          }
        }}
        className="center-slide-peek relative w-full h-full max-h-[338px] md:h-[454px] md:max-h-[454px] overflow-hidden bg-brand-light border border-line-tag opacity-40 hover:opacity-60 transition-opacity duration-300 cursor-pointer flex items-center justify-center p-1 md:p-6"
      >
        {peekProduct.image && (
          <img
            src={peekProduct.image}
            alt={peekProduct.name}
            className="max-h-full max-w-full object-contain"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    );
  };

  return (
    <section data-testid="badminton-center-slider" className="hero-slider-section w-full overflow-hidden">
      <div className="center-slider-viewport grid grid-cols-[18px_minmax(0,1fr)_18px] gap-[8px] md:grid-cols-[1fr_minmax(0,1060px)_1fr] md:gap-[18px] items-start w-full overflow-hidden">
        {showPrevPeek ? renderPeekSlide(prevIndex) : <div aria-hidden="true" />}

        <div
          data-testid="center-slide-active"
          className="center-slide-active col-start-2 relative w-full min-w-0 overflow-hidden border border-line-strong bg-surface opacity-100 scale-100"
        >
          <div
            data-testid="slider-visual-wrap"
            className="slide-visual-wrap relative w-full aspect-square md:aspect-[1400/600] overflow-hidden bg-brand-light flex items-center justify-center p-4 md:p-6"
          >
            {activeProduct.image ? (
              <img
                src={activeProduct.image}
                alt={activeProduct.name}
                className="hero-main-img max-h-full max-w-full object-contain transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-ink-muted font-bold text-sm truncate max-w-full">{activeProduct.name}</div>
            )}

            <div
              data-testid="slider-product-chip"
              className="slide-product-chip absolute inset-x-[8px] bottom-[8px] md:inset-x-auto md:right-[20px] md:bottom-[20px] md:w-[350px] md:max-w-[350px] bg-surface/95 border border-line-strong rounded-[6px] md:rounded-[10px] px-[9px] py-[5px] md:px-[14px] md:py-[9px] flex items-center gap-[12px] shadow-md z-10 overflow-hidden min-w-0"
            >
              {activeProduct.image && (
                <img
                  src={activeProduct.image}
                  alt={activeProduct.name}
                  className="hidden md:block w-[52px] h-[52px] shrink-0 rounded-[6px] border border-line-tag bg-brand-light p-[4px] object-contain"
                  referrerPolicy="no-referrer"
                />
              )}

              <div className="slide-chip-meta min-w-0 flex-1 flex flex-col gap-[2px] overflow-hidden">
                <div className="flex items-center gap-1.5 md:flex-col md:items-start md:gap-[2px] min-w-0 overflow-hidden">
                  {playStyle && (
                    <span
                      data-testid="slider-playstyle-badge"
                      className="shrink-0 inline-flex items-center px-1.5 py-0 md:px-2 md:py-[1px] rounded-full font-mono text-[9px] leading-[12px] md:text-[10px] md:leading-[12px] font-bold uppercase tracking-wider border border-line-tag bg-pill-bg text-ink-primary max-w-full truncate"
                    >
                      {playStyle}
                    </span>
                  )}

                  <h2
                    data-testid="slider-active-title"
                    className="slide-chip-name font-display font-extrabold text-[11px] leading-[14px] md:text-[13px] md:leading-[16px] text-ink-primary min-w-0 flex-1 md:w-full break-words line-clamp-1 md:line-clamp-2"
                  >
                    {activeProduct.name}
                  </h2>
                </div>

                <div className="slide-chip-bottom flex items-center justify-between gap-[8px] min-w-0 md:mt-[1px] overflow-hidden">
                  {activeProduct.price !== undefined ? (
                    <div className="flex items-baseline gap-[6px] min-w-0 overflow-hidden">
                      <span className="slide-chip-price font-display font-black text-[12px] leading-[15px] md:text-[14px] md:leading-[18px] text-brand-sale tabular-nums truncate">
                        {(salePrice ?? originalPrice ?? 0).toLocaleString('vi-VN')}đ
                      </span>
                      {hasActivePromotion && (
                        <span
                          data-testid="slider-original-price"
                          className="text-[10px] leading-none text-ink-muted line-through tabular-nums shrink-0"
                        >
                          {(originalPrice ?? 0).toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] leading-[14px] font-bold text-ink-muted truncate">
                      Liên hệ để biết giá
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate(productPath)}
                    className="slide-chip-btn shrink-0 bg-ink-primary hover:bg-brand-primary text-white text-[10.5px] leading-[13px] md:text-[11px] md:leading-[14px] font-bold px-[7px] py-[3px] md:px-[9px] md:py-[4px] rounded-[4px] transition-colors duration-150"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            data-testid="slider-caption-bar"
            className="slide-caption-bar flex flex-row items-center md:flex-row md:items-center justify-between gap-2.5 md:gap-5 px-3 py-2 md:px-6 md:py-4 bg-surface border-t-[1.5px] border-ink-primary min-w-0 overflow-hidden"
          >
            <div className="slide-caption-left min-w-0 flex-1 flex flex-col gap-1 overflow-hidden">
              {(activeProduct.brand || activeProduct.category) && (
                <div className="slide-caption-eyebrow hidden md:block font-mono text-[11.5px] font-bold uppercase tracking-[0.08em] text-brand-primary truncate">
                  {activeProduct.brand && <span>{activeProduct.brand}</span>}
                  {activeProduct.brand && activeProduct.category && <span className="mx-1.5">·</span>}
                  {activeProduct.category && <span>{activeProduct.category}</span>}
                </div>
              )}
              <div className="slide-caption-title font-display font-black text-[13px] leading-[1.3] md:text-[19px] text-ink-primary min-w-0 break-words line-clamp-1 md:line-clamp-1">
                {activeProduct.name}
              </div>
              {activeProduct.description?.trim() && (
                <div className="slide-caption-sub hidden text-[13.5px] leading-[1.45] font-medium text-ink-secondary min-w-0 break-words whitespace-normal line-clamp-2 md:line-clamp-1">
                  {activeProduct.description}
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="slider-cta"
              onClick={() => navigate(productPath)}
              className="slide-caption-cta shrink-0 w-auto md:w-auto bg-ink-primary hover:bg-brand-primary text-white border-[1.5px] border-ink-primary hover:border-brand-primary px-3 py-1.5 md:px-5 md:py-[11px] font-display text-[11.5px] md:text-[13px] font-extrabold uppercase tracking-[0.04em] whitespace-nowrap rounded-[4px] transition-colors duration-150"
            >
              Xem chi tiết
            </button>
          </div>
        </div>

        {showNextPeek ? renderPeekSlide(nextIndex) : <div aria-hidden="true" />}
      </div>

      <div className={count <= 1 ? 'hidden' : 'slider-controls flex items-center justify-center gap-3.5 mt-2 md:mt-4'}>
        <button
          type="button"
          data-testid="slider-prev"
          aria-label="Sản phẩm trước"
          onClick={handlePrev}
          className="slider-arrow w-[34px] h-[34px] rounded-full border border-line-strong bg-surface hover:bg-ink-primary text-ink-primary hover:text-white inline-flex items-center justify-center transition"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <div data-testid="slider-dots" className="slick-dots flex items-center gap-2.5">
          {products.map((_, idx) => {
            const isCurrent = idx === safeIndex;
            return (
              <button
                key={idx}
                type="button"
                data-testid={`slider-dot-${idx}`}
                aria-label={`Xem sản phẩm ${idx + 1}/${count}`}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => setActiveIndex(idx)}
                className={`h-[11px] rounded-full border border-line-strong transition-all duration-200 ${
                  isCurrent ? 'w-[38px] bg-ink-primary' : 'w-[11px] bg-line-tag hover:bg-ink-muted'
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          data-testid="slider-next"
          aria-label="Sản phẩm tiếp theo"
          onClick={handleNext}
          className="slider-arrow w-[34px] h-[34px] rounded-full border border-line-strong bg-surface hover:bg-ink-primary text-ink-primary hover:text-white inline-flex items-center justify-center transition"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          data-testid="slider-pause-toggle"
          aria-pressed={isPaused}
          aria-label={isPaused ? 'Phát tiếp' : 'Tạm dừng'}
          onClick={() => setIsPaused(p => !p)}
          className="slick-pause-btn inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-ink-primary bg-surface hover:bg-surface-hover border border-line-strong rounded-[4px] transition"
        >
          {isPaused ? <Play className="w-3.5 h-3.5" aria-hidden="true" /> : <Pause className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{isPaused ? 'Phát tiếp' : 'Tạm dừng'}</span>
        </button>
      </div>
    </section>
  );
}
