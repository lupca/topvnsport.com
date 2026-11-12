// @vitest-environment jsdom
// STOR-085: every sitemap product <loc> renders its product in <App/> (h1, no #not-found, self-canonical);
// /product/<id> and /product/<VOMA PIM slug> are aliases with the storefront slug as canonical.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { store } from '../app/store';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import sitemapHandler, { SITE_ORIGIN } from '../../api/sitemap';
import productHandler from '../../api/product';
import PIM_ITEMS from './fixtures/stor085_pmi_products.fixture.json';

const api = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

import App from '../App';
import { buildProductSlugById } from '../utils/productSlug';

// Verbatim live PIM /public/products items 638 (images), 632 (no image), 630 + 626 (same name -> '-2' twin).
const ITEMS = PIM_ITEMS as any[];
const SHELL = '<!doctype html><html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
const ENV = { ...process.env };

function makeRes() {
  return {
    statusCode: 200, headers: {} as Record<string, string>, body: '' as string,
    status(code: number) { this.statusCode = code; return this; },
    send(body: string) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn()); // ScrollToTop; jsdom has no window.scrollTo
  process.env.PMI_API_URL = 'https://api-pim.voma.vn/api/v1/site';
  process.env.STOREFRONT_SELLER_ID = 'seller-stor085';
  process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-stor085': 'token-stor085' });
  delete process.env.WMS_API_URL;
  global.fetch = vi.fn().mockImplementation(async (url: string) => ({
    status: 200,
    json: async () => {
      const one = url.match(/\/public\/products\/(\d+)$/);
      if (one) return ITEMS.find((p) => String(p.id) === one[1]);
      return url.includes('/public/voma-categories') ? [] : { items: ITEMS, total: ITEMS.length, pages: 1 };
    },
  })) as any;
  api.getProducts.mockResolvedValue(ITEMS.map((p) => mapPmiProduct(p, [])));
});

afterEach(() => {
  cleanup();
  process.env = { ...ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function sitemapProductPaths(): Promise<string[]> {
  const res = makeRes();
  await sitemapHandler({ method: 'GET' }, res);
  expect(res.statusCode).toBe(200);
  return [...res.body.matchAll(/<loc>([^<]*)<\/loc>/g)]
    .map((m) => m[1].replace(SITE_ORIGIN, ''))
    .filter((p) => p.startsWith('/product/'));
}

async function renderAt(urlPath: string) {
  const view = render(<Provider store={store}><MemoryRouter initialEntries={[urlPath]}><App /></MemoryRouter></Provider>);
  await waitFor(() => expect(view.container.querySelector('main h1')).not.toBeNull(), { timeout: 5000 });
  return view;
}

async function expectProductAt(urlPath: string, name: string, canonicalPath: string) {
  const { container } = await renderAt(urlPath);
  await waitFor(() => expect(container.querySelector('main h1')?.textContent).toBe(name), { timeout: 5000 });
  expect(container.querySelector('#not-found')).toBeNull();
  await waitFor(() => expect(document.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(`${SITE_ORIGIN}${canonicalPath}`));
  cleanup();
}

describe('STOR-085 sitemap product URLs render the product in <App/>', () => {
  it('every sitemap product <loc>: product h1, no #not-found, canonical is the loc itself', async () => {
    const locs = await sitemapProductPaths();
    // The sitemap emits one loc per product in PIM order, so loc i belongs to ITEMS[i].
    expect(locs).toHaveLength(ITEMS.length);
    for (const [i, loc] of locs.entries()) {
      await expectProductAt(loc, ITEMS[i].name.trim(), loc);
    }
  }, 30000);

  it('/product/<id> and /product/<VOMA slug> render the product; canonical stays the storefront slug', async () => {
    const locs = await sitemapProductPaths();
    for (const [i, item] of ITEMS.entries()) {
      expect(item.slug, 'fixture carries the PIM slug').toBeTruthy();
      await expectProductAt(`/product/${item.id}`, item.name.trim(), locs[i]);
      await expectProductAt(`/product/${item.slug}`, item.name.trim(), locs[i]);
    }
  }, 30000);

  it('an unknown slug still renders "Không tìm thấy trang" with "Về trang chủ"', async () => {
    await renderAt('/product/khong-co-san-pham-nay');
    await waitFor(() => expect(screen.getByText('Không tìm thấy trang')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe('/');
  });

  it('mapPmiProduct: no PIM slug -> vomaSlug undefined; storefront slug unchanged', () => {
    const { slug: _slug, ...noSlug } = ITEMS[0];
    const mapped = mapPmiProduct(noSlug, []);
    expect(mapped?.vomaSlug).toBeUndefined();
    expect(mapped?.slug).toBe(mapPmiProduct(ITEMS[0], [])?.slug);
  });
});

describe('STOR-085 api/product with the VOMA slug', () => {
  beforeEach(() => {
    const realRead = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(((p: any, ...rest: any[]) =>
      String(p).endsWith(path.join('dist', 'index.html')) ? SHELL : (realRead as any)(p, ...rest)) as any);
  });

  const canonicalOf = (html: string) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

  it('id returns 200 with the id canonical; VOMA slug and name slug 301 to it', async () => {
    const locs = await sitemapProductPaths();
    const legacySlugs = buildProductSlugById(ITEMS.map((p) => mapPmiProduct(p, [])!)); // what the old name URLs were, '-2' twin included
    for (const [i, item] of ITEMS.entries()) {
      const ok = makeRes();
      await productHandler({ method: 'GET', query: { slug: String(item.id) }, headers: {} }, ok);
      expect(ok.statusCode).toBe(200);
      expect(ok.body).toContain(`<h1>`);
      expect(canonicalOf(ok.body)).toBe(`${SITE_ORIGIN}${locs[i]}`);
      for (const slug of [item.slug, legacySlugs[String(item.id)]]) {
        const res = makeRes();
        await productHandler({ method: 'GET', query: { slug }, url: `/api/product?slug=${slug}&gclid=x`, headers: {} }, res);
        expect(res.statusCode, slug).toBe(301);
        expect(res.headers.Location, slug).toBe(`${locs[i]}?gclid=x`);
      }
    }
  });

  it('unknown slug: 404 no-store', async () => {
    const res = makeRes();
    await productHandler({ method: 'GET', query: { slug: 'khong-co-san-pham-nay' }, headers: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});
