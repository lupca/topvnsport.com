import bannersJson from '../../config/heroBanners.json';

export interface HeroBannerItem {
  headline: string;
  subline: string;
  cta: { label: string; href: string };
  image: { src: string; alt: string };
}

// CTA chỉ được dẫn trong site ("/x", không "//x" hay "/\x") hoặc gọi điện; ảnh chỉ lấy từ public/banners/.
const CTA_HREF = /^(\/(?![/\\])|tel:\+?\d+$)/;
const IMAGE_SRC = /^\/banners\/[\w.-]+\.(webp|jpe?g|png)$/;

function text(parent: unknown, key: string, path: string): string {
  const v = (parent as Record<string, unknown> | null | undefined)?.[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${path}.${key} thiếu hoặc rỗng`);
  return v;
}

// Ném lỗi (không có danh sách mặc định) khi cấu hình sai: HeroBanner hiện lỗi thay vì banner.
export function parseHeroBanners(raw: unknown): HeroBannerItem[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('heroBanners.json phải là mảng có ít nhất 1 banner');
  return raw.map((b, i) => {
    const p = `banners[${i}]`;
    const item = {
      headline: text(b, 'headline', p),
      subline: text(b, 'subline', p),
      cta: { label: text(b?.cta, 'label', `${p}.cta`), href: text(b?.cta, 'href', `${p}.cta`) },
      image: { src: text(b?.image, 'src', `${p}.image`), alt: text(b?.image, 'alt', `${p}.image`) },
    };
    if (!CTA_HREF.test(item.cta.href)) throw new Error(`${p}.cta.href phải là đường dẫn trong site hoặc tel:`);
    if (!IMAGE_SRC.test(item.image.src)) throw new Error(`${p}.image.src phải nằm trong /banners/`);
    return item;
  });
}

export type HeroBannersResult = { banners: HeroBannerItem[] } | { error: string };

export function loadHeroBanners(raw: unknown = bannersJson): HeroBannersResult {
  try {
    return { banners: parseHeroBanners(raw) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
