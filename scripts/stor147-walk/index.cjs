// STOR-147 walk (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F; r:75b60f55 walk the real UI, r:0b30a607 kill by PID).
// 390x844 + 360/430 with hasTouch: add to cart, tap +, tap −, tap remove, re-add, checkout (fake identity), COD -> OTP ->
// 'Hoàn thành mua sắm'. Then SePay: '/payments' is HELD, the step-3 'Đang chuyển…' state is measured, then released as 502
// and the error state is measured. Every non-127.0.0.1 request is aborted by audit.cjs stub(); hosts are logged.
// Measures every target box (<44px), input font (<16px) / height (<44px), text (<14px) inside #cart-drawer-modal, and
// scrollWidth <= clientWidth for the modal and its panel at steps 1-3. Screenshots -> docs/stor147-shots/.
//   node scripts/stor147-walk            (PORT default 4447; PLAYWRIGHT=<path> optional)
// Exit 1 on any finding.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4447';
const { stub, waitPort, BASE } = require('../../e2e/mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'stor147-shots');
// Same fixtures as e2e/mobile-audit/audit.cjs (line 317 SIMPLE_SLUG, line 321 FAKE): fake identity, no real data.
const SIMPLE_SLUG = 'san-pham-audit-8';
const FAKE = { name: 'Khách Kiểm Thử', phone: '0900000000', address: 'Số 1 Đường Kiểm Thử', otp: '123456' };
const WIDTHS = [360, 390, 430];

let findings = 0;
const hosts = new Set();
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(page, label, vw) {
  const m = await page.evaluate(() => {
    const d = document.querySelector('#cart-drawer-modal');
    if (!d) return { error: 'no #cart-drawer-modal' };
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const label = (el) => (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 26);
    const targets = [...d.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=combobox],[role=option]')]
      .filter(vis).map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
      .map(({ el, r }) => `${el.tagName} "${label(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    const inputs = [...d.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis)
      .map((el) => ({ el, fs: parseFloat(getComputedStyle(el).fontSize), h: el.getBoundingClientRect().height }))
      .filter(({ fs, h }) => fs < 16 || h < 43.5)
      .map(({ el, fs, h }) => `${el.tagName} "${el.placeholder || el.getAttribute('aria-label') || ''}" ${fs}px h=${Math.round(h)}`);
    const small = new Set();
    const tw = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const p = n.parentElement;
      if (!n.nodeValue.trim() || !p || /^(OPTION|SCRIPT|STYLE)$/.test(p.tagName) || !vis(p)) continue;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      if (fs < 14) small.add(`${fs}px "${n.nodeValue.trim().slice(0, 22)}"`);
    }
    const panel = d.firstElementChild;
    return { targets, inputs, small: [...small], overflow: [d.scrollWidth, d.clientWidth, panel.scrollWidth, panel.clientWidth] };
  });
  if (m.error) { findings++; log(`FAIL ${label}@${vw}: ${m.error}`); return; }
  const [sw, cw, psw, pcw] = m.overflow;
  const bad = [...m.targets.map((t) => `target ${t}`), ...m.inputs.map((i) => `input ${i}`), ...m.small.map((s) => `text ${s}`)];
  if (sw > cw || psw > pcw) bad.push(`horizontal overflow modal ${sw}/${cw} panel ${psw}/${pcw}`);
  findings += bad.length;
  log(`${bad.length ? 'FAIL' : 'PASS'} ${label}@${vw}: targets<44=${m.targets.length} inputs=${m.inputs.length} text<14=${m.small.length} modal=${sw}/${cw} panel=${psw}/${pcw}`);
  for (const b of bad) log(`    ${b}`);
  await page.screenshot({ path: path.join(SHOTS, `${label}-${vw}.png`) });
}

const jsClick = (loc) => loc.evaluate((el) => el.click());
const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await sleep(500); };
const loaded = async (page) => { await page.locator('#api-loading-state').waitFor({ state: 'detached', timeout: 30000 }); await settle(page); };
const drawerClose = (page) => page.locator('#cart-drawer-modal .p-4.border-b > button');

async function addAndOpenCart(page) {
  await page.goto(`${BASE}/product/${SIMPLE_SLUG}`); await loaded(page);
  await page.getByRole('button', { name: /Mua ngay|Thêm vào giỏ hàng/ }).filter({ visible: true }).first().tap();
  if (!(await page.getByText('Giỏ Hàng Của Bạn').isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /Giỏ/ }).filter({ visible: true }).first().tap();
  }
  await page.getByText('Giỏ Hàng Của Bạn').waitFor(); await sleep(500);
}

async function fillCheckout(page) {
  await page.getByRole('button', { name: /Tiến hành thanh toán/ }).tap();
  await page.locator('#checkout-form').waitFor();
  await page.getByPlaceholder('Ví dụ: Nguyễn Văn A').fill(FAKE.name);
  await page.getByPlaceholder('Ví dụ: 0912345678').fill(FAKE.phone);
  await page.getByPlaceholder('Ví dụ: Số 12 Chùa Hà').fill(FAKE.address);
  await page.getByRole('combobox', { name: 'Tỉnh/Thành phố' }).fill('Hà');
  await jsClick(page.getByRole('option', { name: 'Hà Nội' }));
  await page.getByRole('combobox', { name: 'Phường/Xã' }).focus();
  await jsClick(page.getByRole('option', { name: 'Phường Kiểm Thử' }));
}

async function walkWidth(browser, vw) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  page.on('pageerror', (e) => { findings++; log(`FAIL pageerror@${vw}: ${e.message}`); });
  await stub(page);
  let release;
  const held = new Promise((r) => { release = r; });
  // SePay: the first /payments is HELD; after the 'Đang chuyển…' state is measured it is released as 502.
  await page.route('**/payments', async (route) => { await held; await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: 'walk: SePay gateway 502' }) }); });
  try {
    // 1. cart: add, +, −, remove, re-add
    await addAndOpenCart(page);
    await measure(page, 'cart', vw);
    await page.getByRole('button', { name: 'Tăng số lượng' }).tap();
    await page.getByRole('button', { name: 'Giảm số lượng' }).tap();
    await page.getByTitle('Xóa sản phẩm').tap();
    await page.getByText(/Giỏ hàng của bạn đang trống/).waitFor();
    await drawerClose(page).tap();
    await addAndOpenCart(page);
    // 2. COD: checkout form -> OTP -> step 3 -> Hoàn thành mua sắm
    await fillCheckout(page);
    await page.getByText('Thanh toán COD').tap();
    await sleep(400);
    await measure(page, 'checkout', vw);
    await page.getByRole('button', { name: 'Xác nhận đặt hàng' }).tap();
    await page.getByPlaceholder('Nhập 6 số OTP').fill(FAKE.otp);
    await page.getByRole('button', { name: 'Xác nhận OTP' }).tap();
    await page.getByText('ĐẶT HÀNG THÀNH CÔNG!').waitFor(); await sleep(400);
    await measure(page, 'order-success', vw);
    await page.getByRole('button', { name: 'Hoàn thành mua sắm' }).tap();
    await page.locator('#cart-drawer-modal').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    // 3. SePay: OTP -> /payments held -> 'Đang chuyển…' -> 502 -> error state
    await addAndOpenCart(page);
    await fillCheckout(page);
    await page.getByText('SePay QR Code').tap();
    await page.getByRole('button', { name: /Thanh toán SePay QR/ }).tap();
    await page.getByPlaceholder('Nhập 6 số OTP').fill(FAKE.otp);
    await page.getByRole('button', { name: 'Xác nhận OTP' }).tap();
    await page.getByText(/Đang chuyển tới trang thanh toán SePay/).waitFor();
    await measure(page, 'sepay-pending', vw);
    release();
    await page.getByRole('heading', { name: 'Chưa mở được trang thanh toán' }).waitFor();
    await measure(page, 'sepay-error', vw);
  } catch (e) {
    findings++;
    log(`FAIL walk@${vw}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(SHOTS, `walk-fail-${vw}.png`) }).catch(() => {});
  } finally {
    release();
    await ctx.close();
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    for (const vw of WIDTHS) await walkWidth(browser, vw);
  } catch (e) {
    findings++;
    log('ERROR', e.message.split('\n')[0]);
  } finally {
    if (browser) await browser.close();
    try { process.kill(server.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; } // recorded PID only (r:0b30a607)
    log(`stopped dev server pid ${server.pid}`);
    log('hosts requested:', [...hosts].join(', '));
    log(`${findings} finding(s)`);
    process.exitCode = findings ? 1 : 0;
  }
}
main();
