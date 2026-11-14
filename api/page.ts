// Server render of the home page (/) and catalog pages (/catalog, /catalog?category=<code>), reached through
// middleware.ts: head (title, description, canonical, Open Graph) plus an H1, intro paragraph and the
// product links with prices inside #root, for crawlers that do not run JS. React replaces #root on mount.
import fs from 'node:fs';
import path from 'node:path';
import { CDN_CACHE_CONTROL, resolveCatalogGrantToken } from './_catalogProxy.js';
import { escapeHtml, inlineJson, renderPage, sendHtml } from './_render.js';
import { fetchWmsStockMap } from './product.js';
import { applyWmsStock } from '../src/services/sport-api/wmsStock.js';
import { HOME_SEO } from '../src/config/seo.js';
import { catalogH1, catalogHead, catalogPath, homeHead, type ProductHead } from '../src/utils/productHead.js';
import { getCategoriesSortedByCount, getCategoryLabel } from '../src/utils/categories.js';
import { getPriceDisplay } from '../src/utils/priceDisplay.js';
import { getProductPath } from '../src/utils/productSlug.js';
import { mapPmiProduct } from '../src/services/sport-api/productMappers.js';
import { formatVnd } from '../src/components/product-detail/helpers.js';
import { BANNER_SIZE, BANNER_SIZES, bannerSrcSet } from '../src/features/home/bannerImage.js';
import type { Category, Product } from '../src/types.js';

const PIM_TIMEOUT_MS = 4000;
const NO_PRICE_TEXT = 'Liên hệ để biết giá';

async function pimJson(baseUrl: string, token: string, route: string): Promise<any> {
  const resp = await fetch(`${baseUrl}${route}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(PIM_TIMEOUT_MS) });
  if (resp.status !== 200) throw new Error(`PIM ${route} ${resp.status}`);
  return resp.json();
}

async function fetchCatalog(baseUrl: string, token: string): Promise<{ categories: Category[]; products: Product[] }> {
  const [categories, first] = await Promise.all([
    pimJson(baseUrl, token, '/public/voma-categories'),
    pimJson(baseUrl, token, '/public/products?page=1&limit=100'),
  ]);
  if (!Array.isArray(categories) || !Array.isArray(first?.items) || typeof first.pages !== 'number') throw new Error('PIM malformed');
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page += 1) items.push(...(await pimJson(baseUrl, token, `/public/products?page=${page}&limit=100`)).items);
  return { categories, products: items.map((p) => mapPmiProduct(p, categories)).filter((p): p is Product => p !== null) };
}

// First configured hero banner, as raw HTML so the browser fetches it at parse time (LCP).
function heroImage(): string {
  try {
    const first = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/config/heroBanners.json'), 'utf8'))[0]?.image;
    if (typeof first?.src !== 'string' || !/^\/banners\/[\w.-]+\.webp$/.test(first.src)) return '';
    return `<img class="ssr-hero" src="${first.src}" srcset="${bannerSrcSet(first.src)}" sizes="${BANNER_SIZES}" width="${BANNER_SIZE}" height="${BANNER_SIZE}" fetchpriority="high" alt="${escapeHtml(String(first.alt ?? ''))}">`;
  } catch {
    return '';
  }
}

const productList = (products: Product[]) => `<ul>${products.map((p) => {
  const { salePrice } = getPriceDisplay(p);
  const price = p.price !== undefined && salePrice > 0 ? formatVnd(salePrice) : NO_PRICE_TEXT;
  return `<li><a href="${getProductPath(p)}">${escapeHtml(p.name)}</a> <span>${escapeHtml(price)}</span></li>`;
}).join('')}</ul>`;

const categoryLinks = (categories: Category[], products: Product[]) => {
  const shown = getCategoriesSortedByCount(categories, products);
  return shown.length ? `<nav aria-label="Danh mục"><ul>${shown.map((c) => `<li><a href="${catalogPath(c.code)}">${escapeHtml(getCategoryLabel(c, categories))}</a></li>`).join('')}</ul></nav>` : '';
};

// The catalog the page was rendered from, for the SPA to start from (window.__CATALOG__): a failed or slow
// /api fetch in the browser (or a crawler that cannot fetch it) never replaces the content with a loading/error state.
const catalogScript = (categories: Category[], products: Product[]) => `window.__CATALOG__=${inlineJson({ categories, products })}`;

export function renderHome(shell: string, categories: Category[], products: Product[]): string {
  const root = `<div id="ssr"><h1>${escapeHtml(HOME_SEO.h1)}</h1><p>${escapeHtml(HOME_SEO.description)}</p>${heroImage()}${categoryLinks(categories, products)}${productList(products)}</div>`;
  return renderPage(shell, homeHead(), { root, script: catalogScript(categories, products) });
}

export function renderCatalog(shell: string, head: ProductHead, code: string | undefined, categories: Category[], products: Product[]): string {
  const items = code ? products.filter((p) => p.categoryCode === code) : products;
  const root = `<div id="ssr"><h1>${escapeHtml(catalogH1(head))}</h1><p>${escapeHtml(head.description ?? '')}</p>${productList(items)}${categoryLinks(categories, products)}</div>`;
  return renderPage(shell, head, { root, script: catalogScript(categories, products) });
}

export default async function handler(req: any, res: any) {
  if (req?.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).send('Method Not Allowed');
    return;
  }
  const shell = fs.readFileSync(path.join(process.cwd(), 'dist/index.html'), 'utf8');
  const route = req?.query?.route === 'catalog' ? 'catalog' : 'home';
  const code = typeof req?.query?.category === 'string' && req.query.category ? req.query.category : undefined;
  // Search/brand-filtered catalog views are not landing pages: plain SPA.
  const filtered = ['search', 'brand'].some((k) => req?.query?.[k] !== undefined);
  const baseUrl = process.env.PMI_API_URL;
  const token = resolveCatalogGrantToken();

  let catalog: { categories: Category[]; products: Product[] } | undefined;
  let stockMap: Record<string, number> | null = null;
  if (baseUrl && token && !filtered) {
    // WMS stock alongside (never throws): the inlined products carry the stock the browser would load.
    const stockPromise = fetchWmsStockMap(token);
    try {
      catalog = await fetchCatalog(baseUrl, token);
    } catch (error) {
      console.error('page render: PIM catalog unavailable', error);
    }
    stockMap = await stockPromise;
    if (catalog) catalog = { categories: catalog.categories, products: applyWmsStock(catalog.products, stockMap) };
  }
  // PIM down: home still gets its own head (static config); the catalog gets the plain shell. Never cached.
  if (!catalog) {
    return sendHtml(res, 200, 'no-store', route === 'home' && !filtered ? renderPage(shell, homeHead(), { root: '' }) : shell);
  }
  let html: string;
  if (route === 'home') html = renderHome(shell, catalog.categories, catalog.products);
  else {
    const head = catalogHead(code, catalog.categories, catalog.products);
    if (!head) return sendHtml(res, 200, 'no-store', shell); // unknown category code: the SPA shows its own state
    html = renderCatalog(shell, head, code, catalog.categories, catalog.products);
  }
  // No stock: the page is right but its inlined products lack stock until the browser refreshes them: not cached.
  if (!stockMap) return sendHtml(res, 200, 'no-store', html);
  res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE_CONTROL);
  sendHtml(res, 200, 'public, max-age=0, s-maxage=300', html);
}
