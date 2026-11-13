// Responsive sources for a /banners/<name>.webp image (1024×1024); <name>-640.webp sits next to it.
// The hero box shows it at most 52% of 1440px wide (desktop) or 290px tall, cover (mobile).
export const BANNER_SIZE = 1024;
export const BANNER_SIZES = '(min-width: 768px) 52vw, 290px';
export const bannerSrcSet = (src: string) => `${src.replace(/\.webp$/, '-640.webp')} 640w, ${src} ${BANNER_SIZE}w`;
