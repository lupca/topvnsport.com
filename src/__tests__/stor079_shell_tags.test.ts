// STOR-079: shell head tags are removed and their value extracted whatever the attribute syntax
// (quoted '>' , single quotes, unquoted, indented); a lookalike key is left alone.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderProductPage } from '../../api/product';
import type { Product } from '../types';

const INDEX_HTML = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const CANONICAL = 'https://www.topvnsport.com/product/vot-yonex';
const PRODUCT = {
  id: '1', name: 'Vợt Yonex', image: '', gallery: ['https://cdn.example/a.jpg'], description: 'Mô tả sản phẩm',
  price: 1500000, salePrice: 1500000, tier_variations: [], variants: [],
} as unknown as Product;

const withShell = (tag: string, indent = '') => INDEX_HTML.replace('  </head>', () => `  ${indent}${tag}\n  </head>`);
const withBody = (tag: string, body: string) => withShell(tag).replace('<body>', () => `<body>\n    ${body}`);
const render = (shell: string) => renderProductPage(shell, PRODUCT, CANONICAL);
const norm = (html: string) => html.replace(/\s+/g, ' ');
const noCarry = (html: string) => html.replace(/ data-shell-value="[^"]*"/g, '');
const headOf = (html: string) => new DOMParser().parseFromString(html, 'text/html').head;

// [label, shell tag, keyAttr, key, expected data-shell-value, indent]
const CASES: [string, string, string, string, string, string][] = [
  ['description with > in a double-quoted value', '<meta name="description" content="Giá > 1 triệu" />', 'name', 'description', 'Giá > 1 triệu', ''],
  ['unquoted canonical link', '<link rel=canonical href=https://shell/>', 'rel', 'canonical', 'https://shell/', ''],
  ['unquoted og:title meta', '<meta property=og:title content=ShellOg>', 'property', 'og:title', 'ShellOg', ''],
  ['single-quoted description', "<meta name='description' content='shell desc'>", 'name', 'description', 'shell desc', ''],
  ['single-quoted og:image with > in the value', "<meta property=\"og:image\" content='https://shell/a.jpg?x=1>2'>", 'property', 'og:image', 'https://shell/a.jpg?x=1>2', ''],
  ['indented description', '<meta name="description" content="Indented" />', 'name', 'description', 'Indented', '    '],
];

describe('STOR-079 shell head tags', () => {
  it.each(CASES)('%s: removed whole, value carried exactly', (_label, tag, keyAttr, key, expected, indent) => {
    const html = render(withShell(tag, indent));
    // Nothing of the shell tag is left (no stray text) and the page equals a render of a shell without it.
    expect(norm(noCarry(html))).toBe(norm(noCarry(render(INDEX_HTML))));
    const els = headOf(html).querySelectorAll(`[${keyAttr}="${key}"]`);
    expect(els).toHaveLength(1);
    expect(els[0].hasAttribute('data-product-head')).toBe(true);
    expect(els[0].getAttribute('data-shell-value')).toBe(expected);
  });

  it('leaves <meta name=description-long content=keep> untouched', () => {
    const tag = '<meta name=description-long content=keep>';
    const html = render(withShell(tag));
    expect(html).toContain(tag);
    const desc = headOf(html).querySelector('[name="description"][data-product-head]')!;
    expect(desc.hasAttribute('data-shell-value')).toBe(false);
  });

  it("unquoted value with apostrophe followed by body apostrophes does not eat </head> (STOR-083)", () => {
    const html = render(withBody("<meta name=description content=Shop's>", "<p class='x'>it's</p>"));
    expect(html).toContain('</head>');
    const head = headOf(html);
    const els = head.querySelectorAll('[name="description"]');
    expect(els).toHaveLength(1);
    expect(els[0].hasAttribute('data-product-head')).toBe(true);
    expect(els[0].getAttribute('data-shell-value')).toBe("Shop's");
    expect(head.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });

  it("unquoted value with odd apostrophe count still removes the shell duplicate (STOR-083)", () => {
    const html = render(withShell("<meta name=description content=Shop's>"));
    const els = headOf(html).querySelectorAll('[name="description"]');
    expect(els).toHaveLength(1);
    expect(els[0].hasAttribute('data-product-head')).toBe(true);
    expect(els[0].getAttribute('data-shell-value')).toBe("Shop's");
  });
});
