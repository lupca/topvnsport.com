// STOR-161 (from STOR-158) measurement (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): /catalog at 390x844, open the filter drawer and measure every
// button (w x h, <44 fails) and every element with a direct text node (font-size, <14 fails) inside [role=dialog].
// Each row is tagged chrome (the drawer's own title / close X / CTA, CatalogFilterDrawer.tsx) or children (CatalogPage
// filterPanel, owned by STOR-145). Exit 1 on ANY FAIL row in the whole dialog. Then 1440x900 /catalog: dump the desktop sidebar's rects + computed styles to argv[2]. stub/ROUTES/waitPort/BASE come from audit.cjs.
// Vite is started --strictPort and killed by its recorded PID only (r:0b30a607).  node docs/stor161-shots/measure.cjs <out1440.json>
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4458';
const { stub, ROUTES, waitPort } = require('../../e2e/mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..', '..');

function sweep() {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return { error: 'no [role=dialog]' };
  const body = dlg.querySelector('.overflow-y-auto');
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1.5 && r.height > 1.5; };
  const owner = (el) => (body && body.contains(el) ? 'children(STOR-145)' : 'chrome');
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || (el.labels && el.labels[0] && el.labels[0].textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  const rows = [];
  for (const el of dlg.querySelectorAll('button,a[href],input:not([type=hidden]),select,[role=button]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    rows.push({ kind: 'button', owner: owner(el), name: name(el), val: `${Math.round(r.width)}x${Math.round(r.height)}`, fail: r.width < 43.5 || r.height < 43.5 });
  }
  for (const el of [dlg, ...dlg.querySelectorAll('*')]) {
    if (!vis(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    rows.push({ kind: 'text', owner: owner(el), name: name(el), val: `${fs}px`, fail: fs < 14 });
  }
  return { rows };
}

async function main() {
  const taken = await new Promise((res) => net.connect(+process.env.PORT, '127.0.0.1').once('connect', function () { this.destroy(); res(true); }).once('error', () => res(false)));
  if (taken) { console.log(`ERROR port ${process.env.PORT} already taken; set PORT`); process.exitCode = 1; return; }
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser, chromeFail = 1;
  try {
    await waitPort();
    const owner = execFileSync('ss', ['-ltnpH', `sport = :${process.env.PORT}`], { encoding: 'utf8' });
    if (server.exitCode !== null || !owner.includes(`pid=${server.pid},`)) throw new Error(`port ${process.env.PORT} not served by pid ${server.pid}`);
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await stub(page);
    await ROUTES.find((r) => r.id === 'catalog').go(page);
    await page.getByRole('button', { name: /^Bộ lọc/ }).filter({ visible: true }).first().click();
    await page.getByRole('dialog').waitFor();
    const m = await page.evaluate(sweep);
    if (m.error) throw new Error(m.error);
    for (const r of m.rows) console.log(`${r.fail ? 'FAIL' : 'pass'} ${r.owner.padEnd(18)} ${r.kind.padEnd(6)} ${r.val.padEnd(7)} "${r.name}"`);
    const ch = m.rows.filter((r) => r.owner === 'chrome');
    chromeFail = m.rows.filter((r) => r.fail).length;
    const kids = m.rows.filter((r) => r.owner !== 'chrome' && r.fail).length;
    console.log(`390x844 dialog: ${m.rows.length} rows (chrome ${ch.length}), ${chromeFail} fail (children ${kids})`);
    await page.screenshot({ path: path.join(__dirname, 'drawer-390.png') });
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p2 = await ctx2.newPage();
    await stub(p2);
    await ROUTES.find((r) => r.id === 'catalog').go(p2);
    const dump = await p2.evaluate(() => {
      const root = document.querySelector('.hidden.lg\\:block');
      const out = [];
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
        out.push({ tag: el.tagName, x: r.x, y: r.y, w: r.width, h: r.height, fs: s.fontSize, pad: s.padding, mar: s.margin, app: s.appearance });
      }
      return out;
    });
    if (process.argv[2]) require('fs').writeFileSync(process.argv[2], JSON.stringify(dump, null, 1) + '\n');
    console.log(`1440x900 sidebar: ${dump.length} elements`);
  } catch (e) {
    console.log('ERROR', e.message.split('\n')[0]);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
      try { process.kill(server.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; } // recorded PID only (r:0b30a607)
    }
    console.log(`stopped dev server pid ${server.pid}`);
    process.exitCode = chromeFail ? 1 : 0;
  }
}
main();
