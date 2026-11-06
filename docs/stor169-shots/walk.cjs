// STOR-169 walk: real checkout at 390x844 on the vite dev server with VITE_GA4_ID and VITE_META_PIXEL_ID set.
// /api/oms/shipping-quote answers QUOTE_V_Q1 (spec c55789ce), /api/oms/checkout/orders answers ORDER_201_O1 (spec a4918ed8 O1).
// Bodies are read from src/__tests__/fixtures/shippingQuote.ts (no second copy); other /api stubs come from e2e/mobile-audit/audit.cjs.
// audit.cjs stub() drops every external script, gtag.js and fbevents.js included, so window.dataLayer and window.fbq.queue
// stay readable. Vite is started --strictPort and killed by its recorded PID (r:0b30a607).
//   PORT=4469 node docs/stor169-shots/walk.cjs   -> docs/stor169-shots/*.png + walk.log
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
process.env.PORT ||= '4469';
process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
const { stub, waitPort, BASE } = require('../../e2e/mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const fixtures = fs.readFileSync(path.join(ROOT, 'src/__tests__/fixtures/shippingQuote.ts'), 'utf8');
const body = (name) => JSON.parse(fixtures.match(new RegExp(`export const ${name} = JSON\\.parse\\('(.*)'\\);`))[1]);
const QUOTE_V_Q1 = body('QUOTE_V_Q1');
const ORDER_201_O1 = body('ORDER_201_O1');

const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
const jsClick = (loc) => loc.evaluate((el) => el.click());

(async () => {
  const env = { ...process.env, VITE_GA4_ID: 'G-STOR169', VITE_META_PIXEL_ID: '169169' };
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', env });
  log(`dev server pid ${server.pid} port ${process.env.PORT}`);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await stub(page);
    const fulfill = (route, status, b) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    await page.route('**/api/oms/shipping-quote', (route) => { log('POST /api/oms/shipping-quote -> 200 QUOTE_V_Q1'); return fulfill(route, 200, QUOTE_V_Q1); });
    await page.route('**/api/oms/checkout/orders', (route) => { log('POST /api/oms/checkout/orders -> 201 ORDER_201_O1'); return fulfill(route, 201, ORDER_201_O1); });

    await page.goto(`${BASE}/product/san-pham-audit-8`); // audit.cjs SIMPLE_SLUG: one SKU, no tiers
    await page.locator('#api-loading-state').waitFor({ state: 'detached', timeout: 30000 });
    await jsClick(page.getByRole('button', { name: /Mua ngay|Thêm vào giỏ hàng/ }).filter({ visible: true }).first());
    if (!(await page.getByText('Giỏ Hàng Của Bạn').isVisible().catch(() => false))) await jsClick(page.getByRole('button', { name: /Giỏ/ }).filter({ visible: true }).first());
    await page.getByText('Giỏ Hàng Của Bạn').waitFor();
    log('step 1: cart open');
    await jsClick(page.getByRole('button', { name: /Tiến hành thanh toán/ }));
    await page.locator('#checkout-form').waitFor();
    await page.getByPlaceholder('Ví dụ: Nguyễn Văn A').fill('Nguyễn Văn Kiểm');
    await page.getByPlaceholder('Ví dụ: 0912345678').fill('0912345678');
    await page.getByPlaceholder('Ví dụ: Số 12 Chùa Hà').fill('12 Phố Kiểm Thử');
    await jsClick(page.getByText('Thanh toán COD'));
    await page.getByRole('combobox', { name: 'Tỉnh/Thành phố' }).fill('Hà');
    await jsClick(page.getByRole('option', { name: 'Hà Nội' }));
    await jsClick(page.getByRole('combobox', { name: 'Phường/Xã' })); await page.getByRole('combobox', { name: 'Phường/Xã' }).focus();
    await jsClick(page.getByRole('option', { name: 'Phường Kiểm Thử' }));
    await page.locator('button', { hasText: 'Giao hàng chuẩn' }).getByText(/78\.000đ/).waitFor();
    log('step 2: form filled (name, phone, address, COD, Hà Nội / Phường Kiểm Thử), STANDARD 78.000đ');

    await jsClick(page.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    const otp = page.getByPlaceholder('Nhập 6 số OTP');
    await otp.waitFor();
    await otp.fill('123456');
    await jsClick(page.getByRole('button', { name: 'Xác nhận OTP' }));
    const success = page.getByText(ORDER_201_O1.order_number).first();
    await success.waitFor();
    log(`step 3: success step shows ${ORDER_201_O1.order_number}=${await success.isVisible()}`);
    await page.screenshot({ path: path.join(__dirname, '01-order-success-390x844.png') });

    const ga4 = await page.evaluate(() => window.dataLayer.map((a) => Array.from(a)).filter((a) => a[0] === 'event' && a[1] === 'purchase').map((a) => a[2]));
    const meta = await page.evaluate(() => window.fbq.queue.filter((a) => a[0] === 'track' && a[1] === 'Purchase').map((a) => a[2]));
    ga4.forEach((p) => log(`GA4 purchase ${JSON.stringify(p)}`));
    meta.forEach((p) => log(`Meta Purchase ${JSON.stringify(p)}`));
    if (ga4.length !== 1 || ga4[0].value !== 248000 || ga4[0].shipping !== 48000) throw new Error('GA4 purchase is not value 248000, shipping 48000');
    if (meta.length !== 1 || meta[0].value !== 248000) throw new Error('Meta Purchase is not value 248000');
  } catch (e) {
    log(`ERROR ${e.message.split('\n')[0]}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    try { process.kill(server.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; } // recorded PID only (r:0b30a607)
    log(`stopped dev server pid ${server.pid}`);
    fs.writeFileSync(path.join(__dirname, 'walk.log'), lines.join('\n') + '\n');
  }
})();
