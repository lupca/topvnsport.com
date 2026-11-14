import fs from 'node:fs';
import path from 'node:path';
import { CDN_CACHE_CONTROL, resolveCatalogGrantToken } from './_catalogProxy.js';
import { escapeHtml, inlineJson, renderPage, sendHtml } from './_render.js';
import { SITE_ORIGIN } from '../src/config/storefront.js';
import { PRICE_VALID_DAYS, RETURN_POLICY, SHIPPING } from '../src/config/seo.js';
import { productHeadValues } from '../src/utils/productHead.js';
import { productBrand } from '../src/utils/seoText.js';
import { getProductPath, findProductBySlug } from '../src/utils/productSlug.js';
import { mapPmiProduct } from '../src/services/sport-api/productMappers.js';
import { applyWmsStock, parseWmsStock } from '../src/services/sport-api/wmsStock.js';
import { aggregateStock, getPdpPrice, formatVnd, initialTierValue } from '../src/components/product-detail/helpers.js';
import { getCategoryLabel } from '../src/utils/categories.js';
import type { Category, Product, ProductVariant } from '../src/types.js';

export { escapeHtml };

const PRODUCTS_PAGE_SIZE = 100;
const NO_PRICE_TEXT = 'Liên hệ để biết giá';
const WMS_TIMEOUT_MS = 4000;
const PIM_CATEGORIES_TIMEOUT_MS = 4000;
const SCHEMA_STOCK = (stock: number) => (stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock');

// Policy properties every Offer carries, read from src/config/seo.ts (owner decisions); off = omitted.
export function offerPolicies(): Record<string, unknown> {
  const days = (min: number, max: number) => ({ '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' });
  return {
    ...(SHIPPING.enabled && {
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: SHIPPING.rateVnd, currency: 'VND' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'VN' },
        deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: days(...SHIPPING.handlingDays), transitTime: days(...SHIPPING.transitDays) },
      },
    }),
    ...(RETURN_POLICY.enabled && {
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'VN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: RETURN_POLICY.days,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
        ...(RETURN_POLICY.link && { merchantReturnLink: RETURN_POLICY.link }),
      },
    }),
  };
}

// schema.org Product from the values the page shows. Offers only when the page shows a price (never on
// NO_PRICE_TEXT): one Offer per priced variant (sku, its own price, its WMS availability), the variant the
// page shows first leading; several variants -> AggregateOffer(lowPrice/highPrice/offerCount) around them,
// also when no variant is preselected (two-tier products).
export function productJsonLd(product: Product, canonicalUrl: string, now = new Date()): Record<string, unknown> {
  const description = (product.description ?? '').trim();
  const image = product.gallery?.find((src) => /^https?:\/\/\S+$/i.test(src));
  const price = getPdpPrice(product, initialTierValue(product, 1), initialTierValue(product, 2));
  const priced = price.hasPrice && price.salePrice > 0;
  const sku = price.matchedVariant?.sku_code ?? product.defaultSku;
  const brand = productBrand(product);
  const priceValidUntil = new Date(now.getTime() + PRICE_VALID_DAYS * 86400000).toISOString().slice(0, 10);
  const base = { '@type': 'Offer', priceCurrency: 'VND', priceValidUntil, url: canonicalUrl, ...offerPolicies() };

  let offers: Record<string, unknown> | undefined;
  const variants = (product.variants ?? []).filter((v) => v.price > 0);
  if (priced && variants.length > 0) {
    // One Offer per priced variant the web shows (PIM already dropped hidden ones), each with its sku, price and
    // WMS availability; the variant the page shows first leads. Several -> AggregateOffer around them.
    const first = price.matchedVariant && variants.includes(price.matchedVariant) ? price.matchedVariant : undefined;
    const ordered: ProductVariant[] = first ? [first, ...variants.filter((v) => v !== first)] : variants;
    const list = ordered.map((v) => ({
      ...base,
      ...(v.sku_code && { sku: v.sku_code }),
      price: v.computedPrice ?? v.price,
      ...(v.stock !== undefined && { availability: SCHEMA_STOCK(v.stock) }),
    }));
    const prices = list.map((o) => o.price as number);
    offers = list.length === 1
      ? list[0]
      : { '@type': 'AggregateOffer', priceCurrency: 'VND', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: list.length, offers: list };
  } else if (priced) {
    // No priced variant: availability only from WMS stock at the PDP's initial tiers; 'unknown' and 'none' omit it, never invented.
    const stock = aggregateStock(product, initialTierValue(product, 1), initialTierValue(product, 2));
    offers = { ...base, price: price.salePrice, ...(stock.kind === 'known' && { availability: SCHEMA_STOCK(stock.stock) }) };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(description && { description }),
    ...(image && { image }),
    ...(sku && { sku }),
    ...(brand && { brand: { '@type': 'Brand', name: brand } }),
    ...(offers && { offers }),
  };
}

type NavItem = { code: string; label: string };

// Pure: shell + product -> HTML. Missing data is omitted, never composed.
// nav (header menu items) is inlined as window.__NAV__: the menu reserves its rows before the catalog loads.
export function renderProductPage(shell: string, product: Product, canonicalUrl: string, nav?: NavItem[]): string {
  const description = (product.description ?? '').trim();
  const head = productHeadValues(product, canonicalUrl);
  const price = getPdpPrice(product, initialTierValue(product, 1), initialTierValue(product, 2));
  const priced = price.hasPrice && price.salePrice > 0;
  // Cover = the PIM cover when it is a real gallery URL (never NO_IMAGE_URL), else the first absolute gallery URL.
  const cover = product.image && product.gallery?.includes(product.image) && /^https?:\/\//i.test(product.image) ? product.image : head.image;
  const body = [
    `<h1>${escapeHtml(product.name)}</h1>`,
    // Cover photo for crawlers that do not run JS; square box, product photos are not cropped.
    cover && `<img src="${escapeHtml(cover)}" alt="${escapeHtml(product.name)}" width="600" height="600" style="max-width:100%;height:auto;object-fit:contain">`,
    `<p>${escapeHtml(priced ? formatVnd(price.salePrice) : NO_PRICE_TEXT)}</p>`,
    description && `<p>${escapeHtml(description)}</p>`,
  ].filter(Boolean).join('');

  return renderPage(shell, head, {
    jsonLd: productJsonLd(product, canonicalUrl),
    root: body,
    script: `window.__PRODUCT__=${inlineJson(product)}${nav?.length ? `;window.__NAV__=${inlineJson(nav)}` : ''}`,
    productPage: true,
  });
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

// Header menu items from PIM voma-categories (2 KB, the categories that have public products; the browser
// orders them by product count once the catalog loads), or null on any failure (logged).
async function fetchNavItems(baseUrl: string, token: string): Promise<NavItem[] | null> {
  try {
    const resp = await fetch(`${baseUrl}/public/voma-categories`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PIM_CATEGORIES_TIMEOUT_MS),
    });
    if (resp.status !== 200) throw new Error(`status ${resp.status}`);
    const categories: Category[] = await resp.json();
    if (!Array.isArray(categories) || !categories.every((c) => typeof c?.code === 'string' && typeof c?.display_name === 'string')) {
      throw new Error('malformed body');
    }
    return categories.map((c) => ({ code: c.code, label: getCategoryLabel(c, categories) }));
  } catch (error) {
    console.error('product page: header menu not inlined, PIM voma-categories failed:', error);
    return null;
  }
}

// WMS stock map, or null on any failure. Malformed (neither stock object nor items array) is a failure, never zero stock.
export async function fetchWmsStockMap(token: string): Promise<Record<string, number> | null> {
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
  const navPromise = fetchNavItems(baseUrl, token);
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
  const [stockMap, nav] = await Promise.all([stockPromise, navPromise]);
  const [withStock] = applyWmsStock([product], stockMap);
  const html = renderProductPage(shell, withStock, canonicalUrl, nav ?? undefined);
  // Without the menu items the page still renders (menu shifts once loaded): served, not cached.
  if (!stockMap || !nav) return sendHtml(res, 200, 'no-store', html);
  res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE_CONTROL);
  sendHtml(res, 200, 'public, max-age=0, s-maxage=300', html);
}
