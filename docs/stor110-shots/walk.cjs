// STOR-110 walk (r:75b60f55): vite dev (PID ghi lại, tắt theo PID, r:0b30a607), /api/* trả fixture PMI/WMS.
// 14 SP: 9 còn hàng đang KM (% 5..45), 1 KM nhưng hết hàng, 4 còn hàng không KM.
// Ở 1440 và 390: cuộn header hub -> hero -> kệ nổi bật -> khối KM, kiểm thứ tự DOM, số thẻ = 9, nhãn "Giảm đến 45%",
// thứ tự thẻ giảm % nhiều nhất trước, mỗi thẻ có giá bán/giá gạch/-N%. Ảnh + walk.json vào docs/stor110-shots/.
// Dùng: node docs/stor110-shots/walk.cjs   (PLAYWRIGHT=<đường dẫn playwright-core> tùy chọn)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core'));

const PORT = Number(process.env.PORT || 4410);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = __dirname;
const CATS = [{ id: 1, code: 'CAT_VOT', name: 'Vợt cầu lông', display_name: 'Thể Thao > Vợt cầu lông' }];
const PCTS = [10, 45, 5, 30, 20, 15, 25, 35, 40]; // còn hàng đang KM, thứ tự API cố ý không sắp
const spec = [
  ...PCTS.map((pct) => ({ pct, qty: 5 })),
  { pct: 50, qty: 0 }, // KM nhưng hết hàng -> không vào khối
  ...[0, 0, 0, 0].map((pct) => ({ pct, qty: 5 })),
];
const HUES = [200, 20, 140, 330, 60, 260];
const ITEMS = spec.map(({ pct }, i) => {
  const id = 110000 + i; const price = 2000000 + i * 100000;
  const promo = pct > 0 ? { has_active_promotion: true, original_price: price, computed_price: Math.round(price * (100 - pct) / 100), percentage_discount: pct } : {};
  return {
    id, name: `Vợt mẫu ${i + 1}${pct ? ` KM ${pct}` : ''}`, slug: `vot-mau-${i + 1}`, description: 'SP test.', voma_category_id: 1,
    media: [{ image_url: `https://img.test/p${i}.svg?h=${HUES[i % 6]}`, is_cover: true, display_order: 1 }],
    attribute_values: [{ id, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } }],
    tier_variations: [], variants: [{ id: id * 10, product_id: id, sku_code: `SKU-${id}`, price, ...promo }],
  };
});
const STOCK = { stock: Object.fromEntries(ITEMS.map((p, i) => [p.variants[0].sku_code, spec[i].qty])), items: [] };
const EXPECT_COUNT = PCTS.length;
const EXPECT_ORDER = [...PCTS].sort((a, b) => b - a);
const svg = (h) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${h},60%,70%)"/></svg>`;

let fails = 0; const report = {};
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
  return got;
};
const waitPort = async () => {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
};

async function viewport(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fails++; console.log('FAIL PAGEERROR', e.message); });
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.host === 'img.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(u.searchParams.get('h') || 200) });
    if (u.host !== `127.0.0.1:${PORT}`) return route.abort();
    if (u.pathname.endsWith('/public/stock')) return json(STOCK);
    if (u.pathname.endsWith('/public/voma-categories')) return json(CATS);
    if (u.pathname.endsWith('/public/products')) return json({ items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"walk: not stubbed"}' });
    return route.continue();
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  console.log(`--- ${w}px`);
  const r = (report[w] = {});
  // Đi theo thứ tự người dùng cuộn: header hub -> hero -> kệ nổi bật -> khối KM.
  for (const id of ['badminton-hub-header', 'badminton-center-slider', 'instock-shelf', 'sale-section']) {
    const el = page.getByTestId(id);
    await el.waitFor();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    r[`top_${id}`] = await el.evaluate((n) => Math.round(n.getBoundingClientRect().top + scrollY));
  }
  r.domOrder = check(`${w}: thứ tự DOM hub < hero < kệ < KM`, await page.evaluate(() => {
    const ids = ['badminton-hub-header', 'badminton-center-slider', 'instock-shelf', 'sale-section'];
    const els = ids.map((i) => document.querySelector(`[data-testid="${i}"]`));
    return els.every((e, k) => k === 0 || (els[k - 1].compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) > 0);
  }), true);
  const sale = page.getByTestId('sale-section');
  r.heading = check(`${w}: tiêu đề`, (await sale.locator('h2').textContent()).trim().toLowerCase(), 'đang khuyến mãi');
  r.badge = check(`${w}: nhãn Giảm đến (max từ dữ liệu)`, (await page.getByTestId('sale-max-badge').textContent()).trim(), `Giảm đến ${EXPECT_ORDER[0]}%`);
  const cards = sale.locator('[id^="product-card-"]');
  r.cardCount = check(`${w}: số thẻ = SP còn hàng đang KM`, await cards.count(), EXPECT_COUNT);
  const pcts = await sale.getByTestId('discount-badge').allTextContents();
  r.discounts = check(`${w}: -N% theo thứ tự giảm dần`, pcts.map((t) => Number(t.replace(/\D/g, ''))), EXPECT_ORDER);
  r.salePrices = check(`${w}: mỗi thẻ có giá bán`, await sale.getByTestId('sale-price').count(), EXPECT_COUNT);
  const struck = await sale.getByTestId('original-price').evaluateAll((els) => els.map((e) => getComputedStyle(e).textDecorationLine));
  r.struck = check(`${w}: mỗi thẻ có giá niêm yết gạch ngang`, struck.filter((s) => s.includes('line-through')).length, EXPECT_COUNT);
  r.outOfStockAbsent = check(`${w}: SP KM hết hàng không có trong khối`, await sale.getByText('KM 50').count(), 0);
  r.overflowX = check(`${w}: không tràn ngang`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // Đỉnh khối KM ngay dưới header sticky để thấy tiêu đề + nhãn + hàng thẻ đầu.
  await page.evaluate(() => {
    const hb = document.getElementById('topvnsport-header').getBoundingClientRect().bottom;
    const t = document.querySelector('[data-testid="sale-section"]').getBoundingClientRect().top + scrollY;
    window.scrollTo(0, t - hb - 8);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/sale-${w}.png` });
  await ctx.close();
}

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    await viewport(browser, 1440, 900);
    await viewport(browser, 390, 844);
  } catch (e) {
    fails++;
    console.log('ERROR', e.stack || e.message);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // chỉ PID đã ghi (r:0b30a607)
    fs.writeFileSync(`${SHOTS}/walk.json`, JSON.stringify({ fails, expected: { count: EXPECT_COUNT, order: EXPECT_ORDER }, report }, null, 2) + '\n');
    console.log(fails ? `FAILED ${fails}` : 'ALL PASS', '| shots in', SHOTS);
    process.exitCode = fails ? 1 : 0;
  }
})();
