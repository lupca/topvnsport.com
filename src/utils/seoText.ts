import { DESCRIPTION_MAX, KNOWN_BRANDS, TITLE_MAX, TITLE_SUFFIX } from '../config/seo.js';

const chars = (s: string) => Array.from(s);
const len = (s: string) => chars(s).length;
const TRAILING_JUNK = /[\s,.;:+\-–—|/(]+$/u;

// Cut to <= max code points at a word boundary (never mid-word, never a lone surrogate). With
// `phrase`, prefer the last phrase separator (" - ", ", ", ". " ...) past half of max.
function cutAtWord(text: string, max: number, phrase = false): string {
  if (len(text) <= max) return text;
  const head = chars(text).slice(0, max + 1).join('');
  const seps = phrase ? [...head.matchAll(/\s[-–—|/]\s|[,.;:]\s/g)].map(m => m.index!).filter(i => i >= max / 2) : [];
  if (seps.length) return head.slice(0, seps[seps.length - 1]).replace(TRAILING_JUNK, '');
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : chars(text).slice(0, max).join('')).replace(TRAILING_JUNK, '');
}

// Page title from a product name: drop [..]/【..】 chunks and "Tặng ..." / "Quà tặng ..." tails,
// cut to TITLE_MAX at a word boundary, add the site suffix only when it still fits.
export function seoTitleFromName(name: string): string {
  const clean = name
    .replace(/\[[^\]]*\]|【[^】]*】/gu, ' ')
    .replace(/(?:^|[\s,.;:+\-–—])(?:(?:quà|combo(?:\s+\d+)?(?:\s+quà)?)\s+)?tặng(?:\s.*)?$/iu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s,.;:+\-–—|]+/u, '')
    .replace(TRAILING_JUNK, '');
  const title = cutAtWord(clean, TITLE_MAX, true);
  return len(title + TITLE_SUFFIX) <= TITLE_MAX ? title + TITLE_SUFFIX : title;
}

// Meta description from a product description: each line loses leading emoji/symbols/[..] chunks and
// markdown marks, lines join as sentences, then cut at the last sentence end within DESCRIPTION_MAX
// (word boundary + "…" when no sentence ends in range).
export function seoDescriptionFromText(text: string | undefined): string | undefined {
  const lines = (text ?? '')
    .split(/\n+/)
    .map(line => line
      .replace(/\*\*|__|`/g, '')
      .replace(/^(?:[^\p{L}\p{N}[【]+|\[[^\]]*\]|【[^】]*】)+/u, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;
  // A line that starts lowercase continues the previous sentence; any other line break ends one.
  const joined = lines.reduce((acc, l) => (!acc ? l : /^\p{Ll}/u.test(l) || /[.!?…:;]$/.test(acc) ? `${acc} ${l}` : `${acc}. ${l}`), '');
  const ended = /[.!?…]$/.test(joined) ? joined : `${joined}.`;
  if (len(ended) <= DESCRIPTION_MAX) return ended;
  const head = chars(ended).slice(0, DESCRIPTION_MAX).join('');
  const ends = [...head.matchAll(/[.!?…](?=\s)/g)].map(m => m.index!);
  const lastEnd = ends.length ? ends[ends.length - 1] : -1;
  // A sentence end in the first half would throw away most of the room; cut at a word then.
  if (lastEnd >= DESCRIPTION_MAX / 2) return head.slice(0, lastEnd + 1);
  return `${cutAtWord(ended, DESCRIPTION_MAX - 1)}…`;
}

const fold = (s: string) => s.normalize('NFC').toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Brand for structured data: the PIM brand attribute (canonical spelling when it is a known alias),
// otherwise the first KNOWN_BRANDS entry found as a whole word in the name.
export function productBrand(product: { brand?: string; name: string }): string | undefined {
  const matches = (text: string, alias: string) =>
    new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(fold(alias))}(?=$|[^\\p{L}\\p{N}])`, 'u').test(fold(text));
  const attr = product.brand?.trim().replace(/^no\s*brand$/i, '');
  if (attr) return KNOWN_BRANDS.find(names => names.some(a => fold(a) === fold(attr)))?.[0] ?? attr;
  return KNOWN_BRANDS.find(names => names.some(a => matches(product.name, a)))?.[0];
}
