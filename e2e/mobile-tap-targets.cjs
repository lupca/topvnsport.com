// STOR-166 (goal 2c881ad4, MOB-E 5c6e5961, MOB-D 0d3a0143): real-browser sizes of the tap targets the audit cannot reach, because its
// fixtures have no 'Tất' category, one photo per product, no sold-out product and no popup. Those states are built here, in
// this process only: audit.cjs and its fixtures stay as they are (before.md compares against that set).
// At 360/390/430 every target must be >=44x44 with no horizontal scroll; the arrow's visible circle must stay 30x30.
// At 390 each control is also tapped for real, at the corner of its hit area where that is new. At 768 the old sizes must hold.
// Vite --strictPort, killed by its recorded PID (r:0b30a607).
//   node e2e/mobile-tap-targets.cjs      one PASS/FAIL line per target, exit 1 on any failure. PORT (default 4432).
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4432';
const { stub, waitPort, BASE, PRODUCTS, STOCK } = require('./mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const TAP = 44;
const CIRCLE = 30;
const TABLET_ARROW = 31.75; // measured before STOR-166: p-1.5 + h-4 on the 17px root
const PHONES = [[360, 800], [390, 844], [430, 932]];
const RACKET = 'vot-yonex-astrox-100zz-kurenai';
const SOLD_OUT = 'san-pham-audit-7';
const SIMPLE = 'san-pham-audit-8';
const bySlug = (slug) => PRODUCTS.find((p) => p.slug === slug);
const CATS = [{ id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Cầu lông > Vợt cầu lông' }, { id: 5, code: 'VC001999', name: 'Tất', display_name: 'Cầu lông > Tất' }];

// 8 distinct photos: fewer fit the rail at 390 and the arrows would have nothing to scroll
bySlug(RACKET).media = PRODUCTS.slice(0, 8).map((p, i) => ({ ...p.media[0], image_url: `${p.media[0].image_url}?n=${i}`, is_cover: i === 0, display_order: i }));
STOCK[bySlug(SOLD_OUT).variants[0].sku_code] = 0;
bySlug(SIMPLE).voma_category_id = 5;

let failures = 0;
const report = (label, why, detail = '') => {
  if (why.length) failures++;
  console.log(`${label.padEnd(34)} ${why.length ? 'FAIL' : 'PASS'} ${detail}${why.length ? ' -- ' + why.join('; ') : ''}`);
};
const size = async (loc) => { const b = await loc.boundingBox(); return b ? { w: Math.round(b.width * 100) / 100, h: Math.round(b.height * 100) / 100 } : { w: 0, h: 0 }; };
const min44 = async (w, name, loc) => {
  const s = await size(loc);
  report(`w=${w} ${name}`, s.w < TAP || s.h < TAP ? [`${s.w}x${s.h} < ${TAP}`] : [], `${s.w}x${s.h}`);
};
const noScroll = async (page, w, where) => {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  report(`w=${w} ${where} no x-scroll`, sw > w ? [`scrollWidth ${sw} > ${w}`] : [], `${sw}`);
};
const check = (label, ok, detail) => report(label, ok ? [] : [detail], ok ? '' : '');

const wordmark = (page) => page.locator('[data-testid=mobile-sticky-bar] img[alt="TopVNSport Logo"]').locator('xpath=..');
const tatLink = (page) => page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Tất', exact: true });
const arrow = (page, dir) => page.getByRole('button', { name: `Cuộn danh sách ảnh sang ${dir}` });
const barButton = (page) => page.locator('div.sticky.bottom-0 button');
const popupBtn = (page, name) => page.getByRole('alertdialog').getByRole('button', { name });
const open = async (page, url, ready) => { await page.goto(`${BASE}${url}`); await ready.waitFor({ timeout: 30000 }); };
const showAlert = (page) => page.evaluate(() => { window.alert('Kiểm thử'); });
// main.tsx's provider and this import share one Vite module, so this is the popup a real confirm path opens
const showConfirm = (page) => page.evaluate(async () => {
  const { popupService } = await import('/src/components/ui/popupService.ts');
  window.__confirmed = 'pending';
  popupService.confirm('Kiểm thử').then((v) => { window.__confirmed = v; });
});

async function phone(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await stub(page);
  await page.route('**/public/voma-categories*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATS) }));
  const walk = w === 390;
  try {
    await open(page, '/catalog', tatLink(page));
    await min44(w, 'wordmark', wordmark(page));
    await min44(w, "nav 'Tất'", tatLink(page));
    await noScroll(page, w, 'catalog');

    await showAlert(page);
    await popupBtn(page, 'Đồng ý').waitFor();
    await min44(w, "popup 'Đồng ý' (alert)", popupBtn(page, 'Đồng ý'));
    await noScroll(page, w, 'alert');
    if (walk) {
      await popupBtn(page, 'Đồng ý').tap();
      await page.getByRole('alertdialog').waitFor({ state: 'detached' });
      check(`w=${w} tap 'Đồng ý' closes alert`, true);
    } else await page.evaluate(() => document.querySelector('[role=alertdialog] button').click());

    await showConfirm(page);
    await popupBtn(page, 'Hủy').waitFor();
    await min44(w, "popup 'Hủy' (confirm)", popupBtn(page, 'Hủy'));
    await min44(w, "popup 'Đồng ý' (confirm)", popupBtn(page, 'Đồng ý'));
    await popupBtn(page, 'Hủy').tap();
    await page.getByRole('alertdialog').waitFor({ state: 'detached' });
    if (walk) check(`w=${w} tap 'Hủy' resolves false`, (await page.evaluate(() => window.__confirmed)) === false, 'confirm did not resolve false');

    if (walk) {
      await tatLink(page).tap();
      await page.waitForURL(/category=VC001999/);
      check(`w=${w} tap 'Tất' opens category`, true);
      await wordmark(page).tap({ position: { x: 40, y: 2 } }); // top edge: outside the old 26px box
      await page.waitForURL(`${BASE}/`);
      check(`w=${w} tap wordmark top edge goes home`, true);
    }

    await open(page, `/product/${RACKET}`, arrow(page, 'phải'));
    for (const [name, dir] of [['left', 'trái'], ['right', 'phải']]) {
      await min44(w, `arrow ${name}`, arrow(page, dir));
      const c = await size(arrow(page, dir).locator('svg'));
      report(`w=${w} arrow ${name} circle`, c.w !== CIRCLE || c.h !== CIRCLE ? [`${c.w}x${c.h} != ${CIRCLE}x${CIRCLE}`] : [], `${c.w}x${c.h}`);
    }
    await min44(w, "bar 'Mua ngay'", barButton(page));
    report(`w=${w} bar label`, (await barButton(page).textContent()).trim() === 'Mua ngay' ? [] : ['not Mua ngay']);
    await noScroll(page, w, 'pdp');

    if (walk) {
      const rail = page.locator('.scrollbar-hide.touch-pan-x');
      // smooth scroll + snap: read scrollLeft once it has settled; snap-start stops the way back at the first thumbnail, not at 0
      const settled = async () => { for (let prev = -1; ;) { const x = await rail.evaluate((el) => el.scrollLeft); if (x === prev) return x; prev = x; await page.waitForTimeout(300); } };
      const start = await settled();
      await arrow(page, 'phải').tap({ position: { x: 2, y: 2 } }); // corner: outside the 30px circle
      await page.waitForTimeout(300);
      const moved = await settled();
      check(`w=${w} tap right arrow corner scrolls`, moved > start, `scrollLeft ${start} -> ${moved}`);
      await arrow(page, 'trái').tap({ position: { x: 2, y: 2 } });
      await page.waitForTimeout(300);
      const back = await settled();
      check(`w=${w} tap left arrow corner scrolls back`, back < moved, `scrollLeft ${moved} -> ${back}`);
      // the left arrow's box overlaps the first thumbnail by a few px: the thumbnail's centre must still take the tap (tap fails if the arrow is on top)
      const thumbs = rail.locator('button');
      await thumbs.nth(1).tap();
      await page.waitForTimeout(300);
      await settled();
      await thumbs.nth(0).tap({ timeout: 5000 });
      check(`w=${w} first thumbnail still tappable`, /border-brand-primary/.test(await thumbs.nth(0).getAttribute('class')), 'first thumbnail not selected');
    }

    await open(page, `/product/${SOLD_OUT}`, barButton(page));
    await page.getByText('Hết hàng').first().waitFor();
    await min44(w, "bar 'Hết hàng'", barButton(page));
    report(`w=${w} bar label`, (await barButton(page).textContent()).trim() === 'Hết hàng' ? [] : ['not Hết hàng']);

    if (walk) {
      await open(page, `/product/${SIMPLE}`, barButton(page));
      await barButton(page).tap({ position: { x: 5, y: 1 } }); // top edge: outside the old 38px box
      await page.locator('[data-testid=mobile-sticky-bar]').getByText('Giỏ (1)').waitFor({ state: 'attached', timeout: 5000 });
      check(`w=${w} tap 'Mua ngay' top edge adds to cart`, true);
    }
  } catch (e) {
    report(`w=${w} run`, [e.message.split('\n')[0]]);
  } finally {
    await ctx.close();
  }
}

// 768px is out of scope: every size here is the pre-STOR-166 one, so a token that leaks past max-md goes red.
async function tablet(browser) {
  const w = 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: 1024 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await stub(page);
  await page.route('**/public/voma-categories*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATS) }));
  try {
    await open(page, '/catalog', tatLink(page));
    const t = await size(tatLink(page));
    report(`w=${w} nav 'Tất' keeps text width`, t.w >= TAP ? [`${t.w}px wide`] : [], `${t.w}x${t.h}`);
    await showAlert(page);
    const p = await size(popupBtn(page, 'Đồng ý'));
    report(`w=${w} popup button unchanged`, p.h >= TAP ? [`${p.h}px tall`] : [], `${p.w}x${p.h}`);
    await open(page, `/product/${RACKET}`, arrow(page, 'phải'));
    const a = await size(arrow(page, 'phải'));
    report(`w=${w} arrow unchanged`, a.w !== TABLET_ARROW || a.h !== TABLET_ARROW ? [`${a.w}x${a.h}`] : [], `${a.w}x${a.h}`);
    await noScroll(page, w, 'pdp');
  } catch (e) {
    report(`w=${w} run`, [e.message.split('\n')[0]]);
  } finally {
    await ctx.close();
  }
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
    for (const [w, h] of PHONES) await phone(browser, w, h);
    await tablet(browser);
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
