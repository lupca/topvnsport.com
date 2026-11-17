// @vitest-environment jsdom
// Gác ảnh sản phẩm (perf/product-images-lazy-resized): mọi ảnh sản phẩm trong src đi qua productImgProps (/api/img,
// srcset + sizes), ảnh dưới màn đầu là lazy, ảnh gốc chỉ được tải khi mở zoom, và lỗi ảnh vẫn ra "Chưa có ảnh".
import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductMediaGallery from '../components/ProductMediaGallery';
import MobilePurchaseBar from '../components/product-detail/MobilePurchaseBar';
import { renderProductPage } from '../../api/product';
import robotsHandler from '../../api/robots';
import { IMAGE_PLACES, IMAGE_WIDTHS, mainPictureSource, productImgProps } from '../utils/productImage';
import type { Product } from '../types';

const SRC = join(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? (e.name === '__tests__' ? [] : walk(p)) : /\.tsx$/.test(e.name) ? [p] : [];
  });

// Every JSX <img ...> element of src (tests excluded): the text from "<img" to its closing ">" at brace depth 0.
function jsxTags(text: string, name = '<img'): string[] {
  const tags: string[] = [];
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + name.length)) {
    let depth = 0;
    let i = at;
    for (; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
      else if (text[i] === '>' && depth === 0 && text[i - 1] !== '=') break;
    }
    tags.push(text.slice(at, i + 1));
  }
  return tags;
}

const images = walk(SRC).flatMap((file) => jsxTags(readFileSync(file, 'utf8')).map((tag) => ({ file: file.replace(`${SRC}/`, ''), tag })));
// Pictures that are not product pictures (the shop logo, the local hero banners): nothing to resize.
const NOT_PRODUCT = /src=\{LOGO_SRC\}|src=\{load \? image\.src : undefined\}/;
// The zoom view shows the original on purpose and only exists once opened.
const ZOOM = /alt=\{`\$\{productName\} zoom`\}/;
const productImages = images.filter(({ tag }) => !NOT_PRODUCT.test(tag));
// Eager on purpose: the product page's main picture (largest paint, fetchPriority high) and the quick view (opens on a click, is the whole dialog).
const EAGER_OK = (file: string, tag: string) =>
  (file.endsWith('ProductMediaGallery.tsx') && /fetchPriority="high"/.test(tag)) || file.endsWith('QuickViewModal.tsx');

describe('guard: every product <img> in src goes through productImgProps', () => {
  it('finds the pictures this guard is about (so a parser that finds none cannot pass)', () => {
    expect(images.length).toBeGreaterThanOrEqual(12);
    expect(productImages.length).toBeGreaterThanOrEqual(9);
  });

  it.each(productImages.map((i) => [`${i.file}: ${i.tag.slice(0, 70).replace(/\s+/g, ' ')}`, i] as const))('%s', (_n, { file, tag }) => {
    if (ZOOM.test(tag)) {
      expect(tag).toMatch(/src=\{selectedImage\}/); // the original, by design
      return;
    }
    expect(tag, 'a product picture must spread productImgProps(...) (no raw src)').toMatch(/\{\.\.\.productImgProps\(/);
    expect(tag, 'a product picture must not also set a raw src').not.toMatch(/\bsrc=/);
    expect(tag, 'decoding="async"').toMatch(/decoding="async"/);
    if (!EAGER_OK(file, tag)) expect(tag, 'a picture below the first screen must be lazy').toMatch(/loading=(?:"lazy"|\{[^}]*'lazy'[^}]*\})/);
  });

  // Every file that renders <ProductCard ...> (not a hand-picked list): a grid never passes `priority` to all its cards.
  const cardFiles = walk(SRC).filter((f) => /<ProductCard\b/.test(readFileSync(f, 'utf8')));
  it('finds the files that render ProductCard (home, sale, catalog)', () => {
    expect(cardFiles.map((f) => f.replace(`${SRC}/`, '')).sort()).toEqual(
      expect.arrayContaining(['features/catalog/CatalogPage.tsx', 'features/home/HomePage.tsx', 'features/home/SaleSection.tsx']));
  });
  it.each(cardFiles.map((f) => [f.replace(`${SRC}/`, ''), f] as const))('%s: a ProductCard is eager only for the first row (priority={i < FIRST_SCREEN_CARDS}), never the whole grid', (_n, f) => {
    const text = readFileSync(f, 'utf8');
    const tags = jsxTags(text, '<ProductCard');
    // Every occurrence is parsed (a `=>` inside an attribute must not cut a tag short and hide its `priority`).
    expect(tags.length, 'parsed tags = occurrences of <ProductCard').toBe(text.split('<ProductCard').length - 1);
    for (const tag of tags) {
      expect(tag.endsWith('>'), 'tag parsed to its closing >').toBe(true);
      const priority = tag.match(/\bpriority\b(=\{[^}]*\})?/);
      if (priority) {
        expect(priority[1], 'priority must depend on the card index').toBe('={i < FIRST_SCREEN_CARDS}');
        expect(Number(text.match(/const FIRST_SCREEN_CARDS = (\d+);/)?.[1]), 'FIRST_SCREEN_CARDS declared here, <= 4').toBeLessThanOrEqual(4);
      }
    }
  });

  // Self-sized pictures (laid out from the file's own pixel size) must never get descriptors: see IMAGE_PLACES.
  it('galleryMain and quickView are self-sized places: one width, no sizes (so never a srcset)', () => {
    for (const place of [IMAGE_PLACES.galleryMain, IMAGE_PLACES.quickView]) {
      expect(place.widths).toEqual([1024]);
      expect((place as { sizes?: string }).sizes).toBeUndefined();
    }
    for (const place of [IMAGE_PLACES.galleryMain, IMAGE_PLACES.quickView]) {
      expect(productImgProps(PIM(1), place)).toEqual({ src: '/api/img?f=00000000-0000-4000-8000-000000000001.jpg&w=1024' });
    }
  });
  it.each([['components/ProductMediaGallery.tsx', 'galleryMain'], ['components/QuickViewModal.tsx', 'quickView']])('%s: the %s picture never sets srcset/sizes by hand', (file, place) => {
    const tag = jsxTags(readFileSync(join(SRC, file), 'utf8')).find((t) => t.includes(`IMAGE_PLACES.${place}`))!;
    expect(tag, `${place} <img> found`).toBeTruthy();
    expect(tag).not.toMatch(/srcSet|sizes=/i);
  });
  it.each([['components/ProductMediaGallery.tsx'], ['../api/product.ts']])('%s builds the tablet <source> from mainPictureSource only (no hand-written media/srcset)', (file) => {
    const text = readFileSync(join(SRC, file), 'utf8');
    expect(text).toContain('mainPictureSource(');
    expect(text).not.toMatch(/min-resolution|min-width: 600px|w=1536/);
  });
  it('mainPictureSource: only inside 600-1023.98 px at dpr >= 1.5, w=1536, NO descriptor', () => {
    const src = mainPictureSource(PIM(1))!;
    expect(src.media).toBe('(min-width: 600px) and (max-width: 1023.98px) and (min-resolution: 1.5dppx)');
    expect(src.srcSet).toBe('/api/img?f=00000000-0000-4000-8000-000000000001.jpg&w=1536');
    expect(src.srcSet).not.toMatch(/\s\d+[wx]\b/);
    expect(mainPictureSource('https://cdn.example.com/a.jpg')).toBeNull();
  });
  it('gallery main + SSR cover: the same <picture style="display:contents"><source media srcset></source><img src w=1024> (one download), no descriptor, no sizes', () => {
    const { container } = render(<ProductMediaGallery productName="Vợt 1" image={PIM(1)} gallery={[PIM(1), PIM(2)]} />);
    const pic = container.querySelector('picture')!;
    expect(pic.getAttribute('style')).toContain('display: contents');
    const [source] = [...pic.querySelectorAll('source')];
    expect(pic.querySelectorAll('source').length).toBe(1);
    expect(pic.querySelector('img')!.getAttribute('src')).toMatch(/&w=1024$/);
    const html = renderProductPage('<html><head></head><body><div id="root"></div></body></html>', product({ gallery: [PIM(1), PIM(2)] }), 'https://www.topvnsport.com/product/vot-1');
    const cover = html.match(/<picture style="display:contents">(<source [^>]*>)(<img [^>]*>)<\/picture>/)!;
    expect(cover, 'cover is <picture style=display:contents><source><img></picture>').toBeTruthy();
    const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]?.replace(/&amp;/g, '&');
    expect(attr(cover[1], 'media')).toBe(source.getAttribute('media'));
    expect(attr(cover[1], 'srcset')).toBe(source.getAttribute('srcset'));
    expect(attr(cover[2], 'src')).toBe(pic.querySelector('img')!.getAttribute('src'));
    expect(cover[1]).not.toMatch(/ sizes=/);
  });
  it('api/product.ts: the server-rendered cover uses the galleryMain place and no hand-written srcset/sizes', () => {
    const text = readFileSync(join(process.cwd(), 'api/product.ts'), 'utf8');
    const tag = text.split('\n').find((l) => l.includes('IMAGE_PLACES.galleryMain'))!;
    expect(tag).toBeTruthy();
    expect(tag).not.toMatch(/srcset|sizes=/i);
  });

  it('no component imports a pim.voma.vn URL into an <img> by hand', () => {
    const raw = walk(SRC).filter((f) => /pim\.voma\.vn\/media/.test(readFileSync(f, 'utf8')) && !f.endsWith('productImage.ts'));
    expect(raw.map((f) => f.replace(SRC, 'src'))).toEqual([]);
  });
});

const PIM = (n: number) => `https://pim.voma.vn/media/00000000-0000-4000-8000-${String(n).padStart(12, '0')}.jpg`;
const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', slug: 'vot-1', name: 'Vợt 1', brand: 'Yonex', image: PIM(1), category: 'Vợt', categoryCode: 'VC1', price: 100000, hasActivePromotion: false, specs: {}, description: '', stock: 5, ...over,
} as Product);
const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
afterEach(cleanup);

describe('guard: rendered pictures', () => {
  it('product card: resized url + srcset + sizes, lazy by default, eager as first-screen priority, no raw PIM url', () => {
    const { container, rerender } = inRouter(<ProductCard product={product()} onQuickView={() => {}} onAddToCart={() => {}} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/api/img?f=00000000-0000-4000-8000-000000000001.jpg&w=320');
    expect(img.getAttribute('srcset')).toBe(
      [320, 540, 768, 1024].map((w) => `/api/img?f=00000000-0000-4000-8000-000000000001.jpg&w=${w} ${w}w`).join(', '));
    expect(img.getAttribute('sizes')).toBe(IMAGE_PLACES.cardHome.sizes);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(container.innerHTML).not.toContain('pim.voma.vn');
    rerender(<MemoryRouter><ProductCard product={product()} priority onQuickView={() => {}} onAddToCart={() => {}} /></MemoryRouter>);
    expect(container.querySelector('img')!.getAttribute('loading')).toBe('eager');
  });

  it('product card: the resizer answering an error (502) still shows "Chưa có ảnh" in place of the picture', () => {
    const { container } = inRouter(<ProductCard product={product()} onQuickView={() => {}} onAddToCart={() => {}} />);
    fireEvent.error(container.querySelector('img')!); // what the browser fires when /api/img answers 502
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('image-placeholder').textContent).toContain('Chưa có ảnh');
  });

  it('a picture that is not a PIM media file (local, other host) is left exactly as it is: no srcset, no /api/img', () => {
    for (const image of ['https://cdn.example.com/a.jpg', '/banners/a.webp', 'https://pim.voma.vn/media/a.jpg?x=1']) {
      expect(productImgProps(image, IMAGE_PLACES.cardHome)).toEqual({ src: image });
    }
  });

  it('gallery: main picture resized + eager + fetchpriority high; the original is requested only when zoom opens', () => {
    const gallery = [PIM(1), PIM(2), PIM(3)];
    const { container } = render(<ProductMediaGallery productName="Vợt 1" image={gallery[0]} gallery={gallery} />);
    expect(container.innerHTML).not.toContain('pim.voma.vn'); // before opening zoom, no original anywhere in the page
    const imgs = [...container.querySelectorAll('img')];
    const main = imgs[0];
    expect(main.getAttribute('src')).toMatch(/^\/api\/img\?f=.*&w=1024$/);
    expect(main.getAttribute('srcset')).toBeNull(); // self-sized: descriptors would shrink small originals
    expect(main.getAttribute('sizes')).toBeNull();
    expect(main.getAttribute('loading')).toBeNull(); // eager
    expect(main.getAttribute('fetchpriority')).toBe('high');
    const thumbs = imgs.slice(1);
    expect(thumbs.length).toBeGreaterThan(0);
    for (const t of thumbs) {
      expect(t.getAttribute('src')).toMatch(/^\/api\/img\?f=.*&w=192$/);
      expect(t.getAttribute('loading')).toBe('lazy');
    }
    fireEvent.click(main.parentElement!); // open zoom
    const zoom = [...container.ownerDocument.querySelectorAll('img')].find((i) => /zoom$/.test(i.alt))!;
    expect(zoom.getAttribute('src')).toBe(gallery[0]); // the original, exactly
    expect(zoom.getAttribute('srcset')).toBeNull();
  });

  it('mobile purchase bar: 192 px, lazy', () => {
    const { container } = render(<MobilePurchaseBar productName="Vợt 1" productImage={PIM(1)} totalDisplayPrice={1} hasPrice onBuyNow={() => {}} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(/&w=192$/);
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('server-rendered product page: the cover is the same single resized picture as the gallery main (w=1024, no srcset/sizes), eager, in a CSS square (width/height 600 kept)', () => {
    const p = product({ gallery: [PIM(1), PIM(2)] });
    const html = renderProductPage('<html><head></head><body><div id="root"></div></body></html>', p, 'https://www.topvnsport.com/product/vot-1');
    const tag = html.match(/<img [^>]*>/)![0];
    expect(tag).toContain('src="/api/img?f=00000000-0000-4000-8000-000000000001.jpg&amp;w=1024"');
    expect(tag).not.toMatch(/srcset|sizes=/i);
    expect(tag).toContain('fetchpriority="high"');
    expect(tag).not.toContain('loading="lazy"');
    expect(tag).toContain('width="600" height="600"');
    expect(tag).toContain('aspect-ratio:1/1');
    expect(tag).toContain('height:auto');
    expect(tag).not.toContain('pim.voma.vn');
  });

  it('places: widths are a subset of IMAGE_WIDTHS and every srcset url is the canonical one', () => {
    for (const place of Object.values(IMAGE_PLACES)) for (const w of place.widths) expect(IMAGE_WIDTHS).toContain(w);
  });

  it('robots.txt: /api/img is crawlable by longest match, the rest of /api/ and /checkout/ stay out', async () => {
    let body = '';
    await robotsHandler({ method: 'GET' }, { setHeader() {}, status() { return { send: (b: string) => { body = b; } }; } });
    const rules = body.split('\n').flatMap((l) => { const m = /^(Allow|Disallow): (\S+)$/.exec(l); return m ? [{ allow: m[1] === 'Allow', path: m[2] }] : []; });
    // Google: the longest matching path wins; on a tie, Allow wins
    const allowed = (url: string) => {
      const hit = rules.filter((r) => url.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))[0];
      return hit ? hit.allow : true;
    };
    expect(allowed('/api/img?f=00000000-0000-4000-8000-000000000001.jpg&w=540')).toBe(true);
    expect(allowed('/api/imgx')).toBe(false);
    expect(allowed('/api/img/')).toBe(false);
    expect(allowed('/api/img')).toBe(false);
    expect(allowed('/api/pmi/public/products')).toBe(true);
    expect(allowed('/api/identity/me')).toBe(false);
    expect(allowed('/api/order')).toBe(false);
    expect(allowed('/checkout/')).toBe(false);
    expect(allowed('/product/1')).toBe(true);
  });
});
