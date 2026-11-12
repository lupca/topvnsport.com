import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG_CACHE_TTL_MS, loadCatalog, saveCatalog, withInlinedProduct } from '../features/appData/catalogCache';
import { buildInitialState } from '../features/appData/appDataSlice';
import { renderProductPage } from '../../api/product';
import type { Product } from '../types';

const product = (id: string, name = 'P'): Product => ({ id, name, image: '', gallery: [], price: 1, salePrice: 1, tier_variations: [], variants: [] } as unknown as Product);
const SHELL = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

beforeEach(() => localStorage.clear());

describe('catalog cache (stale-while-revalidate)', () => {
  it('round-trips, expires after the TTL, and survives corrupt/blocked storage', () => {
    expect(loadCatalog()).toBeNull();
    saveCatalog({ a: 1 }, 1000);
    expect(loadCatalog(1000 + 5)).toEqual({ a: 1 });
    expect(loadCatalog(1000 + CATALOG_CACHE_TTL_MS)).toBeNull();
    localStorage.setItem('tvs.catalog.v1', '{broken');
    expect(loadCatalog()).toBeNull();
  });

  it('a cached catalog paints at once (no loading state); an empty cache waits', () => {
    expect(buildInitialState(undefined).isLoading).toBe(true);
    saveCatalog({ products: [product('1')], branches: [], stringOptions: [], categories: [] });
    const s = buildInitialState(undefined);
    expect(s.isLoading).toBe(false);
    expect(s.products.map(p => p.id)).toEqual(['1']);
    expect(s.catalogFromCache).toBe(true);
  });
});

describe('server-inlined product', () => {
  it('seeds the store without ending the catalog loading state', () => {
    const s = buildInitialState(product('590', 'Vợt'));
    expect(s.products.map(p => p.id)).toEqual(['590']);
    expect(s.isLoading).toBe(true);
  });

  it('replaces the same id from the cache instead of duplicating it', () => {
    expect(withInlinedProduct([product('1', 'old'), product('2')], product('1', 'fresh')).map(p => p.name)).toEqual(['fresh', 'P']);
    expect(withInlinedProduct([product('1')], undefined)).toHaveLength(1);
  });

  it('api/product inlines the product as window.__PRODUCT__ (no "<" escape hatch) and drops the catalog preloads', () => {
    expect(SHELL).toContain('data-catalog-preload');
    const html = renderProductPage(SHELL, product('590', 'A </script><b> B'), 'https://www.topvnsport.com/product/590');
    const m = html.match(/<script>window\.__PRODUCT__=(.*?)<\/script>/)!;
    expect(JSON.parse(m[1]).name).toBe('A </script><b> B');
    expect(m[1]).not.toContain('</script');
    expect(html).not.toContain('data-catalog-preload');
  });
});
