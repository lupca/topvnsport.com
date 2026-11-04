// STOR-107 hero walk (r:75b60f55): vite dev server (PID recorded, killed by PID, r:0b30a607), every /api/* routed
// with fixtures. At 1440x900 and 390x844 (touch) it walks the hero the way a visitor does: reads the box height on
// every slide, clicks dots, swipes with real CDP touch events, hovers, clicks pause, then emulates
// prefers-reduced-motion and reads the track's computed transition. Saves docs/stor107-shots/hero-{1440,390}.png.
// Usage: node scripts/stor107-walk   (PLAYWRIGHT=<path to playwright(-core)> optional)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const PORT = Number(process.env.PORT || 4407);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', '..', 'docs', 'stor107-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const BANNERS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'config', 'heroBanners.json'), 'utf8'));

const IMGS = ['hotline-tu-van', 'dan-vot-30-phut', 'showroom-ha-noi', 'chinh-hang-yonex'];
const ITEMS = IMGS.map((img, i) => ({
  id: 700 + i, name: `Vợt walk ${i + 1}`, slug: `vot-walk-${i + 1}`, description: 'Vợt test.', voma_category_id: 1,
  image: `/banners/${img}.webp`,
  attribute_values: [{ id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } }],
  tier_variations: [{ id: 1, product_id: 700 + i, tier_index: 1, name: 'Màu sắc', options: ['Đen'] }],
  variants: [{ id: 70000 + i, product_id: 700 + i, tier_1_option: 'Đen', sku_code: `WALK-${i}`, price: 2000000 + i * 100000 }],
}));
const STOCK = { stock: Object.fromEntries(ITEMS.map((_, i) => [`WALK-${i}`, 5])), items: ITEMS.map((_, i) => ({ sku_code: `WALK-${i}`, qty_available: 5, qty_on_hand: 5, qty_reserved: 0, stock_code: `WALK-${i}` })) };
const CATS = [{ id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' }];

const waitPort = async () => {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};
const checkTrue = (label, cond, detail) => check(label, Boolean(cond), true) || (cond ? 0 : console.log('   ', detail));

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    const errors = [];
    const open = async (viewport, extra = {}) => {
      const ctx = await browser.newContext({ viewport, ...extra });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      await page.route('**/api/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (p.endsWith('/public/stock')) return json(STOCK);
        if (p.endsWith('/public/voma-categories')) return json(CATS);
        if (p.endsWith('/public/products')) return json({ items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
        if (p.endsWith('/branches')) return json([]);
        return json({ detail: 'walk: not stubbed' }, 404);
      });
      await page.goto(`${BASE}/`);
      await page.getByTestId('hero-banner-section').waitFor();
      return { ctx, page };
    };
    const boxH = (page) => page.getByTestId('hero-banner-box').evaluate((el) => Math.round(el.getBoundingClientRect().height * 10) / 10);
    const active = (page) => page.getByTestId('slider-dots').locator('button').evaluateAll((b) => b.findIndex((x) => x.getAttribute('aria-current') === 'true'));
    const trackStyle = (page) => page.getByTestId('hero-banner-track').evaluate((el) => { const s = getComputedStyle(el); return { dur: s.transitionDuration, fn: s.transitionTimingFunction }; });

    // ---- shared per-viewport checks: slides, no overflow, images loaded, controls clear of the CTA
    const walkSlides = async (page, tag) => {
      const n = await page.getByTestId('hero-banner').count();
      check(`${tag}: one hero-banner per config entry`, n, BANNERS.length);
      check(`${tag}: one dot per entry`, await page.getByTestId('slider-dots').locator('button').count(), BANNERS.length);
      const heights = [];
      for (let i = 0; i < n; i++) {
        await page.getByTestId(`slider-dot-${i}`).click();
        await sleep(650); // > 500ms transition
        heights.push(await boxH(page));
        const slide = page.getByTestId('hero-banner').nth(i);
        const m = await slide.evaluate((el) => {
          const q = (s) => el.querySelector(s);
          const h2 = q('h2'), p = q('p'), a = q('a'), img = q('img');
          const dots = document.querySelector('[data-testid="slider-dots"]').getBoundingClientRect();
          const box = document.querySelector('[data-testid="hero-banner-box"]').getBoundingClientRect();
          const ar = a.getBoundingClientRect();
          return {
            clipped: h2.scrollHeight > h2.clientHeight + 1 || p.scrollHeight > p.clientHeight + 1,
            dims: [h2.scrollHeight, h2.clientHeight, p.scrollHeight, p.clientHeight],
            ctaClearOfDots: ar.bottom < dots.top, ctaInBox: ar.top >= box.top && ar.bottom <= box.bottom && ar.right <= box.right,
            imgOk: img.complete && img.naturalWidth > 0, h2: h2.textContent, href: a.getAttribute('href'), links: el.querySelectorAll('a').length,
          };
        });
        check(`${tag}: slide ${i} headline/subline not clipped`, m.clipped, false) || (m.clipped && console.log('    [h2 scroll,client, p scroll,client]', m.dims));
        check(`${tag}: slide ${i} CTA inside box and above the dots`, [m.ctaInBox, m.ctaClearOfDots], [true, true]);
        check(`${tag}: slide ${i} image loaded`, m.imgOk, true);
        check(`${tag}: slide ${i} text + one CTA from config`, [m.h2, m.href, m.links], [BANNERS[i].headline, BANNERS[i].cta.href, 1]);
      }
      check(`${tag}: box height identical on every slide`, new Set(heights).size, 1);
      console.log(`    ${tag} box heights`, JSON.stringify(heights));
      return heights[0];
    };

    // ================= 1440 =================
    {
      const { ctx, page } = await open({ width: 1440, height: 900 });
      const h = await walkSlides(page, '1440');
      check('1440: box ~ 520px (aspect 1440/520)', Math.round(h), 520);
      const st = await trackStyle(page);
      check('1440: track transition 0.5s with the ease-out curve (Tailwind ease-out = cubic-bezier(0,0,.2,1))', [st.dur, st.fn], ['0.5s', 'cubic-bezier(0, 0, 0.2, 1)']);
      check('1440: no product name / price / Xem chi tiết in hero', await page.getByTestId('hero-banner-section').evaluate((el) => /Vợt walk|\d[\d.]*đ|Xem chi tiết/.test(el.textContent)), false);
      check('1440: stringing/contact CTAs go to catalog stringing path or /stores', BANNERS.filter((b) => /đan vợt|showroom/i.test(b.headline + b.subline)).map((b) => b.cta.href).every((x) => x === '/catalog?category=VC001491' || x === '/stores'), true);
      check('1440: rest of page below hero still renders (h1 + shelf)', [await page.getByRole('heading', { level: 1, name: 'BADMINTON' }).count(), await page.getByTestId('instock-shelf').count()], [1, 1]);
      // hover pauses autoplay, leaving resumes it; pause button holds it
      await page.getByTestId('slider-dot-0').click();
      await page.getByTestId('hero-banner-box').hover();
      await sleep(5800);
      check('1440: autoplay stays on slide 0 while hovered (>5s)', await active(page), 0);
      await page.mouse.move(5, 880);
      await sleep(5800);
      check('1440: autoplay advances after the pointer leaves', await active(page), 1);
      await page.getByTestId('slider-pause-toggle').click();
      check('1440: pause button label flips to Phát tiếp', await page.getByTestId('slider-pause-toggle').getAttribute('aria-label'), 'Phát tiếp');
      await page.mouse.move(5, 880);
      await sleep(5800);
      check('1440: paused autoplay stays on slide 1 (>5s)', await active(page), 1);
      await page.getByTestId('slider-pause-toggle').click();
      check('1440: label flips back to Tạm dừng', await page.getByTestId('slider-pause-toggle').getAttribute('aria-label'), 'Tạm dừng');
      await page.getByTestId('slider-dot-0').click();
      await sleep(700);
      await page.mouse.move(5, 880);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(200);
      // hero starts at y=440 at 1440, so clip the top 1000px (header + whole 520px hero) instead of the 900px viewport
      await page.screenshot({ path: path.join(SHOTS, 'hero-1440.png'), fullPage: true, clip: { x: 0, y: 0, width: 1440, height: 1000 } });
      await ctx.close();
    }

    // ================= 1440, reduced motion =================
    {
      const { ctx, page } = await open({ width: 1440, height: 900 }, { reducedMotion: 'reduce' });
      const st = await trackStyle(page);
      check('reduced motion: track transition-duration 0s', st.dur, '0s');
      await sleep(5800);
      check('reduced motion: autoplay off (still slide 0 after >5s)', await active(page), 0);
      await page.getByTestId('slider-dot-2').click();
      check('reduced motion: dots still navigate', await active(page), 2);
      await ctx.close();
    }

    // ================= 390 (touch) =================
    {
      const { ctx, page } = await open({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const h = await walkSlides(page, '390');
      checkTrue('390: box height within 280-300px', h >= 280 && h <= 300, `got ${h}`);
      const cdp = await ctx.newCDPSession(page);
      const swipe = async (x0, x1, y0 = 400, y1 = 400) => {
        const pt = (x, y) => [{ x, y, id: 1 }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt((x0 + x1) / 2, (y0 + y1) / 2) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x1, y1) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(700);
      };
      await page.getByTestId('slider-dot-0').click();
      await page.getByTestId('slider-pause-toggle').click(); // keep autoplay out of the swipe measurements
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await page.getByTestId('hero-banner-box').boundingBox();
      const y = Math.round(box.y + box.height / 2);
      await swipe(300, 200, y, y);
      check('390: swipe left 100px shows banner 1', await active(page), 1);
      await swipe(200, 300, y, y);
      check('390: swipe right 100px shows banner 0', await active(page), 0);
      await swipe(250, 220, y, y);
      check('390: swipe of 30px keeps banner 0', await active(page), 0);
      await page.getByTestId('slider-pause-toggle').click(); // resume
      await page.getByTestId('slider-dot-0').click();
      await sleep(700);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(200);
      await page.screenshot({ path: path.join(SHOTS, 'hero-390.png') });
      await ctx.close();
    }

    check('no page errors / console errors during the walk', errors, []);
  } catch (e) {
    fails++;
    console.log('ERROR', e.message);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // recorded PID only (r:0b30a607)
    console.log(fails ? `FAILED ${fails}` : 'ALL PASS', '| shots in', SHOTS);
    process.exitCode = fails ? 1 : 0;
  }
})();
