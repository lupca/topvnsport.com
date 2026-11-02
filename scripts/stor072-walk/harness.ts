// STOR-072 local harness, run from the repo root after npm run build: dist/ + /product/:slug through the real
// api/product handler, fixture PIM/WMS on /api/pmi, /api/wms (and /pim for the handler). No real token, no network.
// Unstubbed /api/* (admin-units, branches) answer 404 on purpose. Usage: npx tsx scripts/stor072-walk/harness.ts
// Stop it by the PID it writes to $PIDFILE (the server's own pid, not the npx/tsx wrapper's) or by port: ss -ltnp 'sport = :4372'.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import productHandler from '../../api/product';

const PORT = Number(process.env.PORT || 4372);
// Verbatim PIM item shape from src/__tests__/stor069_product_page.test.ts (pmi()).
const pmi = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, voma_category_id: 1, variants: [{ id: id * 10, price: 500000, stock: 3, sku_code: `S${id}` }], ...extra,
});
const ITEMS = [
  pmi(101, 'Vợt Yonex Astrox 99', { description: 'Mô tả vợt A', media: [{ image_url: 'https://cdn.voma.vn/a.jpg' }] }),
  pmi(103, 'Cước BG65 Titanium', { description: 'Cước bền' }),
  pmi(104, 'Giày Lining'),
];
const CATS = [{ id: 1, code: 'vot', name: 'Vợt', display_name: 'Vợt' }];
const STOCK = { stock: { S101: 3, S103: 3, S104: 3 } };

process.env.PMI_API_URL = `http://127.0.0.1:${PORT}/pim`;
process.env.STOREFRONT_SELLER_ID = 'seller-harness';
process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-harness': 'fake-harness-token' });

const json = (res: http.ServerResponse, body: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const TYPES: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  const api = p.match(/^\/(?:pim|api\/pmi)(\/.*)$/);
  if (api) {
    if (api[1] === '/public/voma-categories') return json(res, CATS);
    if (api[1] === '/public/products') return json(res, { items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
    const one = api[1].match(/^\/public\/products\/(\d+)$/);
    if (one) { const it = ITEMS.find((i) => String(i.id) === one[1]); return it ? json(res, it) : json(res, {}, 404); }
  }
  if (p.startsWith('/api/wms/public/stock')) return json(res, STOCK);
  const slug = p.match(/^\/product\/([^/]+)$/);
  if (slug) {
    const r: any = { statusCode: 200, headers: {} as Record<string, string>,
      status(c: number) { this.statusCode = c; return this; },
      setHeader(k: string, v: string) { this.headers[k] = v; },
      send(b: string) { res.writeHead(this.statusCode, this.headers); res.end(b); } };
    return productHandler({ method: req.method, query: { slug: decodeURIComponent(slug[1]) }, headers: req.headers }, r);
  }
  if (p.startsWith('/api/')) { console.log('UNHANDLED', req.method, p); return json(res, { detail: 'harness: not stubbed' }, 404); }
  const file = path.join(process.cwd(), 'dist', p);
  if (p !== '/' && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(process.cwd(), 'dist/index.html')));
}).listen(PORT, '127.0.0.1', () => {
  fs.writeFileSync(process.env.PIDFILE || '/tmp/stor072/harness.pid', String(process.pid));
  console.log('harness on', PORT, 'pid', process.pid);
});
