// STOR-100 measurement (390 showroom strip on '/' vs design Mobile tab).
// `PORT=4389 node docs/stor100-shots/measure.cjs baseline` (on main) -> before.json: full computed-style tree of
//   [data-testid=topbar] at 1440 on '/', #topvnsport-header at 390 on a PDP and on /checkout/success.
// `PORT=4389 node docs/stor100-shots/measure.cjs` (on branch) -> design-390.json, after.json, after-390.png;
//   strip vs design, no live-dot / 'mở cửa', and a node diff of the same three trees vs before.json. Exit 1 on FAIL.
// Starts node_modules/.bin/vite on PORT if nothing listens there and kills that PID on exit (r:0b30a607).
let chromium;
try {
  chromium = require(process.env.PLAYWRIGHT || 'playwright').chromium;
} catch (e) {
  chromium = require('/home/pny/.npm/_npx/e41f203b7505f1fb/node_modules/playwright').chromium;
}
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const DIR = path.resolve(__dirname);
const PORT = Number(process.env.PORT || 4389);
const BASE = `http://127.0.0.1:${PORT}`;
const PROPS = ['display', 'position', 'width', 'height', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderBottomWidth', 'borderRadius',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'textAlign',
  'gap', 'flexWrap', 'justifyContent', 'alignItems'];
const STRIP_TEXT = 'Đan vợt chuẩn quốc tế 30p';
let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};

const dumpTree = (page, sel) => page.evaluate(({ sel, PROPS }) => {
  const root = document.querySelector(sel);
  if (!root) return { sel, missing: true };
  return { sel, nodes: [root, ...root.querySelectorAll('*')].map((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (el.getClientRects().length === 0) return { tag: el.tagName, text: own, rendered: false };
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { tag: el.tagName, text: own, box: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100),
      style: Object.fromEntries(PROPS.map((p) => [p, cs[p]])) };
  }) };
}, { sel, PROPS });

const pick = (page, sel) => page.evaluate(({ sel, PROPS }) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return { h: r.height, text: el.textContent.trim().replace(/\s+/g, ' '), ...Object.fromEntries(PROPS.map((p) => [p, cs[p]])) };
}, { sel, PROPS });

const go = async (page, url) => { await page.goto(BASE + url); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); };

const trees = async (browser) => {
  const out = {};
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await go(desk, '/');
  out['1440 / topbar'] = await dumpTree(desk, '[data-testid=topbar]');
  await desk.close();
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await go(m, '/');
  // Real slug if the catalogue loaded; header markup only depends on the /product/ path either way.
  const pdp = (await m.evaluate(() => { const a = document.querySelector('a[href^="/product/"]'); return a && a.getAttribute('href'); })) || '/product/yonex-astrox-99-pro';
  await go(m, pdp);
  out['390 PDP header'] = await dumpTree(m, '#topvnsport-header');
  out['390 PDP header'].url = pdp;
  await go(m, '/checkout/success');
  out['390 /checkout/success header'] = await dumpTree(m, '#topvnsport-header');
  await m.close();
  return out;
};

const diff = (a, b, p = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diff(a[k], b[k], `${p}/${k}`));
  }
  return [`${p}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`];
};

const isServerUp = () => new Promise((resolve) => {
  const req = http.get(BASE + '/', (res) => resolve(res.statusCode < 500));
  req.on('error', () => resolve(false));
  req.setTimeout(500, () => { req.destroy(); resolve(false); });
});

(async () => {
  let server = null;
  if (!(await isServerUp())) {
    console.log(`Starting vite dev server on ${PORT}...`);
    server = spawn(path.resolve(DIR, '../../node_modules/.bin/vite'), [`--port=${PORT}`, '--host=127.0.0.1', '--strictPort'], { stdio: 'ignore' });
    console.log(`server pid ${server.pid}`);
    for (let i = 0; i < 80 && !(await isServerUp()); i++) await new Promise((r) => setTimeout(r, 250));
  }
  const stop = () => { if (server && server.pid) try { process.kill(server.pid); } catch (e) {} };
  try {
    const browser = await chromium.launch();
    if (process.argv[2] === 'baseline') {
      fs.writeFileSync(`${DIR}/before.json`, JSON.stringify(await trees(browser), null, 1));
      console.log('wrote before.json');
      await browser.close(); stop(); return;
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await go(page, '/design/index.html');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button, [role=tab]')].find((x) => /Mobile/.test(x.textContent)); if (b) b.click(); });
    await page.waitForTimeout(300);
    const design = await pick(page, '#panel-mobile .phone-frame > div:nth-child(2)');
    fs.writeFileSync(`${DIR}/design-390.json`, JSON.stringify(design, null, 1));

    await go(page, '/');
    const strip = await pick(page, '#topvnsport-header [data-testid=mobile-showroom-strip]');
    const header = await pick(page, '#topvnsport-header');
    const extra = await page.evaluate(() => {
      const h = document.querySelector('#topvnsport-header');
      return { liveDots: h.querySelectorAll('.live-dot').length, moCua: h.textContent.includes('mở cửa') };
    });
    fs.writeFileSync(`${DIR}/after.json`, JSON.stringify({ strip, header, ...extra }, null, 1));
    await page.screenshot({ path: `${DIR}/after-390.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });

    console.log('--- 390x844 / strip vs design Mobile tab strip');
    check('strip in #topvnsport-header', !!strip, true);
    check('strip text', strip && strip.text, STRIP_TEXT);
    check('strip padding', strip && [strip.paddingTop, strip.paddingRight, strip.paddingBottom, strip.paddingLeft].join(' '), '7px 10px 7px 10px');
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontSize', 'fontWeight', 'color', 'backgroundColor', 'textAlign']) {
      check(`strip ${p}`, strip && strip[p], design && design[p]);
    }
    check('no .live-dot in header', extra.liveDots, 0);
    check("no 'mở cửa' in header", extra.moCua, false);
    console.log(`INFO strip height ${strip && strip.h}px (design ${design && design.h}px, design line-height ${design && design.lineHeight}, live ${strip && strip.lineHeight})`);
    console.log(`INFO #topvnsport-header height at 390 on / = ${header && header.h}px`);
    await page.close();

    console.log('--- unchanged trees vs before.json (main)');
    const after = await trees(browser);
    const before = JSON.parse(fs.readFileSync(`${DIR}/before.json`, 'utf8'));
    for (const k of Object.keys(before)) {
      const d = diff(before[k], after[k]);
      d.slice(0, 20).forEach((l) => console.log('   ', k, l));
      check(`${k} node diff`, d.length, 0);
    }
    await browser.close();
    console.log(fails ? `${fails} FAIL` : 'ALL PASS');
    stop();
    process.exit(fails ? 1 : 0);
  } catch (err) {
    console.error(err);
    stop();
    process.exit(1);
  }
})();
