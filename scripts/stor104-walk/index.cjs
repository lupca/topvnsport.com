// STOR-104 PDP walk: vite dev server (PID recorded, killed by PID), every /api/* routed with
// fixtures; /public/stock answers the pinned WMS body (VOMA-399 shape) where 3 string options of
// ONE frame share stock_code FRAME-DEN qty 31. Asserts each string option shows 31 (not 93).
// Usage: node scripts/stor104-walk   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const PORT = Number(process.env.PORT || 4404);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS || '/tmp/stor104/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const STRINGS = ['Khung không dây', 'BG65', 'BG80'];
const sku = (s) => `VOT104-DEN-${s.replace(/\s+/g, '-')}`;
const ITEM = {
  id: 104, name: 'Vợt test STOR-104', slug: 'vot-test-stor-104', description: 'Vợt test.', voma_category_id: 1,
  image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
  attribute_values: [{ id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } }],
  tier_variations: [
    { id: 1, product_id: 104, tier_index: 1, name: 'Màu sắc', options: ['Đen'] },
    { id: 2, product_id: 104, tier_index: 2, name: 'Loại cước', options: STRINGS },
  ],
  variants: STRINGS.map((s, i) => ({
    id: 10400 + i, product_id: 104, tier_1_option: 'Đen', tier_2_option: s, sku_code: sku(s), price: 2000000 + i * 60000,
  })),
};
// Pinned wire body: {stock:{sku:qty}, items:[{sku_code, qty_available, qty_on_hand, qty_reserved, stock_code}]}
const ITEMS = STRINGS.map((s) => ({ sku_code: sku(s), qty_available: 31, qty_on_hand: 31, qty_reserved: 0, stock_code: 'FRAME-DEN' }));
const STOCK = { stock: Object.fromEntries(ITEMS.map((i) => [i.sku_code, 31])), items: ITEMS };
const CATS = [{ id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' }];

const waitPort = async () => {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
};

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    let stockCalls = 0;
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (p.endsWith('/public/stock')) { stockCalls++; return json(STOCK); }
      if (p.endsWith('/public/voma-categories')) return json(CATS);
      if (p.endsWith('/public/products')) return json({ items: [ITEM], total: 1, page: 1, limit: 100, pages: 1 });
      if (/\/public\/products\/\d+$/.test(p)) return json(ITEM);
      if (p.endsWith('/branches')) return json([]);
      return json({ detail: 'walk: not stubbed' }, 404);
    });

    await page.goto(`${BASE}/product/${ITEM.slug}`);
    await page.getByText('Vợt test STOR-104').first().waitFor();
    await page.screenshot({ path: `${SHOTS}/1-pdp.png` });
    check('/public/stock routed', stockCalls > 0, true);
    check('colour Đen (frame) qty', await page.locator('button[data-stock]', { hasText: 'Đen' }).getAttribute('data-stock'), '31');

    await page.locator('input[type="checkbox"]').first().check({ force: true }); // bật đan cước
    await page.screenshot({ path: `${SHOTS}/2-stringing-on.png` });
    const opts = await page.locator('[data-stock]').evaluateAll((els) => els.map((e) => [e.textContent.trim().slice(0, 12), e.dataset.stock]));
    console.log('  options', JSON.stringify(opts));
    for (const s of ['BG65', 'BG80']) {
      check(`string ${s} shared qty`, await page.locator('[data-stock]', { hasText: s }).first().getAttribute('data-stock'), '31');
    }
    check('no Hết on page', (await page.locator('body').innerText()).includes('Hết'), false);
    fs.writeFileSync(`${SHOTS}/2-stringing-on.aria.txt`, await page.locator('body').ariaSnapshot());
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
