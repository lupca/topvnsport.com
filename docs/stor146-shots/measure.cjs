// STOR-146 measurement (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): PDP purchase section, back button, stringing picker, tabs.
// Copied from docs/stor148-shots/measure.cjs. Fixtures, ROUTES, stub and waitPort come from e2e/mobile-audit/audit.cjs;
// only the in-process fixture of product 9001 is enriched below (racket specs, a VOMA attribute, a promotion, 'Xanh' out
// of stock) so the tech tab, the discount pill and the 'Hết' badge render. Rules d (targets <44px) and e (text <14px) are
// audit.cjs measureInPage rules d/e verbatim, run inside SCOPE only. Vite runs --strictPort, killed by recorded PID (r:0b30a607).
//   node docs/stor146-shots/measure.cjs                     360/390/430: one line per row + probe sizes; exit 1 on any failure
//   node docs/stor146-shots/measure.cjs --dump <file>       768/1440: page rect + full computed style of every scoped element -> JSON
//   node docs/stor146-shots/measure.cjs --diff <file>       768/1440: differences against a --dump file, per width; exit 1 if any
//   node docs/stor146-shots/measure.cjs --shots             also save docs/stor146-shots/<row>-390.png
//   node docs/stor146-shots/measure.cjs --walk              390x844 pdp-racket, real taps: colour, stringing on, string, tension,
//                                                           tech tab -> step1..5-*-390.png; exit 1 if a step has no effect (r:75b60f55)
// PORT (default 4446).
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4446';
const { stub, ROUTES, waitPort, BASE, PRODUCTS, STOCK } = require('../../e2e/mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

// Measurement-only fixture override (never a component default): real-shaped racket specs on product 9001.
const racket = PRODUCTS.find((p) => p.id === 9001);
const attr = (code, name, value) => ({ id: 1, attribute_id: 10, value_string: value, attribute: { code, name } });
racket.attribute_values = [...racket.attribute_values, attr('weightClass', 'Trọng lượng', '4U (83g)'), attr('stiffness', 'Độ cứng', 'Medium'), attr('balance', 'Điểm cân bằng', '295'), attr('maxTension', 'Sức căng tối đa', '28')];
racket.voma_attribute_values = [{ code: 'material', name: 'Chất liệu', value: 'Carbon' }];
racket.variants.forEach((v) => Object.assign(v, { original_price: v.price, computed_price: Math.round(v.price * 0.9), percentage_discount: 10, has_active_promotion: true }));
['AUDIT-R1-10', 'AUDIT-R1-11', 'AUDIT-R1-12'].forEach((s) => { STOCK[s] = 0; }); // 'Xanh' shows 'Hết'

const ROOT = path.join(__dirname, '..', '..');
const SCOPE = ['[data-testid=pdp-back]', '[data-testid=pdp-purchase]', '[data-testid=pdp-tabs]'];
const ROWS = [['pdp-racket', 'details'], ['pdp-simple', 'details'], ['pdp-racket', 'tech'], ['pdp-simple', 'tech']];
const PHONES = [[360, 800], [390, 844], [430, 932]];
const WIDE = [[768, 1024, true], [1440, 900, false]];
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// audit.cjs rules d and e, verbatim, with `root` replaced by the scope roots.
function rulesDE(selectors) {
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
  const txt = (el) => (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().replace(/\d{6,}/g, '#').replace(/\S*@\S*/g, '@').slice(0, 28);
  const roots = selectors.map((s) => document.querySelector(s));
  if (roots.some((r) => !r)) return { error: `scope missing: ${selectors.filter((s, i) => !roots[i]).join(', ')}` };
  const ALL = (root) => [root, ...root.querySelectorAll('*')];
  const NATIVE = 'a[href],button,select,textarea,summary,[role=button],[role=tab],[role=option],[role=menuitem],[role=combobox],input:not([type=hidden]),label:has(input[type=checkbox]),label:has(input[type=radio])';
  const nativeSet = new Set(roots.flatMap((root) => ALL(root).filter((el) => el.matches(NATIVE))));
  const pointerRoots = roots.flatMap(ALL).filter((el) => !nativeSet.has(el) && cs(el).cursor === 'pointer' && (!el.parentElement || cs(el.parentElement).cursor !== 'pointer') && !el.closest(NATIVE));
  const targets = [...nativeSet, ...pointerRoots].filter((el) => {
    if (!vis(el)) return false;
    if (el.tagName === 'INPUT' && el.getBoundingClientRect().width <= 2) return false;
    if (el.tagName === 'A' && cs(el).display === 'inline') {
      const rest = (el.parentElement.textContent || '').replace(el.textContent || '', '').trim();
      if (rest.length > 3) return false;
    }
    return true;
  });
  const smallT = targets.map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width < 43.5 || r.height < 43.5);
  const smallText = new Map();
  for (const root of roots) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const p = n.parentElement;
      if (!n.nodeValue.trim() || !p || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(p.tagName) || !vis(p)) continue;
      const fs = parseFloat(cs(p).fontSize);
      if (fs < 14 && !smallText.has(p)) smallText.set(p, fs);
    }
  }
  return {
    targets: smallT.length, totalTargets: targets.length, text: smallText.size,
    targetSample: smallT.slice(0, 8).map(({ el, r }) => `${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${txt(el)}"`),
    textSample: [...smallText].slice(0, 8).map(([el, fs]) => `${sel(el)} ${fs}px "${txt(el)}"`),
  };
}

// Named probes (must exist and be visible) + the sizes the acceptance criteria name.
function probes([route, tab]) {
  const q = (s) => [...document.querySelectorAll(s)];
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1.5 && r.height > 1.5 && getComputedStyle(el).visibility !== 'hidden'; };
  const sz = (el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; };
  const fsz = (el) => parseFloat(getComputedStyle(el).fontSize);
  const options = q('#tier-select-1 button');
  const het = q('#tier-select-1 button > span');
  const caption = q('#tier-select-2 h3 + p');
  const range = q('#tier-select-2 input[type=range]');
  const ticks = range.map((el) => el.nextElementSibling).filter(Boolean);
  const tooltip = ticks.map((el) => el.nextElementSibling).filter(Boolean);
  const tabs = q('[data-testid=pdp-tabs] > div:first-child > button');
  const gauges = q('[data-testid=pdp-tabs] .w-24 > div.absolute');
  const attrRows = q('[data-testid=pdp-tabs] tbody tr');
  const want = {
    back: q('[data-testid=pdp-back]'),
    brand: q('[data-testid=pdp-purchase] > div:first-child > div:first-child > span'),
    tabs,
    ...(route === 'pdp-racket' ? {
      discount: q('[data-testid=pdp-purchase] .rounded-full.bg-brand-primary'),
      tierOption: options, het, caption, ticks, tooltip,
      ...(tab === 'tech' ? { gauges, attrRows } : {}),
    } : {}),
  };
  const missing = Object.keys(want).filter((k) => !want[k].some(vis));
  const inside = (a, b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.left >= y.left - 0.5 && x.right <= y.right + 0.5 && x.top >= y.top - 0.5 && x.bottom <= y.bottom + 0.5; };
  const gaugeFit = gauges.filter((g) => g.scrollWidth <= g.clientWidth && inside(g, g.parentElement)).length;
  const img = document.querySelector('#product-detail-page img');
  return {
    sw: document.documentElement.scrollWidth,
    imgTop: img ? Math.round(img.getBoundingClientRect().top + scrollY) : null,
    missing,
    back: want.back.map(sz),
    options: options.map((el) => `${el.childNodes[0].textContent.trim()} ${sz(el)}`),
    tabs: tabs.map(sz),
    tabMinH: tabs.length ? Math.min(...tabs.map((el) => el.getBoundingClientRect().height)) : null,
    backMinH: want.back.length ? want.back[0].getBoundingClientRect().height : null,
    optMin: options.length ? Math.min(...options.flatMap((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; })) : null,
    captionFs: caption.length ? fsz(caption[0]) : null,
    hetFs: het.length ? fsz(het[0]) : null,
    hetInside: het.length ? (het.every((h) => inside(h, h.parentElement)) ? 'yes' : 'no') : null,
    gauges: gauges.length, attrRows: attrRows.length, gaugeFit,
  };
}

// The shopper's order of taps at 390x844, with real (hit-tested) clicks, one screenshot per step.
async function walk(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  let bad = 0;
  const step = async (name, shot, check) => {
    const ok = await check();
    if (!ok) bad++;
    await page.locator(shot).screenshot({ path: path.join(__dirname, `${name}-390.png`) });
    console.log(`${name} ${ok ? 'ok' : 'FAIL'}`);
  };
  try {
    await stub(page);
    await page.goto(`${BASE}/product/${racket.slug}`);
    await page.locator('#api-loading-state').waitFor({ state: 'detached', timeout: 30000 });
    await page.locator('h1').first().waitFor();
    const den = page.locator('#tier-select-1 button', { hasText: 'Đen' });
    await den.click();
    await step('step1-colour', '#tier-select-1', async () => (await den.getAttribute('class')).includes('bg-brand-primary'));
    await page.locator('#tier-select-2 label:has(input[type=checkbox])').click();
    const range = page.locator('#tier-select-2 input[type=range]');
    await step('step2-toggle', '#tier-select-2', async () => (await page.locator('#tier-select-2 input[type=checkbox]').isChecked()) && range.isVisible());
    const row = page.locator('#tier-select-2 [data-stock]', { hasText: 'BG65 Titanium' });
    await row.click();
    await step('step3-string', '#tier-select-2', async () => (await row.getAttribute('class')).includes('border-brand-primary'));
    const before = await range.inputValue();
    const box = await range.boundingBox();
    await range.click({ position: { x: box.width * 0.9, y: box.height / 2 } });
    const after = await range.inputValue();
    console.log(`    tension ${before} -> ${after}, range ${Math.round(box.width)}x${Math.round(box.height)}`);
    await step('step4-tension', '#tier-select-2', async () => after !== before);
    await page.locator('[data-testid=pdp-tabs] > div:first-child > button').nth(1).click();
    await step('step5-tab', '[data-testid=pdp-tabs]', async () => (await page.locator('[data-testid=pdp-tabs] .w-24').count()) === 4);
  } finally {
    await ctx.close();
  }
  return bad;
}

// Every element in scope, keyed by its index path: page-relative rect + every computed style property.
function dumpScope(selectors) {
  const out = {};
  selectors.forEach((s) => {
    const walk = (el, key) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const o = { tag: el.tagName, rect: [r.left + scrollX, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 100) / 100).join(',') };
      for (let i = 0; i < st.length; i++) o[st[i]] = st.getPropertyValue(st[i]);
      out[key] = o;
      Array.from(el.children).forEach((c, i) => walk(c, `${key}/${i}`));
    };
    walk(document.querySelector(s), s);
  });
  return out;
}

async function main() {
  const dumpFile = arg('--dump'), diffFile = arg('--diff'), shots = process.argv.includes('--shots');
  const wide = !!(dumpFile || diffFile);
  const routes = Object.fromEntries(['pdp-racket', 'pdp-simple'].map((id) => [id, ROUTES.find((r) => r.id === id)]));
  if (Object.values(routes).some((r) => !r)) throw new Error('audit.cjs ROUTES is missing a route');
  const taken = await new Promise((res) => net.connect(+process.env.PORT, '127.0.0.1').once('connect', function () { this.destroy(); res(true); }).once('error', () => res(false)));
  if (taken) { console.log(`ERROR port ${process.env.PORT} already taken; set PORT to a free port`); process.exitCode = 1; return; }
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser, failures = 0;
  const dump = {};
  const base = diffFile ? JSON.parse(fs.readFileSync(diffFile, 'utf8')) : null;
  try {
    await waitPort();
    const owner = execFileSync('ss', ['-ltnpH', `sport = :${process.env.PORT}`], { encoding: 'utf8' });
    if (server.exitCode !== null || !owner.includes(`pid=${server.pid},`)) throw new Error(`port ${process.env.PORT} is not served by dev server pid ${server.pid}`);
    browser = await chromium.launch();
    if (process.argv.includes('--walk')) failures += await walk(browser);
    const widths = process.argv.includes('--walk') ? [] : wide ? WIDE : PHONES.map(([w, h]) => [w, h, true]);
    for (const [vw, vh, mobile] of widths) {
      let diffs = 0;
      for (const [id, tab] of ROWS) {
        const row = `${id}:${tab}`;
        const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        try {
          await stub(page);
          await routes[id].go(page);
          if (tab === 'tech') { await page.locator('[data-testid=pdp-tabs] > div:first-child > button').nth(1).evaluate((el) => el.click()); await sleep(300); }
          if (!wide) {
            const m = await page.evaluate(rulesDE, SCOPE);
            if (m.error) throw new Error(m.error);
            const p = await page.evaluate(probes, [id, tab]);
            const bad = [];
            if (m.targets) bad.push('targets');
            if (m.text) bad.push('text');
            if (p.sw > vw) bad.push('hscroll');
            if (p.missing.length) bad.push('missing');
            if (vw === 390 && id === 'pdp-racket' && !(p.imgTop !== null && p.imgTop < vh)) bad.push('imgTop');
            if (p.backMinH !== null && p.backMinH < 43.5) bad.push('back');
            if (p.tabMinH !== null && p.tabMinH < 43.5) bad.push('tabs');
            if (id === 'pdp-racket') {
              if (!(p.optMin >= 43.5)) bad.push('options');
              if (!(p.captionFs >= 14)) bad.push('caption');
              if (!(p.hetFs >= 14)) bad.push('hetFs');
              if (p.hetInside !== 'yes') bad.push('hetInside');
              if (tab === 'tech' && p.gaugeFit !== p.gauges) bad.push('gaugeFit');
            }
            if (bad.length) failures++;
            console.log(`${row} ${vw} targets=${m.targets} text=${m.text} sw=${p.sw} imgTop=${p.imgTop} missing=${p.missing.join(',') || 'none'} (of ${m.totalTargets} targets)${bad.length ? ' FAIL ' + bad.join(',') : ''}`);
            console.log(`    back=${p.back.join(',')} options=[${p.options.join(', ')}] tabs=${p.tabs.join(',')} caption=${p.captionFs}px hetFs=${p.hetFs} hetInside=${p.hetInside}${tab === 'tech' ? ` gauges=${p.gauges} attrRows=${p.attrRows} gaugeFit=${p.gaugeFit}/${p.gauges}` : ''}`);
            for (const s of m.targetSample) console.log(`    target ${s}`);
            for (const s of m.textSample) console.log(`    text   ${s}`);
            if (shots && vw === 390) await page.screenshot({ path: path.join(__dirname, `${id}-${tab}-390.png`), fullPage: true });
          } else {
            const d = await page.evaluate(dumpScope, SCOPE);
            const key = `${row}@${vw}`;
            dump[key] = d;
            if (base) {
              const b = base[key] || {};
              const keys = new Set([...Object.keys(b), ...Object.keys(d)]);
              let n = 0;
              const sample = [];
              for (const k of keys) {
                const x = b[k] || {}, y = d[k] || {};
                for (const pr of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[pr] !== y[pr]) { n++; if (sample.length < 5) sample.push(`${k} ${pr}: ${x[pr]} -> ${y[pr]}`); }
              }
              diffs += n;
              console.log(`${row} ${vw} elements=${Object.keys(d).length} diffs=${n}`);
              for (const s of sample) console.log(`    ${s}`);
            }
          }
        } catch (e) {
          failures++;
          console.log(`${row} ${vw} ERROR ${e.message.split('\n')[0]}`);
        } finally {
          await ctx.close();
        }
      }
      if (base) { console.log(`width ${vw}: ${diffs} difference(s) vs ${diffFile}`); if (diffs) failures++; }
    }
    if (dumpFile) { fs.writeFileSync(dumpFile, JSON.stringify(dump)); console.log(`dumped ${Object.keys(dump).length} row@width to ${dumpFile}`); }
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
