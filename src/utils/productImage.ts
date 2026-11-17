// Product pictures: the PIM serves 1024x1024 originals from https://pim.voma.vn/media/<file>. /api/img (api/img.ts)
// returns the same picture resized to one of IMAGE_WIDTHS as WebP. The page-facing contract lives here:
//
//   * a URL that is exactly https://pim.voma.vn/media/<plain file name>.<jpg|jpeg|png|webp|avif> is rewritten
//     to /api/img?f=<file name>&w=<width>;
//   * EVERY other URL (local /banners/..., data: URLs, other hosts, a pim.voma.vn URL with a query string or a
//     sub-path) is returned UNCHANGED and gets no srcset. That is the rule, not a fallback: those pictures are
//     not the PIM's content-unique media files, so there is nothing to resize.
//
// api/img.ts imports MEDIA_FILE and IMAGE_WIDTHS from here: what the helper emits and what the function accepts
// are the same two definitions.

// Layout-derived (CSS box x device-pixel-ratio 1-3, measured at 390 and 1440 px): 192 thumbnails / cart / search
// (<= 64 css px x3), 320 card at 390 px dpr2 and 1440 px dpr1 (148-259 css px), 540 the middle size: phone card
// dpr3 (444), home card dpr2 (488), desktop catalog card dpr2 (518), desktop main picture dpr1 (466), 768 gallery
// main at 390 dpr2, 1024 zoom and the source size. Each extra width is one more CDN cache entry per picture:
// keep the list short.
export const IMAGE_WIDTHS = [192, 320, 540, 768, 1024] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

export const MEDIA_ORIGIN = 'https://pim.voma.vn';
export const MEDIA_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:jpe?g|png|webp|avif)$/i;
const MEDIA_URL_PREFIX = `${MEDIA_ORIGIN}/media/`;

export function mediaFileName(src: string): string | null {
  if (!src.startsWith(MEDIA_URL_PREFIX)) return null;
  const file = src.slice(MEDIA_URL_PREFIX.length);
  return MEDIA_FILE.test(file) && !file.includes('..') ? file : null;
}

export function resizedImageUrl(src: string, width: ImageWidth): string {
  if (!IMAGE_WIDTHS.includes(width)) throw new RangeError(`resizedImageUrl: width ${width} is not one of ${IMAGE_WIDTHS.join(', ')}`);
  const file = mediaFileName(src);
  return file ? `/api/img?f=${encodeURIComponent(file)}&w=${width}` : src;
}

// srcset for the resizable URLs; undefined for every other URL (see the rule above).
export function imageSrcSet(src: string, widths: readonly ImageWidth[] = IMAGE_WIDTHS): string | undefined {
  if (!mediaFileName(src)) return undefined;
  return widths.map((w) => `${resizedImageUrl(src, w)} ${w}w`).join(', ');
}
