// STOR-072 walk on built dist: land on product A, click home, click product B, assert title/canonical/og each
// step, add to cart, reach checkout entry; screenshot + aria snapshot per step into SHOTS.
// Usage: PLAYWRIGHT=<path to playwright module> node scripts/stor072-walk/walk.cjs (harness running).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const SHOTS = process.env.SHOTS || '/tmp/stor072/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 4372), ORIGIN = 'https://www.topvnsport.com';
const SHELL = fs.readFileSync('dist/index.html', 'utf8').match(/<title>([^<]*)<\/title>/)[1];
let n = 0, fails = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.stack));
  const head = () => page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel=canonical]')?.href ?? null,
    canonicals: document.querySelectorAll('link[rel=canonical]').length,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    ogUrl: document.querySelector('meta[property="og:url"]')?.content ?? null,
    desc: document.querySelector('meta[name=description]')?.content ?? null,
    ogImage: document.querySelector('meta[property="og:image"]')?.content ?? null,
  }));
  const snap = async (name) => {
    n++;
    await page.screenshot({ path: `${SHOTS}/${n}-${name}.png` });
    fs.writeFileSync(`${SHOTS}/${n}-${name}.aria.txt`, await page.locator('body').ariaSnapshot());
    console.log(`  snapshot ${n}-${name} url=${page.url().replace(BASE, '')} head=${JSON.stringify(await head())}`);
  };
  const navs = [];
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });

  // 1. Land on product A (server-rendered by api/product handler).
  const resp = await page.goto(`${BASE}/product/vot-yonex-astrox-99`);
  check('A served by handler, status', resp.status(), 200);
  check('A served html has product canonical', (await resp.text()).includes(`<link rel="canonical" href="${ORIGIN}/product/vot-yonex-astrox-99" data-product-head />`), true);
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).waitFor();
  let h = await head();
  check('A title', h.title, 'Vợt Yonex Astrox 99');
  check('A canonical', h.canonical, `${ORIGIN}/product/vot-yonex-astrox-99`);
  check('A og:url', h.ogUrl, `${ORIGIN}/product/vot-yonex-astrox-99`);
  check('A description', h.desc, 'Mô tả vợt A');
  await snap('product-A-landing');
  const docLoads = navs.length;

  // 2. Click to home (header logo link).
  await page.locator('header a[href="/"]').first().click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForFunction((t) => document.title === t, SHELL);
  h = await head();
  check('home title = shell default', h.title, SHELL);
  check('home canonical absent', h.canonical, null);
  check('home og:title absent', h.ogTitle, null);
  check('home og:url absent', h.ogUrl, null);
  check('home description absent', h.desc, null);
  check('home og:image absent', h.ogImage, null);
  await snap('home');

  // 3. Click to product B from the home page.
  await page.getByRole('heading', { name: 'Giày Lining', level: 3 }).first().click();
  await page.waitForURL(`${BASE}/product/giay-lining`);
  await page.waitForFunction(() => document.title === 'Giày Lining');
  h = await head();
  check('B title', h.title, 'Giày Lining');
  check('B canonical', h.canonical, `${ORIGIN}/product/giay-lining`);
  check('B one canonical', h.canonicals, 1);
  check('B og:title', h.ogTitle, 'Giày Lining');
  check('B og:url', h.ogUrl, `${ORIGIN}/product/giay-lining`);
  check('B description absent (B has none)', h.desc, null);
  check('B og:image absent (B has none)', h.ogImage, null);
  check('client-side navigation only (no document reload)', navs.length - docLoads, 2);
  await snap('product-B');

  // 4. Add B to cart, open cart, reach checkout entry.
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  await snap('added-to-cart');
  const cartHeading = page.getByText('Giỏ Hàng Của Bạn');
  const auto = await cartHeading.waitFor({ timeout: 3000 }).then(() => true, () => false);
  if (auto) {
    console.log('CART PATH: auto-open');
  } else {
    console.log('CART PATH: cart-icon click');
    await page.getByRole('button', { name: 'Giỏ hàng' }).first().click();
    await cartHeading.waitFor();
  }
  check('Giày Lining in #cart-drawer-modal', await page.locator('#cart-drawer-modal').getByText('Giày Lining').first().isVisible(), true);
  await snap('cart');
  await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();
  await page.getByText('Thanh Toán Đơn Hàng').waitFor();
  check('checkout entry reached', await page.getByText('Thanh Toán Đơn Hàng').isVisible(), true);
  check('checkout keeps B title', (await head()).title, 'Giày Lining');
  await snap('checkout-entry');

  await browser.close();
  console.log(fails ? `RESULT: ${fails} FAIL` : 'RESULT: ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
