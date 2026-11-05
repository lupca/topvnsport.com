// STOR-128 mobile audit (goal 2c881ad4, spec MOB-A..G). READ-ONLY on product code.
// Starts the vite dev server (--strictPort, PID recorded and killed by PID, r:0b30a607), routes every /api/** to fake
// fixtures (fake identity, OMS order creation + OTP stubbed, the real OMS is never called), then for every route state
// and width 360/390/430/768 saves a PNG and measures the page with ONE page.evaluate (r:8a172b17: numbers, not eyes).
//   node e2e/mobile-audit/audit.cjs                 full run -> docs/mobile-audit/{before/,desktop-baseline/,before.json,before.md}
//   node e2e/mobile-audit/audit.cjs --selftest      8 PASS/FAIL lines (one planted violation per measurement + clean control)
//   node e2e/mobile-audit/audit.cjs --report-only   rewrite before.md from the existing before.json
//   node e2e/mobile-audit/audit.cjs --only=cart --width=390   debug subset (writes nothing outside before/ and does not touch before.json/md)
// PLAYWRIGHT=<path to playwright(-core)> optional. PORT (default 4428). OUT (default docs/mobile-audit).
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 4428);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.OUT || path.join(ROOT, 'docs', 'mobile-audit');
const MOBILE_WIDTHS = [[360, 800], [390, 844], [430, 932], [768, 1024]];
const PHONE_WIDTHS = [360, 390, 430]; // MOB-A/B/C/E/F/G apply here; MOB-D applies at all four
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------------------------------------------------------
// 1. Measurements. ONE self-contained function, serialised into the page (selftest uses the very same function).
// ------------------------------------------------------------------------------------------------------------------
async function measureInPage(opts) {
  opts = opts || {};
  const W = window.innerWidth, H = window.innerHeight;
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const cs = (el) => getComputedStyle(el);
  const vis = (el) => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1.5 && r.height > 1.5;
  };
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    const tid = el.getAttribute('data-testid');
    if (el.id) s += '#' + el.id;
    else if (tid) s += `[data-testid=${tid}]`;
    else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s.slice(0, 80);
  };
  // samples are committed to docs: digits runs (phone numbers) and anything with @ (emails) are masked
  const txt = (el) => (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().replace(/\d{6,}/g, '#').replace(/\S*@\S*/g, '@').slice(0, 28);
  const ALL = (root) => Array.from(root.querySelectorAll('*'));

  // Scope: a full-screen fixed overlay (cart modal, mobile drawer) hides the page, so measure what is inside it.
  let root = document.body, scope = 'document';
  const overlays = ALL(document.body).filter((el) => {
    if (cs(el).position !== 'fixed' || !vis(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= W * 0.9 && r.height >= H * 0.9 && el.textContent.trim().length > 0;
  });
  if (overlays.length) { root = overlays[overlays.length - 1]; scope = 'overlay'; }

  // Line boxes of text + media/controls inside `container`: the "things you see", one rect per text line.
  const items = (container) => {
    const out = [];
    const tw = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement)) continue;
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 1 && r.height > 1) out.push(r);
    }
    for (const el of container.querySelectorAll('img,svg,input,select,textarea')) if (vis(el)) out.push(el.getBoundingClientRect());
    return out;
  };
  const rowsOf = (rects) => {
    const s = rects.slice().sort((a, b) => a.top - b.top);
    let rows = 0, cur = -Infinity;
    for (const r of s) { if (r.top >= cur - 1) { rows++; cur = r.bottom; } else cur = Math.max(cur, r.bottom); }
    return rows;
  };
  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - H);

  // ---- a: fixed/sticky region anchored to the top (height at scroll 0, then after scrolling down: height + rows)
  const topAnchored = () => ALL(root).filter((el) => {
    const s = cs(el);
    if ((s.position !== 'fixed' && s.position !== 'sticky') || !vis(el)) return false; // (computed top/bottom are resolved px, never 'auto', so anchor by geometry)
    const r = el.getBoundingClientRect();
    return !(r.width >= W * 0.9 && r.height >= H * 0.9) && r.top < H / 2;
  });
  const topH = (els) => Math.round(Math.max(0, ...els.map((e) => e.getBoundingClientRect().bottom)));
  window.scrollTo(0, 0); await raf();
  const topEls0 = scope === 'overlay' ? [] : topAnchored();
  const h0 = topH(topEls0);
  const scrollTarget = Math.min(maxScroll(), 800);
  window.scrollTo(0, scrollTarget); await raf(); await raf();
  const topEls1 = scope === 'overlay' ? [] : topAnchored();
  const a_top_fixed = {
    h0, hScrolled: topH(topEls1), scrolledBy: scrollTarget,
    rowsScrolled: rowsOf(topEls1.flatMap(items).filter((r) => r.bottom > 0)),
  };

  // ---- b: horizontal overflow
  const de = document.documentElement;
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) {
      const o = cs(p).overflowX;
      if (o !== 'visible') return true;
    }
    return false;
  };
  const offenders = ALL(root).filter((el) => {
    if (!vis(el)) return false;
    const r = el.getBoundingClientRect();
    return (r.right > W + 1 || r.left < -1) && !clippedByAncestor(el);
  }).map((el) => { const r = el.getBoundingClientRect(); return { sel: sel(el), left: Math.round(r.left), right: Math.round(r.right), t: txt(el) }; });
  const b_overflow_x = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenderCount: offenders.length, offenders: offenders.slice(0, 8) };

  // ---- c: rows of the category nav bar (0 = hidden / not rendered, i.e. in a drawer or absent)
  const nav = document.querySelector(opts.navSel || 'nav[aria-label="Điều hướng chính"]');
  let c_nav_rows = 0;
  if (nav && vis(nav) && scope === 'document') c_nav_rows = rowsOf(Array.from(nav.querySelectorAll('a')).filter(vis).map((a) => a.getBoundingClientRect()));

  // ---- d: touch targets < 44x44 (inline links inside a sentence are exempt)
  const NATIVE = 'a[href],button,select,textarea,summary,[role=button],[role=tab],[role=option],[role=menuitem],[role=combobox],input:not([type=hidden]),label:has(input[type=checkbox]),label:has(input[type=radio])';
  const nativeSet = new Set(Array.from(root.querySelectorAll(NATIVE)));
  const pointerRoots = ALL(root).filter((el) => !nativeSet.has(el) && cs(el).cursor === 'pointer' && (!el.parentElement || cs(el.parentElement).cursor !== 'pointer') && !el.closest(NATIVE));
  const targets = [...nativeSet, ...pointerRoots].filter((el) => {
    if (!vis(el)) return false;
    if (el.tagName === 'INPUT' && el.getBoundingClientRect().width <= 2) return false; // sr-only input: its label is the target
    if (el.tagName === 'A' && cs(el).display === 'inline') {
      const rest = (el.parentElement.textContent || '').replace(el.textContent || '', '').trim();
      if (rest.length > 3) return false;
    }
    return true;
  });
  const smallT = targets.map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width < 43.5 || r.height < 43.5);
  const d_small_targets = {
    count: smallT.length, total: targets.length,
    sample: smallT.slice(0, 8).map(({ el, r }) => ({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height), t: txt(el) })),
  };

  // ---- e: text < 14px
  const smallText = new Map();
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const p = n.parentElement;
    if (!n.nodeValue.trim() || !p || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(p.tagName) || !vis(p)) continue;
    const fs = parseFloat(cs(p).fontSize);
    if (fs < 14 && !smallText.has(p)) smallText.set(p, fs);
  }
  const e_small_text = {
    count: smallText.size, at11: [...smallText.values()].filter((f) => f >= 11 && f < 12).length,
    sample: [...smallText].slice(0, 8).map(([el, fs]) => ({ sel: sel(el), fs, t: txt(el) })),
  };

  // ---- f: form fields with font-size < 16px (iOS zooms the page on focus)
  const smallIn = Array.from(root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]),textarea,select'))
    .filter((el) => vis(el) && parseFloat(cs(el).fontSize) < 16);
  const f_small_inputs = { count: smallIn.length, sample: smallIn.slice(0, 8).map((el) => ({ sel: sel(el), fs: parseFloat(cs(el).fontSize), t: txt(el) })) };

  // ---- g: bottom fixed/sticky bar. A `sticky bottom-0` bar (PDP "Mua ngay") only sits at the viewport bottom while the page
  // is NOT scrolled to its end (at the end it falls back into normal flow above the footer), so bars are collected at
  // scroll 0 AND at the very bottom; "covers" is judged at the very bottom: any content (outside the bar) overlapping a bar's rect.
  const bottomBars = () => scope === 'overlay' ? [] : ALL(root).filter((el) => {
    const s = cs(el);
    if ((s.position !== 'fixed' && s.position !== 'sticky') || !vis(el)) return false;
    const r = el.getBoundingClientRect();
    return r.bottom >= H - 2 && r.top >= H * 0.5 && r.width >= W * 0.9 && r.height < H * 0.5;
  });
  window.scrollTo(0, 0); await raf(); await raf();
  const bars = new Set(bottomBars());
  const barH = (b) => Math.round(b.getBoundingClientRect().height);
  const heights = new Map(Array.from(bars).map((b) => [b, barH(b)]));
  window.scrollTo(0, maxScroll()); await raf(); await raf();
  for (const b of bottomBars()) { bars.add(b); heights.set(b, Math.max(heights.get(b) || 0, barH(b))); }
  const barList = Array.from(bars);
  const inBar = (n) => barList.some((b) => b.contains(n));
  const content = [];
  const tw2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw2.nextNode(); n; n = tw2.nextNode()) {
    if (!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement) || inBar(n.parentElement) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) if (r.width > 1 && r.height > 1) content.push(r);
  }
  for (const el of root.querySelectorAll('img,svg,input,select,textarea,button,a')) if (vis(el) && !inBar(el) && !barList.some((b) => el.contains(b))) content.push(el.getBoundingClientRect());
  let overlapPx = 0;
  for (const b of barList) {
    const br = b.getBoundingClientRect();
    if (!(br.bottom > br.top && br.top < H)) continue;
    for (const r of content) if (r.top < H && r.bottom > br.top + 1 && r.top < br.bottom - 1) overlapPx = Math.max(overlapPx, Math.round(Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top)));
  }
  const pad = (el) => (el ? parseFloat(cs(el).paddingBottom) || 0 : 0);
  const g_bottom_overlap = {
    covers: overlapPx > 0,
    barH: Math.max(0, ...heights.values()),
    padBottom: Math.round(Math.max(pad(document.body), pad(document.body.firstElementChild), pad(document.body.firstElementChild && document.body.firstElementChild.firstElementChild))),
    overlapPx,
    bars: barList.map(sel).slice(0, 3),
  };

  // ---- h: promo / info strips ("*-strip" or topbar test ids) in the first screen and how many text lines they take
  window.scrollTo(0, 0); await raf();
  const strips = scope === 'overlay' ? [] : Array.from(document.querySelectorAll('[data-testid$="-strip"],[data-testid="topbar"]')).filter(vis).map((el) => {
    const lines = new Set();
    for (const r of items(el)) lines.add(Math.round(r.top / 4));
    const r = el.getBoundingClientRect();
    return { sel: sel(el), lines: rowsOf(items(el)), top: Math.round(r.top + window.scrollY), height: Math.round(r.height), firstScreen: r.top < H };
  });
  const h_promo_lines = { lines: Math.max(0, ...strips.filter((s) => s.firstScreen).map((s) => s.lines)), strips };

  return { scope, a_top_fixed, b_overflow_x, c_nav_rows, d_small_targets, e_small_text, f_small_inputs, g_bottom_overlap, h_promo_lines };
}

// Which MOB-x does one measurement record break? Single source for before.md and the selftest.
// {key: 'a_top_fixed', mob: 'MOB-A', why: '...'}; thresholds other than MOB-D apply only at phone widths 360-430.
function violations(rec) {
  const phone = PHONE_WIDTHS.includes(rec.width);
  const v = [];
  const a = rec.a_top_fixed, b = rec.b_overflow_x, d = rec.d_small_targets, e = rec.e_small_text, f = rec.f_small_inputs, g = rec.g_bottom_overlap;
  if (b.scrollWidth > b.clientWidth) v.push({ key: 'b_overflow_x', mob: 'MOB-D', why: `cuộn ngang: scrollWidth ${b.scrollWidth} > clientWidth ${b.clientWidth}${b.offenders[0] ? `; vd ${b.offenders[0].sel} (${b.offenders[0].left}..${b.offenders[0].right})` : ''}` });
  if (!phone) return v;
  if (a.h0 > 120 || a.rowsScrolled > 1) v.push({ key: 'a_top_fixed', mob: 'MOB-A', why: `vùng cố định/dính trên cùng: h0=${a.h0}px (≤120), sau cuộn ${a.hScrolled}px, ${a.rowsScrolled} hàng (phải 1)` });
  if (rec.c_nav_rows > 1) v.push({ key: 'c_nav_rows', mob: 'MOB-B', why: `thanh danh mục ${rec.c_nav_rows} hàng (phải ≤1)` });
  if (rec.h_promo_lines.lines > 1) v.push({ key: 'h_promo_lines', mob: 'MOB-C', why: `dải khuyến mãi/thông tin ${rec.h_promo_lines.lines} dòng trong màn hình đầu: ${rec.h_promo_lines.strips.filter((s) => s.firstScreen && s.lines > 1).map((s) => `${s.sel} ${s.lines} dòng`).join(', ')}` });
  if (d.count > 0) v.push({ key: 'd_small_targets', mob: 'MOB-E', why: `${d.count}/${d.total} vùng bấm <44px; vd ${d.sample.slice(0, 2).map((s) => `${s.sel} ${s.w}x${s.h}`).join(', ')}` });
  if (e.count > 0) v.push({ key: 'e_small_text', mob: 'MOB-F', why: `${e.count} phần tử chữ <14px (${e.at11} cỡ 11px)` });
  if (f.count > 0) v.push({ key: 'f_small_inputs', mob: 'MOB-F', why: `${f.count} ô nhập <16px; vd ${f.sample.slice(0, 2).map((s) => `${s.sel} ${s.fs}px`).join(', ')}` });
  if (g.covers) v.push({ key: 'g_bottom_overlap', mob: 'MOB-G', why: `thanh dưới (${g.bars.join(', ')}) cao ${g.barH}px che ${g.overlapPx}px nội dung cuối; đệm dưới ${g.padBottom}px` });
  return v;
}

// ------------------------------------------------------------------------------------------------------------------
// 2. Selftest: one planted violation per measurement, plus a clean control that must measure clean.
// ------------------------------------------------------------------------------------------------------------------
const FILL = 'lorem ipsum '.repeat(400);
const SELFTEST_HTML = {
  dirty: `<body style="margin:0;font:16px sans-serif">
    <div style="position:fixed;top:0;left:0;right:0;background:#eee"><div style="height:80px">fixed row one</div><div style="height:80px">fixed row two</div></div>
    <div data-testid="promo-strip" style="margin-top:170px;width:200px">khuyen mai khuyen mai khuyen mai khuyen mai khuyen mai khuyen mai khuyen mai</div>
    <div style="width:600px;height:10px;background:red"></div>
    <nav aria-label="Điều hướng chính"><ul style="display:flex;flex-wrap:wrap;list-style:none;margin:0;padding:0">${'<li style="width:150px"><a href="#" style="display:block;min-height:44px">muc</a></li>'.repeat(6)}</ul></nav>
    <button style="width:30px;height:30px">x</button>
    <p style="font-size:11px">small text</p>
    <input style="font-size:12px;height:44px">
    <p style="word-break:break-all">${FILL}</p>
    <div style="position:fixed;bottom:0;left:0;right:0;height:60px;background:#ccc">bottom bar</div>
    <p id="last">last line of the page</p></body>`,
  clean: `<body style="margin:0;font:16px sans-serif;padding-bottom:60px">
    <div style="position:sticky;top:0;background:#eee;height:56px;display:flex;align-items:center;gap:8px"><span>logo</span><button style="width:44px;height:44px;font-size:16px">go</button></div>
    <div data-testid="promo-strip" style="width:360px;white-space:nowrap;overflow:hidden">khuyen mai</div>
    <nav aria-label="Điều hướng chính" style="overflow-x:auto"><ul style="display:flex;list-style:none;margin:0;padding:0;width:max-content">${'<li><a href="#" style="display:block;min-width:60px;min-height:44px;padding:0 12px">muc</a></li>'.repeat(6)}</ul></nav>
    <input style="font-size:16px;height:44px">
    <p>${FILL}</p>
    <div style="position:fixed;bottom:0;left:0;right:0;height:56px;background:#ccc">bottom bar</div>
    <p>last line of the page</p></body>`,
  // PDP shape: `sticky bottom-0` bar inside a wrapper, footer below it. Must be SEEN (barH>0) yet not "cover" anything.
  sticky: `<body style="margin:0;font:16px sans-serif"><div><p>${FILL}</p><div style="position:sticky;bottom:0;height:64px;background:#ccc"><button style="height:44px;font-size:16px">Mua ngay</button></div></div><footer style="height:200px">footer</footer></body>`,
};

async function selftest() {
  const browser = await chromium.launch();
  let fails = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // not isMobile: setContent has no viewport meta, so a mobile context would lay out at 980px
    const page = await ctx.newPage();
    const run = async (html) => { await page.setContent(html); const m = await page.evaluate(measureInPage, {}); return { ...m, width: 390 }; };
    const dirty = await run(SELFTEST_HTML.dirty);
    const clean = await run(SELFTEST_HTML.clean);
    const sticky = await run(SELFTEST_HTML.sticky);
    const keyOf = { a_top_fixed: 'a_top_fixed', b_overflow_x: 'b_overflow_x', c_nav_rows: 'c_nav_rows', d_small_targets: 'd_small_targets', e_small_text: 'e_small_text', f_small_inputs: 'f_small_inputs', g_bottom_overlap: 'g_bottom_overlap', h_promo_lines: 'h_promo_lines' };
    const vd = new Set(violations(dirty).map((x) => x.key)), vc = new Set(violations(clean).map((x) => x.key));
    for (const k of Object.keys(keyOf)) {
      let ok = vd.has(k) && !vc.has(k);
      if (k === 'g_bottom_overlap') ok = ok && sticky.g_bottom_overlap.barH >= 60 && !sticky.g_bottom_overlap.covers; // in-flow sticky bar is seen, and does not cover
      if (!ok) fails++;
      const detail = ok ? '' : ` dirty=${JSON.stringify(dirty[k])} clean=${JSON.stringify(clean[k])}${k === 'g_bottom_overlap' ? ` sticky=${JSON.stringify(sticky[k])}` : ''}`;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${k}: planted violation ${vd.has(k) ? 'detected' : 'MISSED'}, clean control ${vc.has(k) ? 'FLAGGED' : 'clean'}${detail}`);
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  process.exitCode = fails ? 1 : 0;
}

// ------------------------------------------------------------------------------------------------------------------
// 3. Fixtures: fake shop, fake identity. Everything under /api/** is answered here.
// ------------------------------------------------------------------------------------------------------------------
const IMGS = ['hotline-tu-van', 'dan-vot-30-phut', 'showroom-ha-noi', 'chinh-hang-yonex'].map((n) => `/banners/${n}.webp`);
// Fixture categories mimic the LIVE nav of www.topvnsport.com (5 links = "trang chủ" + 4 in-stock categories, measured read-only
// 2026-11-04: header 420px / 3 nav rows at 390). Only the racket category is invented (the PDP/stringing states need one).
// More categories than live would inflate the nav rows and the sticky header height, so keep this at 4.
const CATS = [
  { id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Cầu lông > Vợt cầu lông' },
  { id: 2, code: 'VC001427', name: 'Giày Cầu Lông', display_name: 'Cầu lông > Giày Cầu Lông' },
  { id: 3, code: 'VC001500', name: 'Lưới Cầu Lông', display_name: 'Cầu lông > Lưới Cầu Lông' },
  { id: 4, code: 'VC001510', name: 'Bộ Đồ Thể Thao', display_name: 'Cầu lông > Bộ Đồ Thể Thao' },
];
const brandAttr = (b) => [{ id: 1, attribute_id: 10, value_string: b, attribute: { code: 'brand', name: 'Thương hiệu' } }];
const media = (i) => [{ image_url: IMGS[i % IMGS.length], is_cover: true, display_order: 0 }];
const PRODUCTS = [];
const STOCK = {};
const addProduct = (p) => { PRODUCTS.push(p); p.variants.forEach((v) => { STOCK[v.sku_code] = 9; }); };
// racket with a string tier ("Loại Cước"): the stringing picker lives on its PDP
addProduct({
  id: 9001, name: 'Vợt cầu lông Yonex Astrox 100ZZ Kurenai chính hãng bản đặc biệt', slug: 'vot-yonex-astrox-100zz-kurenai', description: 'Vợt kiểm thử cho đợt quét mobile.',
  voma_category_id: 1, attribute_values: brandAttr('Yonex'), media: media(0),
  tier_variations: [{ id: 1, product_id: 9001, tier_index: 1, name: 'Màu sắc', options: ['Đen', 'Xanh'] }, { id: 2, product_id: 9001, tier_index: 2, name: 'Loại Cước', options: ['Không đan', 'BG65 Titanium', 'BG80 Power'] }],
  variants: ['Đen', 'Xanh'].flatMap((c, ci) => ['Không đan', 'BG65 Titanium', 'BG80 Power'].map((s, si) => ({ id: 90010 + ci * 3 + si, product_id: 9001, tier_1_option: c, tier_2_option: s, sku_code: `AUDIT-R1-${ci}${si}`, price: 3890000 + si * 150000 }))),
});
const racketNames = ['Vợt Li-Ning Axforce 80', 'Vợt Victor Thruster K 12', 'Vợt Yonex Nanoflare 800 Pro', 'Vợt Mizuno Fortius 10 Quick'];
racketNames.forEach((n, i) => addProduct({ id: 9002 + i, name: n, slug: `vot-audit-${i + 1}`, description: 'Vợt kiểm thử.', voma_category_id: 1, attribute_values: brandAttr(['Li-Ning', 'Victor', 'Yonex', 'Mizuno'][i]), media: media(i + 1), tier_variations: [{ id: 10 + i, product_id: 9002 + i, tier_index: 1, name: 'Màu sắc', options: ['Đen'] }], variants: [{ id: 90020 + i, product_id: 9002 + i, tier_1_option: 'Đen', sku_code: `AUDIT-R${i + 2}`, price: 2100000 + i * 210000 }] }));
const simpleDefs = [
  [2, 'Giày cầu lông Yonex Power Cushion 65 Z3 Wide', 'Yonex', 2890000], [2, 'Giày cầu lông Lining Saga Lite', 'Li-Ning', 1690000],
  [3, 'Lưới cầu lông Yonex AC171 thi đấu', 'Yonex', 790000], [3, 'Lưới cầu lông Kawasaki tập luyện', 'Kawasaki', 450000],
  [4, 'Áo thi đấu Lining AAYT325 Nam', 'Li-Ning', 390000], [4, 'Bộ đồ thể thao Yonex 1015 Nữ', 'Yonex', 690000],
  [4, 'Quần cầu lông Victor R-3096', 'Victor', 450000], [4, 'Tất thể thao Yonex (3 đôi)', 'Yonex', 150000],
];
simpleDefs.forEach(([cat, name, brand, price], i) => addProduct({ id: 9100 + i, name, slug: `san-pham-audit-${i + 1}`, description: 'Sản phẩm kiểm thử.', voma_category_id: cat, attribute_values: brandAttr(brand), media: media(i), tier_variations: [], variants: [{ id: 91000 + i, product_id: 9100 + i, sku_code: `AUDIT-S${i + 1}`, price }] }));
const SIMPLE_SLUG = 'san-pham-audit-8'; // Tất: no tiers, one SKU, cheap, ideal for the cart
const RACKET_SLUG = 'vot-yonex-astrox-100zz-kurenai';
const PROVINCES = [{ code: 'P01', level: 'province', name: 'Hà Nội', parent_code: null }, { code: 'P79', level: 'province', name: 'Thành phố Hồ Chí Minh', parent_code: null }];
const WARDS = [{ code: 'W0101', level: 'ward', name: 'Phường Kiểm Thử', parent_code: 'P01' }, { code: 'W0102', level: 'ward', name: 'Phường Thử Nghiệm', parent_code: 'P01' }];
const FAKE = { name: 'Khách Kiểm Thử', phone: '0900000000', address: 'Số 1 Đường Kiểm Thử', otp: '123456' };

async function stub(page) {
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') {
      // no external network: images become a flat grey SVG so layout is stable; anything else is dropped
      return route.request().resourceType() === 'image'
        ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#ddd"/></svg>' })
        : route.abort();
    }
    if (!u.pathname.startsWith('/api/')) return route.continue();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const p = u.pathname;
    if (p.endsWith('/public/stock')) return json({ stock: STOCK, items: Object.keys(STOCK).map((s) => ({ sku_code: s, qty_available: STOCK[s], qty_on_hand: STOCK[s], qty_reserved: 0, stock_code: s })) });
    if (p.endsWith('/public/voma-categories')) return json(CATS);
    if (p.endsWith('/public/products')) return json({ items: PRODUCTS, total: PRODUCTS.length, page: 1, limit: 100, pages: 1 });
    if (p.endsWith('/admin-units')) return json({ items: u.searchParams.get('level') === 'province' ? PROVINCES : WARDS, next_cursor: null });
    if (p.endsWith('/shipping-quote')) return json({ currency: 'VND', receiver_province_code: 'P01', receiver_ward_code: 'W0101', is_fallback: false, options: [
      { delivery_option: 'STANDARD', available: true, unavailable_reason: null, service_code: 'STD', service_name: 'Chuẩn', shipping_fee: 30000, eta_days: 3, is_fallback: false },
      { delivery_option: 'EXPRESS', available: true, unavailable_reason: null, service_code: 'EXP', service_name: 'Hỏa tốc', shipping_fee: 55000, eta_days: 1, is_fallback: false }] });
    if (p.endsWith('/checkout/send-otp')) return json({ success: true });
    if (p.endsWith('/checkout/verify-otp')) return json({ success: true, verification_token: 'audit-fake-token' });
    if (p.endsWith('/checkout/orders')) return json({ order_number: 'AUDIT-0001', total_amount: 180000 }, 201);
    return json({ detail: 'mobile-audit: not stubbed' }, 404);
  });
}

// ------------------------------------------------------------------------------------------------------------------
// 4. Routes: ids, URL/state, and how to reach the state (the storefront has no /cart, /checkout or /search page).
// ------------------------------------------------------------------------------------------------------------------
// Setup clicks go through el.click(): at 360-430 the tall sticky header/bars often cover the target, which is itself
// a finding (measured below), but must not stop the audit from reaching the state.
const jsClick = (loc) => loc.evaluate((el) => el.click());
const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await sleep(500); };
const loaded = async (page) => { await page.locator('#api-loading-state').waitFor({ state: 'detached', timeout: 30000 }); await settle(page); };
const openCartWithOne = async (page) => {
  await page.goto(`${BASE}/product/${SIMPLE_SLUG}`); await loaded(page);
  await jsClick(page.getByRole('button', { name: /Mua ngay|Thêm vào giỏ hàng/ }).filter({ visible: true }).first());
  if (!(await page.getByText('Giỏ Hàng Của Bạn').isVisible().catch(() => false))) await jsClick(page.getByRole('button', { name: /Giỏ/ }).filter({ visible: true }).first());
  await page.getByText('Giỏ Hàng Của Bạn').waitFor(); await sleep(600);
};
const toCheckoutForm = async (page) => {
  await openCartWithOne(page);
  await jsClick(page.getByRole('button', { name: /Tiến hành thanh toán/ }));
  await page.locator('#checkout-form').waitFor();
  await page.getByPlaceholder('Ví dụ: Nguyễn Văn A').fill(FAKE.name);
  await page.getByPlaceholder('Ví dụ: 0912345678').fill(FAKE.phone);
  await page.getByPlaceholder('Ví dụ: Số 12 Chùa Hà').fill(FAKE.address);
  await page.getByRole('combobox', { name: 'Tỉnh/Thành phố' }).fill('Hà');
  await jsClick(page.getByRole('option', { name: 'Hà Nội' }));
  await jsClick(page.getByRole('combobox', { name: 'Phường/Xã' })); await page.getByRole('combobox', { name: 'Phường/Xã' }).focus();
  await jsClick(page.getByRole('option', { name: 'Phường Kiểm Thử' }));
  await page.getByText('Giao hàng chuẩn').first().waitFor();
  await jsClick(page.getByText('Thanh toán COD'));
  await sleep(600);
};
const ROUTES = [
  { id: 'home', state: '/', go: async (p) => { await p.goto(`${BASE}/`); await loaded(p); } },
  { id: 'footer', state: '/ cuộn tới #topvnsport-footer', go: async (p) => { await p.goto(`${BASE}/`); await loaded(p); await p.locator('#topvnsport-footer').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(400); } },
  { id: 'catalog', state: '/catalog', go: async (p) => { await p.goto(`${BASE}/catalog`); await loaded(p); } },
  { id: 'category', state: '/catalog?category=VC001427 (giày, không phải vợt)', go: async (p) => { await p.goto(`${BASE}/catalog?category=VC001427`); await loaded(p); } },
  { id: 'search', state: '/catalog?search=vot', go: async (p) => { await p.goto(`${BASE}/catalog?search=vot`); await loaded(p); } },
  { id: 'stringing', state: 'STRINGING_CTA_PATH = /catalog?category=VC001491', go: async (p) => { await p.goto(`${BASE}/catalog?category=VC001491`); await loaded(p); } },
  { id: 'pdp-racket', state: `/product/${RACKET_SLUG} (bật dịch vụ đan cước, chọn màu + cước BG65, cuộn tới bộ chọn cước)`, go: async (p) => {
    await p.goto(`${BASE}/product/${RACKET_SLUG}`); await loaded(p);
    await jsClick(p.locator('label:has(input[type=checkbox])').first());
    await jsClick(p.getByText('BG65 Titanium').first());
    await jsClick(p.getByRole('button', { name: 'Đen' }).first()).catch(() => {});
    await p.locator('#tier-select-2').evaluate((el) => el.scrollIntoView({ block: 'center' })); await sleep(500);
  } },
  { id: 'pdp-simple', state: `/product/${SIMPLE_SLUG} (không có phân loại)`, go: async (p) => { await p.goto(`${BASE}/product/${SIMPLE_SLUG}`); await loaded(p); } },
  { id: 'cart', state: 'CartModal bước 1 (1 món)', go: openCartWithOne },
  { id: 'checkout', state: 'CartModal bước 2 (form đã điền danh tính giả, COD, phí ship đã báo giá)', go: toCheckoutForm },
  { id: 'order-success', state: 'CartModal bước 3 (sau OTP + OMS 201 giả)', go: async (p) => {
    await toCheckoutForm(p);
    await jsClick(p.getByRole('button', { name: 'Xác nhận đặt hàng' }));
    await p.getByPlaceholder('Nhập 6 số OTP').fill(FAKE.otp);
    await jsClick(p.getByRole('button', { name: 'Xác nhận OTP' }));
    await p.getByText('Đặt Hàng Thành Công').first().waitFor(); await sleep(600);
  } },
  // ?order= so the orderNumber box (text-xs font-mono) is rendered and measured too
  { id: 'checkout-success', state: '/checkout/success?order=AUDIT-0001', go: async (p) => { await p.goto(`${BASE}/checkout/success?order=AUDIT-0001`); await loaded(p); } },
  { id: 'checkout-error', state: '/checkout/error?order=AUDIT-0001', go: async (p) => { await p.goto(`${BASE}/checkout/error?order=AUDIT-0001`); await loaded(p); } },
  { id: 'checkout-cancel', state: '/checkout/cancel?order=AUDIT-0001', go: async (p) => { await p.goto(`${BASE}/checkout/cancel?order=AUDIT-0001`); await loaded(p); } },
  { id: 'stores', state: '/stores (trang O2O / đan vợt)', go: async (p) => { await p.goto(`${BASE}/stores`); await loaded(p); } },
  { id: 'notfound', state: '/khong-ton-tai (404)', go: async (p) => { await p.goto(`${BASE}/khong-ton-tai`); await loaded(p); } },
];

// ------------------------------------------------------------------------------------------------------------------
// 5. Run
// ------------------------------------------------------------------------------------------------------------------
async function waitPort() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('dev server did not start');
}

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function writeReport(records) {
  const rows = [];
  const matrix = ROUTES.map((r) => {
    const cols = MOBILE_WIDTHS.map(([w]) => {
      const rec = records.find((x) => x.route === r.id && x.width === w);
      const v = violations(rec);
      v.forEach((x) => rows.push({ route: r.id, width: w, ...x, rec }));
      return v.length ? [...new Set(v.map((x) => x.mob.replace('MOB-', '')))].join('') : '—';
    });
    return `| \`${r.id}\` | ${r.state} | ${cols.join(' | ')} |`;
  });
  const issueRows = rows.map((x) => {
    const e = x.key === 'e_small_text' && x.rec.e_small_text.at11 ? ' ⚠ xung đột với thiết kế 11px (spec e7944019)' : '';
    return `| ${x.route} | ${x.width} | ${cell(x.why)}${e} (\`${x.key}\`) | ${x.mob} |`;
  });
  const perMob = {};
  rows.forEach((x) => { perMob[x.mob] = (perMob[x.mob] || 0) + 1; });
  const md = `# Quét mobile trước khi sửa (STOR-128, goal 2c881ad4)

Sinh tự động bởi \`node e2e/mobile-audit/audit.cjs\` từ \`before.json\` (đo bằng \`page.evaluate\`, không đo bằng mắt). Không sửa tay.
Ảnh: \`before/<route>-<độ rộng>.png\` (${ROUTES.length} route × 4 độ rộng), mốc desktop \`desktop-baseline/<route>-1440.png\`.
Dữ liệu: vite dev local + fixture giả (không dữ liệu cá nhân, OMS/OTP giả), \`prefers-reduced-motion: reduce\` để slide hero đứng yên, ảnh ngoài thay bằng ô xám.
**Số đo phụ thuộc fixture**: bộ danh mục fixture (4 danh mục + "trang chủ" = 5 liên kết nav) được chọn khớp site live đo chỉ-đọc ngày 2026-11-04 (www.topvnsport.com/catalog ở 390: header dính 420px, nav 3 hàng, 5 liên kết). Thêm danh mục vào fixture sẽ làm nav và header cao hơn; số "sau khi sửa" phải so với bộ fixture này.

Ngưỡng (spec MOB-A..G): A: vùng cố định/dính trên cùng ≤120px và 1 hàng khi cuộn · B: thanh danh mục ≤1 hàng · C: dải khuyến mãi ≤1 dòng trong màn hình đầu · D: scrollWidth ≤ clientWidth (cả 4 độ rộng) · E: vùng bấm ≥44px · F: chữ ≥14px, ô nhập ≥16px · G: thanh dưới không che nội dung. Mọi ngưỡng trừ D chỉ áp dụng ở 360–430px; ở 768px chỉ MOB-D được xét (số liệu 768 vẫn nằm trong \`before.json\`).
Ngoại lệ đo: link nằm giữa câu không tính vào MOB-E; khi có lớp phủ toàn màn hình (giỏ hàng) đo bên trong lớp phủ.

## Route → URL / trạng thái

| route | URL / trạng thái | 360 | 390 | 430 | 768 |
|---|---|---|---|---|---|
${matrix.join('\n')}

(ô = các chữ cái MOB vi phạm, ví dụ \`ADE\` = MOB-A, MOB-D, MOB-E; — = không vi phạm.)

## Tổng hợp

${Object.keys(perMob).sort().map((k) => `- ${k}: ${perMob[k]} dòng lỗi`).join('\n') || '- không có lỗi'}

## Bảng lỗi (trang | độ rộng | lỗi | MOB-x vi phạm)

| trang | độ rộng | lỗi | MOB-x vi phạm |
|---|---|---|---|
${issueRows.join('\n')}
`;
  fs.writeFileSync(path.join(OUT, 'before.md'), md);
}

async function main() {
  const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  const widthArg = Number((process.argv.find((a) => a.startsWith('--width=')) || '').slice(8)) || 0;
  if (process.argv.includes('--report-only')) { writeReport(JSON.parse(fs.readFileSync(path.join(OUT, 'before.json'), 'utf8'))); console.log('rewrote before.md from before.json'); return; } // template-only change, no browser
  const full = !onlyArg && !widthArg;
  const routes = ROUTES.filter((r) => !onlyArg || onlyArg.split(',').includes(r.id));
  const widths = MOBILE_WIDTHS.filter(([w]) => !widthArg || w === widthArg);
  for (const d of ['before', 'desktop-baseline']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser, fails = 0;
  try {
    await waitPort();
    browser = await chromium.launch();
    const records = [];
    const shoot = async (route, vw, vh, mobile) => {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await stub(page);
      try {
        await route.go(page);
        const file = path.join(OUT, mobile ? 'before' : 'desktop-baseline', `${route.id}-${vw}.png`);
        await page.screenshot({ path: file });
        if (mobile) {
          const m = await page.evaluate(measureInPage, {});
          records.push({ route: route.id, width: vw, ...m, pageErrors: errors.slice(0, 3) });
        }
        console.log('ok', route.id, vw);
      } catch (e) {
        fails++;
        console.log('FAIL', route.id, vw, process.env.DEBUG ? e.message : e.message.split('\n')[0]);
      } finally {
        await ctx.close();
      }
    };
    for (const r of routes) {
      for (const [w, h] of widths) await shoot(r, w, h, true);
      if (!widthArg) await shoot(r, 1440, 900, false);
    }
    if (full && !fails) {
      records.sort((a, b) => ROUTES.findIndex((r) => r.id === a.route) - ROUTES.findIndex((r) => r.id === b.route) || a.width - b.width);
      fs.writeFileSync(path.join(OUT, 'before.json'), JSON.stringify(records, null, 1) + '\n');
      writeReport(records);
      console.log('wrote before.json + before.md,', records.length, 'records');
    } else if (!full) {
      console.log(JSON.stringify(records.map((r) => ({ route: r.route, width: r.width, scope: r.scope, a: r.a_top_fixed, b: [r.b_overflow_x.scrollWidth, r.b_overflow_x.clientWidth], c: r.c_nav_rows, d: r.d_small_targets.count, e: r.e_small_text.count, f: r.f_small_inputs.count, g: r.g_bottom_overlap, h: r.h_promo_lines.lines, v: violations(r).map((x) => x.mob) }))));
    }
  } catch (e) {
    fails++;
    console.log('ERROR', e.message);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // recorded PID only (r:0b30a607)
    process.exitCode = fails ? 1 : 0;
  }
}

module.exports = { measureInPage, stub, ROUTES, waitPort, BASE, PRODUCTS, STOCK };
if (require.main === module) { if (process.argv.includes('--selftest')) selftest(); else main(); }
