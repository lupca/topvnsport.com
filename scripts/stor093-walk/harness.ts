// STOR-093 local harness, run from the repo root after npm run build: dist/ + /product/:slug through the real
// api/product handler, fixture PIM/WMS/OMS on /api/pmi, /api/wms, /api/oms. One promoted SKU (S101) and one
// non-promoted SKU (S104). Stop by the PID written to $PIDFILE or by port: ss -ltnp 'sport = :4393'.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import productHandler from '../../api/product';

const PORT = Number(process.env.PORT || 4393);

const ITEMS = [
  {
    id: 101,
    name: 'Vợt Yonex Astrox 99',
    slug: 'vot-yonex-astrox-99-vyax99-k7q2',
    description: 'Vợt tấn công chính hãng.',
    voma_category_id: 1,
    attribute_values: [
      { id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } },
    ],
    tier_variations: [{ tier_index: 1, name: 'Màu sắc', options: ['Đỏ'] }],
    variants: [
      {
        id: 1010,
        sku_code: 'S101',
        tier_1_option: 'Đỏ',
        tier_2_option: null,
        price: 2500000,
        original_price: 2500000,
        computed_price: 2000000,
        percentage_discount: 20,
        has_active_promotion: true,
        stock: 5,
      },
    ],
  },
  {
    id: 104,
    name: 'Giày Lining',
    description: 'Giày cầu lông êm chân.',
    voma_category_id: 2,
    attribute_values: [
      { id: 2, attribute_id: 10, value_string: 'Lining', attribute: { code: 'brand', name: 'Thương hiệu' } },
    ],
    tier_variations: [{ tier_index: 1, name: 'Size', options: ['42'] }],
    variants: [
      {
        id: 1040,
        sku_code: 'S104',
        tier_1_option: '42',
        tier_2_option: null,
        price: 1800000,
        stock: 5,
      },
    ],
  },
];

const CATS = [
  { id: 1, code: 'vot', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' },
  { id: 2, code: 'giay', name: 'Giày cầu lông', display_name: 'Giày cầu lông' },
];

const row = (sku_code: string, qty: number) => ({
  sku_code,
  qty_available: qty,
  qty_on_hand: qty,
  qty_reserved: 0,
  stock_status: qty > 0 ? 'in_stock' : 'out_of_stock',
  low_stock_threshold: 5,
  threshold_source: 'default',
});

const STOCK = {
  stock: { S101: 5, S104: 5 },
  items: [row('S101', 5), row('S104', 5)],
};

const PROVINCE_BODY = {
  level: 'province',
  parent_code: null,
  items: [
    { code: 'ADM1-01', name: 'Hà Nội', parent_code: null, level: 'province' },
    { code: 'ADM1-79', name: 'Thành phố Hồ Chí Minh', parent_code: null, level: 'province' },
  ],
};

const WARD_BODY = {
  level: 'ward',
  parent_code: 'ADM1-01',
  items: [
    { code: 'ADM1-01.W49886', name: 'Phường Ba Đình', parent_code: 'ADM1-01', level: 'ward' },
    { code: 'ADM1-01.W49887', name: 'Phường Hoàn Kiếm', parent_code: 'ADM1-01', level: 'ward' },
  ],
};

const QUOTE_200 = {
  currency: 'VND',
  options: [
    { delivery_option: 'STANDARD', available: true, shipping_fee: 30000, eta_days: 2, is_fallback: false, unavailable_reason: null },
    { delivery_option: 'EXPRESS', available: true, shipping_fee: 65000, eta_days: 1, is_fallback: false, unavailable_reason: null },
  ],
};

process.env.PMI_API_URL = `http://127.0.0.1:${PORT}/pim`;
process.env.WMS_API_URL = `http://127.0.0.1:${PORT}/api/wms`;
process.env.STOREFRONT_SELLER_ID = 'seller-harness';
process.env.CATALOG_GRANT_TOKENS = JSON.stringify({ 'seller-harness': 'fake-harness-token' });

const json = (res: http.ServerResponse, body: unknown, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  const api = p.match(/^\/(?:pim|api\/pmi)(\/.*)$/);
  if (api) {
    if (api[1] === '/public/voma-categories') return json(res, CATS);
    if (api[1] === '/public/products') return json(res, { items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
    const one = api[1].match(/^\/public\/products\/(\d+)$/);
    if (one) {
      const it = ITEMS.find((i) => String(i.id) === one[1]);
      return it ? json(res, it) : json(res, {}, 404);
    }
  }
  if (p.startsWith('/api/wms/public/stock')) return json(res, STOCK);
  if (p === '/api/oms/branches') return json(res, []);
  if (p === '/api/oms/admin-units') {
    return json(res, url.searchParams.get('level') === 'ward' ? WARD_BODY : PROVINCE_BODY);
  }
  if (p === '/api/oms/shipping-quote') return json(res, QUOTE_200);
  const slug = p.match(/^\/product\/([^/]+)$/);
  if (slug) {
    const r: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      status(c: number) { this.statusCode = c; return this; },
      setHeader(k: string, v: string) { this.headers[k] = v; },
      send(b: string) { res.writeHead(this.statusCode, this.headers); res.end(b); },
    };
    return productHandler({ method: req.method, query: { slug: decodeURIComponent(slug[1]) }, headers: req.headers }, r);
  }
  if (p.startsWith('/api/')) {
    console.log('UNHANDLED', req.method, p);
    return json(res, { detail: 'harness: not stubbed' }, 404);
  }
  const file = path.join(process.cwd(), 'dist', p);
  if (p !== '/' && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(path.join(process.cwd(), 'dist/index.html')));
}).listen(PORT, '127.0.0.1', () => {
  const pidFile = process.env.PIDFILE || '/tmp/stor093/harness.pid';
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(process.pid));
  console.log('harness on', PORT, 'pid', process.pid);
});
