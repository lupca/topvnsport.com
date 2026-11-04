// STOR-131 catalog walk: vite dev server (PID recorded, killed by PID); every GET /api/** is forwarded
// READ-ONLY to https://www.topvnsport.com/api (non-GET aborted). Asserts default /catalog shows as many
// cards as PIM total, cards 544/545/623/633 exist, header search 'Astrox 99 Pro' finds 544 labelled
// 'Hết hàng', and 633 is labelled with a disabled cart button.
// Usage: node scripts/stor131-walk   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const PORT = Number(process.env.PORT || 4431);
const BASE = `http://127.0.0.1:${PORT}`;
const PROD = 'https://www.topvnsport.com';
const SHOTS = process.env.SHOTS || '/tmp/stor131/shots';
fs.mkdirSync(SHOTS, { recursive: true });

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
  const { total, items } = await (await fetch(`${PROD}/api/pmi/public/products?page=1&limit=100`)).json();
  const astroxIds = items.filter((p) => p.name.toLowerCase().includes('astrox 99 pro')).map((p) => String(p.id)).sort();
  console.log('PIM total (prod GET)', total, '| names containing "astrox 99 pro":', astroxIds);
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.route('**/api/**', async (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.abort(); // prod is read-only
      const u = new URL(req.url());
      const res = await route.fetch({ url: `${PROD}${u.pathname}${u.search}`, headers: {} });
      return route.fulfill({ response: res });
    });

    await page.goto(`${BASE}/catalog`);
    const cards = page.locator('[id^="product-card-"]');
    await page.getByText(`${total} sản phẩm`).first().waitFor({ timeout: 30000 });
    check('default card count = PIM total', await cards.count(), total);
    check('price label untouched', await page.getByText('Tất cả mức giá').first().isVisible(), true);
    for (const id of [544, 545, 623, 633]) check(`card ${id} present`, await page.locator(`#product-card-${id}`).count(), 1);
    await page.screenshot({ path: `${SHOTS}/1-catalog-default.png`, fullPage: false });

    const c633 = page.locator('#product-card-633');
    // Header dính che đầu thẻ: cuộn để thẻ nằm dưới header rồi mới chụp/kiểm tra hiển thị.
    await c633.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 320));
    check('633 Hết hàng visible', await c633.getByText('Hết hàng').isVisible(), true);
    const b633 = c633.locator('button[title="Sản phẩm hết hàng"]');
    check('633 cart button disabled', (await b633.count()) > 0 && (await b633.evaluateAll((bs) => bs.every((b) => b.disabled))), true);
    await page.screenshot({ path: `${SHOTS}/2-card-633.png` });
    const order = await cards.evaluateAll((els) => els.map((e) => e.id.replace('product-card-', '')));
    check('out-of-stock 544/633 after in-stock 545/623', Math.min(order.indexOf('544'), order.indexOf('633')) > Math.max(order.indexOf('545'), order.indexOf('623')), true);

    const search = page.getByPlaceholder('Tìm vợt Yonex, Lining, cước đan, giày cầu lông...').first();
    await search.fill('Astrox 99 Pro');
    await search.press('Enter');
    await page.waitForURL(/\/catalog\?search=/);
    await page.getByText('Đang tìm kết quả lọc theo từ khóa').waitFor({ timeout: 15000 });
    await page.getByText(`${astroxIds.length} sản phẩm`).first().waitFor({ timeout: 15000 });
    check('search result cards = PIM names matching', (await cards.evaluateAll((els) => els.map((e) => e.id.replace('product-card-', '')))).sort(), astroxIds);
    check('search finds 544', await page.locator('#product-card-544').count(), 1);
    const c544 = page.locator('#product-card-544');
    await c544.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 320));
    check('544 Hết hàng visible', await c544.getByText('Hết hàng').isVisible(), true);
    await page.screenshot({ path: `${SHOTS}/3-search-astrox-99-pro.png` });
    fs.writeFileSync(`${SHOTS}/3-search.aria.txt`, await page.locator('main, body').first().ariaSnapshot());
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
