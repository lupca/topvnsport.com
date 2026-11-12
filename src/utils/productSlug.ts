import type { Product } from '../types';

export function slugifyProductName(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'san-pham';
}

export function buildProductSlugById(products: Product[]): Record<string, string> {
  const seen = new Map<string, number>();
  const slugById: Record<string, string> = {};

  for (const product of products) {
    const preferredSlug = (product.slug || '').trim().toLowerCase();
    const base = preferredSlug || slugifyProductName(product.name);
    const currentCount = seen.get(base) || 0;
    const nextCount = currentCount + 1;

    seen.set(base, nextCount);
    slugById[product.id] = currentCount === 0 ? base : `${base}-${nextCount}`;
  }

  return slugById;
}

export function getProductSlug(product: Product, slugById?: Record<string, string>): string {
  if (slugById && slugById[product.id]) {
    return slugById[product.id];
  }
  return (product.slug || '').trim().toLowerCase() || slugifyProductName(product.name);
}

// Canonical URL = the PIM product id, which never changes on rename. Name slugs (getProductSlug) are legacy aliases that 301 here.
export function getProductPath(product: Product): string {
  return `/product/${encodeURIComponent(product.id)}`;
}

export function findProductBySlug(products: Product[], slugOrId?: string): Product | undefined {
  if (!slugOrId) return undefined;

  const decoded = decodeURIComponent(slugOrId).toLowerCase();
  const byId = products.find(product => product.id.toLowerCase() === decoded);
  if (byId) return byId;

  const slugById = buildProductSlugById(products);
  return products.find(product => slugById[product.id] === decoded)
    ?? products.find(product => product.vomaSlug === decoded);
}