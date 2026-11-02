// STOR-085 walk on built dist (harness running): land on a sitemap slug URL -> PDP -> add to cart -> cart ->
// checkout entry; then land on /product/<VOMA slug> and /product/<id>. Screenshot + aria snapshot per step.
// Usage: PLAYWRIGHT=<playwright-core path> PORT=<harness port> node docs/stor085-shots/walk.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright-core');
const fs = require('fs');
const SHOTS = process.env.SHOTS || 'docs/stor085-shots';
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 4372), ORIGIN = 'https://www.topvnsport.com';
const NAME = 'Vợt Yonex Astrox 99', SLUG = '/product/vot-yonex-astrox-99';
let n = 0, fails = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text()}`); });
  const snap = async (name) => {
    n++;
    await page.screenshot({ path: `${SHOTS}/${n}-${name}.png` });
    fs.writeFileSync(`${SHOTS}/${n}-${name}.aria.txt`, await page.locator('body').ariaSnapshot());
    console.log(`  snapshot ${n}-${name} url=${page.url().replace(BASE, '')}`);
  };
  const landing = async (path, label) => {
    const resp = await page.goto(BASE + path);
    check(`${label} status`, resp.status(), 200);
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).waitFor();
    check(`${label} main h1`, (await page.locator('main h1').first().textContent()).trim(), NAME);
    check(`${label} no #not-found`, await page.locator('#not-found').count(), 0);
    check(`${label} canonical`, await page.locator('link[rel=canonical]').getAttribute('href'), ORIGIN + SLUG);
    check(`${label} address bar unchanged`, page.url(), BASE + path);
  };

  await landing(SLUG, 'sitemap slug');
  await snap('sitemap-slug-landing');
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  await snap('added-to-cart');
  const cartHeading = page.getByText('Giỏ Hàng Của Bạn');
  if (!(await cartHeading.waitFor({ timeout: 3000 }).then(() => true, () => false))) {
    await page.getByRole('button', { name: 'Giỏ hàng' }).first().click();
    await cartHeading.waitFor();
  }
  check('product in #cart-drawer-modal', await page.locator('#cart-drawer-modal').getByText(NAME).first().isVisible(), true);
  await snap('cart');
  await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();
  await page.getByText('Thanh Toán Đơn Hàng').waitFor();
  check('checkout entry reached', await page.getByText('Thanh Toán Đơn Hàng').isVisible(), true);
  await snap('checkout-entry');

  await landing('/product/vot-yonex-astrox-99-vyax99-k7q2', 'VOMA slug');
  await snap('voma-slug-landing');
  await landing('/product/101', 'id');
  await snap('id-landing');

  const resp = await page.goto(BASE + '/product/khong-co-san-pham-nay');
  check('unknown slug status', resp.status(), 404);
  await page.locator('#not-found').waitFor();
  check('unknown slug h1', (await page.locator('main h1').first().textContent()).trim(), 'Không tìm thấy trang');
  await snap('unknown-slug-not-found');

  console.log('errors:', JSON.stringify(errors));
  await browser.close();
  console.log(fails ? `RESULT: ${fails} FAIL` : 'RESULT: ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
