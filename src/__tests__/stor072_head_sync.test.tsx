// @vitest-environment jsdom
// STOR-072: after a server-rendered product landing, client-side navigation keeps title, canonical,
// description and og tags in sync with the route; nothing from product A survives elsewhere.
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act, render, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderProductPage } from '../../api/product';
import { SITE_ORIGIN } from '../config/storefront';
import { productHeadValues, readShellHead, syncHead } from '../utils/productHead';

const A = {
  id: 'a1', name: 'Vợt Yonex Astrox 99', description: 'Mô tả A', gallery: ['https://cdn.voma.vn/a.jpg'],
  image: 'https://cdn.voma.vn/a.jpg', price: 1500000, salePrice: 1500000, tier_variations: [], variants: [], specs: {}, stock: 1, brand: 'Yonex',
} as any;
const B = { id: 'b2', name: 'Giày Lining', gallery: ['/relative.jpg'], image: '/relative.jpg', price: 900000, tier_variations: [], variants: [], specs: {}, stock: 1, brand: 'Lining' } as any;
const C = { ...A, id: 'c3', name: 'Cước BG65', description: 'Mô tả C', gallery: ['https://cdn.voma.vn/c.jpg'] };

const api = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

const INDEX_HTML = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const SHELL_TITLE = new DOMParser().parseFromString(INDEX_HTML, 'text/html').title;

const q = (sel: string) => document.head.querySelector(sel);
const content = (sel: string) => q(sel)?.getAttribute('content') ?? null;
const head = () => ({
  title: document.title,
  canonical: q('link[rel="canonical"]')?.getAttribute('href') ?? null,
  description: content('meta[name="description"]'),
  ogTitle: content('meta[property="og:title"]'),
  ogUrl: content('meta[property="og:url"]'),
  ogDescription: content('meta[property="og:description"]'),
  ogImage: content('meta[property="og:image"]'),
});
const SHELL_HEAD = {
  title: SHELL_TITLE, canonical: null, description: null, ogTitle: null, ogUrl: null, ogDescription: null, ogImage: null,
};
const leftNothingOf = (p: any) => {
  const h = head();
  for (const v of [h.description, h.ogDescription]) expect(v).not.toBe(p.description);
  expect(h.ogImage).not.toBe(p.gallery[0]);
  expect([h.title, h.ogTitle]).not.toContain(p.name);
  expect([h.canonical, h.ogUrl].some(u => u?.includes('vot-yonex-astrox-99'))).toBe(false);
};

let navigate: (to: string) => void;

describe('STOR-072 head sync on client-side navigation', () => {
  beforeAll(async () => {
    // Land on /product/A exactly as api/product.ts serves it.
    const served = renderProductPage(INDEX_HTML, A, `${SITE_ORIGIN}/product/vot-yonex-astrox-99`);
    const doc = new DOMParser().parseFromString(served, 'text/html');
    document.head.innerHTML = doc.head.innerHTML;
    expect(document.title).toBe(A.name);
    api.getProducts.mockResolvedValue([A, B, C]);
    window.scrollTo = vi.fn() as any;

    vi.resetModules(); // App reads the shell title at module load, after the server head is in place
    const { default: App } = await import('../App');
    const { store } = await import('../app/store');
    const { Provider } = await import('react-redux');
    const { MemoryRouter, useNavigate } = await import('react-router-dom');
    const Nav = () => { navigate = useNavigate(); return null; };
    render(<Provider store={store}><MemoryRouter initialEntries={['/product/vot-yonex-astrox-99']}><Nav /><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(store.getState().appData.products).toHaveLength(3));
  });
  afterAll(cleanup);

  // navigate() runs in a transition and the lazy PDP may suspend, so head checks wait for the commit.
  const go = async (to: string) => { await act(async () => { navigate(to); }); };
  const headSoon = (expected: Record<string, unknown>) => waitFor(() => expect(head()).toMatchObject(expected));

  it('product A landing keeps A head', async () => {
    await waitFor(() => expect(head()).toEqual({
      title: A.name,
      canonical: `${SITE_ORIGIN}/product/vot-yonex-astrox-99`,
      description: 'Mô tả A',
      ogTitle: A.name,
      ogUrl: `${SITE_ORIGIN}/product/vot-yonex-astrox-99`,
      ogDescription: 'Mô tả A',
      ogImage: 'https://cdn.voma.vn/a.jpg',
    }));
  });

  it('A -> home restores the shell head: shell title, no canonical, no og/description', async () => {
    await go('/');
    await headSoon(SHELL_HEAD);
    leftNothingOf(A);
  });

  it('home -> B (no description, no absolute image) sets B title/canonical/og, omits the rest', async () => {
    await go('/product/giay-lining');
    await headSoon({
      title: 'Giày Lining',
      canonical: `${SITE_ORIGIN}/product/giay-lining`,
      description: null,
      ogTitle: 'Giày Lining',
      ogUrl: `${SITE_ORIGIN}/product/giay-lining`,
      ogDescription: null,
      ogImage: null,
    });
    leftNothingOf(A);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it('B -> C updates every existing tag in place to C values', async () => {
    await go('/product/cuoc-bg65');
    await headSoon({
      title: 'Cước BG65',
      canonical: `${SITE_ORIGIN}/product/cuoc-bg65`,
      description: 'Mô tả C',
      ogTitle: 'Cước BG65',
      ogUrl: `${SITE_ORIGIN}/product/cuoc-bg65`,
      ogDescription: 'Mô tả C',
      ogImage: 'https://cdn.voma.vn/c.jpg',
    });
  });

  it('C -> A (product to product) overwrites C values, no duplicates', async () => {
    await go('/product/vot-yonex-astrox-99');
    await headSoon({
      title: A.name,
      canonical: `${SITE_ORIGIN}/product/vot-yonex-astrox-99`,
      description: 'Mô tả A',
      ogTitle: A.name,
      ogUrl: `${SITE_ORIGIN}/product/vot-yonex-astrox-99`,
      ogDescription: 'Mô tả A',
      ogImage: 'https://cdn.voma.vn/a.jpg',
    });
    expect(document.head.querySelectorAll('link[rel="canonical"], meta[property^="og:"], meta[name="description"]')).toHaveLength(6);
  });

  it.each(['/catalog', '/stores', '/checkout/success', '/checkout/error', '/checkout/cancel', '/khong-co', '/product/khong-ton-tai'])(
    '%s shows the shell head', async (path) => {
      await go('/product/cuoc-bg65');
      await headSoon({ title: 'Cước BG65' });
      await go(path);
      await headSoon(SHELL_HEAD);
    });
});

describe('STOR-072 readShellHead', () => {
  it('prefers data-shell-title, falls back to document.title', () => {
    const doc = new DOMParser().parseFromString('<html><head><title>X</title></head></html>', 'text/html');
    expect(readShellHead(doc).title).toBe('X');
    doc.querySelector('title')!.dataset.shellTitle = 'Shell';
    expect(readShellHead(doc).title).toBe('Shell');
  });
});

describe('STOR-072 shell-owned head tags (finding 3c02e75f)', () => {
  // A shell that already has four of the six tags; a product landing replaces each, keeping the shell value.
  const SHELL = INDEX_HTML.replace('</head>', () => [
    '<link rel="canonical" href="https://shell/" />',
    '<meta name="description" content="shell desc" />',
    '<meta property="og:title" content="shell og" />',
    '<meta property="og:image" content="https://shell/og.jpg" />',
    '</head>'].join('\n'));
  const SHELL_TAGS = {
    title: SHELL_TITLE, canonical: 'https://shell/', description: 'shell desc', ogTitle: 'shell og', ogUrl: null, ogDescription: null, ogImage: 'https://shell/og.jpg',
  };
  const COUNT_SEL = 'link[rel="canonical"], meta[name="description"], meta[property^="og:"]';
  const urlA = `${SITE_ORIGIN}/product/vot-yonex-astrox-99`;
  const urlB = `${SITE_ORIGIN}/product/giay-lining`;

  it('landing on A -> shell restores the shell values, one copy each; -> B falls back to shell only where B lacks data', () => {
    const html = renderProductPage(SHELL, A, urlA);
    // Crawler-visible HTML (no JavaScript): one copy per tag, the product's (finding 11283670).
    for (const re of [/rel="canonical"/g, /name="description"/g, /property="og:title"/g, /property="og:image"/g]) {
      expect(html.match(re)).toHaveLength(1);
    }
    expect(html).not.toMatch(/(href|content)="(https:\/\/shell\/|shell desc|shell og|https:\/\/shell\/og\.jpg)"/);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.head.innerHTML = doc.head.innerHTML;
    expect(document.head.querySelectorAll(COUNT_SEL)).toHaveLength(6); // product tags replaced the 4 shell tags
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(urlA);
    const shell = readShellHead(document);
    expect(shell).toEqual({ title: SHELL_TITLE, tags: {
      canonical: 'https://shell/', description: 'shell desc', 'og:title': 'shell og', 'og:image': 'https://shell/og.jpg',
    } });

    syncHead(document, null, shell);
    expect(head()).toEqual(SHELL_TAGS);
    expect(document.head.querySelectorAll(COUNT_SEL)).toHaveLength(4);

    syncHead(document, productHeadValues(B, urlB), shell);
    expect(head()).toEqual({
      title: B.name, canonical: urlB, description: 'shell desc', ogTitle: B.name, ogUrl: urlB, ogDescription: null, ogImage: 'https://shell/og.jpg',
    });
    expect(document.head.querySelectorAll(COUNT_SEL)).toHaveLength(5);

    syncHead(document, null, shell);
    expect(head()).toEqual(SHELL_TAGS);
    expect(document.head.querySelectorAll(COUNT_SEL)).toHaveLength(4);
  });
});

describe('STOR-072 the shell title lives only in index.html', () => {
  it('src/ and api/ do not repeat it', async () => {
    const { execSync } = await import('node:child_process');
    const root = resolve(__dirname, '../..');
    const hits = execSync(`grep -rlF -- ${JSON.stringify(SHELL_TITLE)} src api || true`, { cwd: root }).toString().trim();
    expect(hits).toBe('');
  });

  it("api/product.ts inserts head tags through exactly one .replace('</head>', ...)", () => {
    const src = readFileSync(resolve(__dirname, '../../api/product.ts'), 'utf8');
    expect(src.match(/\.replace\('<\/head>'/g)).toHaveLength(1);
  });
});
