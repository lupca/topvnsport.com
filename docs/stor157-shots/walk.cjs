// STOR-157 walk: checkout at 390x844 on the vite dev server, /api/oms/shipping-quote answered with QUOTE_F1
// (spec 08893767) and, after 'Thử lại', QUOTE_V_Q1 (spec c55789ce). Bodies are read from
// src/__tests__/fixtures/shippingQuote.ts (no second copy). Other /api stubs come from e2e/mobile-audit/audit.cjs.
// Vite is started --strictPort and killed by its recorded PID (r:0b30a607).
//   PORT=4457 node docs/stor157-shots/walk.cjs   -> docs/stor157-shots/*.png + walk.log
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
process.env.PORT ||= '4457';
process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
const { stub, waitPort, BASE } = require('../../e2e/mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const fixtures = fs.readFileSync(path.join(ROOT, 'src/__tests__/fixtures/shippingQuote.ts'), 'utf8');
const body = (name) => JSON.parse(fixtures.match(new RegExp(`export const ${name} = JSON\\.parse\\('(.*)'\\);`))[1]);
const QUOTE_F1 = body('QUOTE_F1');
const QUOTE_V_Q1 = body('QUOTE_V_Q1');

const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jsClick = (loc) => loc.evaluate((el) => el.click());

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  log(`dev server pid ${server.pid} port ${process.env.PORT}`);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await stub(page);
    let quoteN = 0; let orderPosts = 0; let otpPosts = 0;
    await page.route('**/api/oms/shipping-quote', (route) => {
      quoteN += 1;
      const b = quoteN === 1 ? QUOTE_F1 : QUOTE_V_Q1;
      log(`POST /api/oms/shipping-quote #${quoteN} -> 200 ${quoteN === 1 ? 'QUOTE_F1' : 'QUOTE_V_Q1'}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    });
    page.on('request', (r) => {
      if (r.method() !== 'POST') return;
      if (r.url().endsWith('/api/oms/checkout/orders')) orderPosts += 1;
      if (r.url().endsWith('/send-otp')) otpPosts += 1;
    });

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
    log('step 2: form filled (name, phone, address, COD, Hà Nội / Phường Kiểm Thử)');

    const sentence = page.getByText('Chưa tính được phí vận chuyển. Vui lòng thử lại.');
    await sentence.waitFor();
    const btn = page.getByRole('button', { name: 'Xác nhận đặt hàng' });
    const fee = (await page.getByText('Phí vận chuyển:').locator('..').innerText()).replace(/\s+/g, ' ');
    const total = (await page.getByText('Tổng cộng thanh toán:').locator('..').innerText()).replace(/\s+/g, ' ');
    const modalText = await page.locator('#checkout-form').innerText();
    log(`F1 stubbed: failure sentence visible=${await sentence.isVisible()}`);
    log(`F1 stubbed: 'Thử lại' visible=${await page.getByRole('button', { name: 'Thử lại' }).isVisible()}`);
    log(`F1 stubbed: 'Xác nhận đặt hàng' disabled=${await btn.isDisabled()}`);
    log(`F1 stubbed: fee row="${fee}" total row="${total}"`);
    // whole-amount match: the items total 150.000đ contains the substring '50.000đ'
    const has = (amount) => new RegExp(`(^|[^0-9.])${amount.replace('.', '\\.')}`).test(modalText);
    log(`F1 stubbed: form shows 30.000đ=${has('30.000đ')} 50.000đ=${has('50.000đ')} 0đ=${has('0đ')} (items total row: ${(await page.getByText('Tổng tiền hàng:').locator('..').innerText()).replace(/\s+/g, ' ')})`);
    await sentence.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, '01-f1-quote-failed-390x844.png') });
    await page.locator('#checkout-form').evaluate((f) => f.requestSubmit());
    await sleep(800);
    log(`F1 stubbed: form submit (Enter) -> POST /send-otp count=${otpPosts}, POST /api/oms/checkout/orders count=${orderPosts}`);
    await page.screenshot({ path: path.join(__dirname, '02-f1-footer-disabled-390x844.png') });

    await jsClick(page.getByRole('button', { name: 'Thử lại' }));
    log("clicked 'Thử lại'");
    const std = page.locator('button', { hasText: 'Giao hàng chuẩn' });
    await std.getByText(/78\.000đ/).waitFor();
    log(`after retry: quote POSTs=${quoteN}; STANDARD card="${(await std.innerText()).replace(/\s+/g, ' ')}"`);
    log(`after retry: 'Xác nhận đặt hàng' disabled=${await btn.isDisabled()}`);
    log(`after retry: fee row="${(await page.getByText('Phí vận chuyển:').locator('..').innerText()).replace(/\s+/g, ' ')}"`);
    await std.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(__dirname, '03-retry-q1-78000-390x844.png') });

    await jsClick(btn);
    const otp = page.getByPlaceholder('Nhập 6 số OTP');
    await otp.waitFor();
    log(`after retry: clicked 'Xác nhận đặt hàng' -> POST /send-otp count=${otpPosts}, OTP input visible=${await otp.isVisible()}`);
    await otp.fill('123456');
    await jsClick(page.getByRole('button', { name: 'Xác nhận OTP' }));
    const success = page.getByText('AUDIT-0001').first();
    await success.waitFor();
    log(`order placed: POST /api/oms/checkout/orders count=${orderPosts}, success screen shows AUDIT-0001=${await success.isVisible()}`);
    await page.screenshot({ path: path.join(__dirname, '04-order-success-390x844.png') });
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
