import type { Category, Product } from '../../types';

// Stale-while-revalidate: the last good catalog in localStorage paints a return visit at once;
// fetchAppData then refreshes it. Storage may be missing/full/blocked: every access is try/catch.
const KEY = 'tvs.catalog.v2';
export const CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

declare global {
  interface Window {
    // Product api/product.ts already resolved server-side, inlined into the HTML.
    __PRODUCT__?: Product;
    // Header menu items api/product.ts built from PIM voma-categories (not yet ordered by product count):
    // Header renders them hidden until the catalog loads, so the menu has its final rows at first paint.
    // Catalog api/page.ts rendered home/catalog from: the SPA starts from it (then refreshes in the background).
    __CATALOG__?: { categories: Category[]; products: Product[] };
    __NAV__?: { code: string; label: string }[];
  }
}

export interface CatalogSnapshot<T> { savedAt: number; data: T }

export function saveCatalog<T>(data: T, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: now, data } satisfies CatalogSnapshot<T>));
  } catch {
    // quota / private mode: next visit simply starts cold
  }
}

export function loadCatalog<T>(now = Date.now()): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as CatalogSnapshot<T>;
    return snap && typeof snap.savedAt === 'number' && now - snap.savedAt < CATALOG_CACHE_TTL_MS ? snap.data : null;
  } catch {
    return null;
  }
}

// Server-inlined product (window.__PRODUCT__) replaces the same id in `products` or leads the list.
export function withInlinedProduct(products: Product[], inlined: Product | undefined): Product[] {
  if (!inlined || typeof inlined !== 'object' || inlined.id === undefined) return products;
  return [inlined, ...products.filter(p => String(p.id) !== String(inlined.id))];
}

// window.__CATALOG__ when well formed (arrays), else undefined.
export function inlinedCatalog(inlined = typeof window === 'undefined' ? undefined : window.__CATALOG__): { categories: Category[]; products: Product[] } | undefined {
  return inlined && Array.isArray(inlined.categories) && Array.isArray(inlined.products) && inlined.products.length > 0
    ? { categories: inlined.categories, products: inlined.products }
    : undefined;
}
