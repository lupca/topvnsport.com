// Product pictures: the PIM serves originals (any size and aspect ratio: measured 484 px to 3024x4032, JPEG) from
// https://pim.voma.vn/media/<file>. /api/img (api/img.ts) returns the same picture resized to one of IMAGE_WIDTHS as WebP. The page-facing contract lives here:
//
//   * a URL that is exactly https://pim.voma.vn/media/<plain file name>.<jpg|jpeg|png|webp> is rewritten
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
// main at 390 dpr2, 1024 the largest the gallery/quick view ask for at dpr2+ on desktop. The zoom view does NOT use
// these widths: it shows the original URL, which the visitor asks for by opening it. Each extra width is one more
// CDN cache entry per picture: keep the list short.
// 1536 is used ONLY by the product page main picture's tablet <source> (mainPictureSource below).
export const IMAGE_WIDTHS = [192, 320, 540, 768, 1024, 1536] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

export const MEDIA_ORIGIN = 'https://pim.voma.vn';
export const MEDIA_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:jpe?g|png|webp)$/i;
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

// ---- Where the pictures are shown -------------------------------------------------------------------------------
// One entry per CSS box that shows a product picture. `sizes` is the box's rendered width in CSS px, written from
// the layout classes and checked against measured boxes (390-1920 px wide, e2e/mobile-audit fixtures); `widths` are
// the srcset candidates that box can ever need (CSS px x device-pixel-ratio 1-3), a subset of IMAGE_WIDTHS.
// A box that never needs more than one width has no srcset: src is that one URL.
//
// Two kinds of place:
//  - fixed box (cards, tiles, thumbnails, cart, search, bar): the CSS box does not depend on the picture, so the
//    place has `sizes` and >= 2 widths and the browser picks a candidate from the srcset.
//  - SELF-SIZED (product page main picture and its server-rendered cover, quick view): the <img> is laid out from the
//    picture's own pixel size (max-h-full / max-w-full), as on `main` with the original. With `w` descriptors the browser
//    takes the intrinsic size from the descriptor, but /api/img never upscales, so a 591 px original asked at w=1024
//    comes back 591 px and would be laid out at 591 x (box / 1024). These places have NO `sizes`, ONE width and so
//    never a srcset: the file's real pixel size (<= 1024) is what the browser lays out, exactly like the original.
export type ImagePlace = { readonly sizes?: string; readonly widths: readonly ImageWidth[] };

export const IMAGE_PLACES = {
  // Home / sale grid card: 2 columns (gap 12, card padding) under 768 px, 4 columns from 1024 px, capped at 1280 px.
  cardHome: { sizes: '(min-width: 1280px) 244px, (min-width: 1024px) calc(25vw - 76px), (min-width: 768px) calc(50vw - 81px), calc(50vw - 47px)', widths: [320, 540, 768, 1024] },
  // Catalog card: sidebar + 3 columns from 1024 px, capped from 1360 px.
  cardCatalog: { sizes: '(min-width: 1360px) 259px, (min-width: 1024px) calc(25vw - 81px), (min-width: 768px) calc(50vw - 91px), calc(50vw - 47px)', widths: [320, 540, 768, 1024] },
  // Home category tile (a product picture of that category), 2 columns, 4 from 1024 px, capped at 1280 px.
  categoryTile: { sizes: '(min-width: 1280px) 287px, (min-width: 1024px) calc(25vw - 33px), (min-width: 768px) calc(50vw - 32px), calc(50vw - 25px)', widths: [320, 540, 768, 1024] },
  // Product page main picture and its server-rendered cover (same URL, so one download), and the quick view picture.
  // SELF-SIZED: one width, no sizes, never a srcset (see the type above). 1024 is wider than every box they live in
  // (647 css px at 1440 px wide; the one-column tablet layout is wider, see MAIN_PICTURE_TABLET), so a large original still fills the box; a small one keeps its natural size, as on main.
  galleryMain: { widths: [1024] },
  quickView: { widths: [1024] },
  // Fixed small boxes (css px x3 <= 192): gallery thumbnail (64 px button), cart line (56), header search (43), mobile bar (40).
  thumb: { sizes: '56px', widths: [192] },
  cartLine: { sizes: '56px', widths: [192] },
  searchResult: { sizes: '43px', widths: [192] },
  purchaseBar: { sizes: '40px', widths: [192] },
} as const satisfies Record<string, ImagePlace>;

// The src / srcSet / sizes for one picture in one place. A URL that is not a resizable PIM picture is returned as
// `src` alone (see the rule at the top of this file).
export function productImgProps(src: string, place: ImagePlace): { src: string; srcSet?: string; sizes?: string } {
  if (!mediaFileName(src)) return { src };
  const [first, ...rest] = place.widths;
  if (rest.length === 0) return { src: resizedImageUrl(src, first) };
  return { src: resizedImageUrl(src, first), srcSet: imageSrcSet(src, place.widths), sizes: place.sizes };
}

// Tablet portrait: below 1024 px the product page is ONE column, so the main picture's box is 600-902 css px wide
// (about 879 at 1000 px, 902 at 1023) and at dpr 2 needs up to ~1800 px. A <source> for that window asks w=1536.
// It has NO width/density descriptor on purpose: like the 1024 <img>, the browser keeps using the file's real pixel
// size (the resizer never upscales), so a small original is laid out exactly as on main. Gallery main picture and the
// server-rendered cover both build their <picture> from this one function, so they cannot drift apart (one download).
export const MAIN_PICTURE_TABLET = '(min-width: 600px) and (max-width: 1023.98px) and (min-resolution: 1.5dppx)';
export function mainPictureSource(src: string): { media: string; srcSet: string } | null {
  return mediaFileName(src) ? { media: MAIN_PICTURE_TABLET, srcSet: resizedImageUrl(src, 1536) } : null;
}
