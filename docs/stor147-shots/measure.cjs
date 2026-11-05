// STOR-147 measurement (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): CartModal drawer at steps 1-3 (cart, checkout, order-success).
// Fixtures, ROUTES, stub and waitPort come from e2e/mobile-audit/audit.cjs (not copied). Rules d (targets <44px, inline
// mid-sentence links exempt) and e (text <14px) are audit.cjs measureInPage rules d/e verbatim, run inside SCOPE only.
// Rule f (this file only, audit.cjs untouched): form inputs/selects/textareas with font-size <16px or height <44px.
// Rule b (this file): the drawer root scrollWidth must be <= clientWidth (no horizontal scroll in the modal).
// Vite is started --strictPort and killed by its recorded PID (r:0b30a607).
//   node docs/stor147-shots/measure.cjs                     360/390/430: one `route width targets/text/inputs/overflowX` line each; exit 1 if any
//   node docs/stor147-shots/measure.cjs --dump <file>       768/1440: page rect + full computed style of every scoped element -> JSON
//   node docs/stor147-shots/measure.cjs --diff <file>       768/1440: differences against a --dump file, per width; exit 1 if any
//   node docs/stor147-shots/measure.cjs --shots             also save docs/stor147-shots/<route>-390.png
// PORT (default 4430).
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4430';
const { stub, ROUTES, waitPort } = require('../../e2e/mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const IDS = ['cart', 'checkout', 'order-success'];
const SCOPE = () => ['#cart-drawer-modal'];
const PHONES = [[360, 800], [390, 844], [430, 932]];
const WIDE = [[768, 1024, true], [1440, 900, false]];
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

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
  const inputs = roots.flatMap(ALL).filter((el) => el.matches('input:not([type=hidden]),select,textarea') && vis(el));
  const badInputs = inputs.map((el) => ({ el, fs: parseFloat(cs(el).fontSize), r: el.getBoundingClientRect() })).filter(({ fs, r }) => fs < 16 || r.height < 43.5);
  const drawer = document.querySelector('#cart-drawer-modal');
  const overflowX = [drawer.scrollWidth, drawer.clientWidth];
  return {
    inputs: badInputs.length, inputSample: badInputs.slice(0, 8).map(({ el, fs, r }) => `${sel(el)} ${fs}px h=${Math.round(r.height)} "${txt(el)}"`), overflowX,
    targets: smallT.length, totalTargets: targets.length, text: smallText.size,
    targetSample: smallT.slice(0, 8).map(({ el, r }) => `${sel(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${txt(el)}"`),
    textSample: [...smallText].slice(0, 8).map(([el, fs]) => `${sel(el)} ${fs}px "${txt(el)}"`),
  };
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
  const routes = IDS.map((id) => ROUTES.find((r) => r.id === id));
  if (routes.some((r) => !r)) throw new Error('audit.cjs ROUTES is missing a route');
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
    const widths = wide ? WIDE : PHONES.map(([w, h]) => [w, h, true]);
    for (const [vw, vh, mobile] of widths) {
      let diffs = 0;
      for (const route of routes) {
        const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        try {
          await stub(page);
          await route.go(page);
          const scope = SCOPE(route.id);
          if (!wide) {
            const m = await page.evaluate(rulesDE, scope);
            if (m.error) throw new Error(m.error);
            if (m.targets || m.text || m.inputs || m.overflowX[0] > m.overflowX[1]) failures++;
            console.log(`${route.id} ${vw} targets=${m.targets} text=${m.text} inputs=${m.inputs} overflowX=${m.overflowX[0]}/${m.overflowX[1]} (of ${m.totalTargets} targets) scope=${scope.join('+')}`);
            for (const s of m.inputSample) console.log(`    input  ${s}`);
            for (const s of m.targetSample) console.log(`    target ${s}`);
            for (const s of m.textSample) console.log(`    text   ${s}`);
            if (shots && vw === 390) await page.screenshot({ path: path.join(__dirname, `${route.id}-390.png`), fullPage: true });
          } else {
            const d = await page.evaluate(dumpScope, scope);
            const key = `${route.id}@${vw}`;
            dump[key] = d;
            if (base) {
              const b = base[key] || {};
              const keys = new Set([...Object.keys(b), ...Object.keys(d)]);
              let n = 0;
              const sample = [];
              for (const k of keys) {
                const x = b[k] || {}, y = d[k] || {};
                for (const p of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[p] !== y[p]) { n++; if (sample.length < 5) sample.push(`${k} ${p}: ${x[p]} -> ${y[p]}`); }
              }
              diffs += n;
              console.log(`${route.id} ${vw} elements=${Object.keys(d).length} diffs=${n}`);
              for (const s of sample) console.log(`    ${s}`);
            }
          }
        } catch (e) {
          failures++;
          console.log(`${route.id} ${vw} ERROR ${e.message.split('\n')[0]}`);
        } finally {
          await ctx.close();
        }
      }
      if (base) { console.log(`width ${vw}: ${diffs} difference(s) vs ${diffFile}`); if (diffs) failures++; }
    }
    if (dumpFile) { fs.writeFileSync(dumpFile, JSON.stringify(dump)); console.log(`dumped ${Object.keys(dump).length} route@width to ${dumpFile}`); }
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
