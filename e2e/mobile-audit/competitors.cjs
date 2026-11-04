// STOR-128: read-only look at competitor mobile headers (390x844). Load + wait + passive scroll only: no login, no form,
// no click. Prints numbers about PATTERNS (top fixed height, nav type, promo-strip lines); no text or screenshots are kept.
// yonex.vn is skipped on purpose (TLS fails, STOR-125); the Yonex reference is yonexshop.jp.
//   node e2e/mobile-audit/competitors.cjs [--out=/tmp/competitors.json]
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core'));
const { measureInPage } = require('./audit.cjs');

const SITES = [
  ['shopvnb.com', 'https://shopvnb.com/'],
  ['yonexshop.jp', 'https://yonexshop.jp/'],
  ['hvshop.vn', 'https://hvshop.vn/'],
  ['www.topvnsport.com (ours, live)', 'https://www.topvnsport.com/'],
];

// nav type + promo strips, generic (no site-specific selectors)
function inspect() {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4; };
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const all = Array.from(document.querySelectorAll('body *')).filter(vis);
  const head = all.filter((el) => top(el) < 220);
  const hamburger = head.some((el) => /^(BUTTON|A|DIV|SPAN|LABEL)$/.test(el.tagName) && /menu|burger|nav-?toggle|drawer|offcanvas/i.test([el.getAttribute('aria-label'), el.className && el.className.baseVal === undefined ? el.className : '', el.id, el.getAttribute('title'), el.getAttribute('data-target')].join(' ')) && el.getBoundingClientRect().width < 90);
  const scrollRows = all.filter((el) => top(el) < 360 && /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 8 && el.querySelectorAll('a').length >= 3).length;
  const lineCount = (el) => { const ys = new Set(); const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.nodeValue.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.height > 4) ys.add(Math.round(r.top / 6)); } return ys.size; };
  const hd = Array.from(document.querySelectorAll('header,[role=banner]')).filter(vis)[0];
  const headerH = hd ? Math.round(hd.getBoundingClientRect().bottom + scrollY) : null; // first <header>: how much of the first screen the whole header block takes
  const strips = head.filter((el) => {
    const r = el.getBoundingClientRect(), t = (el.innerText || '').trim();
    return r.width >= W * 0.9 && r.height >= 14 && r.height <= 90 && t.length >= 5 && t.length <= 200 && el.querySelectorAll('input,select').length === 0 && !el.closest('nav');
  }).filter((el, _, arr) => !arr.some((o) => o !== el && el.contains(o) && o.getBoundingClientRect().height >= el.getBoundingClientRect().height - 1)) // innermost
    .map((el) => ({ top: Math.round(top(el)), height: Math.round(el.getBoundingClientRect().height), lines: lineCount(el), links: el.querySelectorAll('a').length }));
  const headerPos = hd ? getComputedStyle(hd).position : null;
  return { headerH, headerPos, hamburger, scrollRows, strips: strips.filter((x, i, a) => x.top < Math.max(headerH || 0, 120) && a.findIndex((y) => y.top === x.top) === i).slice(0, 4), // only strips inside/at the header block, one per top offset
     horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
}

(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const [name, url] of SITES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const rec = { site: name, url };
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);
      Object.assign(rec, await page.evaluate(inspect));
      const m = await page.evaluate(measureInPage, { navSel: 'header nav, nav' });
      rec.scope = m.scope; rec.topFixedH0 = m.a_top_fixed.h0; rec.topFixedHScrolled = m.a_top_fixed.hScrolled; rec.topFixedRowsScrolled = m.a_top_fixed.rowsScrolled; rec.navRows = m.c_nav_rows;
    } catch (e) { rec.error = e.message.split('\n')[0]; }
    out.push(rec);
    console.log(JSON.stringify(rec));
    await ctx.close();
  }
  await browser.close();
  const o = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6);
  if (o) fs.writeFileSync(o, JSON.stringify(out, null, 1));
})();
