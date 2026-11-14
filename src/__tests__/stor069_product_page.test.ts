import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import productHandler, { offerPolicies, renderProductPage } from '../../api/product';
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

// SEO 13/11: every Offer carries priceValidUntil and the owner's policies (src/config/seo.ts).
const OFFER_EXTRA = () => ({ priceValidUntil: expect.stringMatching(/^\d{4}-\d\d-\d\d$/), ...offerPolicies() });

const headBlock = (html: string) => html.slice(html.indexOf('</title>'), html.indexOf('</head>'));
const titleText = (html: string) => html.match(/<title[^>]*>([^<]*)<\/title>/)![1];
const rootDiv = (html: string) => html.match(/<div id="root">([\s\S]*?)<\/div>/)![1];

describe('STOR-069 renderProductPage', () => {
  it('SEO 13/11: title is the escaped cleaned name plus the site suffix when it fits', () => {
    const html = renderProductPage(SHELL, baseProduct({ name: 'A & B "C"' }), CANONICAL);
    expect(titleText(html)).toBe('A &amp; B &quot;C&quot; | Top VN Sport');
    expect(html.match(/<title[ >]/g)).toHaveLength(1);
    expect(titleText(html)).not.toContain('Shell');
    // STOR-072: the shell title rides along in data-shell-title for the SPA, never as visible text.
    expect(html).toContain('<title data-shell-title="TopVNSport - Shell">');
  });

  it('adds exactly one head block right before </head> with canonical, og:title, og:url', () => {
    const html = renderProductPage(SHELL, baseProduct(), CANONICAL);
    expect(html.match(/<\/head>/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toMatch(/<meta property="og:[a-z]+" content="[^"]*" data-product-head \/>\n {2}<\/head>/);
    const head = headBlock(html);
    expect(head).toContain(`<link rel="canonical" href="${CANONICAL}" data-product-head />`);
    expect(head).toContain('<meta property="og:title" content="Vợt Yonex Astrox 99 | Top VN Sport" data-product-head />');
    expect(head).toContain(`<meta property="og:url" content="${CANONICAL}" data-product-head />`);
    // head tags sit together as one contiguous block
    expect(html.indexOf('rel="canonical"')).toBeGreaterThan(html.indexOf('</title>'));
  });

  it('description present: meta description collapsed and <=155 chars, og:description, <p>', () => {
    const desc = 'Dòng   vợt\n\ncông thủ   ' + 'xx '.repeat(100);
    const html = renderProductPage(SHELL, baseProduct({ description: desc }), CANONICAL);
    const meta = html.match(/<meta name="description" content="([^"]*)" data-product-head \/>/)![1];
    expect(meta.startsWith('Dòng vợt công thủ xx')).toBe(true);
    expect(Array.from(meta).length).toBeLessThanOrEqual(155);
    expect(meta).not.toMatch(/\s{2,}|\n/);
    expect(html).toMatch(/<meta property="og:description" content="Dòng vợt công thủ[ x]+…" data-product-head \/>/);
    expect(rootDiv(html)).toContain(`<p>${desc.trim()}</p>`);
  });

  it('STOR-072: emoji at the cut is cut whole, never U+FFFD or a lone surrogate', () => {
    const desc = 'x'.repeat(153) + '\u{1F3F8}\u{1F3F8}' + ' y';
    const html = renderProductPage(SHELL, baseProduct({ description: desc }), CANONICAL);
    const meta = html.match(/<meta name="description" content="([^"]*)" data-product-head \/>/)![1];
    // no space in range: cut at 154 code points (153 x + the first emoji) plus the ellipsis
    expect(meta).toBe('x'.repeat(153) + '\u{1F3F8}…');
    expect(Array.from(meta).length).toBe(155);
    expect(meta).not.toContain('\uFFFD');
    expect(meta).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(new TextDecoder().decode(new TextEncoder().encode(meta))).not.toContain('\uFFFD');
    expect(html).toContain(`<meta property="og:description" content="${meta}" data-product-head />`);
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
    expect(html).toContain('<meta property="og:image" content="https://cdn.voma.vn/a.jpg?x=1&amp;y=2" data-product-head />');
    expect(html.match(/og:image/g)).toHaveLength(1);
  });

  it('empty or relative-only gallery gives no og:image and never NO_IMAGE_URL', () => {
    for (const gallery of [[], undefined, ['/only-relative.jpg']]) {
      // window.__PRODUCT__ is the product's own data (image included), not a head tag.
      const html = renderProductPage(SHELL, baseProduct({ gallery, image: NO_IMAGE_URL }), CANONICAL).replace(/<script>window\.__PRODUCT__=.*?<\/script>/, '');
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
    // Title/description are derived (cleaned) from the hostile text, then escaped; the raw text never appears.
    expect(titleText(html)).toBe(`${esc} | Top VN Sport`);
    expect(html).toContain(`<h1>${esc}</h1>`);
    expect(html).toContain(`<p>${esc}</p>`);
    expect(html).toContain(`<meta property="og:title" content="${esc} | Top VN Sport" data-product-head />`);
    expect(html).toContain(`<meta name="description" content="script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;&amp;$&amp;." data-product-head />`);
  });

  // STOR-070 adds the JSON-LD Offer; availability and CDN headers belong to the follow-up task.
  it('has no availability or Vercel-CDN-Cache-Control', () => {
    const html = renderProductPage(SHELL, baseProduct({ description: 'd', gallery: ['https://x/a.jpg'] }), CANONICAL);
    expect(html).not.toContain('availability');
    expect(html).not.toContain('Vercel-CDN-Cache-Control');
  });
});

// The browser ends a script element at the first </script>, so this regex reads what a crawler reads.
const ldScripts = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const jsonLd = (html: string) => {
  const scripts = ldScripts(html);
  expect(scripts).toHaveLength(1);
  return JSON.parse(scripts[0]);
};
const ld = (over: Partial<Product> = {}) => jsonLd(renderProductPage(SHELL, baseProduct(over), CANONICAL));

describe('STOR-070 JSON-LD', () => {
  it('one ld+json Product in head with name, full description, image, sku, brand and a VND Offer', () => {
    const description = '  Vợt công thủ\n' + 'x'.repeat(300) + '  ';
    const html = renderProductPage(SHELL, baseProduct({
      description,
      gallery: ['/relative.jpg', 'https://cdn.voma.vn/a.jpg', 'https://cdn.voma.vn/b.jpg'],
      brand: 'Yonex',
      defaultSku: 'SKU-DEF',
    }), CANONICAL);
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
    const at = html.indexOf('<script type="application/ld+json">');
    expect(at).toBeGreaterThan(html.indexOf('<head>'));
    expect(at).toBeLessThan(html.indexOf('</head>'));
    const data = jsonLd(html);
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Vợt Yonex Astrox 99',
      description: description.trim(),
      image: 'https://cdn.voma.vn/a.jpg',
      sku: 'SKU-DEF',
      brand: { '@type': 'Brand', name: 'Yonex' },
      offers: { '@type': 'Offer', price: 1500000, priceCurrency: 'VND', url: CANONICAL, ...OFFER_EXTRA() },
    });
    expect(typeof data.offers.price).toBe('number');
    expect(rootDiv(html)).toContain(`<p>${formatVnd(data.offers.price)}</p>`);
  });

  it('no description key when description is missing, empty or whitespace', () => {
    for (const description of [undefined, '', '   \n ']) {
      expect(ld({ description })).not.toHaveProperty('description');
    }
  });

  it('no image key without an absolute http(s) gallery URL, never NO_IMAGE_URL', () => {
    for (const gallery of [[], undefined, ['/only-relative.jpg', 'data:image/png;base64,x']]) {
      const html = renderProductPage(SHELL, baseProduct({ gallery, image: NO_IMAGE_URL }), CANONICAL);
      expect(jsonLd(html)).not.toHaveProperty('image');
      expect(ldScripts(html)[0]).not.toContain(NO_IMAGE_URL);
    }
  });

  it('sku and offers.price come from the variant getPdpPrice matches at the initial tiers', () => {
    const product = baseProduct({
      price: 900000,
      salePrice: 900000,
      defaultSku: 'SKU-DEF',
      tier_variations: [{ name: 'Màu', tier_index: 1, options: ['Đỏ'] }],
      variants: [{ id: 1, tier_1_option: 'Đỏ', price: 1200000, stock: 1, sku_code: 'SKU-RED' } as any],
    } as any);
    const html = renderProductPage(SHELL, product, CANONICAL);
    const data = jsonLd(html);
    expect(data.sku).toBe('SKU-RED');
    expect(data.offers.price).toBe(1200000);
    expect(rootDiv(html)).toContain(`<p>${formatVnd(data.offers.price)}</p>`);
  });

  it('no preselected variant: product sku falls back to defaultSku, offers still list every priced variant with its sku', () => {
    const data = ld({
      defaultSku: 'SKU-DEF',
      tier_variations: [{ name: 'Màu', tier_index: 1, options: ['Đỏ', 'Xanh'] }, { name: 'Cước', tier_index: 2, options: ['A', 'B'] }],
      variants: [
        { id: 1, tier_1_option: 'Đỏ', tier_2_option: 'A', price: 1200000, stock: 1, sku_code: 'SKU-RED-A' } as any,
        { id: 2, tier_1_option: 'Xanh', tier_2_option: 'B', price: 1500000, stock: 0, sku_code: 'SKU-BLUE-B' } as any,
      ],
    } as any);
    expect(data.sku).toBe('SKU-DEF');
    expect(data.offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 1200000, highPrice: 1500000, offerCount: 2 });
    expect(data.offers.offers.map((o: any) => [o.sku, o.price])).toEqual([['SKU-RED-A', 1200000], ['SKU-BLUE-B', 1500000]]);
  });

  it('no sku key when no SKU exists', () => {
    expect(ld({ defaultSku: undefined })).not.toHaveProperty('sku');
    expect(ld({
      tier_variations: [{ name: 'Màu', tier_index: 1, options: ['Đỏ'] }],
      variants: [{ id: 1, tier_1_option: 'Đỏ', price: 1200000, stock: 1, sku_code: '' } as any],
    } as any)).not.toHaveProperty('sku');
  });

  it('brand is a Brand object; no brand key when absent or No Brand and the name has no known brand', () => {
    expect(ld({ brand: 'Yonex' }).brand).toEqual({ '@type': 'Brand', name: 'Yonex' });
    for (const brand of [undefined, '', '  ', 'No Brand', 'no brand', 'NoBrand', ' NO  BRAND ']) {
      expect(ld({ brand, name: 'Cuốn cán cao su non' })).not.toHaveProperty('brand');
      // SEO 13/11: no brand attribute -> known brand found in the name (src/config/seo.ts KNOWN_BRANDS).
      expect(ld({ brand }).brand).toEqual({ '@type': 'Brand', name: 'Yonex' });
    }
  });

  it("no offers key when the page shows 'Liên hệ để biết giá'", () => {
    const cases: Array<Partial<Product>> = [
      { price: undefined, salePrice: undefined },
      {
        tier_variations: [{ name: 'Màu', tier_index: 1, options: ['Đỏ'] }],
        variants: [{ id: 1, tier_1_option: 'Đỏ', price: 0, stock: 1, sku_code: 'SKU-RED' } as any],
      } as any,
    ];
    for (const over of cases) {
      const html = renderProductPage(SHELL, baseProduct(over), CANONICAL);
      expect(rootDiv(html)).toContain('<p>Liên hệ để biết giá</p>');
      expect(jsonLd(html)).not.toHaveProperty('offers');
      expect(ldScripts(html)[0]).not.toContain('Offer');
    }
  });

  it('escapes <, U+2028 and U+2029 so a hostile description cannot leave the script and parses back', () => {
    const hostile = 'a</script><script>alert(1)</script>\u2028b\u2029c<!--d';
    const html = renderProductPage(SHELL, baseProduct({ name: hostile, description: hostile }), CANONICAL);
    const raw = ldScripts(html)[0];
    expect(raw).not.toContain('<');
    expect(raw).toContain('a\\u003c/script>\\u003cscript>');
    expect(raw).not.toContain('\u2028');
    expect(raw).not.toContain('\u2029');
    expect(raw).toContain('\\u2028b\\u2029c');
    const element = html.slice(html.indexOf('<script type="application/ld+json">'), html.indexOf('</head>'));
    expect(element.match(/<\/script>/g)).toHaveLength(1);
    const data = jsonLd(html);
    expect(data.name).toBe(hostile);
    expect(data.description).toBe(hostile);
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

// Verbatim voma-wms /public/stock body: {stock:{sku:qty}} plus items[]. S102 and S104 have no stock row.
const row = (sku_code: string, qty: number) => ({
  sku_code, qty_available: qty, qty_on_hand: qty, qty_reserved: 0,
  stock_status: qty > 0 ? 'in_stock' : 'out_of_stock', low_stock_threshold: 5, threshold_source: 'default',
});
// Canonical URLs are ids; these name slugs are the legacy aliases of the mocked products.
const ID_OF: Record<string, string> = { 'vot-yonex-astrox-99': '101', 'vot-yonex-astrox-99-2': '102', 'cuoc-bg65-titanium': '103', 'giay-lining': '104', 'vot-lining-none': '105', 'vot-khong-gia': '106' };
const WMS_BODY = { stock: { S101: 5, S103: 0 }, items: [row('S101', 5), row('S103', 0)] };

type StockOpt = { status?: number; body?: any; reject?: boolean; hang?: boolean };

function mockFetch(opts: { reject?: boolean; status?: number; body?: any; stock?: StockOpt } = {}) {
  global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
    if (url.includes('/public/stock')) {
      const st = opts.stock ?? {};
      if (st.reject) throw new Error('wms down');
      if (st.hang) {
        // Settles only when the caller's signal aborts, like real fetch.
        return new Promise((_resolve, reject) => {
          const sig: AbortSignal | undefined = init?.signal;
          if (!sig) return;
          const abort = () => reject(new Error('aborted'));
          if (sig.aborted) abort(); else sig.addEventListener('abort', abort);
        });
      }
      if (st.status && st.status !== 200) return { status: st.status, json: async () => WMS_BODY } as any;
      return { status: 200, json: async () => (st.body !== undefined ? st.body : WMS_BODY) } as any;
    }
    if (opts.reject) throw new Error('timeout');
    if (url.includes('/public/voma-categories')) {
      return { status: 200, json: async () => [{ id: 1, code: 'vot', name: 'Vợt', display_name: 'Vợt' }] } as any;
    }
    if (opts.status && opts.status !== 200) return { status: opts.status, json: async () => ({}) } as any;
    const single = url.match(/\/public\/products\/(\d+)$/);
    if (single) {
      if (opts.body !== undefined) return { status: 200, json: async () => opts.body.items?.[0] ?? opts.body } as any;
      const hit = [...PAGE1, ...PAGE2].find((p) => String(p.id) === single[1]);
      return { status: hit ? 200 : 404, json: async () => hit ?? {} } as any;
    }
    if (opts.body !== undefined) return { status: 200, json: async () => opts.body } as any;
    const page2 = url.includes('page=2');
    return { status: 200, json: async () => ({ items: page2 ? PAGE2 : PAGE1, total: 4, pages: 2 }) } as any;
  });
}

describe('STOR-069 api/product handler', () => {
  const ORIGINAL_ENV = { ...process.env };
  const get = (slug: string, headers: Record<string, string> = {}) => ({ method: 'GET', query: { slug: ID_OF[slug] ?? slug }, headers });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const realRead = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: any, ...rest: any[]) =>
      String(p).endsWith(path.join('dist', 'index.html')) ? SHELL : (realRead as any)(p, ...rest)) as any);
    process.env.PMI_API_URL = 'https://api-pim.voma.vn/api/v1/site';
    process.env.WMS_API_URL = 'https://api-wms.voma.vn/api/v1/site';
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
    expect(res.headers['Vercel-CDN-Cache-Control']).toBe('max-age=60, stale-while-revalidate=300');
    expect(res.body).toContain('<h1>Vợt Yonex Astrox 99</h1>');
    // STOR-070: one JSON-LD Product in head, sku and price from the PIM variant.
    expect(res.body.match(/application\/ld\+json/g)).toHaveLength(1);
    expect(res.body.indexOf('application/ld+json')).toBeLessThan(res.body.indexOf('</head>'));
    const data = jsonLd(res.body);
    expect(data.sku).toBe('S101');
    expect(data.offers).toEqual({ '@type': 'Offer', sku: 'S101', price: 500000, priceCurrency: 'VND', url: 'https://www.topvnsport.com/product/101', availability: 'https://schema.org/InStock', ...OFFER_EXTRA() });
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
      expect(canonical).toBe(`https://www.topvnsport.com/product/${ID_OF[slug]}`);
      expect(locs).toContain(canonical);
    }
  });

  it('a spoofed host header does not change the canonical', async () => {
    const res = makeRes();
    await productHandler(get('cuoc-bg65-titanium', { host: 'evil.example', 'x-forwarded-host': 'evil.example' }), res);
    expect(res.body).toContain('href="https://www.topvnsport.com/product/103"');
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
      [get('vot-yonex-astrox-99'), () => mockFetch({ stock: { status: 503 } })],
      [get('vot-yonex-astrox-99'), () => mockFetch({ stock: { reject: true } })],
      [get('vot-yonex-astrox-99'), () => mockFetch({ stock: { body: { nope: true } } })],
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

describe('STOR-078 WMS stock, availability and cache headers', () => {
  const ORIGINAL_ENV = { ...process.env };
  const get = (slug: string) => ({ method: 'GET', query: { slug: ID_OF[slug] ?? slug }, headers: {} });
  const SLUG = 'vot-yonex-astrox-99';
  const OFFER = { '@type': 'Offer', sku: 'S101', price: 500000, priceCurrency: 'VND', url: `https://www.topvnsport.com/product/${ID_OF[SLUG]}` , ...OFFER_EXTRA() };
  const KNOWN_HEADERS = { 'Cache-Control': 'public, max-age=0, s-maxage=300', 'Vercel-CDN-Cache-Control': 'max-age=60, stale-while-revalidate=300' };
  const stockCalls = () => (global.fetch as any).mock.calls.filter((c: any[]) => String(c[0]).includes('/public/stock'));
  const run = async (slug: string, opts: Parameters<typeof mockFetch>[0] = {}) => {
    mockFetch(opts);
    const res = makeRes();
    await productHandler(get(slug), res);
    return res;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const realRead = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: any, ...rest: any[]) =>
      String(p).endsWith(path.join('dist', 'index.html')) ? SHELL : (realRead as any)(p, ...rest)) as any);
    process.env.PMI_API_URL = 'https://api-pim.voma.vn/api/v1/site';
    process.env.WMS_API_URL = 'https://api-wms.voma.vn/api/v1/site';
    process.env.STOREFRONT_SELLER_ID = 'seller-stor069';
    process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-stor069': TOKEN });
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
  });

  it('stock > 0 in the verbatim {stock, items} body gives InStock and the known-stock header pair', async () => {
    const res = await run(SLUG);
    expect(res.statusCode).toBe(200);
    expect(jsonLd(res.body).offers).toEqual({ ...OFFER, availability: 'https://schema.org/InStock' });
    expect(res.headers).toMatchObject(KNOWN_HEADERS);
  });

  it('an items-only body gives InStock when qty_available > 0', async () => {
    const res = await run(SLUG, { stock: { body: { items: [row('S101', 7)] } } });
    expect(jsonLd(res.body).offers.availability).toBe('https://schema.org/InStock');
    expect(res.headers).toMatchObject(KNOWN_HEADERS);
  });

  it('qty 0 gives OutOfStock', async () => {
    const res = await run('cuoc-bg65-titanium');
    expect(jsonLd(res.body).offers.availability).toBe('https://schema.org/OutOfStock');
    expect(res.headers).toMatchObject(KNOWN_HEADERS);
  });

  it('a SKU absent from a loaded stock map gives OutOfStock', async () => {
    const res = await run('vot-yonex-astrox-99-2'); // S102 has no WMS row
    expect(jsonLd(res.body).offers).toEqual({ ...OFFER, sku: 'S102', url: 'https://www.topvnsport.com/product/102', availability: 'https://schema.org/OutOfStock' });
  });

  it('the PIM variant stock never supplies availability (PIM stock 3, WMS qty 0 -> OutOfStock)', async () => {
    const res = await run('cuoc-bg65-titanium', { stock: { body: { stock: { S103: 0 } } } });
    expect(jsonLd(res.body).offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it("kind 'none' (no variant at the initial tiers) still offers the priced variant and gets the known-stock header pair", async () => {
    const none = pmi(105, 'Vợt Lining None', {
      tier_1_name: 'Màu', variants: [{ id: 1050, price: 500000, stock: 3, sku_code: 'S105', tier_1_option: 'Đỏ' }],
    });
    const body = { items: [{ ...none, tier_variations: [{ name: 'Màu', tier_index: 1, options: ['Xanh'] }] }], total: 1, pages: 1 };
    const res = await run('vot-lining-none', { body, stock: { body: { stock: { S105: 9 } } } });
    expect(res.statusCode).toBe(200);
    const { offers } = jsonLd(res.body);
    // The tier option is gone but the priced variant is still offered, with its sku and WMS availability.
    expect(offers).toMatchObject({ '@type': 'Offer', priceCurrency: 'VND', sku: 'S105', availability: 'https://schema.org/InStock' });
    expect(res.headers).toMatchObject(KNOWN_HEADERS);
  });

  it("an unpriced product with WMS 200 gets the known-stock header pair and no Offer", async () => {
    const body = { items: [pmi(106, 'Vợt Không Giá', { variants: [{ id: 1060, price: 0, stock: 3, sku_code: 'S106' }] })], total: 1, pages: 1 };
    const res = await run('vot-khong-gia', { body });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<p>Liên hệ để biết giá</p>');
    expect(jsonLd(res.body)).not.toHaveProperty('offers');
    expect(res.headers).toMatchObject(KNOWN_HEADERS);
  });

  it('one request makes exactly one /public/stock GET with the Bearer token and a 4000 ms AbortSignal.timeout', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    await run(SLUG);
    const calls = stockCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://api-wms.voma.vn/api/v1/site/public/stock');
    expect(calls[0][1].headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(4000);
  });

  it('the /public/stock call starts while the PIM page-1 fetch is still pending', async () => {
    let releasePim!: () => void;
    const held = new Promise<void>((r) => { releasePim = r; });
    mockFetch();
    const inner = (global.fetch as any).getMockImplementation();
    let stockStartedWhileHeld = false;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (String(url).includes('/public/products') && String(url).includes('page=1')) {
        await held;
      } else if (String(url).includes('/public/stock')) {
        stockStartedWhileHeld = true;
        releasePim();
      }
      return inner(url, init);
    });
    // If WMS were awaited after PIM, page 1 would never release and this would time out.
    const res = makeRes();
    await productHandler(get(SLUG), res);
    expect(stockStartedWhileHeld).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  const failures: Array<[string, () => Parameters<typeof mockFetch>[0], (() => void)?]> = [
    ['non-200', () => ({ stock: { status: 503 } })],
    ['throw', () => ({ stock: { reject: true } })],
    ['missing WMS_API_URL', () => ({}), () => { delete process.env.WMS_API_URL; }],
    ['malformed body', () => ({ stock: { body: { nope: true } } })],
    ['null body', () => ({ stock: { body: null } })],
  ];
  for (const [label, opts, env] of failures) {
    it(`WMS ${label}: 200, product rendered, Offer kept, no availability, no-store, no CDN header, no token`, async () => {
      env?.();
      const res = await run(SLUG, opts());
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<h1>Vợt Yonex Astrox 99</h1>');
      const data = jsonLd(res.body);
      expect(data.offers).toEqual(OFFER);
      expect(data.offers).not.toHaveProperty('availability');
      expect(res.body).not.toContain('availability');
      expect(res.headers['Cache-Control']).toBe('no-store');
      expect(res.headers).not.toHaveProperty('Vercel-CDN-Cache-Control');
      expect(String(res.body)).not.toContain(TOKEN);
      expect(JSON.stringify(res.headers)).not.toContain(TOKEN);
    });
  }

  it('WMS timeout (never-resolving fetch aborted by AbortSignal.timeout(4000)): 200, no availability, no-store', async () => {
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    mockFetch({ stock: { hang: true } });
    const res = makeRes();
    const done = productHandler(get(SLUG), res);
    setTimeout(() => controller.abort(), 50);
    await done;
    expect(timeoutSpy).toHaveBeenCalledWith(4000);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<h1>Vợt Yonex Astrox 99</h1>');
    expect(jsonLd(res.body).offers).toEqual(OFFER);
    expect(res.body).not.toContain('availability');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers).not.toHaveProperty('Vercel-CDN-Cache-Control');
  }, 2000);

  it('PIM failure, 404 and 405 keep their STOR-069 status and headers with WMS up', async () => {
    const pimDown = await run(SLUG, { reject: true });
    expect([pimDown.statusCode, pimDown.headers['Cache-Control'], pimDown.body]).toEqual([200, 'no-store', SHELL]);
    const notFound = await run('khong-ton-tai');
    expect([notFound.statusCode, notFound.headers['Cache-Control'], notFound.body]).toEqual([404, 'no-store', SHELL]);
    expect(notFound.headers).not.toHaveProperty('Vercel-CDN-Cache-Control');
    const res = makeRes();
    await productHandler({ method: 'POST', query: { slug: SLUG } }, res);
    expect([res.statusCode, res.headers['Cache-Control']]).toEqual([405, 'no-store']);
    expect(res.headers).not.toHaveProperty('Vercel-CDN-Cache-Control');
  });

  it('never leaks the token in body or headers on WMS success', async () => {
    const res = await run(SLUG);
    expect(String(res.body)).not.toContain(TOKEN);
    expect(JSON.stringify(res.headers)).not.toContain(TOKEN);
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
