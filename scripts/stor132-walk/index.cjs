// STOR-132 walk: vite dev server (PID recorded, killed by PID); every GET /api/** is forwarded READ-ONLY to
// https://www.topvnsport.com/api (non-GET aborted). If prod has no category whose products are all out of
// stock, the walk zeroes the WMS stock of the SKUs of the smallest category IN THE BROWSER ONLY (prod untouched).
// At 390x844 and 1440x900 it asserts: that category has a chip with its full count, a tile, (1440) a Header nav
// link, and clicking the chip lists its products with 'Hết hàng'.
// Usage: node scripts/stor132-walk   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const PORT = Number(process.env.PORT || 4432);
const BASE = `http://127.0.0.1:${PORT}`;
const PROD = 'https://www.topvnsport.com';
const SHOTS = process.env.SHOTS || '/tmp/stor132/shots';
fs.mkdirSync(SHOTS, { recursive: true });

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};
const getJson = async (p) => (await fetch(`${PROD}${p}`)).json();

(async () => {
  const items = [];
  for (let page = 1; ; page++) {
    const r = await getJson(`/api/pmi/public/products?page=${page}&limit=100`);
    items.push(...r.items);
    if (items.length >= r.total || !r.items.length) break;
  }
  const stockRaw = await getJson('/api/wms/public/stock');
  const qty = {};
  if (stockRaw.stock) Object.assign(qty, stockRaw.stock);
  else for (const it of stockRaw.items || []) qty[it.sku_code] = Number(it.qty_available ?? it.qty_on_hand ?? 0);
  const byCat = {};
  for (const p of items) {
    const c = (byCat[p.voma_category_id] ||= { n: 0, inStock: 0, skus: [] });
    const skus = (p.variants || []).map((v) => v.sku_code).filter(Boolean);
    c.n++; c.skus.push(...skus);
    if (skus.some((s) => (qty[s] || 0) > 0)) c.inStock++;
  }
  console.log('per voma_category_id {products, inStock}:', JSON.stringify(Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, [v.n, v.inStock]]))));
  let target = Object.entries(byCat).find(([, v]) => v.inStock === 0);
  const natural = Boolean(target);
  if (!target) target = Object.entries(byCat).sort((a, b) => a[1].n - b[1].n)[0];
  const [catId, cat] = target;
  const zeroSkus = new Set(natural ? [] : cat.skus);
  console.log(natural ? `natural all-out-of-stock category id ${catId}` : `no natural one; zeroing stock in browser for category id ${catId} (${cat.n} products)`);

  const list = await getJson('/api/pmi/public/voma-categories');
  const meta = list.find((c) => String(c.id) === String(catId));
  if (!meta) throw new Error(`category ${catId} not in voma-categories`);
  console.log('target category', meta.code, meta.display_name);

  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
    browser = await chromium.launch();
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => { fails++; console.log('PAGEERROR', e.message); });
      await page.route('**/api/**', async (route) => {
        const req = route.request();
        if (req.method() !== 'GET') return route.abort(); // prod is read-only
        const u = new URL(req.url());
        const res = await route.fetch({ url: `${PROD}${u.pathname}${u.search}`, headers: {} });
        if (!zeroSkus.size || !u.pathname.startsWith('/api/wms/public/stock')) return route.fulfill({ response: res });
        const body = await res.json();
        if (body.stock) for (const s of Object.keys(body.stock)) if (zeroSkus.has(s)) body.stock[s] = 0;
        for (const it of body.items || []) if (zeroSkus.has(it.sku_code)) { it.qty_available = 0; it.qty_on_hand = 0; }
        return route.fulfill({ response: res, json: body });
      });
      await page.goto(`${BASE}/`);
      await page.getByTestId('cate-select-bar').waitFor({ timeout: 30000 });
      const pill = page.getByTestId(`cate-pill-${meta.code}`);
      check(`${w}px chip for ${meta.code} visible`, await pill.isVisible(), true);
      check(`${w}px chip count = all its products`, (await pill.textContent()).endsWith(`(${cat.n})`), true);
      const tile = page.getByTestId(`cat-tile-${meta.code}`);
      check(`${w}px tile for ${meta.code}`, await tile.count(), 1);
      if (w >= 1024) {
        const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
        check(`${w}px header nav link`, await nav.locator(`a[href="/catalog?category=${meta.code}"]`).count(), 1);
      }
      await page.screenshot({ path: `${SHOTS}/${w}-1-home.png` });
      await tile.scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${SHOTS}/${w}-2-tile.png` });
      await pill.scrollIntoViewIfNeeded();
      await pill.click();
      const grid = page.getByTestId('featured-grid');
      await page.waitForTimeout(800);
      const cards = await grid.locator('[id^="product-card-"]').count();
      const badges = await grid.getByText('Hết hàng', { exact: true }).count();
      check(`${w}px shelf cards = min(8, n)`, cards, Math.min(8, cat.n));
      check(`${w}px every card says Hết hàng`, badges, cards);
      await grid.locator('[id^="product-card-"]').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/${w}-3-shelf.png` });
      await page.close();
    }
  } catch (e) {
    fails++;
    console.log('ERROR', e.message);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // recorded PID only (r:0b30a607)
    console.log(fails ? `FAILED ${fails}` : 'ALL PASS', '| shots in', SHOTS);
    process.exitCode = fails ? 1 : 0;
  }
})();
