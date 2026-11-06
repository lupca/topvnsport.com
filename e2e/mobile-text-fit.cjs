// STOR-167 (goal 2c881ad4, MOB-F, MOB-A c4cd5fa6, MOB-D 0d3a0143, MOB-G c9cd6197): text raised to >=14px must still fit. Real fonts,
// real browser, at 360/390/430: the bottom bar (one row, one line per label, no overlap, inside pb-16, >=44px buttons, badge at cart 99),
// the PDP purchase bar in every price/stock state, and the states audit.cjs never opens: mobile drawer, search dropdown, MainNav error
// row, QuickViewModal. Fixtures change in this process only; audit.cjs stays as it is. Not wired into CI.
// QuickView opens only from the hover buttons of ProductCard, so that context has no touch; the width and font sizes are the phone's.
// Vite --strictPort, killed by its recorded PID (r:0b30a607).
//   node e2e/mobile-text-fit.cjs      one PASS/FAIL line per check, exit 1 on any failure. PORT (default 4433).
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4433';
const { stub, waitPort, BASE, PRODUCTS, STOCK } = require('./mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const MIN = 14;
const TAP = 44;
const PHONES = [[360, 800], [390, 844], [430, 932]];
const LABELS = ['BADMINTON', 'Vợt & Cước', 'Đan Vợt O2O', 'Giỏ hàng'];
const bySlug = (slug) => PRODUCTS.find((p) => p.slug === slug);
const audit = (n) => bySlug(`san-pham-audit-${n}`);

// one fixture product per state
audit(6).variants[0].price = 0;
STOCK[audit(7).variants[0].sku_code] = 0;
Object.assign(audit(1).variants[0], { computed_price: 2000000, original_price: audit(1).variants[0].price });
// a SKU missing from the stock response reads as sold out; 'unknown' needs the stock call itself to fail
const stockDown = (page) => page.route('**/public/stock', (r) => r.fulfill({ status: 500, body: '{}' }));
const BAR_STATES = [
  ['priced', 8, 'Mua ngay', true], ['promo', 1, 'Mua ngay', true], ['no-price', 6, 'Mua ngay', false], ['out-of-stock', 7, 'Hết hàng', true],
  ['stock-unknown', 8, 'Chưa rõ tồn kho', true, stockDown], ['no-price+unknown', 6, 'Chưa rõ tồn kho', false, stockDown],
];

let failures = 0;
const report = (label, why, detail = '') => {
  if (why.length) failures++;
  console.log(`${label.padEnd(44)} ${why.length ? 'FAIL' : 'PASS'} ${detail}${why.length ? ' -- ' + why.join('; ') : ''}`);
};

function cartSeed(qty) {
  if (!qty) return '[]';
  const p = audit(8), v = p.variants[0];
  return JSON.stringify([{ id: `${p.id}-${v.id}`, productId: String(p.id), skuCode: v.sku_code, name: p.name, brand: '', image: '', price: v.price, selectedWeight: '', selectedColor: '', quantity: qty }]);
}

// Every visible text node under the selector whose element computes below 14px.
const smallText = (page, selector) => page.evaluate(([sel, min]) => {
  const out = [];
  for (const root of document.querySelectorAll(sel)) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const p = n.parentElement;
      if (!n.nodeValue.trim() || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(p.tagName) || !p.checkVisibility()) continue;
      const fs = parseFloat(getComputedStyle(p).fontSize);
      if (fs < min) out.push(`${fs}px '${n.nodeValue.trim().slice(0, 24)}'`);
    }
  }
  return out;
}, [selector, MIN]);
const noSmall = async (page, label, selector) => {
  const s = await smallText(page, selector);
  report(label, s.length ? [`${s.length} under ${MIN}px: ${s.slice(0, 4).join(', ')}`] : []);
};
const noScroll = async (page, label, w) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  report(label, sw > w ? [`page scrollWidth ${sw} > ${w}`] : [], `${sw}`);
};

async function withPage(browser, [w, h], { touch = true, cart = 0, setup } = {}, fn) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  try {
    await page.addInitScript((seed) => { localStorage.setItem('cart_items', seed); }, cartSeed(cart));
    await stub(page);
    // stub() aborts every non-local request, which would measure a narrower fallback font. Later routes win in Playwright.
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.continue());
    if (setup) await setup(page);
    await fn(page);
  } catch (e) {
    report(`w=${w} error`, [e.message.split('\n')[0]]);
  } finally {
    await ctx.close();
  }
}
const open = async (page, url) => {
  await page.goto(`${BASE}${url}`);
  await page.locator('#api-loading-state').waitFor({ state: 'detached', timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  // fonts.check() is true when nothing needs loading, so force the Vietnamese faces the labels use and require them loaded
  const ok = await page.evaluate(async (text) => {
    const faces = await document.fonts.load('800 14px "Be Vietnam Pro"', text).catch(() => []);
    await document.fonts.ready;
    return faces.length > 0 && faces.every((f) => f.status === 'loaded');
  }, LABELS.join(' '));
  if (!ok) throw new Error('Be Vietnam Pro chưa tải (fonts.googleapis.com/gstatic.com unreachable?); refusing to measure a fallback font');
};

const bottomBar = (page, labels) => page.evaluate((names) => {
  const spans = [...document.querySelectorAll('span')].filter((s) => names.includes(s.textContent) && s.closest('button') && s.closest('.fixed.bottom-0'));
  const bar = spans[0].closest('.fixed.bottom-0');
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const cart = spans[3].closest('button');
  const badge = cart.querySelector('span.absolute');
  const cs = badge && getComputedStyle(badge);
  return {
    text: spans.map((s) => s.textContent),
    bar: box(bar), pad: parseFloat(getComputedStyle(document.getElementById('root').firstElementChild).paddingBottom),
    labels: spans.map((s) => ({ ...box(s), fs: parseFloat(getComputedStyle(s).fontSize), lines: s.getClientRects().length, lh: parseFloat(getComputedStyle(s).lineHeight) })),
    btns: spans.map((s) => box(s.closest('button'))),
    badge: badge && { ...box(badge), fs: parseFloat(cs.fontSize), pos: cs.position, text: badge.textContent, sw: badge.scrollWidth, cw: badge.clientWidth },
  };
}, labels);

async function checkBottomBar(browser, vp) {
  const w = vp[0];
  for (const url of ['/', '/catalog', '/stores']) await withPage(browser, vp, {}, async (page) => {
    await open(page, url);
    const m = await bottomBar(page, LABELS);
    const why = [];
    if (m.text.join() !== LABELS.join()) why.push(`order ${m.text.join()}`);
    m.labels.forEach((l, i) => {
      if (l.fs < MIN) why.push(`${LABELS[i]} ${l.fs}px`);
      if (l.lines !== 1 || l.h > l.lh + 1) why.push(`${LABELS[i]} not one line (${l.lines} rects, h=${l.h})`);
      if (l.l < 0 || l.r > w) why.push(`${LABELS[i]} outside the screen ${l.l}..${l.r}`);
      if (i && l.l < m.labels[i - 1].r) why.push(`${LABELS[i]} overlaps ${LABELS[i - 1]}`);
    });
    m.btns.forEach((b, i) => { if (b.w < TAP || b.h < TAP) why.push(`button ${LABELS[i]} ${b.w}x${b.h} < ${TAP}`); });
    if (new Set(m.btns.map((b) => Math.round(b.t))).size !== 1) why.push('buttons not on one row');
    if (m.bar.h > m.pad) why.push(`bar ${m.bar.h}px > page bottom padding ${m.pad}px`);
    report(`w=${w} bottom bar ${url}`, why, `bar=${m.bar.h}/${m.pad} labels=${m.labels[0].fs}px minBtn=${Math.min(...m.btns.map((b) => b.w)).toFixed(1)}x${Math.min(...m.btns.map((b) => b.h)).toFixed(1)}`);
    await noScroll(page, `w=${w} bottom bar ${url} no x-scroll`, w);
  });
  let empty;
  await withPage(browser, vp, {}, async (page) => { await open(page, '/'); empty = (await bottomBar(page, LABELS)).btns[3]; });
  await withPage(browser, vp, { cart: 99 }, async (page) => {
    await open(page, '/');
    const m = await bottomBar(page, LABELS), b = m.badge, why = [];
    if (!b) return report(`w=${w} cart badge 99`, ['badge missing (seed not applied)']);
    if (b.text !== '99') why.push(`text '${b.text}'`);
    if (b.fs < MIN) why.push(`${b.fs}px`);
    if (b.pos !== 'absolute') why.push(`position ${b.pos}`);
    if (b.sw > b.cw) why.push(`text clipped ${b.sw} > ${b.cw}`);
    if (b.r > w || b.t < m.bar.t) why.push(`outside the bar: right ${b.r}, top ${b.t} < ${m.bar.t}`);
    if (m.btns[3].w !== empty.w || m.btns[3].h !== empty.h) why.push(`cart button ${m.btns[3].w}x${m.btns[3].h} != ${empty.w}x${empty.h} without badge`);
    report(`w=${w} cart badge 99`, why, `${b.fs}px ${b.w}x${b.h}`);
  });
}

async function checkPurchaseBar(browser, vp) {
  const w = vp[0];
  for (const [state, n, button, priced, setup] of BAR_STATES) await withPage(browser, vp, { setup }, async (page) => {
    await open(page, `/product/${audit(n).slug}`);
    const bar = page.locator('div.sticky.bottom-0');
    const m = await bar.evaluate((el) => {
      const fs = (s) => parseFloat(getComputedStyle(el.querySelector(s)).fontSize);
      const btn = el.querySelector('button').getBoundingClientRect();
      return { h4: fs('h4'), p: fs('p'), btn: fs('button'), text: el.querySelector('button').textContent.trim(), price: el.querySelector('p').textContent, sw: el.scrollWidth, cw: el.clientWidth, bw: btn.width, bh: btn.height, right: btn.right, h: el.getBoundingClientRect().height };
    });
    const why = [];
    for (const k of ['h4', 'p', 'btn']) if (m[k] < MIN) why.push(`${k} ${m[k]}px`);
    if (m.text !== button) why.push(`button '${m.text}' != '${button}' (fixture state not reached)`);
    if ((m.price === 'Liên hệ để biết giá') === priced) why.push(`price '${m.price}' (fixture state not reached)`);
    if (m.sw > m.cw) why.push(`bar scrollWidth ${m.sw} > ${m.cw}`);
    if (m.right > w) why.push(`button right ${m.right} > ${w}`);
    if (m.bh < TAP) why.push(`button h=${m.bh} < ${TAP}`);
    report(`w=${w} purchase bar ${state}`, why, `h=${m.h} btn=${m.bw.toFixed(1)}x${m.bh}`);
    await noScroll(page, `w=${w} pdp ${state} no x-scroll`, w);
    await noSmall(page, `w=${w} pdp ${state} no small text`, 'body');
  });
}

async function checkDrawer(browser, vp) {
  const w = vp[0];
  await withPage(browser, vp, {}, async (page) => {
    await open(page, '/catalog');
    await page.getByRole('button', { name: 'Open mobile menu' }).click();
    await page.getByText('Thương Hiệu Hot').waitFor();
    await noSmall(page, `w=${w} drawer`, '#mobile-sidebar-drawer');
  });
  await withPage(browser, vp, { setup: (p) => p.route('**/public/voma-categories', (r) => r.fulfill({ status: 500, body: '{}' })) }, async (page) => {
    await open(page, '/catalog');
    await page.getByText('Chưa tải được danh mục sản phẩm.').first().waitFor();
    await noSmall(page, `w=${w} MainNav error row`, 'header');
    await noScroll(page, `w=${w} MainNav error row no x-scroll`, w);
    await page.getByRole('button', { name: 'Open mobile menu' }).click();
    await page.getByText('Thương Hiệu Hot').waitFor();
    await noSmall(page, `w=${w} drawer error state`, '#mobile-sidebar-drawer');
  });
}

async function checkSearch(browser, vp) {
  const w = vp[0];
  await withPage(browser, vp, {}, async (page) => {
    await open(page, '/catalog');
    await page.getByPlaceholder(/^Tìm vợt Yonex/).fill('a');
    await page.getByPlaceholder(/^Tìm vợt Yonex/).fill('Giày');
    await page.getByText('Kết quả tìm kiếm phù hợp').waitFor();
    report(`w=${w} search dropdown shows old price`, await page.locator('#search-wrap p.line-through').count() ? [] : ['promo row not reached']);
    await noSmall(page, `w=${w} search dropdown`, '#search-wrap');
    await noScroll(page, `w=${w} search dropdown no x-scroll`, w);
  });
}

async function checkQuickView(browser, vp) {
  const w = vp[0];
  const cases = [
    ['promo', audit(1), 'Thêm vào giỏ', '[data-testid=discount-badge]'], ['priced', audit(8), 'Thêm vào giỏ', '[data-testid=regular-price]'],
    ['no-price', audit(6), 'Thêm vào giỏ', '[data-testid=no-price]'], ['out-of-stock', audit(7), 'Hết hàng', '[data-testid=regular-price]'],
    ['stock-unknown', audit(8), 'Chưa rõ tồn kho', '[data-testid=regular-price]', stockDown], ['racket', bySlug('vot-yonex-astrox-100zz-kurenai'), 'Chọn phân loại', '[data-testid=regular-price]'],
  ];
  for (const [state, p, button, marker, setup] of cases) await withPage(browser, vp, { touch: false, setup }, async (page) => {
    await open(page, `/catalog?search=${encodeURIComponent(p.name)}`);
    await page.locator('button[title="Xem nhanh thông số"]').first().evaluate((el) => el.click());
    await page.locator('#quick-view-modal-content').waitFor();
    const text = (await page.locator('#add-to-cart-quickview').textContent()).trim();
    const why = [];
    if (text !== button) why.push(`button '${text}' != '${button}' (fixture state not reached)`);
    if (!(await page.locator(`#quick-view-overlay ${marker}`).count())) why.push(`${marker} missing (fixture state not reached)`);
    report(`w=${w} QuickView ${state} state`, why);
    await noSmall(page, `w=${w} QuickView ${state}`, '#quick-view-overlay');
    const m = await page.locator('#quick-view-modal-content').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    report(`w=${w} QuickView ${state} no x-scroll`, m.sw > m.cw ? [`modal scrollWidth ${m.sw} > ${m.cw}`] : [], `${m.sw}/${m.cw}`);
    await noScroll(page, `w=${w} QuickView ${state} page no x-scroll`, w);
  });
}

async function main() {
  const taken = await new Promise((res) => net.connect(+process.env.PORT, '127.0.0.1').once('connect', function () { this.destroy(); res(true); }).once('error', () => res(false)));
  if (taken) { console.log(`ERROR port ${process.env.PORT} already taken; set PORT to a free port`); process.exitCode = 1; return; }
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  const exited = new Promise((_, rej) => server.once('exit', (code) => rej(new Error(`dev server exited early (code ${code}); port ${process.env.PORT} taken?`))));
  exited.catch(() => {});
  let browser;
  try {
    await Promise.race([waitPort(), exited]);
    const owner = execFileSync('ss', ['-ltnpH', `sport = :${process.env.PORT}`], { encoding: 'utf8' });
    if (server.exitCode !== null || !owner.includes(`pid=${server.pid},`)) throw new Error(`port ${process.env.PORT} is not served by dev server pid ${server.pid}`);
    browser = await chromium.launch();
    for (const vp of PHONES) for (const check of [checkBottomBar, checkPurchaseBar, checkDrawer, checkSearch, checkQuickView]) await check(browser, vp);
  } catch (e) {
    failures++;
    console.log('ERROR', e.message.split('\n')[0]);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
      try { process.kill(server.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; } // recorded PID only (r:0b30a607)
    }
    console.log(`stopped dev server pid ${server.pid}; ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
  }
}

main();
