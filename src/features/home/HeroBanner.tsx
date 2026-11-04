import { TouchEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { HeroBannerItem, loadHeroBanners } from './heroBanners';

const AUTOPLAY_MS = 5000;
const SWIPE_MIN_PX = 40;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
// Khung cố định: 290px dưới md, tỉ lệ 1440:520 từ md. Chiều cao không phụ thuộc slide nào đang hiện.
const BOX = 'relative w-full overflow-hidden bg-brand-secondary max-md:h-[290px] md:aspect-[1440/520] md:max-h-[560px]';
const GUTTER = 'pl-5 md:pl-[max(24px,calc(50%-616px))]';

// ponytail: đọc một lần lúc vào trang (không nghe sự kiện đổi giữa phiên); bật giảm chuyển động giữa chừng thì tải lại trang.
const prefersReducedMotion = () => Boolean(window.matchMedia?.(REDUCED_MOTION).matches);

// key?: repo không có @types/react nên prop key phải khai báo (như ProductCard).
function Slide({ banner, active, index, count }: { key?: number; banner: HeroBannerItem; active: boolean; index: number; count: number }) {
  const { headline, subline, cta, image } = banner;
  const ctaClass = 'mt-4 md:mt-7 inline-flex h-10 md:h-12 items-center bg-surface px-5 md:px-8 font-display text-[13px] md:text-[15px] font-extrabold uppercase tracking-[0.04em] text-brand-secondary transition-colors hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  return (
    <div
      data-testid="hero-banner"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} / ${count}`}
      aria-hidden={!active}
      inert={!active}
      className="relative h-full w-full shrink-0"
    >
      <img data-testid="hero-banner-image" src={image.src} alt={image.alt} className="absolute inset-y-0 right-0 h-full w-[52%] object-cover" />
      <div className="absolute inset-y-0 right-0 w-[52%] bg-gradient-to-r from-brand-secondary to-transparent" aria-hidden="true" />
      <div className={`relative z-10 flex h-full w-[62%] md:w-[50%] flex-col justify-center pr-3 md:pr-0 ${GUTTER} pb-8 text-white`}>
        <h2 className="min-w-0 break-words line-clamp-3 font-display text-[22px] leading-[1.15] md:text-[46px] md:leading-[1.2] font-black">{headline}</h2>
        <p className="mt-2 md:mt-4 min-w-0 break-words line-clamp-3 text-[13px] leading-[18px] md:text-[19px] md:leading-[28px] font-medium">{subline}</p>
        {/* Link của react-router giữ nguyên href tel:/ngoài-SPA, chỉ điều hướng SPA với đường dẫn trong site. */}
        <Link to={cta.href} data-testid="hero-banner-cta" className={`${ctaClass} self-start`}>{cta.label}</Link>
      </div>
    </div>
  );
}

function Carousel({ banners }: { banners: HeroBannerItem[] }) {
  const count = banners.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [reduced] = useState(prefersReducedMotion);
  const autoplay = !paused && !hovered && !reduced && count > 1;

  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => setIndex(i => (i + 1) % count), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [autoplay, index, count]);

  const onTouchEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (!touchStart || !t) return;
    const dx = t.clientX - touchStart.x;
    setTouchStart(null);
    // Vuốt dọc (cuộn trang) không đổi banner.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(t.clientY - touchStart.y)) return;
    setIndex(i => (i + (dx < 0 ? 1 : -1) + count) % count);
  };

  return (
    <section
      data-testid="hero-banner-section"
      aria-roledescription="carousel"
      aria-label="Banner trang chủ"
      className="hero-banner-section w-full max-md:!mt-0 max-md:mb-0 max-md:pt-[12px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div data-testid="hero-banner-box" className={BOX} onTouchStart={e => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={onTouchEnd}>
        <div
          data-testid="hero-banner-track"
          aria-live={autoplay ? 'off' : 'polite'}
          className={`absolute inset-0 flex ${reduced ? 'transition-none' : 'transition-transform duration-500 ease-out motion-reduce:transition-none'}`}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b, i) => <Slide key={i} banner={b} active={i === index} index={i} count={count} />)}
        </div>

        <div className={`absolute bottom-3 md:bottom-6 z-20 flex items-center gap-3 ${GUTTER}`}>
          <div data-testid="slider-dots" className="flex items-center gap-2.5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                data-testid={`slider-dot-${i}`}
                aria-label={`Xem banner ${i + 1}/${count}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className={`relative h-[8px] rounded-full before:absolute before:-inset-[10px] before:content-[''] transition-all duration-200 ${i === index ? 'w-[28px] bg-white' : 'w-[8px] bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
          <button
            type="button"
            data-testid="slider-pause-toggle"
            aria-pressed={paused}
            aria-label={paused ? 'Phát tiếp' : 'Tạm dừng'}
            onClick={() => setPaused(p => !p)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 text-white transition-colors hover:bg-white/20"
          >
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </section>
  );
}

// Cấu hình banner sai -> báo lỗi trong chính ô hero (và console), không hiện banner mặc định hay ô trống.
function HeroBannerError({ message }: { message: string }) {
  useEffect(() => console.error('[HeroBanner] heroBanners.json không hợp lệ:', message), [message]);
  return (
    <section data-testid="hero-banner-section" className="hero-banner-section w-full max-md:!mt-0 max-md:mb-0 max-md:pt-[12px]">
      <div role="alert" className={`${BOX} flex items-center justify-center px-6 text-center text-white`}>
        <p className="text-sm font-bold">Không hiển thị được banner trang chủ: {message}</p>
      </div>
    </section>
  );
}

export default function HeroBanner() {
  const result = useMemo(() => loadHeroBanners(), []);
  return 'error' in result ? <HeroBannerError message={result.error} /> : <Carousel banners={result.banners} />;
}
