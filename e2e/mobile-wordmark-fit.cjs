// STOR-160 (goal 2c881ad4, MOB-A c4cd5fa6): on non-home pages the TOPVNSPORT wordmark in the mobile sticky bar must be
// whole (scrollWidth <= clientWidth) at 360-430px, with the bar one row <=62px and menu/cart >=44x44, 'Đan cước' >=44px tall.
// Below 480px the bar must also use the compact padding/gap (max-[480px] tokens).
// Sweep: widths x cart count (0, 99 seeded via localStorage 'cart_items') x routes (catalog, pdp-simple).
// Fixtures/routes/waitPort come from e2e/mobile-audit/audit.cjs. Vite --strictPort, killed by its recorded PID (r:0b30a607).
//   node e2e/mobile-wordmark-fit.cjs      one PASS/FAIL line per route/width/cart, exit 1 on any failure. PORT (default 4431).
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4431';
const { stub, ROUTES, waitPort, PRODUCTS } = require('./mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const WIDTHS = [360, 390, 399, 412, 414, 430, 431, 479, 480];
const CARTS = [0, 99];
const IDS = ['catalog', 'pdp-simple'];
const MAX_BAR = 62;
const TAP = 44;

function cartSeed(qty) {
  if (!qty) return '[]';
  const p = PRODUCTS.find((x) => x.slug === 'san-pham-audit-8');
  const v = p.variants[0];
  return JSON.stringify([{ id: `${p.id}-${v.id}`, productId: String(p.id), skuCode: v.sku_code, name: p.name, brand: '', image: '', price: v.price, selectedWeight: '', selectedColor: '', quantity: qty }]);
}

async function measure(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid=mobile-sticky-bar]');
    if (!bar) return null;
    const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, top: r.top, bottom: r.bottom }; };
    const wm = bar.querySelector('img[alt="TopVNSport Logo"]').parentElement;
    const btns = [...bar.querySelectorAll(':scope > button')];
    const menu = btns.find((b) => b.getAttribute('aria-label') === 'Open mobile menu');
    const dan = btns.find((b) => b.textContent.trim() === 'Đan cước');
    const cart = btns.find((b) => b.getAttribute('aria-label') === 'Giỏ hàng');
    const kids = [...bar.children].map(box);
    // one row: every child's vertical span overlaps every other's (no child sits wholly below another)
    const oneRow = kids.every((a) => kids.every((b) => a.top < b.bottom && b.top < a.bottom));
    const cs = getComputedStyle(bar), rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { padL: parseFloat(cs.paddingLeft) / rem, gap: parseFloat(cs.columnGap) / rem, sw: wm.scrollWidth, cw: wm.clientWidth, bar: box(bar).h, oneRow, menu: box(menu), dan: box(dan), cart: box(cart), cartText: cart.textContent,
      docSw: document.documentElement.scrollWidth };
  });
}

async function main() {
  const routes = IDS.map((id) => ROUTES.find((r) => r.id === id));
  const taken = await new Promise((res) => net.connect(+process.env.PORT, '127.0.0.1').once('connect', function () { this.destroy(); res(true); }).once('error', () => res(false)));
  if (taken) { console.log(`ERROR port ${process.env.PORT} already taken; set PORT to a free port`); process.exitCode = 1; return; }
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  const exited = new Promise((_, rej) => server.once('exit', (code) => rej(new Error(`dev server exited early (code ${code}); port ${process.env.PORT} taken?`))));
  exited.catch(() => {});
  let browser, failures = 0;
  try {
    await Promise.race([waitPort(), exited]);
    const owner = execFileSync('ss', ['-ltnpH', `sport = :${process.env.PORT}`], { encoding: 'utf8' });
    if (server.exitCode !== null || !owner.includes(`pid=${server.pid},`)) throw new Error(`port ${process.env.PORT} is not served by dev server pid ${server.pid}`);
    browser = await chromium.launch();
    for (const route of routes) for (const cart of CARTS) for (const w of WIDTHS) {
      const label = `${route.id.padEnd(10)} w=${w} cart=${String(cart).padEnd(2)}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      try {
        await page.addInitScript((seed) => { localStorage.setItem('cart_items', seed); }, cartSeed(cart));
        await stub(page);
        // production draws the wordmark in Google Fonts Montserrat 800 (src/index.css @import); stub() aborts every
        // non-local request, which would measure a narrower fallback font. Routes registered later win in Playwright.
        await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.continue());
        await route.go(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        // fonts.check() is true when nothing needs loading, so force the load and require a face with status 'loaded'
        const font = await page.evaluate(async () => {
          // load() resolves with the faces covering these glyphs (the latin subset); a failed file rejects or leaves one unloaded
          let faces;
          try { faces = await document.fonts.load('800 18px Montserrat', 'TOPVNSPORT'); } catch (e) { return false; }
          if (!faces.length || faces.some((f) => f.status !== 'loaded')) return false;
          await document.fonts.ready;
          const loaded = [...document.fonts].some((f) => {
            if (!/Montserrat/i.test(f.family) || f.status !== 'loaded') return false;
            const [lo, hi = lo] = String(f.weight).split(/\s+/).map(Number); // '800' or variable range '100 900'
            return lo <= 800 && 800 <= hi;
          });
          const wm = document.querySelector('[data-testid=mobile-sticky-bar] img[alt="TopVNSport Logo"]').parentElement;
          return loaded && getComputedStyle(wm).fontFamily.includes('Montserrat');
        });
        if (!font) throw new Error('Montserrat 800 chưa tải (no loaded Montserrat 800 face in document.fonts; fonts.googleapis.com/gstatic.com unreachable?); refusing to measure a fallback font');
        const m = await measure(page);
        if (!m) throw new Error('[data-testid=mobile-sticky-bar] missing');
        const why = [];
        if (m.cartText !== `Giỏ (${cart})`) why.push(`cart label '${m.cartText}' != 'Giỏ (${cart})' (seed not applied)`);
        if (m.sw > m.cw) why.push(`wordmark clipped scrollWidth ${m.sw} > clientWidth ${m.cw}`);
        if (!m.oneRow) why.push('bar wraps to more than one row');
        if (m.bar > MAX_BAR) why.push(`bar ${m.bar}px > ${MAX_BAR}px`);
        if (m.menu.w < TAP || m.menu.h < TAP) why.push(`menu ${m.menu.w}x${m.menu.h} < 44`);
        if (m.cart.w < TAP || m.cart.h < TAP) why.push(`cart ${m.cart.w}x${m.cart.h} < 44`);
        if (m.dan.h < TAP) why.push(`Đan cước h=${m.dan.h} < 44`);
        // the fix: compact bar spacing (max-[480px]:px-2 = 0.5rem, gap-0.5 = 0.125rem) must apply at every width < 480 (Tailwind v4 max-[480px] = width < 480px);
        // the wordmark alone has slack (any one of the four tokens frees enough at 412), so guard the bar tokens directly
        if (w < 480 && m.padL !== 0.5) why.push(`bar padding-left ${m.padL}rem != 0.5rem (max-[480px]:px-2 not active)`);
        if (w < 480 && m.gap !== 0.125) why.push(`bar gap ${m.gap}rem != 0.125rem (max-[480px]:gap-0.5 not active)`);
        if (m.docSw > w) why.push(`page scrollWidth ${m.docSw} > ${w}`);
        if (why.length) failures++;
        console.log(`${label} ${why.length ? 'FAIL' : 'PASS'} pad=${m.padL}rem gap=${m.gap}rem wordmark=${m.sw}/${m.cw} bar=${m.bar}px menu=${m.menu.w}x${m.menu.h} dan.h=${m.dan.h} cart=${m.cart.w}x${m.cart.h}${why.length ? ' -- ' + why.join('; ') : ''}`);
      } catch (e) {
        failures++;
        console.log(`${label} FAIL error: ${e.message.split('\n')[0]}`);
      } finally {
        await ctx.close();
      }
    }
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
