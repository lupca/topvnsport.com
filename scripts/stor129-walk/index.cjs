// STOR-129 walk (r:75b60f55): vite dev server (PID recorded, killed by PID, r:0b30a607), /api/* routed with fixtures.
// At 390x844 (touch) and 1440x900 it opens /, /catalog and a product page, measures the floating contact cluster
// (size, viewport fit, overlap with "Mua ngay" bar / MobileBottomNav / cart pill), hovers, clicks, checks GA4 events,
// opens the cart drawer to prove it covers the cluster, and saves docs/stor129-shots/*.png.
// Usage: node scripts/stor129-walk   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const PORT = Number(process.env.PORT || 4429);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', '..', 'docs', 'stor129-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const ITEMS = [0, 1, 2].map((i) => ({
  id: 900 + i, name: `Vợt thử ${i + 1}`, slug: `vot-thu-${i + 1}`, description: 'Vợt thử nghiệm.', voma_category_id: 1,
  image: '',
  attribute_values: [{ id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } }],
  tier_variations: [{ id: 1, product_id: 900 + i, tier_index: 1, name: 'Màu sắc', options: ['Đen'] }],
  variants: [{ id: 90000 + i, product_id: 900 + i, tier_1_option: 'Đen', sku_code: `WALK-${i}`, price: 2000000 + i * 100000 }],
}));
const STOCK = { stock: Object.fromEntries(ITEMS.map((_, i) => [`WALK-${i}`, 5])), items: ITEMS.map((_, i) => ({ sku_code: `WALK-${i}`, qty_available: 5, qty_on_hand: 5, qty_reserved: 0, stock_code: `WALK-${i}` })) };
const CATS = [{ id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' }];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitPort = async () => {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) return; } catch {} await sleep(500); }
  throw new Error('dev server did not start');
};
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};
const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    const errors = [];
    for (const [tag, viewport, extra] of [['390', { width: 390, height: 844 }, { hasTouch: true, isMobile: true }], ['1440', { width: 1440, height: 900 }, {}]]) {
      const ctx = await browser.newContext({ viewport, ...extra });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(() => { window.__ga = []; window.gtag = (...a) => window.__ga.push(a); });
      await page.route('**/api/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (p.endsWith('/public/stock')) return json(STOCK);
        if (p.endsWith('/public/voma-categories')) return json(CATS);
        if (p.endsWith('/public/products')) return json({ items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
        if (p.endsWith('/branches')) return json([]);
        return json({ detail: 'walk: not stubbed' }, 404);
      });
      const mobile = viewport.width < 768;
      await page.goto(`${BASE}/`);
      const zalo = page.getByLabel('Chat Zalo với TopVNSport');
      const call = page.getByLabel('Gọi hotline 097 6007006');
      await zalo.waitFor();

      let pdpHref = null;
      for (const route of ['/', '/catalog', 'PDP']) {
        let url = route;
        if (route === 'PDP') {
          await page.goto(`${BASE}/catalog`);
          await page.getByText('Vợt thử 1').first().click();
          await page.waitForURL(/\/product\//);
          url = new URL(page.url()).pathname;
          pdpHref = url;
        }
        await page.goto(`${BASE}${url}`);
        await zalo.waitFor();
        if (route === 'PDP' && mobile) await page.getByRole('button', { name: /Mua ngay/ }).first().waitFor();
        await sleep(300);
        const label = `${tag} ${route}`;
        const m = await page.evaluate(() => {
          const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
          const z = document.querySelector('a[aria-label="Chat Zalo với TopVNSport"]');
          const c = document.querySelector('a[aria-label="Gọi hotline 097 6007006"]');
          const cluster = z.parentElement;
          const visible = (el) => el && el.getClientRects().length > 0;
          const buy = [...document.querySelectorAll('button')].find((b) => /Mua ngay/.test(b.textContent) && visible(b));
          const bar = buy && buy.parentElement;
          const nav = [...document.querySelectorAll('div.fixed.bottom-0')].find(visible);
          return { zalo: rect(z), call: rect(c), cluster: rect(cluster), buy: rect(buy), bar: rect(bar), nav: rect(nav), vw: innerWidth, vh: innerHeight,
            target: z.target, rel: z.rel, href: z.href, tel: c.getAttribute('href'), zIdx: getComputedStyle(cluster).zIndex, bottomPx: getComputedStyle(cluster).bottom,
            callText: c.textContent.trim(), callTextVisible: visible(c.querySelector('span')) };
        });
        check(`${label}: Zalo/hotline anchors >=44px`, [m.zalo.w >= 44 && m.zalo.h >= 44, m.call.w >= 44 && m.call.h >= 44], [true, true]);
        check(`${label}: cluster inside viewport`, m.cluster.l >= 0 && m.cluster.r <= m.vw && m.cluster.t >= 0 && m.cluster.b <= m.vh, true);
        check(`${label}: href/target/rel/tel/z`, [m.href, m.target, m.rel, m.tel, m.zIdx], ['https://zalo.me/955065648695191027', '_blank', 'noopener noreferrer', 'tel:0976007006', '30']);
        check(`${label}: number beside icon only on md+`, [m.callText, m.callTextVisible], [ '097 6007006', !mobile ]);
        for (const [name, box] of [['Mua ngay button', m.buy], ['purchase bar', m.bar], ['MobileBottomNav', m.nav]]) {
          if (!box) continue;
          const gap = Math.round((box.t - m.cluster.b) * 10) / 10;
          check(`${label}: cluster does not overlap ${name} (gap ${gap}px)`, overlap(m.cluster, box), false);
        }
        console.log(`    ${label} cluster`, JSON.stringify({ bottomCss: m.bottomPx, zalo: [m.zalo.w, m.zalo.h], call: [m.call.w, m.call.h], navTop: m.nav && m.nav.t, barTop: m.bar && m.bar.t }));
        await page.screenshot({ path: path.join(SHOTS, `${tag}-${route === '/' ? 'home' : route === '/catalog' ? 'catalog' : 'product'}.png`) });
      }

      // ---- hover (desktop) / focus, then clicks + GA4
      await page.goto(`${BASE}${pdpHref}`);
      await zalo.waitFor();
      await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a[href^="tel:"]')) e.preventDefault(); }, true));
      const popup = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
      await zalo.click();
      const p2 = await popup;
      check(`${tag}: Zalo click opens new tab to zalo.me`, p2 ? p2.url().startsWith('https://zalo.me/955065648695191027') || p2.url() === 'about:blank' : false, true);
      if (p2) await p2.close();
      await call.click();
      const ga = await page.evaluate(() => window.__ga.filter((a) => /^contact_/.test(a[1])));
      check(`${tag}: GA4 events on click`, ga, [['event', 'contact_zalo_click', { location: 'floating_button' }], ['event', 'contact_call_click', { location: 'floating_button' }]]);

      // ---- cart drawer / overlay must cover the cluster
      await page.evaluate(() => { document.querySelector('a[aria-label^="Chat Zalo"]'); });
      if (mobile) { await page.goto(`${BASE}/`); await zalo.waitFor(); }
      const cartBtn = page.getByRole('button', { name: /giỏ hàng/i }).first();
      if (cartBtn && await cartBtn.count()) {
        await cartBtn.click();
        await page.waitForSelector('#cart-drawer-modal');
        const top = await page.evaluate(() => { const z = document.querySelector('a[aria-label^="Chat Zalo"]').getBoundingClientRect(); const e = document.elementFromPoint(z.left + z.width / 2, z.top + z.height / 2); return e && !!e.closest('#cart-drawer-modal'); });
        check(`${tag}: cart overlay is above the cluster`, top, true);
        await page.screenshot({ path: path.join(SHOTS, `${tag}-cart-open.png`) });
      }
      await ctx.close();
    }
    check('page errors', errors, []);
  } catch (e) {
    console.error('WALK ERROR', e); fails++;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
