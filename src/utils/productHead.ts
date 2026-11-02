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

// Server-inserted head tags carry this attribute, so the SPA can tell them from the shell's own.
export const PRODUCT_HEAD_MARK = 'data-product-head';

export interface ShellHead {
  title: string;
  tags: Partial<Record<(typeof PRODUCT_HEAD_TAGS)[number][2], string>>;
}

// The shell head as index.html wrote it, read once at load. On a product landing api/product.ts keeps the
// shell title in data-shell-title and marks its own tags, so neither is mistaken for a shell value.
export function readShellHead(doc: Document): ShellHead {
  const tags: ShellHead['tags'] = {};
  for (const [tag, keyAttr, key, valueAttr] of PRODUCT_HEAD_TAGS) {
    const value = doc.head.querySelector(`${tag}[${keyAttr}="${key}"]:not([${PRODUCT_HEAD_MARK}])`)?.getAttribute(valueAttr);
    if (value) tags[key] = value;
  }
  return { title: doc.querySelector('title')?.dataset.shellTitle ?? doc.title, tags };
}

// head = null restores the shell. A product value wins; a field the product lacks falls back to the shell's
// own tag, as in the server render (it only appends). One copy per tag survives; none if neither has a value.
export function syncHead(doc: Document, head: ProductHead | null, shell: ShellHead): void {
  doc.title = head?.title ?? shell.title;
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
