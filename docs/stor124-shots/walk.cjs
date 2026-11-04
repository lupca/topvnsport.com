// STOR-124 footer walk (r:75b60f55): vite dev server (PID recorded, killed by PID, r:0b30a607), /api/* routed to fixtures.
// At 1440x900 opens '/', clicks the footer link 'Cửa hàng trải nghiệm', checks path /stores and the h1.
// Usage: TMPDIR=/tmp node docs/stor124-shots/walk.cjs   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core'));

const PORT = Number(process.env.PORT || 4424);
const BASE = `http://127.0.0.1:${PORT}`;
const ITEM = {
  id: 1, name: 'Vợt walk', slug: 'vot-walk', description: 'Vợt test.', voma_category_id: 1, image: '',
  attribute_values: [{ id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } }],
  tier_variations: [], variants: [{ id: 1, product_id: 1, tier_1_option: null, sku_code: 'WALK-1', price: 2000000 }],
};
const CATS = [{ id: 1491, code: 'VC001491', name: 'Vợt Cầu Lông', display_name: 'Thể Thao > Cầu Lông > Vợt Cầu Lông' }];

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid, 'port', PORT);
  let browser;
  try {
    for (let i = 0; ; i++) {
      try { if ((await fetch(BASE)).ok) break; } catch {}
      if (i > 120) throw new Error('dev server did not start');
      await new Promise((r) => setTimeout(r, 500));
    }
    browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (p.endsWith('/public/stock')) return json({ stock: { 'WALK-1': 5 }, items: [{ sku_code: 'WALK-1', qty_available: 5, qty_on_hand: 5, qty_reserved: 0, stock_code: 'WALK-1' }] });
      if (p.endsWith('/public/voma-categories')) return json(CATS);
      if (p.endsWith('/public/products')) return json({ items: [ITEM], total: 1, page: 1, limit: 100, pages: 1 });
      if (p.endsWith('/branches')) return json([]);
      return json({ detail: 'walk: not stubbed' }, 404);
    });
    await page.goto(`${BASE}/`);
    const link = page.locator('footer').getByRole('link', { name: 'Cửa hàng trải nghiệm', exact: true });
    await link.scrollIntoViewIfNeeded();
    check('1440: footer link href', await link.getAttribute('href'), '/stores');
    check('1440: link sits in footer column 1 (brand column)', await link.evaluate((a) => a.closest('div').querySelector('h5').textContent), 'TOPVNSPORT — BADMINTON SPECIALTY STORE');
    await link.click();
    await page.waitForURL('**/stores');
    check('after click: location.pathname', await page.evaluate(() => location.pathname), '/stores');
    const h1 = (await page.locator('h1').first().textContent()).replace(/\s+/g, ' ').trim();
    check('after click: h1 contains CỬA HÀNG TRẢI NGHIỆM', h1.includes('CỬA HÀNG TRẢI NGHIỆM'), true);
    console.log('    h1:', h1);
    check('no page errors', errors, []);
  } catch (e) {
    fails++;
    console.log('ERROR', e.message);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // recorded PID only (r:0b30a607)
    console.log('killed pid', server.pid);
    console.log(fails ? `FAILED ${fails}` : 'ALL PASS');
    process.exitCode = fails ? 1 : 0;
  }
})();
