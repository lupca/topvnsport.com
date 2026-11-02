// STOR-089 measurement on built dist (harness running: PORT=4389 npx tsx scripts/stor072-walk/harness.ts).
// `node measure.cjs baseline` (on main) -> before-390.json (computed style + bbox of every element in
// #topvnsport-header and [data-testid=cate-select-bar] on /, /catalog, /stores at 390x844; unrendered = tag+text).
// `node measure.cjs` -> design-1440.json (public/design at 1440), after-1440.json (live /), fixture-1440.json
// (live / with a design-equivalent category fixture), after-390.json + diff vs before-390.json. Exit 1 on any FAIL.
// Usage: PLAYWRIGHT=<playwright path> PORT=4389 node docs/stor089-shots/measure.cjs [baseline]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const DIR = 'docs/stor089-shots';
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 4389);
const PROPS = ['display', 'position', 'width', 'height', 'maxWidth', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
  'borderLeftWidth', 'borderTopColor', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'color', 'backgroundColor', 'boxShadow', 'opacity', 'gap', 'flexWrap', 'flexDirection', 'justifyContent', 'alignItems',
  'textTransform', 'overflowX', 'minHeight'];
let fails = 0;
const check = (label, got, want) => {
  const ok = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + (typeof want === 'function' ? want.toString() : JSON.stringify(want))}`);
};

// Every element under the given roots, in document order: tag, text (own text nodes), bbox, computed PROPS.
const dumpTree = (page, roots) => page.evaluate(({ roots, PROPS }) => roots.map((sel) => {
  const root = document.querySelector(sel);
  if (!root) return { sel, missing: true };
  return { sel, nodes: [root, ...root.querySelectorAll('*')].map((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    // Not rendered at this viewport (display:none self/ancestor, e.g. hidden md:flex): structure + text only.
    if (el.getClientRects().length === 0) return { tag: el.tagName, text: own, rendered: false };
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { tag: el.tagName, text: own, placeholder: el.getAttribute('placeholder'), box: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100),
      style: Object.fromEntries(PROPS.map((p) => [p, cs[p]])) };
  }) };
}), { roots, PROPS });

// Computed PROPS + bbox for named selectors.
const pick = (page, map) => page.evaluate(({ map, PROPS }) => Object.fromEntries(Object.entries(map).map(([k, sel]) => {
  const el = document.querySelector(sel);
  if (!el) return [k, null];
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return [k, { x: r.x, y: r.y, w: r.width, h: r.height, text: el.textContent.trim().replace(/\s+/g, ' '), placeholder: el.getAttribute('placeholder'),
    ...Object.fromEntries(PROPS.map((p) => [p, cs[p]])) }];
})), { map, PROPS });

const DESIGN = {
  topbar: '#panel-desktop .yonex-topbar', topbarInner: '#panel-desktop .yonex-topbar-inner', pill: '#panel-desktop .o2o-live-pill',
  row: '#panel-desktop .yonex-header-main', mark: '#panel-desktop .brand-logo-mark', wordmark: '#panel-desktop .brand-logo-name',
  tagline: '#panel-desktop .brand-logo-sub', searchWrap: '#panel-desktop .header-search-wrap', searchBox: '#panel-desktop .header-search',
  input: '#panel-desktop .header-search input', searchBtn: '#panel-desktop .header-search-btn', bar: '#desktop-cate-pills',
  chipActive: '#desktop-cate-pills button.active', chip: '#desktop-cate-pills button:not(.active)', count: '#desktop-cate-pills button .count',
};
const LIVE = {
  topbar: '[data-testid=topbar]', topbarInner: '[data-testid=topbar-inner]', pill: '[data-testid=topbar] button',
  row: '[data-testid=header-main-row]', mark: '[data-testid=header-main-row] .rounded-\\[6px\\]', wordmark: '[data-testid=brand-wordmark]',
  tagline: '[data-testid=brand-tagline]', searchWrap: '#search-wrap', searchBox: '[data-testid=search-box]',
  input: '#search-wrap input', searchBtn: '[data-testid=search-box] > button:last-child', bar: '[data-testid=cate-select-bar]',
  chipActive: '[data-testid=cate-select-bar] button[aria-selected=true]', chip: '[data-testid=cate-select-bar] button[aria-selected=false]',
  count: '[data-testid=cate-select-bar] button span:last-child',
};
// Style groups compared design vs live (same keys as DESIGN/LIVE).
const COMPARE = {
  topbar: ['fontSize', 'fontWeight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'],
  topbarInner: ['maxWidth', 'x', 'w'],
  pill: ['x'],
  row: ['maxWidth', 'x', 'w', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'gap'],
  mark: ['x', 'w', 'h'],
  wordmark: ['fontSize', 'fontWeight', 'letterSpacing', 'color', 'lineHeight'],
  tagline: ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'color', 'marginTop', 'textTransform'],
  searchWrap: ['w', 'maxWidth'],
  searchBox: ['h', 'borderTopWidth', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius'],
  input: ['fontSize', 'fontWeight'],
  searchBtn: ['fontSize', 'fontWeight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'],
  bar: ['maxWidth', 'paddingTop', 'paddingLeft', 'gap', 'backgroundColor', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'flexWrap'],
  chipActive: ['fontFamily', 'fontSize', 'fontWeight', 'minHeight', 'paddingTop', 'paddingLeft', 'gap', 'borderRadius', 'backgroundColor', 'color', 'boxShadow'],
  chip: ['fontFamily', 'fontSize', 'fontWeight', 'minHeight', 'paddingTop', 'paddingLeft', 'gap', 'borderRadius', 'backgroundColor', 'color'],
  count: ['fontFamily', 'fontSize', 'fontWeight', 'opacity'],
};
const PLACEHOLDER = 'Tìm vợt Yonex, Lining, cước đan, giày cầu lông...';
const PILL = 'Showroom Hà Nội · Đan vợt lấy ngay 30p';

// Design-equivalent fixture: the design's five category labels, in-stock 8/1/1/1/1 (ALL = 12).
const FIX_CATS = [['vot', 'Vợt cầu lông (Rackets)', 8], ['cuoc', 'Cước đan vợt (Strings)', 1], ['giay', 'Giày cầu lông (Shoes)', 1],
  ['ao', 'Trang phục (Wear)', 1], ['bao', 'Bao vợt & Phụ kiện', 1]];
const fixture = async (page) => {
  const cats = FIX_CATS.map(([code, name], i) => ({ id: i + 1, code, name, display_name: name }));
  const items = []; const stock = {};
  FIX_CATS.forEach(([, , n], ci) => { for (let k = 0; k < n; k++) { const id = 1000 + ci * 100 + k; items.push({ id, name: `SP ${id}`, voma_category_id: ci + 1, variants: [{ id: id * 10, price: 500000, stock: 3, sku_code: `F${id}` }] }); stock[`F${id}`] = 3; } });
  await page.route('**/api/pmi/public/voma-categories*', (r) => r.fulfill({ json: cats }));
  await page.route('**/api/pmi/public/products?*', (r) => r.fulfill({ json: { items, total: items.length, page: 1, limit: 100, pages: 1 } }));
  await page.route('**/api/wms/public/stock*', (r) => r.fulfill({ json: { stock } }));
};

const ROUTES_390 = ['/', '/catalog', '/stores'];
const dump390 = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const out = {};
  for (const r of ROUTES_390) {
    await page.goto(BASE + r); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
    out[r] = await dumpTree(page, ['#topvnsport-header', '[data-testid=cate-select-bar]']);
  }
  await page.close();
  return out;
};

const diff = (a, b, path = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diff(a[k], b[k], `${path}/${k}`));
  }
  return [`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`];
};

// Same rendering, different spelling: rounded-full computes calc(infinity) vs the design's 999px; Tailwind
// prefixes transparent ring layers to box-shadow; design --font-sans differs only after "Be Vietnam Pro".
const norm = (p, v) => {
  if (typeof v !== 'string') return v;
  if (p === 'borderRadius' && parseFloat(v) >= 999) return 'pill';
  if (p === 'boxShadow') return v.split(/,(?![^(]*\))/).map((s) => s.trim()).filter((s) => !s.startsWith('rgba(0, 0, 0, 0) ')).join(', ');
  if (p === 'fontFamily') return v.split(',')[0];
  return v;
};

(async () => {
  const browser = await chromium.launch();
  if (process.argv[2] === 'baseline') {
    fs.writeFileSync(`${DIR}/before-390.json`, JSON.stringify(await dump390(browser), null, 1));
    console.log('wrote before-390.json');
    return browser.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/design/index.html'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
  const design = await pick(page, DESIGN);
  fs.writeFileSync(`${DIR}/design-1440.json`, JSON.stringify(design, null, 1));
  await page.screenshot({ path: `${DIR}/design-1440.png`, clip: { x: 0, y: 0, width: 1440, height: 400 } });

  await page.goto(BASE + '/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500);
  const live = await pick(page, LIVE);
  const extra = await page.evaluate(() => ({
    liveDots: document.querySelectorAll('#topvnsport-header .live-dot').length,
    dangMo: document.querySelector('#topvnsport-header').textContent.includes('Đang mở cửa'),
  }));
  fs.writeFileSync(`${DIR}/after-1440.json`, JSON.stringify({ ...live, ...extra }, null, 1));
  await page.screenshot({ path: `${DIR}/after-1440.png`, clip: { x: 0, y: 0, width: 1440, height: 400 } });

  console.log('--- 1440x900 acceptance values (live /)');
  check('pill x', live.pill.x, 80);
  check('pill text', live.pill.text, PILL);
  check('topbar inner width', live.topbarInner.w, 1280);
  check('topbar font-size', live.topbar.fontSize, '12px');
  check('topbar padding-top', live.topbar.paddingTop, '8px');
  check('topbar padding-bottom', live.topbar.paddingBottom, '8px');
  check('header-main-row x', live.row.x, 80);
  check('header-main-row width', live.row.w, 1280);
  check('TVN mark x', live.mark.x, 104);
  check('wordmark font-size', live.wordmark.fontSize, '24px');
  check('wordmark font-weight', live.wordmark.fontWeight, '900');
  check('wordmark letter-spacing', live.wordmark.letterSpacing, '-0.72px');
  check('wordmark colour', live.wordmark.color, 'rgb(0, 0, 0)');
  check('tagline font-family JetBrains Mono', live.tagline.fontFamily, (v) => /^"?JetBrains Mono/.test(v));
  check('tagline font-size', live.tagline.fontSize, '10.5px');
  check('tagline font-weight', live.tagline.fontWeight, '700');
  check('tagline letter-spacing', live.tagline.letterSpacing, '1.26px');
  check('tagline margin-top', live.tagline.marginTop, '4px');
  check('search-wrap width', live.searchWrap.w, 540);
  check('search pill height', live.searchBox.h, 45);
  check('search input font-size', live.input.fontSize, '14px');
  check('placeholder unchanged', live.input.placeholder, PLACEHOLDER);
  check('no .live-dot', extra.liveDots, 0);
  check('no "Đang mở cửa"', extra.dangMo, false);

  console.log('--- live / vs design at 1440 (computed styles)');
  for (const [k, props] of Object.entries(COMPARE)) for (const p of props) check(`${k}.${p}`, norm(p, live[k] && live[k][p]), norm(p, design[k] && design[k][p]));

  console.log('--- design-equivalent category fixture at 1440');
  const fx = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await fixture(fx);
  await fx.goto(BASE + '/'); await fx.waitForSelector('[data-testid=cate-pill-bao]'); await fx.waitForTimeout(300);
  const fixed = await pick(fx, LIVE);
  fs.writeFileSync(`${DIR}/fixture-1440.json`, JSON.stringify(fixed, null, 1));
  await fx.locator('[data-testid=cate-select-bar]').screenshot({ path: `${DIR}/fixture-1440-chips.png` });
  check('fixture cate-select-bar width', fixed.bar.w, design.bar.w);
  check('fixture cate-select-bar height', fixed.bar.h, design.bar.h);
  check('fixture bar = 1160x106', [fixed.bar.w, fixed.bar.h], [1160, 106]);
  check('fixture chip height', fixed.chip.h, design.chip.h);
  await fx.close();

  console.log('--- placeholder on every route at 1440');
  for (const r of ['/', '/catalog', '/stores']) {
    await page.goto(BASE + r); await page.waitForLoadState('networkidle');
    check(`placeholder ${r}`, await page.locator('#search-wrap input').getAttribute('placeholder'), PLACEHOLDER);
  }

  console.log('--- 390x844 header dump vs before-390.json (main)');
  const after = await dump390(browser);
  fs.writeFileSync(`${DIR}/after-390.json`, JSON.stringify(after, null, 1));
  const before = JSON.parse(fs.readFileSync(`${DIR}/before-390.json`, 'utf8'));
  for (const r of ROUTES_390) {
    const d = diff(before[r], after[r]);
    d.slice(0, 20).forEach((l) => console.log('   ', r, l));
    check(`390 ${r} differences`, d.length, 0);
  }
  await browser.close();
  console.log(fails ? `${fails} FAIL` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
