import { resolveCatalogGrantToken } from './_catalogProxy.js';
import { slugifyProductName, getProductPath } from '../src/utils/productSlug.js';
import { getCategoriesSortedByCount } from '../src/utils/categories.js';
import type { Category, Product } from '../src/types.js';

import { SITE_ORIGIN } from '../src/config/storefront.js';

export { SITE_ORIGIN };

const PRODUCTS_PAGE_SIZE = 100;

// PIM updated_at (ISO, with or without zone) -> W3C datetime in UTC; anything unparsable -> no lastmod.
export function lastmodOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// lastmod (W3C date) only where PIM gives the product's updated_at; never invented for home/categories.
function renderSitemap(urls: { loc: string; lastmod?: string }[]): string {
  const items = urls
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export default async function handler(req: any, res: any) {
  if (req?.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).send('Method Not Allowed');
    return;
  }

  const baseUrl = process.env.PMI_API_URL;
  const token = resolveCatalogGrantToken();
  if (!baseUrl || !token) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).send('Misconfigured');
    return;
  }

  try {
    const catResp = await fetch(`${baseUrl}/public/voma-categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (catResp.status !== 200) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(502).send('Bad Gateway');
      return;
    }
    const categories = await catResp.json();
    if (!Array.isArray(categories)) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(502).send('Bad Gateway');
      return;
    }

    const allPmiProducts: any[] = [];
    let page = 1;
    let pages = 1;
    let total = 0;

    while (page <= pages) {
      const prodResp = await fetch(`${baseUrl}/public/products?page=${page}&limit=${PRODUCTS_PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (prodResp.status !== 200) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).send('Bad Gateway');
        return;
      }
      const data = await prodResp.json();
      if (!data || !Array.isArray(data.items) || typeof data.total !== 'number' || typeof data.pages !== 'number') {
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).send('Bad Gateway');
        return;
      }
      allPmiProducts.push(...data.items);
      pages = data.pages;
      total = data.total;
      page += 1;
    }

    if (allPmiProducts.length !== total) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(502).send('Bad Gateway');
      return;
    }

    // ponytail: mirrors mapPmiProduct name/slug/categoryCode logic without importing sport-api (not Node-safe)
    const categoryById = new Map<number, Category>(categories.map((c: Category) => [c.id, c]));
    const products: Product[] = [];
    for (const p of allPmiProducts) {
      const name = (p?.name ?? '').trim();
      if (!name) continue;
      const matchedCategory = p.voma_category_id ? categoryById.get(p.voma_category_id) : undefined;
      products.push({
        id: String(p.id),
        name,
        slug: slugifyProductName(name),
        categoryCode: matchedCategory?.code,
        updatedAt: lastmodOf(p?.updated_at),
      } as Product);
    }

    const keptCategories = getCategoriesSortedByCount(categories, products);

    const urls = [
      { loc: `${SITE_ORIGIN}/` },
      ...keptCategories.map((c) => ({ loc: `${SITE_ORIGIN}/catalog?category=${encodeURIComponent(c.code)}` })),
      ...products.map((p) => ({ loc: `${SITE_ORIGIN}${getProductPath(p)}`, lastmod: p.updatedAt })),
    ];

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    res.status(200).send(renderSitemap(urls));
  } catch (_error) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send('Bad Gateway');
  }
}
