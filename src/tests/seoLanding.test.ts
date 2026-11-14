import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import middleware, { stripTracking } from '../../middleware';
import productHandler, { queryOf } from '../../api/product';

describe('ad params are stripped from the canonical product cache key', () => {
  it('removes gclid/gbraid/wbraid/fbclid/utm_*/msclkid/ttclid, keeps real params', () => {
    const u = new URL('https://x.vn/product/590?gclid=a&gbraid=b&wbraid=c&fbclid=d&utm_source=e&UTM_Medium=f&msclkid=g&ttclid=h&color=red');
    expect(stripTracking(u)?.search).toBe('?color=red');
  });
  it('clean URLs and legacy slug URLs pass through', () => {
    expect(stripTracking(new URL('https://x.vn/product/590'))).toBeNull();
    expect(stripTracking(new URL('https://x.vn/product/590?color=red'))).toBeNull();
    expect(stripTracking(new URL('https://x.vn/product/old-name?gclid=a'))).toBeNull();
  });
});

// api/product.ts reads dist/index.html; CI runs the tests before the build, so serve the source shell.
const SHELL = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('legacy product URLs 301 to the id URL', () => {
  afterEach(() => vi.restoreAllMocks());
  it('keeps ad params on the redirect', () => {
    expect(queryOf({ url: '/api/product?slug=old&gclid=a&utm_source=b' })).toBe('?gclid=a&utm_source=b');
    expect(queryOf({ url: '/api/product?slug=old' })).toBe('');
  });
  it('old name slug -> 301 /product/<id>?gclid, id URL -> fetches one product only', async () => {
    process.env.PMI_API_URL = 'http://pim';
    process.env.CATALOG_GRANT_TOKENS = '{"s":"t"}';
    process.env.STOREFRONT_SELLER_ID = 's';
    vi.spyOn(fs, 'readFileSync').mockReturnValue(SHELL as any);
    const item = { id: 590, name: 'New Name', status: 'Published', variants: [], media: [], tier_variations: [] };
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(url);
      const body = url.endsWith('/public/products/590') ? item : { items: [item], total: 1, pages: 1 };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as any;
    const res: any = { headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v; }, status(c: number) { this.code = c; return this; }, send() { return this; } };
    await productHandler({ method: 'GET', url: '/api/product?slug=new-name&gclid=a', query: { slug: 'new-name' } }, res);
    expect(res.code).toBe(301);
    expect(res.headers.Location).toBe('/product/590?gclid=a');
    calls.length = 0;
    await productHandler({ method: 'GET', url: '/api/product?slug=590', query: { slug: '590' } }, { ...res, code: 0 });
    expect(calls.filter((c) => c.includes('/public/products/590'))).toHaveLength(1);
    expect(calls.some((c) => c.includes('limit=100'))).toBe(false);
  });
});

describe('product URL with a trailing slash', () => {
  it('308s to the slashless URL, query kept; slashless URLs are not redirected', () => {
    const res = middleware(new Request('https://x.vn/product/590/?gclid=a&color=red'))!;
    expect(res.status).toBe(308);
    expect(res.headers.get('Location')).toBe('/product/590?gclid=a&color=red');
    expect(middleware(new Request('https://x.vn/product/old-name/'))!.headers.get('Location')).toBe('/product/old-name');
    expect(middleware(new Request('https://x.vn/product/590'))?.status).not.toBe(308);
  });
});
