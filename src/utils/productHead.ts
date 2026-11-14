import type { Category, Product } from '../types';
import { SITE_ORIGIN } from '../config/storefront.js';
import { HOME_SEO, TITLE_SUFFIX } from '../config/seo.js';
import { getCategoryLabel } from './categories.js';
import { productBrand, seoDescriptionFromText, seoTitleFromName } from './seoText.js';

// Head values of a page, shared by api/ (server render) and App.tsx (route change).
// Missing data is omitted, never composed.
export interface ProductHead {
  title: string;
  canonical: string;
  type: 'product' | 'website';
  description?: string;
  image?: string;
}

// PIM listing seo_title / seo_description win; otherwise derived from the name / description.
export function productHeadValues(product: Product, canonical: string): ProductHead {
  const description = product.seoDescription ?? seoDescriptionFromText(product.description);
  const image = product.gallery?.find((src) => /^https?:\/\/\S+$/i.test(src));
  return { title: product.seoTitle ?? seoTitleFromName(product.name), canonical, type: 'product', ...(description && { description }), ...(image && { image }) };
}

export function homeHead(): ProductHead {
  return { title: HOME_SEO.title, canonical: `${SITE_ORIGIN}/`, type: 'website', description: HOME_SEO.description, image: HOME_SEO.ogImage.url };
}

// Catalog H1 = its page title without the site suffix (server render and CatalogPage show the same text).
export const catalogH1 = (head: ProductHead) => head.title.replace(/ \| .*$/, '');

export const catalogPath = (code?: string) => (code ? `/catalog?category=${encodeURIComponent(code)}` : '/catalog');

// Category head from the category name and the products in it (count, top brands). undefined = unknown code.
export function catalogHead(code: string | undefined, categories: Category[], products: Product[]): ProductHead | undefined {
  const category = code ? categories.find(c => c.code === code) : undefined;
  if (code && !category) return undefined;
  // A one-word leaf ("Khác", "Tất") says little alone: prefix its parent from display_name.
  const parent = category?.display_name.split('>').map(x => x.trim()).filter(Boolean).slice(-2, -1)[0];
  const shown = category && getCategoryLabel(category, categories);
  const label = !shown ? 'Sản phẩm cầu lông' : !shown.includes(' ') && parent ? `${parent} – ${shown}` : shown;
  const items = category ? products.filter(p => p.categoryCode === code) : products;
  const brandCounts = new Map<string, number>();
  for (const p of items) {
    const b = productBrand(p);
    if (b) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
  }
  const brands = [...brandCounts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
  const lead = `${label} tại Top VN Sport: ${items.length} sản phẩm${brands.length ? ` ${brands.join(', ')}` : ''}.`;
  const description = seoDescriptionFromText(`${lead} Xem giá, chọn phân loại và đặt hàng online, giao hàng toàn quốc. Tư vấn qua hotline và Zalo.`)!;
  const title = category ? `${label}${TITLE_SUFFIX}` : `Tất cả sản phẩm cầu lông${TITLE_SUFFIX}`;
  const image = items.map(p => p.gallery?.find((src) => /^https?:\/\/\S+$/i.test(src))).find(Boolean);
  return { title, canonical: `${SITE_ORIGIN}${catalogPath(code)}`, type: 'website', description, ...(image && { image }) };
}

// [tag, key attr, key, value attr, field]; order is the server's head-block order.
export const PRODUCT_HEAD_TAGS = [
  ['link', 'rel', 'canonical', 'href', 'canonical'],
  ['meta', 'name', 'description', 'content', 'description'],
  ['meta', 'property', 'og:title', 'content', 'title'],
  ['meta', 'property', 'og:url', 'content', 'canonical'],
  ['meta', 'property', 'og:description', 'content', 'description'],
  ['meta', 'property', 'og:image', 'content', 'image'],
  ['meta', 'property', 'og:type', 'content', 'type'],
] as const;

// Server-inserted head tags carry this attribute, so the SPA can tell them from the shell's own.
export const PRODUCT_HEAD_MARK = 'data-product-head';
// A marked tag that replaced a shell tag keeps the shell's value here.
export const PRODUCT_SHELL_VALUE = 'data-shell-value';

export interface ShellHead {
  title: string;
  tags: Partial<Record<(typeof PRODUCT_HEAD_TAGS)[number][2], string>>;
}

// The shell head as index.html wrote it, read once at load. On a product landing api/product.ts keeps the
// shell title in data-shell-title, marks its own tags and keeps a replaced shell tag's value in data-shell-value.
export function readShellHead(doc: Document): ShellHead {
  const tags: ShellHead['tags'] = {};
  for (const [tag, keyAttr, key, valueAttr] of PRODUCT_HEAD_TAGS) {
    const value = doc.head.querySelector(`${tag}[${keyAttr}="${key}"]:not([${PRODUCT_HEAD_MARK}])`)?.getAttribute(valueAttr)
      ?? doc.head.querySelector(`${tag}[${keyAttr}="${key}"][${PRODUCT_SHELL_VALUE}]`)?.getAttribute(PRODUCT_SHELL_VALUE);
    if (value) tags[key] = value;
  }
  return { title: doc.querySelector('title')?.dataset.shellTitle ?? doc.title, tags };
}

// head = null restores the shell. A product value wins; a field the product lacks falls back to the shell's
// own tag, as in the server render (it only appends). One copy per tag survives; none if neither has a value.
// jsonLd: the page's structured data (product pages); without it a server-rendered one is removed, never left stale.
export function syncHead(doc: Document, head: ProductHead | null, shell: ShellHead, jsonLd?: unknown): void {
  doc.title = head?.title ?? shell.title;
  const scripts = Array.from(doc.head.querySelectorAll('script[type="application/ld+json"]'));
  scripts.slice(jsonLd ? 1 : 0).forEach((s) => s.remove());
  if (jsonLd) {
    const script = scripts[0] ?? doc.head.appendChild(Object.assign(doc.createElement('script'), { type: 'application/ld+json' }));
    script.textContent = JSON.stringify(jsonLd);
  }
  for (const [tag, keyAttr, key, valueAttr, field] of PRODUCT_HEAD_TAGS) {
    const value = head?.[field] ?? shell.tags[key];
    const copies = Array.from(doc.head.querySelectorAll(`${tag}[${keyAttr}="${key}"]`));
    copies.slice(1).forEach((d) => d.remove());
    let el = copies[0];
    if (!value) {
      el?.remove();
      continue;
    }
    if (!el) {
      el = doc.createElement(tag);
      el.setAttribute(keyAttr, key);
      doc.head.appendChild(el);
    }
    el.setAttribute(valueAttr, value);
  }
}
