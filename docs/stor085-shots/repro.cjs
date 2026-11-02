// STOR-085 repro: open each /product/<x> URL in Chromium, record HTTP status, main h1, #not-found, console/network errors.
// Usage: TMPDIR=/tmp PLAYWRIGHT=<playwright-core path> BASE=<origin> node docs/stor085-shots/repro.cjs <path>...
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright-core');
const BASE = process.env.BASE || 'https://www.topvnsport.com';
(async () => {
  const browser = await chromium.launch();
  for (const p of process.argv.slice(2)) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
    const resp = await page.goto(BASE + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const h1 = await page.locator('main h1').first().textContent({ timeout: 5000 }).catch(() => null);
    const notFound = await page.locator('#not-found').count();
    console.log(JSON.stringify({ url: p, status: resp.status(), mainH1: h1, notFound: notFound > 0, canonical: await page.locator('link[rel=canonical]').first().getAttribute('href').catch(() => null), errors }));
    await page.close();
  }
  await browser.close();
})();
