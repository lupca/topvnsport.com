import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import productHandler, { renderProductPage } from '../../api/product';
import sitemapHandler from '../../api/sitemap';
import { NO_IMAGE_URL } from '../services/sport-api/constants';
import { formatVnd } from '../components/product-detail/helpers';
import type { Product } from '../types';

const SHELL = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>TopVNSport - Shell</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>
`;
const CANONICAL = 'https://www.topvnsport.com/product/vot-yonex';
const TOKEN = 'secret-catalog-token-stor069';

const baseProduct = (over: Partial<Product> = {}): Product => ({
  id: '1',
  name: 'Vợt Yonex Astrox 99',
  image: NO_IMAGE_URL,
  gallery: [],
  price: 1500000,
  salePrice: 1500000,
  tier_variations: [],
  variants: [],
  ...over,
} as Product);

const headBlock = (html: string) => html.slice(html.indexOf('</title>'), html.indexOf('</head>'));
const rootDiv = (html: string) => html.match(/<div id="root">([\s\S]*?)<\/div>/)![1];

describe('STOR-069 renderProductPage', () => {
  it('sets the bare escaped product name as title, no site suffix', () => {
    const html = renderProductPage(SHELL, baseProduct({ name: 'A & B "C"' }), CANONICAL);
    expect(html).toContain('<title>A &amp; B &quot;C&quot;</title>');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).not.toContain('TopVNSport');
  });

  it('adds exactly one head block right before </head> with canonical, og:title, og:url', () => {
    const html = renderProductPage(SHELL, baseProduct(), CANONICAL);
    expect(html.match(/<\/head>/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toMatch(/<meta property="og:[a-z]+" content="[^"]*" \/>\n {2}<\/head>/);
    const head = headBlock(html);
    expect(head).toContain(`<link rel="canonical" href="${CANONICAL}" />`);
    expect(head).toContain('<meta property="og:title" content="Vợt Yonex Astrox 99" />');
    expect(head).toContain(`<meta property="og:url" content="${CANONICAL}" />`);
    // head tags sit together as one contiguous block
    expect(html.indexOf('rel="canonical"')).toBeGreaterThan(html.indexOf('</title>'));
  });

  it('description present: meta description collapsed and <=160 chars, og:description, <p>', () => {
    const desc = 'Dòng   vợt\n\ncông thủ   ' + 'x'.repeat(300);
    const html = renderProductPage(SHELL, baseProduct({ description: desc }), CANONICAL);
    const meta = html.match(/<meta name="description" content="([^"]*)" \/>/)![1];
    expect(meta.startsWith('Dòng vợt công thủ x')).toBe(true);
    expect(meta.length).toBeLessThanOrEqual(160);
    expect(meta).not.toMatch(/\s{2,}|\n/);
    expect(html).toMatch(/<meta property="og:description" content="Dòng vợt công thủ x+" \/>/);
    expect(rootDiv(html)).toContain(`<p>${desc}</p>`);
  });

  it('description absent: no meta description, no og:description, no description <p>', () => {
    for (const description of [undefined, '', '   \n ']) {
      const html = renderProductPage(SHELL, baseProduct({ description }), CANONICAL);
      expect(html).not.toContain('name="description"');
      expect(html).not.toContain('og:description');
      expect(rootDiv(html).match(/<p>/g)).toHaveLength(1); // price only
    }
  });

  it('og:image is the first absolute http(s) gallery URL', () => {
    const html = renderProductPage(SHELL, baseProduct({
      gallery: ['/relative.jpg', 'data:image/png;base64,x', 'https://cdn.voma.vn/a.jpg?x=1&y=2', 'https://cdn.voma.vn/b.jpg'],
    }), CANONICAL);
    expect(html).toContain('<meta property="og:image" content="https://cdn.voma.vn/a.jpg?x=1&amp;y=2" />');
    expect(html.match(/og:image/g)).toHaveLength(1);
  });

  it('empty or relative-only gallery gives no og:image and never NO_IMAGE_URL', () => {
    for (const gallery of [[], undefined, ['/only-relative.jpg']]) {
      const html = renderProductPage(SHELL, baseProduct({ gallery, image: NO_IMAGE_URL }), CANONICAL);
      expect(html).not.toContain('og:image');
      expect(html).not.toContain(NO_IMAGE_URL);
      expect(html).not.toContain('placeholder');
    }
  });

  it('root div holds h1 name and getPdpPrice+formatVnd price', () => {
    const html = renderProductPage(SHELL, baseProduct(), CANONICAL);
    expect(rootDiv(html)).toBe(`<h1>Vợt Yonex Astrox 99</h1><p>${formatVnd(1500000)}</p>`);
  });

  it('uses the variant price chosen by getPdpPrice (single-option tier)', () => {
    const html = renderProductPage(SHELL, baseProduct({
      price: 900000,
      salePrice: 900000,
      tier_variations: [{ name: 'Màu', tier_index: 1, options: ['Đỏ'] }],
      variants: [{ id: 1, tier_1_option: 'Đỏ', price: 1200000, stock: 1 } as any],
    } as any), CANONICAL);
    expect(rootDiv(html)).toContain(`<p>${formatVnd(1200000)}</p>`);
  });

  it("shows 'Liên hệ để biết giá' when there is no price, never 0đ", () => {
    const html = renderProductPage(SHELL, baseProduct({ price: undefined, salePrice: undefined }), CANONICAL);
    expect(rootDiv(html)).toContain('<p>Liên hệ để biết giá</p>');
    expect(html).not.toContain('0đ');
  });

  it('escapes hostile name and description in text and attributes', () => {
    const hostile = '<script>alert("x")</script>\'&$&';
    const html = renderProductPage(SHELL, baseProduct({ name: hostile, description: hostile }), CANONICAL);
    expect(html).not.toContain('<script>alert');
    const esc = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;&amp;$&amp;';
    expect(html).toContain(`<title>${esc}</title>`);
    expect(html).toContain(`<h1>${esc}</h1>`);
    expect(html).toContain(`<p>${esc}</p>`);
    expect(html).toContain(`<meta property="og:title" content="${esc}" />`);
    expect(html).toContain(`<meta name="description" content="${esc}" />`);
  });

  it('has no JSON-LD, Offer, availability or Vercel-CDN-Cache-Control', () => {
    const html = renderProductPage(SHELL, baseProduct({ description: 'd', gallery: ['https://x/a.jpg'] }), CANONICAL);
    expect(html).not.toContain('application/ld+json');
    expect(html).not.toContain('Offer');
    expect(html).not.toContain('availability');
    expect(html).not.toContain('Vercel-CDN-Cache-Control');
  });
});

function makeRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '' as any,
    status(code: number) { this.statusCode = code; return this; },
    send(body: any) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
}

const pmi = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, voma_category_id: 1, variants: [{ id: id * 10, price: 500000, stock: 3, sku_code: `S${id}` }], ...extra,
});
const PAGE1 = [pmi(101, 'Vợt Yonex Astrox 99'), pmi(102, 'Vợt Yonex Astrox 99')];
const PAGE2 = [pmi(103, 'Cước BG65 Titanium', { description: 'Cước bền' }), pmi(104, 'Giày Lining')];

function mockFetch(opts: { reject?: boolean; status?: number; body?: any } = {}) {
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (opts.reject) throw new Error('timeout');
    if (url.includes('/public/voma-categories')) {
      return { status: 200, json: async () => [{ id: 1, code: 'vot', name: 'Vợt' }] } as any;
    }
    if (opts.status && opts.status !== 200) return { status: opts.status, json: async () => ({}) } as any;
    if (opts.body !== undefined) return { status: 200, json: async () => opts.body } as any;
    const page2 = url.includes('page=2');
    return { status: 200, json: async () => ({ items: page2 ? PAGE2 : PAGE1, total: 4, pages: 2 }) } as any;
  });
}

describe('STOR-069 api/product handler', () => {
  const ORIGINAL_ENV = { ...process.env };
  const get = (slug: string, headers: Record<string, string> = {}) => ({ method: 'GET', query: { slug }, headers });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const realRead = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: any, ...rest: any[]) =>
      String(p).endsWith(path.join('dist', 'index.html')) ? SHELL : (realRead as any)(p, ...rest)) as any);
    process.env.PMI_API_URL = 'https://api-pim.voma.vn/api/v1/site';
    process.env.STOREFRONT_SELLER_ID = 'seller-stor069';
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-stor069': TOKEN });
    mockFetch();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('known slug returns 200 text/html with s-maxage=300 and the product rendered', async () => {
    const res = makeRes();
    await productHandler(get('vot-yonex-astrox-99'), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toMatch(/^text\/html/);
    expect(res.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=300');
    expect(res.headers['Vercel-CDN-Cache-Control']).toBeUndefined();
    expect(res.body).toContain('<h1>Vợt Yonex Astrox 99</h1>');
  });

  it('serves a product from page 2 of the PIM list', async () => {
    const res = makeRes();
    await productHandler(get('cuoc-bg65-titanium'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<h1>Cước BG65 Titanium</h1>');
    expect(res.body).toContain('<p>Cước bền</p>');
  });

  it('canonical equals the sitemap loc for the same product, including duplicate-name slugs', async () => {
    const smRes = makeRes();
    await sitemapHandler({ method: 'GET' }, smRes);
    const locs: string[] = [...String(smRes.body).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const slug of ['vot-yonex-astrox-99', 'vot-yonex-astrox-99-2', 'cuoc-bg65-titanium']) {
      const res = makeRes();
      await productHandler(get(slug), res);
      const canonical = res.body.match(/<link rel="canonical" href="([^"]+)"/)[1];
      expect(canonical).toBe(`https://www.topvnsport.com/product/${slug}`);
      expect(locs).toContain(canonical);
    }
  });

  it('a spoofed host header does not change the canonical', async () => {
    const res = makeRes();
    await productHandler(get('cuoc-bg65-titanium', { host: 'evil.example', 'x-forwarded-host': 'evil.example' }), res);
    expect(res.body).toContain('href="https://www.topvnsport.com/product/cuoc-bg65-titanium"');
    expect(res.body).not.toContain('evil.example');
  });

  it('unknown slug returns 404 with the plain shell and no-store', async () => {
    const res = makeRes();
    await productHandler(get('khong-ton-tai'), res);
    expect(res.statusCode).toBe(404);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toBe(SHELL);
  });

  it('POST returns 405 with no-store', async () => {
    const res = makeRes();
    await productHandler({ method: 'POST', query: { slug: 'vot-yonex-astrox-99' } }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  const degraded: Array<[string, () => void]> = [
    ['PIM fetch error', () => mockFetch({ reject: true })],
    ['PIM non-200', () => mockFetch({ status: 503 })],
    ['malformed PIM body', () => mockFetch({ body: { nope: true } })],
    ['missing env', () => { delete process.env.PMI_API_URL; }],
  ];
  for (const [label, setup] of degraded) {
    it(`${label} returns 200 with the unmodified shell and no-store`, async () => {
      setup();
      const res = makeRes();
      await productHandler(get('vot-yonex-astrox-99'), res);
      expect(res.statusCode).toBe(200);
      expect(res.headers['Cache-Control']).toBe('no-store');
      expect(res.body).toBe(SHELL);
    });
  }

  it('never leaks the catalog-grant token in any response', async () => {
    const cases: Array<[any, () => void]> = [
      [get('vot-yonex-astrox-99'), () => mockFetch()],
      [get('khong-ton-tai'), () => mockFetch()],
      [get('vot-yonex-astrox-99'), () => mockFetch({ reject: true })],
      [{ method: 'POST', query: {} }, () => mockFetch()],
    ];
    for (const [req, setup] of cases) {
      setup();
      const res = makeRes();
      await productHandler(req, res);
      expect(String(res.body)).not.toContain(TOKEN);
      expect(JSON.stringify(res.headers)).not.toContain(TOKEN);
    }
  });
});

describe('STOR-069 vercel.json', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));

  it('routes /product/:slug to /api/product before the SPA catch-all', () => {
    const rewrites: Array<{ source: string; destination: string }> = config.rewrites;
    const productIdx = rewrites.findIndex((r) => r.source === '/product/:slug');
    expect(productIdx).toBeGreaterThanOrEqual(0);
    expect(rewrites[productIdx].destination).toBe('/api/product?slug=:slug');
    const catchAllIdx = rewrites.findIndex((r) => r.destination === '/index.html');
    expect(productIdx).toBeLessThan(catchAllIdx);
  });

  it('includes dist/index.html in the api/product.ts function bundle', () => {
    expect(config.functions['api/product.ts'].includeFiles).toBe('dist/index.html');
  });
});
