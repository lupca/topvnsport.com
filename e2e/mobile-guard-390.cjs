// STOR-149 CI guard at 390x844 (goal 2c881ad4): MOB-A c4cd5fa6 (top fixed/sticky area <=120px at scrollY=0 and after
// scrolling) and MOB-D 0d3a0143 (document scrollWidth <= innerWidth). Fixtures, routes and measureInPage come from
// e2e/mobile-audit/audit.cjs (not copied). No screenshots. Vite is started --strictPort and killed by its PID (r:0b30a607).
//   node e2e/mobile-guard-390.cjs      one line per route, exit 1 on any failure. PORT (default 4429).
const { spawn } = require('child_process');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4429';
const { measureInPage, stub, ROUTES, waitPort } = require('./mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

const IDS = ['home', 'footer', 'catalog', 'category', 'stringing', 'search', 'pdp-racket', 'pdp-simple', 'cart', 'stores', 'notfound'];
const MAX_TOP = 120;
const WIDTH = 390; // isMobile: Chromium widens the layout viewport to fit overflow, so innerWidth grows with scrollWidth; compare with the device width

async function main() {
  const routes = IDS.map((id) => ROUTES.find((r) => r.id === id));
  if (routes.some((r) => !r)) throw new Error(`audit.cjs ROUTES is missing: ${IDS.filter((id, i) => !routes[i]).join(', ')}`);
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser, failures = 0;
  try {
    await waitPort();
    browser = await chromium.launch();
    for (const route of routes) {
      const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      try {
        await stub(page);
        await route.go(page);
        // read before measureInPage: it scrolls the page. cart = full-screen overlay (top area 0px): MOB-D only
        const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
        const m = await page.evaluate(measureInPage, {});
        const a = m.a_top_fixed;
        const top = Math.max(a.h0, a.hScrolled);
        const why = [];
        if (route.id !== 'cart' && top > MAX_TOP) why.push(`MOB-A top ${top}px > ${MAX_TOP}px (h0=${a.h0}, scrolled=${a.hScrolled})`);
        if (sw > WIDTH || sw > iw) why.push(`MOB-D scrollWidth ${sw} > ${WIDTH}px (innerWidth ${iw})`);
        if (why.length) failures++;
        console.log(`${route.id.padEnd(10)} ${why.length ? 'FAIL' : 'PASS'} top=${top}px sw=${sw}/iw=${iw} scope=${m.scope}${why.length ? ' -- ' + why.join('; ') : ''}`);
      } catch (e) {
        failures++;
        console.log(`${route.id.padEnd(10)} FAIL error: ${e.message.split('\n')[0]}`);
      } finally {
        await ctx.close();
      }
    }
  } catch (e) {
    failures++;
    console.log('ERROR', e.message.split('\n')[0]);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // recorded PID only (r:0b30a607)
    console.log(`stopped dev server pid ${server.pid}; ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
  }
}

main();
