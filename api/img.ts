// GET /api/img?f=<file name>&w=<width>: a pim.voma.vn media picture resized to one of IMAGE_WIDTHS, as WebP.
// Not a proxy: the only upstream is https://pim.voma.vn/media/<f>, f must be a plain image file name, w must be
// one of the fixed widths, and the query must be EXACTLY the ordered pairs f then w (parsed, so equivalent encodings pass; a different
// order, an extra or a repeated key is refused, so one picture at one width is one CDN cache entry). The source
// must decode as JPEG, PNG or WebP (anything else, e.g. SVG, is 415). Never upscales, never crops (aspect ratio kept),
// keeps transparency, strips metadata but applies the EXIF orientation. A failure is an explicit status with
// no-store: it never redirects to or streams the original (the page's own broken-image UI shows the failure).
// Uses only the plain Node req/res API so the same handler runs on Vercel and in the Vite dev server (vite.config.ts).
import sharp from 'sharp';
import { IMAGE_WIDTHS, MEDIA_FILE, MEDIA_ORIGIN } from '../src/utils/productImage.js';

export const UPSTREAM_TIMEOUT_MS = 8000;
export const MAX_SOURCE_BYTES = 6 * 1024 * 1024; // PIM originals measured 11 KB-1.1 MB (median 177 KB); 6 MB leaves room without being unbounded
const MAX_SOURCE_PIXELS = 40_000_000; // decode guard: originals measured up to 3024x4032 (~12 MP)
const WEBP_QUALITY = 80;
const DECODABLE_FORMATS = ['jpeg', 'png', 'webp']; // what the PIM serves; checked by decoding, not by content-type
// Content-unique uuid file names: the bytes behind a URL never change.
const IMMUTABLE = 'public, max-age=31536000, immutable';

function fail(res: any, status: number, message: string, extra: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(`${message}\n`);
}

// Returns the validated file name and width, or the 400 message.
export function parseImgQuery(url: string): { file: string; width: number } | string {
  const { searchParams } = new URL(url, 'http://localhost');
  // Exactly the ordered pairs f, w (parsed, so equivalent encodings of the same pairs are the same request): a different
  // order, an extra or a repeated key is refused, so one picture at one width stays one cache entry.
  const keys = [...searchParams.keys()].join(',');
  if (keys !== 'f,w') return 'the query must be exactly ?f=<file>&w=<width>';
  const file = searchParams.get('f');
  if (!file || !MEDIA_FILE.test(file) || file.includes('..')) return 'f must be a plain image file name of /media';
  const raw = searchParams.get('w') ?? '';
  const width = Number(raw);
  if (String(width) !== raw || !(IMAGE_WIDTHS as readonly number[]).includes(width)) return `w must be one of ${IMAGE_WIDTHS.join(', ')}`;
  return { file, width };
}

const isTimeout = (error: unknown) => ['TimeoutError', 'AbortError'].includes((error as { name?: string } | null)?.name ?? '');

async function readCapped(upstream: Response): Promise<Buffer | null> {
  const declared = Number(upstream.headers.get('content-length') ?? 0);
  if (declared > MAX_SOURCE_BYTES || !upstream.body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > MAX_SOURCE_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method not allowed', { Allow: 'GET, HEAD' });
  const q = parseImgQuery(req.url ?? '');
  if (typeof q === 'string') return fail(res, 400, q);

  let upstream: Response;
  try {
    upstream = await fetch(`${MEDIA_ORIGIN}/media/${q.file}`, {
      redirect: 'error',
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = isTimeout(error);
    console.error('img: upstream fetch failed', q.file, error);
    return fail(res, timedOut ? 504 : 502, timedOut ? 'source timed out' : 'source unreachable');
  }
  if (upstream.status === 404) return fail(res, 404, 'source not found');
  if (upstream.status !== 200) return fail(res, 502, `source answered ${upstream.status}`);
  if (!(upstream.headers.get('content-type') ?? '').toLowerCase().startsWith('image/')) return fail(res, 415, 'source is not an image');

  let source: Buffer | null;
  try {
    source = await readCapped(upstream);
  } catch (error) {
    const timedOut = isTimeout(error);
    console.error('img: upstream body failed', q.file, error);
    return fail(res, timedOut ? 504 : 502, timedOut ? 'source timed out' : 'source unreachable');
  }
  if (!source) return fail(res, 502, `source larger than ${MAX_SOURCE_BYTES} bytes`);

  let out: Buffer;
  try {
    const input = sharp(source, { limitInputPixels: MAX_SOURCE_PIXELS });
    const { format } = await input.metadata();
    if (!format || !DECODABLE_FORMATS.includes(format)) return fail(res, 415, 'source is not a JPEG, PNG or WebP picture');
    out = await input
      .rotate() // apply EXIF orientation; metadata is dropped on output (sharp default)
      .resize({ width: q.width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY }) // alpha is kept by default
      .toBuffer();
  } catch (error) {
    console.error('img: cannot decode', q.file, error);
    return fail(res, 415, 'source cannot be decoded as an image');
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Content-Length', String(out.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', IMMUTABLE);
  res.setHeader('Vercel-CDN-Cache-Control', IMMUTABLE);
  res.end(req.method === 'HEAD' ? undefined : out);
}
