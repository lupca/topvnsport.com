// api/img.ts: parameter validation, resize result, error paths, cache headers. No network: fetch is stubbed.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import handler, { MAX_SOURCE_BYTES } from '../../api/img';
import { IMAGE_WIDTHS } from '../utils/productImage';

const FILE = '0e7c1d52-6a1b-4f0e-9d0a-2f6b6b1f3a11.jpg';
let jpeg1024: Buffer, jpegWide: Buffer, jpegSmall: Buffer, pngAlpha: Buffer, jpegRotated: Buffer;

beforeAll(async () => {
  const noise = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } });
  jpeg1024 = await noise(1024, 1024).jpeg().toBuffer();
  jpegWide = await noise(1024, 768).jpeg().toBuffer();
  jpegSmall = await noise(100, 100).jpeg().toBuffer();
  pngAlpha = await sharp({ create: { width: 600, height: 400, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0.4 } } }).png().toBuffer();
  jpegRotated = await noise(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer(); // stored 400x200, displayed 200x400
});

type Reply = { status: number; headers: Record<string, string>; body: Buffer };
async function call(url: string, method = 'GET'): Promise<Reply> {
  const headers: Record<string, string> = {};
  let status = 0;
  let body = Buffer.alloc(0);
  const res = {
    set statusCode(v: number) { status = v; },
    get statusCode() { return status; },
    setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = String(v); },
    end: (b?: Buffer | string) => { body = b === undefined ? Buffer.alloc(0) : Buffer.from(b); },
  };
  await handler({ method, url }, res);
  return { status, headers, body };
}
const q = (f: string, w: string | number) => `/api/img?f=${encodeURIComponent(f)}&w=${w}`;
const imageResponse = (buf: Buffer, init: { status?: number; type?: string; headers?: Record<string, string> } = {}) =>
  new Response(new Uint8Array(buf), { status: init.status ?? 200, headers: { 'content-type': init.type ?? 'image/jpeg', ...init.headers } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => imageResponse(jpeg1024));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('/api/img parameter validation: every rejection is 400 and never reaches the upstream', () => {
  const bad: Array<[string, string]> = [
    ['no query', '/api/img'],
    ['missing f', '/api/img?w=320'],
    ['missing w', `/api/img?f=${FILE}`],
    ['empty f', '/api/img?f=&w=320'],
    ['w not in the list (100)', q(FILE, 100)],
    ['w not in the list (1025)', q(FILE, 1025)],
    ['w = 0', q(FILE, 0)],
    ['w negative', q(FILE, -320)],
    ['w decimal', q(FILE, '320.5')],
    ['w text', q(FILE, 'abc')],
    ['w with leading zero', q(FILE, '0320')],
    ['w with exponent', q(FILE, '3.2e2')],
    ['w empty', q(FILE, '')],
    ['f is a full URL', q('https://evil.example/a.jpg', 320)],
    ['f is another host path', q('//evil.example/a.jpg', 320)],
    ['f has a sub-path', q('a/b.jpg', 320)],
    ['f is parent traversal', q('../etc/a.jpg', 320)],
    ['f is encoded traversal', '/api/img?f=%2e%2e%2fa.jpg&w=320'],
    ['f has two dots', q('a..b.jpg', 320)],
    ['f with a query', q('a.jpg?x=1', 320)],
    ['f with a fragment', q('a.jpg#x', 320)],
    ['f with a NUL', q('a.jpg\0', 320)],
    ['f with a space', q('a b.jpg', 320)],
    ['f svg (not accepted)', q('a.svg', 320)],
    ['f gif (not accepted)', q('a.gif', 320)],
    ['f html', q('a.html', 320)],
    ['f without extension', q('a', 320)],
    ['f only an extension', q('.jpg', 320)],
    ['f starting with a dot', q('.a.jpg', 320)],
    ['f 133 characters', q(`${'a'.repeat(129)}.jpg`, 320)],
    ['extra query key', `${q(FILE, 320)}&u=https://evil.example`],
    ['duplicate w', `${q(FILE, 320)}&w=540`],
    ['duplicate f', `${q(FILE, 320)}&f=b.jpg`],
  ];
  it.each(bad)('%s -> 400', async (_name, url) => {
    const r = await call(url);
    expect(r.status).toBe(400);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['content-type']).toMatch(/^text\/plain/);
    expect(r.body.toString()).toMatch(/\S/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('%s -> 405 with Allow, no upstream call', async (method) => {
    const r = await call(q(FILE, 320), method);
    expect(r.status).toBe(405);
    expect(r.headers.allow).toBe('GET, HEAD');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['a.jpg', 'a.JPG', 'a.jpeg', 'a.png', 'a.webp', 'a.avif', FILE])('accepts %s', async (f) => {
    expect((await call(q(f, 320))).status).toBe(200);
  });

  it.each(IMAGE_WIDTHS)('accepts the listed width %i and asks only https://pim.voma.vn/media/<f>', async (w) => {
    const r = await call(q(FILE, w));
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://pim.voma.vn/media/${FILE}`);
    expect(init.redirect).toBe('error'); // a redirect never leads the function to another host
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('/api/img resize result', () => {
  it.each(IMAGE_WIDTHS.filter((w) => w < 1024))('1024x1024 JPEG at w=%i -> WebP, that width, still square', async (w) => {
    const r = await call(q(FILE, w));
    const meta = await sharp(r.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(w);
    expect(meta.height).toBe(w);
    expect(r.headers['content-type']).toBe('image/webp');
    expect(r.headers['content-length']).toBe(String(r.body.length));
  });

  it('keeps the aspect ratio (1024x768 -> 540x405), no crop', async () => {
    fetchMock.mockResolvedValue(imageResponse(jpegWide));
    const meta = await sharp((await call(q(FILE, 540))).body).metadata();
    expect([meta.width, meta.height]).toEqual([540, 405]);
  });

  it('never upscales (100x100 asked at 768 -> 100x100)', async () => {
    fetchMock.mockResolvedValue(imageResponse(jpegSmall));
    const meta = await sharp((await call(q(FILE, 768))).body).metadata();
    expect([meta.width, meta.height]).toEqual([100, 100]);
  });

  it('keeps transparency of a PNG with alpha', async () => {
    fetchMock.mockResolvedValue(imageResponse(pngAlpha, { type: 'image/png' }));
    const out = await call(q('a.png', 320));
    const meta = await sharp(out.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.hasAlpha).toBe(true);
    const px = await sharp(out.body).raw().toBuffer({ resolveWithObject: true });
    expect(px.data[3]).toBeGreaterThan(80); // alpha 0.4 ~ 102, not flattened to 255 and not dropped
    expect(px.data[3]).toBeLessThan(200);
  });

  it('applies EXIF orientation and strips metadata (400x200 stored rotated -> 192x384, no exif)', async () => {
    fetchMock.mockResolvedValue(imageResponse(jpegRotated));
    const meta = await sharp((await call(q(FILE, 192))).body).metadata();
    expect([meta.width, meta.height]).toEqual([192, 384]);
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('is smaller than the original JPEG', async () => {
    const noisy = await sharp(Buffer.from(Array.from({ length: 512 * 512 * 3 }, (_, i) => (i * 2654435761) % 251)), { raw: { width: 512, height: 512, channels: 3 } }).resize(1024, 1024).jpeg({ quality: 90 }).toBuffer();
    fetchMock.mockResolvedValue(imageResponse(noisy));
    expect((await call(q(FILE, 320))).body.length).toBeLessThan(noisy.length / 4);
  });
});

describe('/api/img cache headers', () => {
  it('success: one year, immutable, for browser and Vercel CDN; nosniff; no Vary', async () => {
    const r = await call(q(FILE, 320));
    expect(r.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(r.headers['vercel-cdn-cache-control']).toBe('public, max-age=31536000, immutable');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers.vary).toBeUndefined();
  });

  it('HEAD: same status and headers, empty body', async () => {
    const get = await call(q(FILE, 320));
    const head = await call(q(FILE, 320), 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    expect(head.headers['content-type']).toBe(get.headers['content-type']);
    expect(head.headers['content-length']).toBe(get.headers['content-length']);
    expect(head.headers['cache-control']).toBe(get.headers['cache-control']);
  });
});

describe('/api/img error paths: explicit status, no-store, never the original', () => {
  const expectFailure = (r: Reply, status: number) => {
    expect(r.status).toBe(status);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['vercel-cdn-cache-control']).toBeUndefined();
    expect(r.headers.location).toBeUndefined();
    expect(r.headers['content-type']).toMatch(/^text\/plain/);
    expect(r.body.length).toBeLessThan(200);
  };

  it('upstream 404 -> 404', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }));
    expectFailure(await call(q(FILE, 320)), 404);
  });
  it.each([500, 502, 403, 429, 304])('upstream %i -> 502', async (status) => {
    fetchMock.mockResolvedValue(new Response(status === 304 ? null : 'x', { status }));
    expectFailure(await call(q(FILE, 320)), 502);
  });
  it('upstream timeout -> 504', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));
    expectFailure(await call(q(FILE, 320)), 504);
  });
  it('upstream unreachable / redirect refused -> 502', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expectFailure(await call(q(FILE, 320)), 502);
  });
  it('body stalls and the timeout fires while reading -> 504', async () => {
    const body = new ReadableStream({ pull() { throw new DOMException('timed out', 'TimeoutError'); } });
    fetchMock.mockResolvedValue(new Response(body, { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    expectFailure(await call(q(FILE, 320)), 504);
  });
  it('upstream is not an image (text/html) -> 415', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expectFailure(await call(q(FILE, 320)), 415);
  });
  it('decodable bytes served as text/html are still refused (-> 415)', async () => {
    fetchMock.mockResolvedValue(imageResponse(jpeg1024, { type: 'text/html' }));
    expectFailure(await call(q(FILE, 320)), 415);
  });
  it('image content-type but undecodable bytes -> 415', async () => {
    fetchMock.mockResolvedValue(imageResponse(Buffer.from('this is not a jpeg at all')));
    expectFailure(await call(q(FILE, 320)), 415);
  });
  it('truncated JPEG -> 415', async () => {
    fetchMock.mockResolvedValue(imageResponse(jpeg1024.subarray(0, 300)));
    expectFailure(await call(q(FILE, 320)), 415);
  });
  it('declared size over the cap -> 502 without reading it', async () => {
    fetchMock.mockResolvedValue(imageResponse(jpegSmall, { headers: { 'content-length': String(MAX_SOURCE_BYTES + 1) } }));
    expectFailure(await call(q(FILE, 320)), 502);
  });
  it('streamed body over the cap (no content-length) -> 502', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const body = new ReadableStream({ pull(c) { if (sent++ > MAX_SOURCE_BYTES / chunk.length + 1) c.close(); else c.enqueue(chunk); } });
    fetchMock.mockResolvedValue(new Response(body, { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    expectFailure(await call(q(FILE, 320)), 502);
  });
  it('a pixel bomb (declared dimensions over the decode limit) -> 415', async () => {
    const huge = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
    fetchMock.mockResolvedValue(imageResponse(huge, { type: 'image/png' }));
    expectFailure(await call(q('a.png', 320)), 415);
  });
});
