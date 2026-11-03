// STOR-096 local harness: dist/ + /product/:slug through real api/product handler,
// fixture PIM/WMS/OMS on /api/pmi, /api/wms, /api/oms.
// Promoted product: Yonex Astrox 88D Tour 2024 (id: 590) with original 3.538.800đ / computed 3.009.000đ.
// Stop by the PID written to $PIDFILE or by port: ss -ltnp 'sport = :4396'.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import productHandler from '../../api/product';

const PORT = Number(process.env.PORT || 4396);

const ITEMS = [
  {
    id: 590,
    name: '[Hỏa Tốc] Vợt cầu lông Yonex Astrox 88D Tour 2024 (Đế nhôm) Chính Hãng, Tặng túi+ Quấn Cán+ Đan cước',
    slug: 'hoa-toc-vot-cau-long-yonex-astrox-88d-tour-2024-de-nhom-chinh-hang-tang-tui-quan-can-dan-cuoc-vclya88dt2024chttqcd-esst',
    description: 'Vợt Yonex Astrox 88D Tour 2024 chính hãng, tặng túi, quấn cán, đan cước.',
    voma_category_id: 1,
    image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=60',
    attribute_values: [
      { id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } },
    ],
    tier_variations: [
      {
        id: 1101,
        product_id: 590,
        tier_index: 1,
        name: 'Loại cước',
        options: [
          'Lining No1',
          'BG 66U',
          'Khung không dây'
        ]
      }
    ],
    variants: [
      {
        id: 6442,
        product_id: 590,
        tier_1_option: 'Lining No1',
        tier_2_option: null,
        sku_code: 'VCLYA88STCHTTQCDC-DYHH-KIZUNA-Z61',
        price: 3538800.0,
        computed_price: 3009000.0,
        has_active_promotion: true,
        original_price: 3538800.0,
        percentage_discount: 14.97,
        stock: 10,
      },
      {
        id: 6443,
        product_id: 590,
        tier_1_option: 'BG 66U',
        tier_2_option: null,
        sku_code: 'VCLYA88STCHTTQCDC-DYHH-CUOC-KHAC-IB-SHOP',
        price: 3538800.0,
        computed_price: 3039000.0,
        has_active_promotion: true,
        original_price: 3538800.0,
        percentage_discount: 14.12,
        stock: 10,
      },
      {
        id: 6444,
        product_id: 590,
        tier_1_option: 'Khung không dây',
        tier_2_option: null,
        sku_code: 'VCLYA88STCHTTQCDC-DYHH-KHUNG-KHONG-DAY',
        price: 3538800.0,
        computed_price: 2849000.0,
        has_active_promotion: true,
        original_price: 3538800.0,
        percentage_discount: 19.49,
        stock: 10,
      },
    ],
  },
];

const CATS = [
  { id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' },
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
  stock: {
    'VCLYA88STCHTTQCDC-DYHH-KIZUNA-Z61': 10,
    'VCLYA88STCHTTQCDC-DYHH-CUOC-KHAC-IB-SHOP': 10,
    'VCLYA88STCHTTQCDC-DYHH-KHUNG-KHONG-DAY': 10,
  },
  items: [
    row('VCLYA88STCHTTQCDC-DYHH-KIZUNA-Z61', 10),
    row('VCLYA88STCHTTQCDC-DYHH-CUOC-KHAC-IB-SHOP', 10),
    row('VCLYA88STCHTTQCDC-DYHH-KHUNG-KHONG-DAY', 10),
  ],
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
  const pidFile = process.env.PIDFILE || '/tmp/stor096/harness.pid';
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(process.pid));
  console.log('harness on', PORT, 'pid', process.pid);
});
