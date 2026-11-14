// @vitest-environment jsdom
// Desktop CLS on product pages: the header menu wrapped to a second row when the catalog loaded after the
// server-rendered product. api/product.ts inlines the menu items (window.__NAV__); MainNav renders them hidden.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import MainNav from '../components/MainNav';
import productHandler, { renderProductPage } from '../../api/product';
import type { Product } from '../types';

const SHELL = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const product = { id: '590', name: 'Vợt', price: 0, gallery: [], variants: [] } as unknown as Product;
const NAV = [{ code: 'VC1', label: 'Vợt Cầu Lông' }, { code: 'VC2', label: 'Áo </script>' }];

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('product page inlines the header menu items', () => {
  it('window.__NAV__ is inlined (script-safe) only when items are given', () => {
    const html = renderProductPage(SHELL, product, 'https://www.topvnsport.com/product/590', NAV);
    const script = html.match(/<script>(window\.__PRODUCT__=[\s\S]*?)<\/script>/)![1];
    const win: any = {};
    new Function('window', script)(win);
    expect(win.__NAV__).toEqual(NAV);
    expect(renderProductPage(SHELL, product, 'https://x/product/590')).not.toContain('__NAV__');
  });

  it('handler: voma-categories failure -> page still 200 without __NAV__, not cached', async () => {
    process.env.PMI_API_URL = 'http://pim';
    process.env.CATALOG_GRANT_TOKENS = '{"s":"t"}';
    process.env.STOREFRONT_SELLER_ID = 's';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(fs, 'readFileSync').mockReturnValue(SHELL as any);
    const item = { id: 590, name: 'Vợt', status: 'Published', variants: [], media: [], tier_variations: [] };
    const run = async (categories: Response) => {
      global.fetch = vi.fn(async (url: string) =>
        url.includes('/public/voma-categories') ? categories.clone() : new Response(JSON.stringify(url.includes('/public/stock') ? { stock: {} } : item), { status: 200 })) as any;
      const res: any = { headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v; }, status(c: number) { this.code = c; return this; }, send(b: string) { this.body = b; return this; } };
      await productHandler({ method: 'GET', url: '/api/product?slug=590', query: { slug: '590' } }, res);
      return res;
    };
    process.env.WMS_API_URL = 'http://wms';
    const ok = await run(new Response(JSON.stringify([{ id: 1, code: 'VC1', name: 'Vợt', display_name: 'Thể Thao > Vợt' }]), { status: 200 }));
    expect(ok.code).toBe(200);
    expect(ok.body).toContain('window.__NAV__=[{"code":"VC1","label":"Vợt"}]');
    expect(ok.headers['Cache-Control']).toContain('s-maxage');
    const failed = await run(new Response('{}', { status: 503 }));
    expect(failed.code).toBe(200);
    expect(failed.body).not.toContain('__NAV__');
    expect(failed.headers['Cache-Control']).toBe('no-store');
  });
});

describe('MainNav placeholder', () => {
  it('placeholder items keep their box but are hidden; real items are visible', () => {
    const view = (placeholder: boolean) => render(<MemoryRouter><MainNav items={NAV} placeholder={placeholder} /></MemoryRouter>);
    view(true);
    const items = screen.getAllByRole('listitem', { hidden: true });
    expect(items[0].className).not.toContain('invisible'); // home link
    expect(items.slice(1).every(li => li.className.includes('invisible'))).toBe(true);
    cleanup();
    view(false);
    expect(screen.getAllByRole('listitem').some(li => li.className.includes('invisible'))).toBe(false);
  });
});
