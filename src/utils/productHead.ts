import type { Product } from '../types';

// Head values of a product page, shared by api/product.ts (server render) and App.tsx (route change).
// Missing data is omitted, never composed.
export interface ProductHead {
  title: string;
  canonical: string;
  description?: string;
  image?: string;
}

export function productHeadValues(product: Product, canonical: string): ProductHead {
  // Cut by code points so an emoji at 159-160 is never split into a lone surrogate.
  const description = Array.from((product.description ?? '').replace(/\s+/g, ' ').trim()).slice(0, 160).join('').trim();
  const image = product.gallery?.find((src) => /^https?:\/\/\S+$/i.test(src));
  return { title: product.name, canonical, ...(description && { description }), ...(image && { image }) };
}

// [tag, key attr, key, value attr, field]; order is the server's head-block order.
export const PRODUCT_HEAD_TAGS = [
  ['link', 'rel', 'canonical', 'href', 'canonical'],
  ['meta', 'name', 'description', 'content', 'description'],
  ['meta', 'property', 'og:title', 'content', 'title'],
  ['meta', 'property', 'og:url', 'content', 'canonical'],
  ['meta', 'property', 'og:description', 'content', 'description'],
  ['meta', 'property', 'og:image', 'content', 'image'],
] as const;

// The shell title as index.html wrote it: api/product.ts keeps it in data-shell-title on a product landing.
export function readShellTitle(doc: Document): string {
  return doc.querySelector('title')?.dataset.shellTitle ?? doc.title;
}

// head = null restores the shell: shell title, none of the product tags.
// ponytail: index.html has none of PRODUCT_HEAD_TAGS, so removing them restores the shell; snapshot them at load if it ever gets one.
export function syncHead(doc: Document, head: ProductHead | null, shellTitle: string): void {
  doc.title = head?.title ?? shellTitle;
  for (const [tag, keyAttr, key, valueAttr, field] of PRODUCT_HEAD_TAGS) {
    const value = head?.[field];
    let el = doc.head.querySelector(`${tag}[${keyAttr}="${key}"]`);
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
