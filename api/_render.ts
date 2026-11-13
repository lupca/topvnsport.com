// Shared server render for api/product.ts (product pages) and api/page.ts (home, catalog):
// replaces the shell's head tags with the page's, adds JSON-LD and fills #root.
import { PRODUCT_HEAD_MARK, PRODUCT_HEAD_TAGS, PRODUCT_SHELL_VALUE, type ProductHead } from '../src/utils/productHead.js';

export function escapeHtml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&#39;', '"': '&quot;' })[c] as string);
}

// JSON for an inline <script>: '<' and U+2028/2029 are \u-escaped so a value can neither close the
// script element nor break a JS parser. JSON.parse returns the original text.
export function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export interface RenderOptions {
  jsonLd?: unknown;
  // HTML placed inside #root (React replaces it on mount).
  root: string;
  // Inline script after #root (e.g. window.__PRODUCT__).
  script?: string;
  // Product pages: server text must not show unstyled, so the bundle CSS blocks again and the
  // catalog preloads (unused there) are dropped. Home/catalog keep both (styled by #ssr rules in index.html).
  productPage?: boolean;
}

export function renderPage(shell: string, head: ProductHead, opts: RenderOptions): string {
  // A page tag replaces the shell's own copy (one canonical for crawlers); the shell value rides along in
  // data-shell-value so the SPA can restore it off this page. A field the page lacks keeps the shell tag.
  let page = shell;
  const headTags = PRODUCT_HEAD_TAGS
    .filter(([, , , , field]) => head[field])
    .map(([tag, keyAttr, key, valueAttr, field]) => {
      let shellValue: string | undefined;
      // Attribute-aware tag body: a quoted '>' stays inside its value; "'" only opens a quote right after '=' so an unquoted apostrophe stays plain.
      const ATTRS = `(?:"[^"]*"|(?<==\\s*)'[^']*'|[^'">]|(?<!=\\s*)')*`;
      page = page.replace(new RegExp(`[ \\t]*<${tag}\\b${ATTRS}?\\s${keyAttr}=(?:"${key}"|'${key}'|${key}(?=[\\s>]|/>))${ATTRS}>\\s*`, 'gi'), (m) => {
        shellValue ??= m.match(new RegExp(`^[ \\t]*<${tag}\\b${ATTRS}?\\s${valueAttr}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((v) => v !== undefined);
        return '';
      });
      const carry = shellValue ? ` ${PRODUCT_SHELL_VALUE}="${shellValue.replace(/"/g, '&quot;')}"` : '';
      return `<${tag} ${keyAttr}="${key}" ${valueAttr}="${escapeHtml(head[field]!)}" ${PRODUCT_HEAD_MARK}${carry} />`;
    })
    .join('\n    ');
  const jsonLd = opts.jsonLd ? `  <script type="application/ld+json">${inlineJson(opts.jsonLd)}</script>\n    ` : '  ';

  if (opts.productPage) {
    page = page
      .replace(/(<link rel="stylesheet"[^>]*?) media="print" onload="[^"]*" data-deferred-css/, '$1')
      .replace(/[ \t]*<link\b[^>]*\bdata-catalog-preload\b[^>]*>\s*/g, '');
  }
  // Function replacers: page strings may contain `$&`-style patterns.
  return page
    // data-shell-title keeps the shell title in the document so the SPA restores it off this page.
    .replace(/<title>([\s\S]*?)<\/title>/, (_m, shellTitle: string) =>
      `<title data-shell-title="${shellTitle.replace(/"/g, '&quot;')}">${escapeHtml(head.title)}</title>`)
    .replace('</head>', () => `${jsonLd}${headTags}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${opts.root}</div>${opts.script ? `\n    <script>${opts.script}</script>` : ''}`);
}

export function sendHtml(res: any, status: number, cacheControl: string, html: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.status(status).send(html);
}
