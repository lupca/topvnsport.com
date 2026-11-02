import { resolveCatalogGrantToken } from './_catalogProxy.js';
import { slugifyProductName, buildProductSlugById, getProductPath } from '../src/utils/productSlug.js';
import { getCategoriesSortedByCount } from '../src/utils/categories.js';
import type { Category, Product } from '../src/types.js';

import { SITE_ORIGIN } from '../src/config/storefront.js';

export { SITE_ORIGIN };

const PRODUCTS_PAGE_SIZE = 100;

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

function renderSitemap(urls: string[]): string {
  const items = urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
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
      } as Product);
    }

    const keptCategories = getCategoriesSortedByCount(categories, products);
    const slugById = buildProductSlugById(products);

    const urls: string[] = [
      `${SITE_ORIGIN}/`,
      ...keptCategories.map((c) => `${SITE_ORIGIN}/catalog?category=${encodeURIComponent(c.code)}`),
      ...products.map((p) => `${SITE_ORIGIN}${getProductPath(p, slugById)}`),
    ];

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    res.status(200).send(renderSitemap(urls));
  } catch (_error) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send('Bad Gateway');
  }
}
