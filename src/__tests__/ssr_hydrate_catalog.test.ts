// Review 14/11 item 3: crawlers may fetch the public catalog reads; the SPA starts from the catalog the
// server rendered home/catalog from (window.__CATALOG__), so a failed/slow /api fetch never wipes it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import robots from '../../api/robots';
import { renderCatalog, renderHome } from '../../api/page';
import { buildInitialState } from '../features/appData/appDataSlice';
import { saveCatalog } from '../features/appData/catalogCache';
import { catalogH1, catalogHead } from '../utils/productHead';
import type { Category, Product } from '../types';

const SHELL = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const CATS = [{ id: 1, code: 'VC1', name: 'Vợt Cầu Lông', parent_id: null, display_name: 'Cầu Lông > Vợt Cầu Lông' }] as Category[];
const PRODUCTS = [{ id: '1', name: 'Vợt </script>', categoryCode: 'VC1', variants: [], tier_variations: [] }] as unknown as Product[];
const inlined = (html: string) => {
  const win: any = {};
  new Function('window', html.match(/<script>(window\.__CATALOG__=[\s\S]*?)<\/script>/)![1])(win);
  return win.__CATALOG__;
};

beforeEach(() => localStorage.clear());
afterEach(() => { delete (window as any).__CATALOG__; });

describe('robots.txt', () => {
  it('allows the public catalog reads, keeps the rest of /api/ and checkout out', async () => {
    let body = '';
    await robots({ method: 'GET' }, { setHeader() {}, status() { return { send: (b: string) => { body = b; } }; } });
    expect(body).toContain('Allow: /api/pmi/public/\nAllow: /api/wms/public/\nDisallow: /api/\n');
    expect(body).toContain('Disallow: /checkout/');
  });
});

describe('home/catalog inline the catalog they were rendered from', () => {
  it('window.__CATALOG__ (script-safe) on home and catalog; catalog H1 = catalogH1(head)', () => {
    expect(inlined(renderHome(SHELL, CATS, PRODUCTS))).toEqual({ categories: CATS, products: PRODUCTS });
    const head = catalogHead('VC1', CATS, PRODUCTS)!;
    const html = renderCatalog(SHELL, head, 'VC1', CATS, PRODUCTS);
    expect(inlined(html)).toEqual({ categories: CATS, products: PRODUCTS });
    expect(html).toContain(`<h1>${catalogH1(head)}</h1>`);
  });

  it('the store starts from it: no loading state, cache extras kept, background refresh flagged', () => {
    saveCatalog({ products: [{ id: 'old' }], branches: [{ id: 'b' }], stringOptions: [{ id: 's' }], categories: [] });
    (window as any).__CATALOG__ = { categories: CATS, products: PRODUCTS };
    const s = buildInitialState(undefined);
    expect(s.isLoading).toBe(false);
    expect(s.catalogFromCache).toBe(true);
    expect(s.products.map(p => p.id)).toEqual(['1']);
    expect(s.categories).toEqual(CATS);
    expect(s.stringOptions).toEqual([{ id: 's' }]);
    (window as any).__CATALOG__ = { categories: CATS, products: [] };
    expect(buildInitialState(undefined).products.map(p => p.id)).toEqual(['old']);
  });
});
