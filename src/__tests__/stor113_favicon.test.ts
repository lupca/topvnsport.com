import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const pub = (f: string) => path.join(root, 'public', f.replace(/^\//, ''));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const links = Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('link'));
const find = (rel: string, sizes?: string) =>
  links.find((l) => l.getAttribute('rel') === rel && (!sizes || l.getAttribute('sizes') === sizes));

function pngSize(file: string) {
  const b = fs.readFileSync(file);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

describe('STOR-113 favicon set', () => {
  it.each([
    ['favicon-48x48.png', '48x48'],
    ['apple-touch-icon.png', '180x180'],
    ['icon-192.png', '192x192'],
    ['icon-512.png', '512x512'],
  ])('%s is a %s PNG', (f, size) => {
    expect(pngSize(pub(f))).toBe(size);
  });

  it('favicon.ico holds 16, 32 and 48', () => {
    const b = fs.readFileSync(pub('favicon.ico'));
    expect(b.readUInt16LE(0)).toBe(0);
    expect(b.readUInt16LE(2)).toBe(1);
    expect(b.readUInt16LE(4)).toBe(3);
    expect([0, 1, 2].map((i) => b[6 + 16 * i])).toEqual([16, 32, 48]);
  });

  it('index.html links favicon.ico, 48x48 png, apple-touch-icon and manifest to existing files', () => {
    const wanted = [
      [find('icon', 'any'), '/favicon.ico'],
      [find('icon', '48x48'), '/favicon-48x48.png'],
      [find('apple-touch-icon', '180x180'), '/apple-touch-icon.png'],
      [find('manifest'), '/site.webmanifest'],
    ] as const;
    for (const [link, href] of wanted) {
      expect(link?.getAttribute('href')).toBe(href);
      expect(fs.existsSync(pub(href))).toBe(true);
    }
  });

  it('site.webmanifest is valid JSON listing existing icons with matching sizes', () => {
    const m = JSON.parse(fs.readFileSync(pub('site.webmanifest'), 'utf8'));
    expect(m.name).toBe('TopVNSport');
    expect(m.short_name).toBe('TopVNSport');
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']);
    for (const i of m.icons) {
      expect(fs.existsSync(pub(i.src))).toBe(true);
      expect(pngSize(pub(i.src))).toBe(i.sizes);
    }
  });
});
