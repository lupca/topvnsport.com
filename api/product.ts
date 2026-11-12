import fs from 'node:fs';
import path from 'node:path';
import { CDN_CACHE_CONTROL, resolveCatalogGrantToken } from './_catalogProxy.js';
import { SITE_ORIGIN } from '../src/config/storefront.js';
import { productHeadValues, PRODUCT_HEAD_MARK, PRODUCT_HEAD_TAGS, PRODUCT_SHELL_VALUE } from '../src/utils/productHead.js';
import { getProductPath, findProductBySlug } from '../src/utils/productSlug.js';
import { mapPmiProduct } from '../src/services/sport-api/productMappers.js';
import { applyWmsStock, parseWmsStock } from '../src/services/sport-api/wmsStock.js';
import { aggregateStock, getPdpPrice, formatVnd, initialTierValue } from '../src/components/product-detail/helpers.js';
import type { Product } from '../src/types.js';

const PRODUCTS_PAGE_SIZE = 100;
const NO_PRICE_TEXT = 'Liên hệ để biết giá';
const WMS_TIMEOUT_MS = 4000;

export function escapeHtml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&#39;', '"': '&quot;' })[c] as string);
}

// JSON for an inline <script>: '<' and U+2028/2029 are \u-escaped so a value can neither close the
// script element nor break a JS parser. JSON.parse returns the original text.
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// Pure: shell + product -> HTML. Missing data is omitted, never composed.
export function renderProductPage(shell: string, product: Product, canonicalUrl: string): string {
  const name = escapeHtml(product.name);
  const description = (product.description ?? '').trim();
  const head = productHeadValues(product, canonicalUrl);
  const price = getPdpPrice(product, initialTierValue(product, 1), initialTierValue(product, 2));
  const priced = price.hasPrice && price.salePrice > 0;
  // Availability only from WMS stock at the PDP's initial tiers; 'unknown' and 'none' omit it, never invented.
  const stock = aggregateStock(product, initialTierValue(product, 1), initialTierValue(product, 2));
  const availability = stock.kind === 'known'
    ? { availability: stock.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
    : {};

  // schema.org Product from the values the page shows. offers only when a price is shown, never on NO_PRICE_TEXT.
  const sku = price.matchedVariant?.sku_code ?? product.defaultSku;
  const brand = product.brand?.trim();
  const jsonLd = inlineJson({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(description && { description }),
    ...(head.image && { image: head.image }),
    ...(sku && { sku }),
    ...(brand && !/^no\s*brand$/i.test(brand) && { brand: { '@type': 'Brand', name: brand } }),
    ...(priced && { offers: { '@type': 'Offer', price: price.salePrice, priceCurrency: 'VND', url: canonicalUrl, ...availability } }),
  });

  // A product tag replaces the shell's own copy (one canonical for crawlers); the shell value rides along in
  // data-shell-value so the SPA can restore it off product pages. A field the product lacks keeps the shell tag.
  let page = shell;
  const headTags = PRODUCT_HEAD_TAGS
    .filter(([, , , , field]) => head[field])
    .map(([tag, keyAttr, key, valueAttr, field]) => {
      let shellValue: string | undefined;
      // Attribute-aware tag body: a quoted '>' stays inside its value; "'" only opens a quote right after '=' so an unquoted apostrophe stays plain.
      const ATTRS = `(?:"[^"]*"|(?<==\\s*)'[^']*'|[^'">]|(?<!=\\s*)')*`;
      page = page.replace(new RegExp(`[ \\t]*<${tag}\\b${ATTRS}?\\s${keyAttr}=(?:"${key}"|'${key}'|${key}(?=[\\s>]|/>))${ATTRS}>\\s*`, 'gi'), (m) => {
        shellValue ??= m.match(new RegExp(`^[ \\t]*<${tag}\\b${ATTRS}?\\s${valueAttr}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((v) => v !== undefined);
        return '';
      });
      const carry = shellValue ? ` ${PRODUCT_SHELL_VALUE}="${shellValue.replace(/"/g, '&quot;')}"` : '';
      return `<${tag} ${keyAttr}="${key}" ${valueAttr}="${escapeHtml(head[field]!)}" ${PRODUCT_HEAD_MARK}${carry} />`;
    })
    .join('\n    ');

  const body = [
    `<h1>${name}</h1>`,
    `<p>${escapeHtml(priced ? formatVnd(price.salePrice) : NO_PRICE_TEXT)}</p>`,
    description && `<p>${escapeHtml(description)}</p>`,
  ].filter(Boolean).join('');

  // Function replacers: product strings may contain `$&`-style patterns.
  return page
    // data-shell-title keeps the shell title in the document so the SPA restores it off product pages.
    .replace(/<title>([\s\S]*?)<\/title>/, (_m, shellTitle: string) =>
      `<title data-shell-title="${shellTitle.replace(/"/g, '&quot;')}">${name}</title>`)
    .replace('</head>', () => `  <script type="application/ld+json">${jsonLd}</script>\n    ${headTags}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
}

function sendHtml(res: any, status: number, cacheControl: string, html: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.status(status).send(html);
}

async function fetchAllProducts(baseUrl: string, token: string): Promise<Product[] | null> {
  const items: any[] = [];
  for (let page = 1, pages = 1; page <= pages; page += 1) {
    const resp = await fetch(`${baseUrl}/public/products?page=${page}&limit=${PRODUCTS_PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status !== 200) return null;
    const data = await resp.json();
    if (!data || !Array.isArray(data.items) || typeof data.pages !== 'number') return null;
    items.push(...data.items);
    pages = data.pages;
  }
  return items.map((p) => mapPmiProduct(p, [])).filter((p): p is Product => p !== null);
}

// Original query string minus the rewrite's own `slug` param (ad params ride along on the redirect).
export function queryOf(req: any): string {
  const url: string = req?.url ?? '';
  const i = url.indexOf('?');
  const params = new URLSearchParams(i === -1 ? '' : url.slice(i + 1));
  params.delete('slug');
  return params.size > 0 ? `?${params}` : '';
}

async function fetchOneProduct(baseUrl: string, token: string, id: string): Promise<Product | undefined | 'error'> {
  const resp = await fetch(`${baseUrl}/public/products/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (resp.status === 404) return undefined;
  if (resp.status !== 200) return 'error';
  const data = await resp.json();
  if (!data || typeof data !== 'object' || data.id === undefined) return 'error'; // malformed is a failure, never a 404
  return mapPmiProduct(data, []) ?? undefined;
}

// WMS stock map, or null on any failure. Malformed (neither stock object nor items array) is a failure, never zero stock.
async function fetchWmsStockMap(token: string): Promise<Record<string, number> | null> {
  const wmsUrl = process.env.WMS_API_URL;
  if (!wmsUrl) return null;
  try {
    const resp = await fetch(`${wmsUrl}/public/stock`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(WMS_TIMEOUT_MS),
    });
    if (resp.status !== 200) return null;
    const data = await resp.json();
    const wellFormed = data && ((typeof data.stock === 'object' && data.stock !== null) || Array.isArray(data.items));
    return wellFormed ? parseWmsStock(data) : null;
  } catch (_error) {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req?.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).send('Method Not Allowed');
    return;
  }

  const shell = fs.readFileSync(path.join(process.cwd(), 'dist/index.html'), 'utf8');
  const baseUrl = process.env.PMI_API_URL;
  const token = resolveCatalogGrantToken();
  // PIM down / env missing: shoppers still get the plain SPA, crawlers are told not to cache.
  if (!baseUrl || !token) return sendHtml(res, 200, 'no-store', shell);

  // WMS starts alongside the PIM pages; fetchWmsStockMap never throws.
  const stockPromise = fetchWmsStockMap(token);
  const slug = typeof req?.query?.slug === 'string' ? req.query.slug : undefined;
  let product: Product | undefined;
  try {
    if (slug && /^\d+$/.test(slug)) {
      // Canonical id URL (the hot path, every ad click): one product, not the whole catalog.
      const one = await fetchOneProduct(baseUrl, token, slug);
      if (one === 'error') return sendHtml(res, 200, 'no-store', shell);
      product = one;
    } else {
      // Legacy name/PIM-slug URL: resolve against the catalog, then 301 to the id URL.
      const products = await fetchAllProducts(baseUrl, token);
      if (!products) return sendHtml(res, 200, 'no-store', shell);
      product = findProductBySlug(products, slug);
    }
  } catch (_error) {
    // malformed %-escape in the slug, or PIM unreachable: a slug that does not decode is 404, a fetch failure serves the shell
    if (_error instanceof URIError) product = undefined;
    else return sendHtml(res, 200, 'no-store', shell);
  }
  if (!product) return sendHtml(res, 404, 'no-store', shell);

  const canonicalPath = getProductPath(product);
  if (canonicalPath !== `/product/${slug}`) {
    res.setHeader('Location', `${canonicalPath}${queryOf(req)}`);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
    res.status(301).send('');
    return;
  }

  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  // A null map gives stock=undefined (never the PIM variant.stock) and a short/no-store response.
  const stockMap = await stockPromise;
  const [withStock] = applyWmsStock([product], stockMap);
  const html = renderProductPage(shell, withStock, canonicalUrl);
  if (!stockMap) return sendHtml(res, 200, 'no-store', html);
  res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE_CONTROL);
  sendHtml(res, 200, 'public, max-age=0, s-maxage=300', html);
}
