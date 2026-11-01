import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import robotsHandler from '../../api/robots';
import sitemapHandler, { SITE_ORIGIN, escapeXml } from '../../api/sitemap';
import { buildProductSlugById, getProductPath } from '../utils/productSlug';
import { getCategoriesSortedByCount } from '../utils/categories';
import type { Category, Product } from '../types';

function makeRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '' as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: any) {
      this.body = body;
      return this;
    },
    json(body: any) {
      this.body = JSON.stringify(body);
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
  };
}

const req = (method = 'GET') => ({ method });

describe('STOR-062: robots.txt and sitemap.xml SEO', () => {
  const ORIGINAL_ENV = { ...process.env };
  const TEST_TOKEN = 'secret-catalog-token-stor062';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.PMI_API_URL = 'https://api-pim.voma.vn/api/v1/site';
    process.env.STOREFRONT_SELLER_ID = 'seller-stor062';
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-stor062': TEST_TOKEN });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe('robots.txt', () => {
    it('returns status 200 and Content-Type starts with text/plain', async () => {
      const res = makeRes();
      await robotsHandler(req(), res);
      expect(res.statusCode).toBe(200);
      expect(res.headers['Content-Type']).toMatch(/^text\/plain/);
    });

    it('contains User-agent: *', async () => {
      const res = makeRes();
      await robotsHandler(req(), res);
      const lines = String(res.body).split('\n').map(l => l.trim());
      expect(lines).toContain('User-agent: *');
    });

    it('contains Allow: /', async () => {
      const res = makeRes();
      await robotsHandler(req(), res);
      const lines = String(res.body).split('\n').map(l => l.trim());
      expect(lines).toContain('Allow: /');
    });

    it('contains Disallow: /api/', async () => {
      const res = makeRes();
      await robotsHandler(req(), res);
      const lines = String(res.body).split('\n').map(l => l.trim());
      expect(lines).toContain('Disallow: /api/');
    });

    it('contains Disallow: /checkout/', async () => {
      const res = makeRes();
      await robotsHandler(req(), res);
      const lines = String(res.body).split('\n').map(l => l.trim());
      expect(lines).toContain('Disallow: /checkout/');
    });

    it('contains Sitemap: https://www.topvnsport.com/sitemap.xml', async () => {
      const res = makeRes();
      await robotsHandler(req(), res);
      const lines = String(res.body).split('\n').map(l => l.trim());
      expect(lines).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
      expect(lines).toContain('Sitemap: https://www.topvnsport.com/sitemap.xml');
    });
  });

  describe('sitemap.xml', () => {
    const mockCategories: Category[] = [
      { id: 1, name: 'Vợt cầu lông', code: 'vot-cau-long', parent_id: null, display_name: 'Vợt cầu lông' },
      { id: 2, name: 'Giày cầu lông', code: 'giay-cau-long', parent_id: null, display_name: 'Giày cầu lông' },
      { id: 3, name: 'Danh mục không có sản phẩm', code: 'empty-cat', parent_id: null, display_name: 'Empty' },
      { id: 4, name: 'Phụ kiện & Đồ <khác>', code: "phu-kien&do<khac>'test", parent_id: null, display_name: 'Phụ kiện' },
    ];

    const mockProductsPage1 = [
      { id: 101, name: 'Vợt Yonex Astrox 88D Pro', voma_category_id: 1 },
      { id: 102, name: 'Giày Yonex 65Z3', voma_category_id: 2 },
    ];

    const mockProductsPage2 = [
      { id: 103, name: 'Vợt Lining Axforce 90', voma_category_id: 1 },
      { id: 104, name: 'Cước cầu lông BG65Ti', voma_category_id: 4 },
    ];

    function setupMockFetch(options?: {
      categoriesStatus?: number;
      categoriesBody?: any;
      productsStatus?: number;
      productsBody?: any;
      reject?: boolean;
      totalMismatch?: boolean;
      singlePageOnly?: boolean;
    }) {
      const {
        categoriesStatus = 200,
        categoriesBody,
        productsStatus = 200,
        productsBody,
        reject = false,
        totalMismatch = false,
        singlePageOnly = false,
      } = options || {};

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (reject) {
          throw new Error('Upstream network timeout');
        }

        if (url.includes('/public/voma-categories')) {
          return {
            status: categoriesStatus,
            ok: categoriesStatus === 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => categoriesBody ?? mockCategories,
          } as any;
        }

        if (url.includes('/public/products')) {
          if (productsStatus !== 200) {
            return {
              status: productsStatus,
              ok: false,
              headers: new Map([['content-type', 'application/json']]),
              json: async () => productsBody ?? ({
                items: mockProductsPage1,
                total: 2,
                pages: 1,
                page: 1,
                limit: 100,
              }),
            } as any;
          }

          if (productsBody !== undefined) {
            return {
              status: 200,
              ok: true,
              headers: new Map([['content-type', 'application/json']]),
              json: async () => productsBody,
            } as any;
          }

          if (singlePageOnly) {
            return {
              status: 200,
              ok: true,
              headers: new Map([['content-type', 'application/json']]),
              json: async () => ({
                items: [mockProductsPage1[0]],
                total: 1,
                pages: 1,
                page: 1,
                limit: 100,
              }),
            } as any;
          }

          if (url.includes('page=1')) {
            return {
              status: 200,
              ok: true,
              headers: new Map([['content-type', 'application/json']]),
              json: async () => ({
                items: mockProductsPage1,
                total: totalMismatch ? 999 : 4,
                pages: 2,
                page: 1,
                limit: 100,
              }),
            } as any;
          }

          if (url.includes('page=2')) {
            return {
              status: 200,
              ok: true,
              headers: new Map([['content-type', 'application/json']]),
              json: async () => ({
                items: mockProductsPage2,
                total: totalMismatch ? 999 : 4,
                pages: 2,
                page: 2,
                limit: 100,
              }),
            } as any;
          }
        }

        throw new Error(`Unexpected fetch url: ${url}`);
      });
    }

    it('escapes XML special characters via escapeXml map', () => {
      expect(escapeXml('<')).toBe('&lt;');
      expect(escapeXml('>')).toBe('&gt;');
      expect(escapeXml('&')).toBe('&amp;');
      expect(escapeXml('\'')).toBe('&apos;');
      expect(escapeXml('"')).toBe('&quot;');
      expect(escapeXml("https://example.com/test?a=1&b=2<'\"")).toBe(
        'https://example.com/test?a=1&amp;b=2&lt;&apos;&quot;'
      );
    });

    it('returns status 200 with mocked VOMA payload', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect(res.statusCode).toBe(200);
    });

    it('Content-Type starts with application/xml', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect(res.headers['Content-Type']).toMatch(/^application\/xml/);
    });

    it('Cache-Control contains s-maxage between 60 and 600', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);
      const cc = res.headers['Cache-Control'] || '';
      const match = cc.match(/s-maxage=(\d+)/);
      expect(match).not.toBeNull();
      const sMaxage = Number(match![1]);
      expect(sMaxage).toBeGreaterThanOrEqual(60);
      expect(sMaxage).toBeLessThanOrEqual(600);
    });

    it('body parses with DOMParser without a parsererror and root is a urlset in sitemaps.org 0.9 namespace', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'application/xml');
      expect(doc.querySelector('parsererror')).toBeNull();
      expect(doc.documentElement.localName).toBe('urlset');
      expect(doc.documentElement.namespaceURI).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
    });

    it('lists https://www.topvnsport.com/ exactly once', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'application/xml');
      const locs = Array.from(doc.querySelectorAll('loc')).map(el => el.textContent);
      const homeLocs = locs.filter(l => l === `${SITE_ORIGIN}/`);
      expect(homeLocs).toHaveLength(1);
    });

    it('has one category loc per kept category and no extra category loc', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'application/xml');
      const locs = Array.from(doc.querySelectorAll('loc')).map(el => el.textContent);

      const allPmi = [...mockProductsPage1, ...mockProductsPage2];
      const categoryById = new Map<number, Category>(mockCategories.map(c => [c.id, c]));
      const mappedProducts: Product[] = allPmi.map(p => ({
        id: String(p.id),
        name: p.name,
        slug: p.name,
        categoryCode: categoryById.get(p.voma_category_id)?.code,
      } as Product));

      const keptCategories = getCategoriesSortedByCount(mockCategories, mappedProducts);
      // Empty category id: 3 should not be in keptCategories
      expect(keptCategories.some(c => c.code === 'empty-cat')).toBe(false);

      const categoryLocs = locs.filter(l => l?.includes('/catalog?category='));
      expect(categoryLocs).toHaveLength(keptCategories.length);

      for (const cat of keptCategories) {
        const expectedLoc = `${SITE_ORIGIN}/catalog?category=${encodeURIComponent(cat.code)}`;
        expect(categoryLocs).toContain(expectedLoc);
      }
      expect(categoryLocs.some(l => l?.includes('empty-cat'))).toBe(false);
    });

    it('product locs equal getProductPath output for the mocked payload', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'application/xml');
      const locs = Array.from(doc.querySelectorAll('loc')).map(el => el.textContent);

      const allPmi = [...mockProductsPage1, ...mockProductsPage2];
      const categoryById = new Map<number, Category>(mockCategories.map(c => [c.id, c]));
      const mappedProducts: Product[] = allPmi.map(p => ({
        id: String(p.id),
        name: p.name,
        categoryCode: categoryById.get(p.voma_category_id)?.code,
      } as Product));

      const slugById = buildProductSlugById(mappedProducts);
      for (const p of mappedProducts) {
        const expectedLoc = `${SITE_ORIGIN}${getProductPath(p, slugById)}`;
        expect(locs).toContain(expectedLoc);
      }
    });

    it('a product only on page 2 of a mocked response appears in the sitemap', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'application/xml');
      const locs = Array.from(doc.querySelectorAll('loc')).map(el => el.textContent);

      // id 103 is on page 2
      expect(locs.some(l => l?.includes('vot-lining-axforce-90'))).toBe(true);
    });

    it('a product missing from the second mock generation is not in the second sitemap', async () => {
      // 1st generation with 2 pages (4 products)
      setupMockFetch();
      const res1 = makeRes();
      await sitemapHandler(req(), res1);
      expect(res1.body).toContain('vot-lining-axforce-90');

      // 2nd generation with singlePageOnly (only product 101)
      setupMockFetch({ singlePageOnly: true });
      const res2 = makeRes();
      await sitemapHandler(req(), res2);
      expect(res2.body).toContain('vot-yonex-astrox-88d-pro');
      expect(res2.body).not.toContain('vot-lining-axforce-90');
      expect(res2.body).not.toContain('giay-yonex-65z3');
    });

    it('a category code containing & \' < still yields parseable XML and loc text equals expected percent-encoded URL', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.body, 'application/xml');
      expect(doc.querySelector('parsererror')).toBeNull();

      const locs = Array.from(doc.querySelectorAll('loc')).map(el => el.textContent);
      const specialCat = mockCategories.find(c => c.id === 4)!;
      const expectedUrl = `${SITE_ORIGIN}/catalog?category=${encodeURIComponent(specialCat.code)}`;
      expect(locs).toContain(expectedUrl);
    });

    it('if the upstream fetch rejects, sitemap returns 502 or 503 with no <urlset', async () => {
      setupMockFetch({ reject: true });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect([502, 503]).toContain(res.statusCode);
      expect(res.body).not.toContain('<urlset');
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('if /public/products returns non-200 with valid shaped body, sitemap returns 502 or 503 with no <urlset', async () => {
      setupMockFetch({ productsStatus: 500 });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect([502, 503]).toContain(res.statusCode);
      expect(res.body).not.toContain('<urlset');
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('if /public/products returns malformed body shape, sitemap returns 502 or 503 with no <urlset', async () => {
      setupMockFetch({ productsBody: { detail: 'error' } });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect([502, 503]).toContain(res.statusCode);
      expect(res.body).not.toContain('<urlset');
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('if /public/voma-categories returns non-200 with valid shaped body, sitemap returns 502 or 503 with no <urlset', async () => {
      setupMockFetch({ categoriesStatus: 500 });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect([502, 503]).toContain(res.statusCode);
      expect(res.body).not.toContain('<urlset');
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('if /public/voma-categories returns malformed non-array body, sitemap returns 502 or 503 with no <urlset', async () => {
      setupMockFetch({ categoriesBody: { detail: 'not an array' } });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect([502, 503]).toContain(res.statusCode);
      expect(res.body).not.toContain('<urlset');
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('if collected products differ from upstream total, sitemap returns 502 or 503 with no <urlset', async () => {
      setupMockFetch({ totalMismatch: true });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect([502, 503]).toContain(res.statusCode);
      expect(res.body).not.toContain('<urlset');
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('every non-200 sitemap response has Cache-Control no-store', async () => {
      setupMockFetch({ categoriesStatus: 500 });
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('no sitemap response header or body contains the catalog-grant token', async () => {
      setupMockFetch();
      const res = makeRes();
      await sitemapHandler(req(), res);
      expect(JSON.stringify(res.headers)).not.toContain(TEST_TOKEN);
      expect(String(res.body)).not.toContain(TEST_TOKEN);
    });
  });

  describe('vercel.json routing configuration', () => {
    it('has /robots.txt -> /api/robots and /sitemap.xml -> /api/sitemap before SPA catch-all', () => {
      const vercelJsonPath = path.resolve(__dirname, '../../vercel.json');
      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
      const rewrites = config.rewrites as Array<{ source: string; destination: string }>;

      const robotsIdx = rewrites.findIndex(r => r.source === '/robots.txt' && r.destination === '/api/robots');
      const sitemapIdx = rewrites.findIndex(r => r.source === '/sitemap.xml' && r.destination === '/api/sitemap');
      const catchAllIdx = rewrites.findIndex(r => r.destination === '/index.html');

      expect(robotsIdx).toBeGreaterThanOrEqual(0);
      expect(sitemapIdx).toBeGreaterThanOrEqual(0);
      expect(catchAllIdx).toBeGreaterThan(robotsIdx);
      expect(catchAllIdx).toBeGreaterThan(sitemapIdx);
    });

    it('SPA catch-all matches /, /catalog, /product/x, /stores and /checkout/success', () => {
      const vercelJsonPath = path.resolve(__dirname, '../../vercel.json');
      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
      const rewrites = config.rewrites as Array<{ source: string; destination: string }>;
      const catchAll = rewrites.find(r => r.destination === '/index.html')!;

      const regexPattern = `^${catchAll.source}$`;
      const regex = new RegExp(regexPattern);

      expect(regex.test('/')).toBe(true);
      expect(regex.test('/catalog')).toBe(true);
      expect(regex.test('/product/x')).toBe(true);
      expect(regex.test('/stores')).toBe(true);
      expect(regex.test('/checkout/success')).toBe(true);

      expect(regex.test('/robots.txt')).toBe(false);
      expect(regex.test('/robots.txtfoo')).toBe(true);
      expect(regex.test('/sitemap.xml')).toBe(false);
      expect(regex.test('/sitemap.xml-old')).toBe(true);
      expect(regex.test('/api/pmi/public/products')).toBe(false);
    });
  });

  describe('index.html lang attribute', () => {
    it('index.html line 2 reads <html lang="vi">', () => {
      const indexPath = path.resolve(__dirname, '../../index.html');
      const lines = fs.readFileSync(indexPath, 'utf-8').split('\n');
      expect(lines[1]).toBe('<html lang="vi">');
    });
  });
});
