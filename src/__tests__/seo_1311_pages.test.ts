// SEO audit 13/11: server-rendered home/catalog (items 1-3) and middleware routing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOME_SEO } from '../config/seo';
import { renderCatalog, renderHome } from '../../api/page';
import { catalogHead } from '../utils/productHead';
import { pageRewrite, stripTracking } from '../../middleware';
import type { Category, Product } from '../types';

const SHELL = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const cp = (s: string) => Array.from(s).length;

const CATS: Category[] = [
  { id: 1, code: 'VC1', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Cầu Lông > Vợt Cầu Lông' },
  { id: 2, code: 'VC2', name: 'Khác', parent_id: null, display_name: 'Cầu Lông > Khác' },
];
const PRODUCTS = [
  { id: '1', name: 'Vợt Yonex A <b>', categoryCode: 'VC1', price: 1000000, salePrice: 1000000, variants: [], tier_variations: [] },
  { id: '2', name: 'Vợt Lining B', categoryCode: 'VC1', price: 2000000, salePrice: 2000000, variants: [], tier_variations: [] },
  { id: '3', name: 'Cuốn cán', categoryCode: 'VC2', variants: [], tier_variations: [] },
] as unknown as Product[];

describe('server-rendered home and catalog (items 1, 2, 3)', () => {
  it('home: config head, canonical /, og:image, H1, paragraph, first banner with fetchpriority, links + prices', () => {
    const html = renderHome(SHELL, CATS, PRODUCTS);
    expect(html).toContain(`<title data-shell-title="Top VN Sport">${HOME_SEO.title}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://www.topvnsport.com/" data-product-head />');
    expect(html).toContain('<meta property="og:type" content="website" data-product-head />');
    expect(html).toContain(`<meta property="og:image" content="${HOME_SEO.ogImage.url}" data-product-head />`);
    expect(html).toContain(`<h1>${HOME_SEO.h1}</h1><p>${HOME_SEO.description}</p>`);
    expect(html).toMatch(/<img class="ssr-hero" src="\/banners\/[\w-]+\.webp" srcset="[^"]+-640\.webp 640w, [^"]+ 1024w" sizes="[^"]+" width="1024" height="1024" fetchpriority="high" alt="[^"]+">/);
    expect(html).toContain('<li><a href="/product/1">Vợt Yonex A &lt;b&gt;</a> <span>1.000.000đ</span></li>');
    expect(html).toContain('<li><a href="/product/3">Cuốn cán</a> <span>Liên hệ để biết giá</span></li>');
    expect(html).toContain('<a href="/catalog?category=VC1">');
    // home keeps the deferred CSS and the catalog preloads (unlike product pages)
    expect(html).toContain('data-catalog-preload');
    expect(HOME_SEO.description).not.toMatch(/số 1|số một|nhất/i);
    expect(cp(HOME_SEO.title)).toBeLessThanOrEqual(60);
    expect(cp(HOME_SEO.description)).toBeGreaterThanOrEqual(120);
    expect(cp(HOME_SEO.description)).toBeLessThanOrEqual(155);
  });

  it('category: own title, 120-155 char description, canonical = sitemap URL, only its products', () => {
    const head = catalogHead('VC1', CATS, PRODUCTS)!;
    expect(head.title).toBe('Vợt Cầu Lông | Top VN Sport');
    expect(head.canonical).toBe('https://www.topvnsport.com/catalog?category=VC1');
    expect(cp(head.description!)).toBeGreaterThanOrEqual(120);
    expect(cp(head.description!)).toBeLessThanOrEqual(155);
    expect(head.description).toMatch(/^Vợt Cầu Lông tại Top VN Sport: 2 sản phẩm (Yonex, Li-Ning|Li-Ning, Yonex)\./);
    expect(catalogHead('VC2', CATS, PRODUCTS)!.title).toBe('Cầu Lông – Khác | Top VN Sport');
    expect(catalogHead('NOPE', CATS, PRODUCTS)).toBeUndefined();
    const html = renderCatalog(SHELL, head, 'VC1', CATS, PRODUCTS);
    expect(html).toContain('<h1>Vợt Cầu Lông</h1>');
    expect(html).toContain('href="/product/2"');
    expect(html).not.toContain('href="/product/3"');
  });
});

describe('middleware routes / and /catalog to the server render (item 1)', () => {
  it('rewrites with route and the non-tracking params', () => {
    expect(pageRewrite(new URL('https://x/?gclid=1'))!.toString()).toBe('https://x/api/page?route=home');
    expect(pageRewrite(new URL('https://x/catalog?category=VC1&utm_source=a'))!.toString()).toBe('https://x/api/page?category=VC1&route=catalog');
    expect(pageRewrite(new URL('https://x/stores'))).toBeNull();
    expect(pageRewrite(new URL('https://x/product/590'))).toBeNull();
    expect(stripTracking(new URL('https://x/product/590?gclid=1'))!.search).toBe('');
  });
});


describe('api/ functions run as unbundled ESM on Vercel', () => {
  it('every value import reachable from api/*.ts is a relative path ending in .js (or a node:/package import)', async () => {
    const { readdirSync, existsSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const root = resolve(__dirname, '../..');
    const queue = readdirSync(join(root, 'api')).filter(f => /^[^.].*\.ts$/.test(f)).map(f => join(root, 'api', f));
    const seen = new Set<string>();
    const bad: string[] = [];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/^(?:import|export)\s+(type\s+)?[^'"]*?from\s+'(\.[^']+)'/gm)) {
        if (m[1]) continue; // import type: erased
        const spec = m[2];
        // a value-syntax import of only types is erased too; those files are listed explicitly
        if (!spec.endsWith('.js')) { if (!/\/types$/.test(spec)) bad.push(`${file.replace(root, '')}: ${spec}`); continue; }
        const ts = join(dirname(file), spec.replace(/\.js$/, '.ts'));
        if (existsSync(ts)) queue.push(ts);
      }
    }
    expect(bad).toEqual([]);
  });
});
