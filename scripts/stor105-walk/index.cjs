// STOR-105 cart walk: vite dev server (PID recorded, killed by PID), every /api/* routed with
// fixtures; /public/stock answers the pinned WMS body (VOMA-399) where BG65 and BG80 of ONE frame
// share stock_code FRAME-DEN qty 2. PDP: add BG65, add BG80, add BG80 again -> Vietnamese stockNotice
// (per-line it would pass: BG80 1+1 <= 2). Cart: + on one line -> over_stock warning on both lines.
// Usage: node scripts/stor105-walk   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const PORT = Number(process.env.PORT || 4405);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS || '/tmp/stor105/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const STRINGS = ['Khung không dây', 'BG65', 'BG80'];
const sku = (s) => `VOT105-DEN-${s.replace(/\s+/g, '-')}`;
const ITEM = {
  id: 105, name: 'Vợt test STOR-105', slug: 'vot-test-stor-105', description: 'Vợt test.', voma_category_id: 1,
  image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
  attribute_values: [{ id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } }],
  tier_variations: [
    { id: 1, product_id: 105, tier_index: 1, name: 'Màu sắc', options: ['Đen'] },
    { id: 2, product_id: 105, tier_index: 2, name: 'Loại cước', options: STRINGS },
  ],
  variants: STRINGS.map((s, i) => ({
    id: 10500 + i, product_id: 105, tier_1_option: 'Đen', tier_2_option: s, sku_code: sku(s), price: 2000000 + i * 60000,
  })),
};
// Pinned wire body: {stock:{sku:qty}, items:[{sku_code, qty_available, qty_on_hand, qty_reserved, stock_code}]}
const ITEMS = STRINGS.map((s) => ({ sku_code: sku(s), qty_available: 2, qty_on_hand: 2, qty_reserved: 0, stock_code: 'FRAME-DEN' }));
const STOCK = { stock: Object.fromEntries(ITEMS.map((i) => [i.sku_code, 2])), items: ITEMS };
const CATS = [{ id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' }];
const NOTICE = 'Chỉ còn 2 sản phẩm. Trong giỏ của bạn đã có 2.';
const OVER = 'Chỉ còn 2 sản phẩm. Vui lòng giảm số lượng.';

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
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (p.endsWith('/public/stock')) return json(STOCK);
      if (p.endsWith('/public/voma-categories')) return json(CATS);
      if (p.endsWith('/public/products')) return json({ items: [ITEM], total: 1, page: 1, limit: 100, pages: 1 });
      if (/\/public\/products\/\d+$/.test(p)) return json(ITEM);
      if (p.endsWith('/branches')) return json([]);
      return json({ detail: 'walk: not stubbed' }, 404);
    });
    const cartLines = page.locator('[data-testid="cart-line"]');
    const closeCart = async () => { await page.locator('#cart-drawer-modal button:has(svg)').first().click(); await cartLines.first().waitFor({ state: 'hidden' }).catch(() => {}); };
    const add = async (s) => {
      await page.locator('[data-stock]', { hasText: s }).first().click();
      await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).first().click();
    };

    await page.goto(`${BASE}/product/${ITEM.slug}`);
    await page.getByText('Vợt test STOR-105').first().waitFor();
    await page.locator('input[type="checkbox"]').first().check({ force: true }); // bật đan cước
    await page.screenshot({ path: `${SHOTS}/1-pdp.png` });

    await add('BG65');
    await cartLines.first().waitFor();
    check('add BG65 opens cart, 1 line', await cartLines.count(), 1);
    await page.screenshot({ path: `${SHOTS}/2-cart-bg65.png` });
    await closeCart();

    await add('BG80');
    await cartLines.nth(1).waitFor();
    check('add BG80 opens cart, 2 lines', await cartLines.count(), 2);
    await page.screenshot({ path: `${SHOTS}/3-cart-bg65-bg80.png` });
    await closeCart();

    await add('BG80');
    const notice = page.getByText(NOTICE);
    await notice.first().waitFor({ timeout: 5000 }).catch(() => {});
    check('second BG80 add shows stockNotice', await notice.count() > 0, true);
    await page.screenshot({ path: `${SHOTS}/4-stock-notice.png` });
    fs.writeFileSync(`${SHOTS}/4-stock-notice.aria.txt`, await page.locator('body').ariaSnapshot());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cart_items') || '[]'));
    check('refused add leaves cart quantities', saved.map((i) => [i.skuCode, i.quantity]), [[sku('BG65'), 1], [sku('BG80'), 1]]);
    check('no stockGroupSkus persisted', saved.some((i) => 'stockGroupSkus' in i), false);
    check('cart stays closed after refusal', await cartLines.count(), 0);
    await page.getByRole('button').filter({ hasText: /^(OK|Đóng|Đồng ý|Xác nhận)$/ }).first().click({ timeout: 3000 }).catch(() => page.keyboard.press('Escape'));

    await page.getByRole('button', { name: 'Giỏ hàng' }).first().click();
    await cartLines.nth(1).waitFor();
    const plus = page.getByLabel('Tăng số lượng');
    check('+ enabled per line (stepper per-line)', await plus.evaluateAll((b) => b.map((x) => x.disabled)), [false, false]);
    await plus.first().click();
    await page.getByText(OVER).first().waitFor({ timeout: 5000 }).catch(() => {});
    check('over_stock warning on both group lines', await page.getByText(OVER).count(), 2);
    check('checkout button disabled', await page.getByRole('button', { name: /Tiến hành thanh toán/ }).isDisabled(), true);
    await page.screenshot({ path: `${SHOTS}/5-cart-over-stock.png` });
    fs.writeFileSync(`${SHOTS}/5-cart-over-stock.aria.txt`, await page.locator('body').ariaSnapshot());
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
