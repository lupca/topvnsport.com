import fs from 'node:fs';
import path from 'node:path';
import { resolveCatalogGrantToken } from './_catalogProxy.js';
import { SITE_ORIGIN } from '../src/config/storefront.js';
import { productHeadValues, PRODUCT_HEAD_MARK, PRODUCT_HEAD_TAGS } from '../src/utils/productHead.js';
import { buildProductSlugById, getProductPath, findProductBySlug } from '../src/utils/productSlug.js';
import { mapPmiProduct } from '../src/services/sport-api/productMappers.js';
import { getPdpPrice, formatVnd, initialTierValue } from '../src/components/product-detail/helpers.js';
import type { Product } from '../src/types.js';

const PRODUCTS_PAGE_SIZE = 100;
const NO_PRICE_TEXT = 'Liên hệ để biết giá';

export function escapeHtml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&#39;', '"': '&quot;' })[c] as string);
}

function priceText(product: Product): string {
  const price = getPdpPrice(product, initialTierValue(product, 1), initialTierValue(product, 2));
  return price.hasPrice && price.salePrice > 0 ? formatVnd(price.salePrice) : NO_PRICE_TEXT;
}

// Pure: shell + product -> HTML. Missing data is omitted, never composed.
export function renderProductPage(shell: string, product: Product, canonicalUrl: string): string {
  const name = escapeHtml(product.name);
  const description = (product.description ?? '').trim();
  const head = productHeadValues(product, canonicalUrl);

  const headTags = PRODUCT_HEAD_TAGS
    .filter(([, , , , field]) => head[field])
    .map(([tag, keyAttr, key, valueAttr, field]) => `<${tag} ${keyAttr}="${key}" ${valueAttr}="${escapeHtml(head[field]!)}" ${PRODUCT_HEAD_MARK} />`)
    .join('\n    ');

  const body = [
    `<h1>${name}</h1>`,
    `<p>${escapeHtml(priceText(product))}</p>`,
    description && `<p>${escapeHtml(description)}</p>`,
  ].filter(Boolean).join('');

  // Function replacers: product strings may contain `$&`-style patterns.
  return shell
    // data-shell-title keeps the shell title in the document so the SPA restores it off product pages.
    .replace(/<title>([\s\S]*?)<\/title>/, (_m, shellTitle: string) =>
      `<title data-shell-title="${shellTitle.replace(/"/g, '&quot;')}">${name}</title>`)
    .replace('</head>', () => `  ${headTags}\n  </head>`)
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

  let products: Product[] | null;
  try {
    products = await fetchAllProducts(baseUrl, token);
  } catch (_error) {
    products = null;
  }
  if (!products) return sendHtml(res, 200, 'no-store', shell);

  const slug = typeof req?.query?.slug === 'string' ? req.query.slug : undefined;
  let product: Product | undefined;
  try {
    product = findProductBySlug(products, slug);
  } catch (_error) {
    product = undefined; // malformed %-escape in the slug
  }
  if (!product) return sendHtml(res, 404, 'no-store', shell);

  const canonicalUrl = `${SITE_ORIGIN}${getProductPath(product, buildProductSlugById(products))}`;
  sendHtml(res, 200, 'public, max-age=0, s-maxage=300', renderProductPage(shell, product, canonicalUrl));
}
