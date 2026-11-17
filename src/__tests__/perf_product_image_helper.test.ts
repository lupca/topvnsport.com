import { describe, it, expect } from 'vitest';
import { IMAGE_WIDTHS, imageSrcSet, mediaFileName, resizedImageUrl } from '../utils/productImage';

const FILE = '0e7c1d52-6a1b-4f0e-9d0a-2f6b6b1f3a11.jpg';
const RAW = `https://pim.voma.vn/media/${FILE}`;

describe('productImage helper contract', () => {
  it('a pim.voma.vn /media/<file> URL becomes the resizer URL at the requested width', () => {
    expect(resizedImageUrl(RAW, 320)).toBe(`/api/img?f=${FILE}&w=320`);
    expect(mediaFileName(RAW)).toBe(FILE);
  });

  it('srcset lists every allowed width, in order, with w descriptors', () => {
    expect(imageSrcSet(RAW)).toBe(IMAGE_WIDTHS.map((w) => `/api/img?f=${FILE}&w=${w} ${w}w`).join(', '));
    expect(imageSrcSet(RAW, [192, 540])).toBe(`/api/img?f=${FILE}&w=192 192w, /api/img?f=${FILE}&w=540 540w`);
  });

  // The documented rule: anything that is not exactly https://pim.voma.vn/media/<plain image file> is returned
  // unchanged and has no srcset.
  it.each([
    ['local banner', '/banners/hero-1.webp'],
    ['data URL', 'data:image/png;base64,iVBORw0KGgo='],
    ['other host', `https://cdn.voma.vn/media/${FILE}`],
    ['look-alike host', `https://pim.voma.vn.evil.example/media/${FILE}`],
    ['http (not https)', `http://pim.voma.vn/media/${FILE}`],
    ['query string on the media URL', `${RAW}?v=2`],
    ['sub-path', `https://pim.voma.vn/media/x/${FILE}`],
    ['other path of the host', `https://pim.voma.vn/static/${FILE}`],
    ['not an image extension', 'https://pim.voma.vn/media/a.svg'],
    ['traversal', 'https://pim.voma.vn/media/../a.jpg'],
    ['empty', ''],
  ])('%s is returned unchanged and has no srcset', (_n, src) => {
    expect(resizedImageUrl(src, 320)).toBe(src);
    expect(imageSrcSet(src)).toBeUndefined();
    expect(mediaFileName(src)).toBeNull();
  });

  it('a width outside the list is a programming error, not silently accepted', () => {
    expect(() => resizedImageUrl(RAW, 300 as never)).toThrow(RangeError);
  });
});
