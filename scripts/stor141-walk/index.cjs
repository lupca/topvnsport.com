// STOR-141 walk (r:75b60f55): vite dev server (PID ghi lại, tắt theo PID r:0b30a607), 390x844, /api/* stub qua page.route.
// A: /public/products 503 -> /product/590 hiện role=alert + Thử lại, không "Không tìm thấy trang"; Thử lại sau 200 -> hiện SP.
// B: /public/stock 503 -> /product/590 không "Hết hàng"; banner dòng tồn kho có Thử lại; bấm sau khi stock 200 -> dòng mất, không spinner.
// /product/590 khớp theo id số (findProductBySlug: product.id === '590'). Ảnh vào docs/stor141-shots/.
// Dùng: node scripts/stor141-walk   (PLAYWRIGHT=<đường dẫn playwright-core> tùy chọn)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core'));

const PORT = Number(process.env.PORT || 4441);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, '../../docs/stor141-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const CATS = [{ id: 1, code: 'CAT_VOT', name: 'Vợt cầu lông', display_name: 'Thể Thao > Vợt cầu lông' }];
const ITEM = {
  id: 590, name: 'Vợt Yonex 590', slug: 'vot-yonex-590', description: 'SP test.', voma_category_id: 1,
  media: [{ image_url: 'https://img.test/p.svg', is_cover: true, display_order: 1 }],
  attribute_values: [], tier_variations: [], variants: [{ id: 5900, product_id: 590, sku_code: 'SKU-590', price: 1500000 }],
};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#9cf"/></svg>';

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};

const waitPort = async () => {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
};

// fail = { products, stock }: true -> 503. Đổi được giữa chừng (mô phỏng backend hồi phục).
async function open(browser, fail) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fails++; console.log('FAIL PAGEERROR', e.message); });
  const hits = { products: 0, stock: 0, categories: 0 };
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.host === 'img.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
    if (u.host !== `127.0.0.1:${PORT}`) return route.abort();
    if (u.pathname.endsWith('/public/stock')) { hits.stock++; return fail.stock ? json({ detail: 'down' }, 503) : json({ stock: { 'SKU-590': 0 }, items: [] }); }
    if (u.pathname.endsWith('/public/voma-categories')) { hits.categories++; return json(CATS); }
    if (u.pathname.endsWith('/public/products')) {
      hits.products++;
      return fail.products ? json({ detail: 'down' }, 503) : json({ items: [ITEM], total: 1, page: 1, limit: 100, pages: 1 });
    }
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"walk: not stubbed"}' });
    return route.continue();
  });
  await page.goto(BASE + '/product/590', { waitUntil: 'domcontentloaded' });
  await page.locator('#api-loading-state').waitFor({ state: 'detached', timeout: 30000 });
  return { page, ctx, hits };
}

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  const browser = await chromium.launch();
  try {
    await waitPort();

    // A: sản phẩm 503
    const fa = { products: true, stock: false };
    const a = await open(browser, fa);
    const alert = a.page.locator('main [role=alert]');
    await alert.waitFor();
    check('A products 503: không Không tìm thấy trang', await a.page.getByText('Không tìm thấy trang').count(), 0);
    check('A products 503: alert có nút Thử lại', await alert.getByRole('button', { name: 'Thử lại' }).count(), 1);
    await a.page.screenshot({ path: path.join(SHOTS, 'A1-products-503.png'), fullPage: true });
    fa.products = false;
    await alert.getByRole('button', { name: 'Thử lại' }).click();
    await a.page.getByRole('heading', { name: 'Vợt Yonex 590' }).first().waitFor({ timeout: 30000 });
    check('A Thử lại sau 200: trang SP hiện', await a.page.getByRole('heading', { name: 'Vợt Yonex 590' }).count() > 0, true);
    await a.page.screenshot({ path: path.join(SHOTS, 'A2-products-retry-200.png'), fullPage: true });
    await a.ctx.close();

    // B: tồn 503
    const fb = { products: false, stock: true };
    const b = await open(browser, fb);
    await b.page.getByRole('heading', { name: 'Vợt Yonex 590' }).first().waitFor();
    const line = b.page.locator('#load-error-banner p', { hasText: 'Không tải được tồn kho.' });
    check('B stock 503: không Hết hàng', await b.page.getByText('Hết hàng', { exact: false }).count(), 0);
    check('B stock 503: không Còn hàng', await b.page.getByText('Còn hàng', { exact: false }).count(), 0);
    check('B stock 503: dòng tồn kho hiện', await line.count(), 1);
    check('B stock 503: dòng tồn kho có Thử lại', await line.getByRole('button', { name: 'Thử lại' }).count(), 1);
    await b.page.screenshot({ path: path.join(SHOTS, 'B1-stock-503.png'), fullPage: true });
    const before = { ...b.hits };
    fb.stock = false;
    let spinner = false;
    const watch = b.page.locator('#api-loading-state').waitFor({ timeout: 4000 }).then(() => { spinner = true; }, () => {});
    await line.getByRole('button', { name: 'Thử lại' }).click();
    await line.waitFor({ state: 'detached', timeout: 30000 });
    await watch;
    check('B Thử lại sau 200: dòng tồn kho mất', await line.count(), 0);
    check('B Thử lại: không spinner toàn trang', spinner, false);
    check('B Thử lại: chỉ thêm GET stock (products/categories +0)', [b.hits.products - before.products, b.hits.categories - before.categories, b.hits.stock - before.stock], [0, 0, 1]);
    check('B tồn 0 thật sau 200: Hết hàng hiện', await b.page.getByText('Hết hàng').count() > 0, true);
    await b.page.screenshot({ path: path.join(SHOTS, 'B2-stock-retry-200.png'), fullPage: true });
    await b.ctx.close();
  } finally {
    await browser.close();
    process.kill(server.pid, 'SIGTERM'); // chỉ PID đã ghi (r:0b30a607)
    console.log('killed pid', server.pid);
  }
  console.log(fails ? `FAILED ${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
