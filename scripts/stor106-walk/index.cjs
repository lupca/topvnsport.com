// STOR-106 walk (r:75b60f55): vite dev server (PID ghi lại, tắt theo PID), /api/* trả fixture 12 SP / 2 ngành còn hàng.
// Ở 1440 và 390: ảnh trước/sau khi bấm chip ngành, tên SP kệ, scrollY, đỉnh kệ so với đáy header, logo naturalWidth,
// hàng mobile 320/375/390 (scrollWidth vs clientWidth), hành vi cuộn smooth vs reduce. Ảnh vào docs/stor106-shots/.
// Dùng: node scripts/stor106-walk   (PLAYWRIGHT=<đường dẫn playwright-core> tùy chọn)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core'));

const PORT = Number(process.env.PORT || 4406);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, '../../docs/stor106-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const CATS = [
  { id: 1, code: 'CAT_VOT', name: 'Vợt cầu lông', display_name: 'Thể Thao > Vợt cầu lông' },
  { id: 2, code: 'CAT_GIAY', name: 'Giày cầu lông', display_name: 'Thể Thao > Giày cầu lông' },
];
// 4 thương hiệu thiết kế -> câu cam kết trên header dài nhất, header cao nhất (trường hợp xấu cho scroll-mt).
const BRANDS = ['Yonex', 'Li-Ning', 'Victor', 'Kizuna'];
const HUES = [200, 20, 140, 330, 60, 260];
const ITEMS = Array.from({ length: 12 }, (_, i) => {
  const cat = i < 6 ? 1 : 2; const n = (i % 6) + 1; const kind = cat === 1 ? 'Vợt' : 'Giày'; const id = 106000 + i;
  return {
    id, name: `${kind} Yonex mẫu ${n}`, slug: `${kind === 'Vợt' ? 'vot' : 'giay'}-yonex-mau-${n}`, description: 'SP test.', voma_category_id: cat,
    media: [{ image_url: `https://img.test/p${i}.svg?h=${HUES[n - 1]}`, is_cover: true, display_order: 1 }],
    attribute_values: [{ id: id, attribute_id: 10, value_string: BRANDS[i % 4], attribute: { code: 'brand', name: 'Thương hiệu' } }],
    tier_variations: [], variants: [{ id: id * 10, product_id: id, sku_code: `SKU-${id}`, price: 1500000 + i * 10000 }],
  };
});
const STOCK = { stock: Object.fromEntries(ITEMS.map((p) => [p.variants[0].sku_code, 5])), items: [] };
const svg = (h) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${h},60%,70%)"/></svg>`;

// Ghi lại mọi lời gọi scrollIntoView (this + tham số) để chứng minh behavior thật sự truyền đi.
const INIT = () => {
  window.__sic = [];
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (a) {
    window.__sic.push({ target: this.dataset.testid, behavior: a && a.behavior, block: a && a.block });
    return orig.apply(this, arguments);
  };
};

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' want ' + JSON.stringify(want)}`);
};
const info = (label, v) => console.log(`INFO ${label}: ${JSON.stringify(v)}`);

const waitPort = async () => {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
};

async function open(browser, width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fails++; console.log('FAIL PAGEERROR', e.message); });
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.host === 'img.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(u.searchParams.get('h') || 200) });
    if (u.host !== `127.0.0.1:${PORT}`) return route.abort();
    if (u.pathname.endsWith('/public/stock')) return json(STOCK);
    if (u.pathname.endsWith('/public/voma-categories')) return json(CATS);
    if (u.pathname.endsWith('/public/products')) return json({ items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"walk: not stubbed"}' });
    return route.continue();
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('cate-pill-ALL').waitFor();
  await page.getByTestId('featured-grid').locator('img').first().waitFor();
  return page;
}

const titles = (page) => page.getByTestId('featured-grid').locator('h3').allTextContents();
const settle = async (page) => {
  let last = -1, same = 0;
  for (let i = 0; i < 100; i++) {
    const y = await page.evaluate(() => scrollY);
    same = y === last ? same + 1 : 0; last = y;
    if (same >= 5) return y;
    await page.waitForTimeout(60);
  }
  throw new Error('scroll did not settle');
};
const logos = (page) => page.locator('img[alt="TopVNSport Logo"]').evaluateAll((imgs) => imgs.filter((i) => i.offsetParent).map((i) => ({ src: i.getAttribute('src'), natural: i.naturalWidth, w: Math.round(i.getBoundingClientRect().width) })));
const geometry = (page) => page.evaluate(() => {
  const hb = document.getElementById('topvnsport-header').getBoundingClientRect().bottom;
  const shelf = document.querySelector('[data-testid="instock-shelf"]');
  return { scrollY: Math.round(scrollY), headerBottom: Math.round(hb), shelfTop: Math.round(shelf.getBoundingClientRect().top), h2Top: Math.round(shelf.querySelector('h2').getBoundingClientRect().top), docH: document.documentElement.scrollHeight, viewH: innerHeight };
});

async function viewport(browser, w, h) {
  const page = await open(browser, w, h);
  console.log(`--- ${w}px`);
  check(`${w}: tải trang không gọi scrollIntoView`, await page.evaluate(() => window.__sic.length), 0);
  const logoList = await logos(page);
  info(`${w}: logo hiển thị`, logoList);
  check(`${w}: có logo hiển thị, mọi logo src repo và naturalWidth>0`, logoList.length > 0 && logoList.every((l) => l.src === '/topvnsport-logo.webp' && l.natural > 0), true);
  check(`${w}: không còn ô chữ TVN`, await page.getByText('TVN', { exact: true }).count(), 0);
  const before = await titles(page);
  check(`${w}: ALL aria-selected trước khi bấm`, await page.getByTestId('cate-pill-ALL').getAttribute('aria-selected'), 'true');
  await page.screenshot({ path: `${SHOTS}/before-${w}.png` });
  await page.getByTestId('cate-pill-CAT_GIAY').click();
  const y = await settle(page);
  const after = await titles(page);
  const g = await geometry(page);
  await page.screenshot({ path: `${SHOTS}/after-${w}.png` });
  info(`${w}: tên SP kệ trước`, before); info(`${w}: tên SP kệ sau`, after); info(`${w}: hình học sau khi bấm`, g);
  check(`${w}: kệ đổi sản phẩm (6 giày)`, after.length === 6 && after.every((t) => t.startsWith('Giày')) && before.some((t) => t.startsWith('Vợt')), true);
  check(`${w}: chip Giày aria-selected, ALL không`, [await page.getByTestId('cate-pill-CAT_GIAY').getAttribute('aria-selected'), await page.getByTestId('cate-pill-ALL').getAttribute('aria-selected')], ['true', 'false']);
  check(`${w}: trang đã cuộn xuống kệ`, y > 0 && g.scrollY === y, true);
  check(`${w}: đỉnh kệ nằm ngay dưới header (0..32px)`, g.shelfTop - g.headerBottom >= 0 && g.shelfTop - g.headerBottom <= 32, true);
  check(`${w}: không rời trang chủ`, new URL(page.url()).pathname, '/');
  check(`${w}: scrollIntoView gọi 1 lần vào kệ, smooth`, await page.evaluate(() => window.__sic), [{ target: 'instock-shelf', behavior: 'smooth', block: 'start' }]);
  await page.context().close();
}

// Quét nhiều độ rộng: chiều cao header sticky thay đổi theo bề rộng, kệ phải luôn dừng ngay dưới header.
async function sweep(browser, w) {
  const page = await open(browser, w, 900);
  await page.getByTestId('cate-pill-CAT_GIAY').click();
  await settle(page);
  const g = await geometry(page);
  info(`${w}: header cao / đỉnh kệ`, [g.headerBottom, g.shelfTop]);
  check(`${w}: đỉnh kệ nằm ngay dưới header (0..32px)`, g.shelfTop - g.headerBottom >= 0 && g.shelfTop - g.headerBottom <= 32, true);
  await page.context().close();
}

async function motion(browser, reduce) {
  const page = await open(browser, 1440, 900, reduce ? { reducedMotion: 'reduce' } : {});
  const mid = await page.evaluate(async () => { document.querySelector('[data-testid="cate-pill-CAT_GIAY"]').click(); await new Promise((r) => setTimeout(r, 40)); return Math.round(scrollY); });
  const fin = await settle(page);
  const call = (await page.evaluate(() => window.__sic))[0];
  info(`${reduce ? 'reduce' : 'normal'}: scrollY sau 40ms / cuối`, [mid, fin]);
  check(`${reduce ? 'reduce' : 'normal'}: behavior truyền vào scrollIntoView`, call.behavior, reduce ? 'auto' : 'smooth');
  check(`${reduce ? 'reduce' : 'normal'}: ${reduce ? 'nhảy thẳng tới đích' : 'còn đang cuộn mượt'} sau 40ms`, reduce ? mid === fin : mid < fin, true);
  await page.context().close();
}

async function mobileRow(browser, w) {
  const page = await open(browser, w, 800);
  const m = await page.getByRole('button', { name: 'Đan cước' }).evaluate((b) => {
    const row = b.parentElement; const wm = [...row.querySelectorAll('div')].find((d) => d.textContent === 'TOPVNSPORT');
    return { rowScroll: row.scrollWidth, rowClient: row.clientWidth, wmScroll: wm.scrollWidth, wmClient: wm.clientWidth, cartRight: Math.round(row.lastElementChild.getBoundingClientRect().right), vw: innerWidth };
  });
  info(`${w}: hàng mobile`, m);
  check(`${w}: hàng mobile không tràn ngang`, m.rowScroll <= m.rowClient && m.cartRight <= m.vw, true);
  if (w >= 375) check(`${w}: wordmark không bị cắt chữ (STOR-071)`, m.wmScroll <= m.wmClient, true);
  else info(`${w}: wordmark cắt bằng dấu … theo min-w-0 truncate (thiết kế STOR-068)`, m.wmScroll > m.wmClient);
  await page.context().close();
}

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  let browser;
  try {
    await waitPort();
    browser = await chromium.launch();
    await viewport(browser, 1440, 900);
    await viewport(browser, 390, 844);
    await motion(browser, false);
    await motion(browser, true);
    for (const w of [320, 375, 390]) await mobileRow(browser, w);
    for (const w of [320, 360, 430, 767, 768, 900, 944, 948, 949, 950, 960, 1023, 1280, 1920]) await sweep(browser, w);
    const page = await open(browser, 390, 844);
    await page.goto(BASE + '/catalog', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open mobile menu' }).click();
    const drawer = page.locator('#mobile-sidebar-drawer');
    await drawer.getByAltText('TopVNSport Logo').waitFor();
    await page.waitForTimeout(600);
    const d = await drawer.getByAltText('TopVNSport Logo').evaluate((i) => ({ src: i.getAttribute('src'), natural: i.naturalWidth }));
    check('390: logo ngăn kéo src repo, naturalWidth>0', d.src === '/topvnsport-logo.webp' && d.natural > 0, true);
    await page.screenshot({ path: `${SHOTS}/drawer-390.png` });
  } catch (e) {
    fails++;
    console.log('ERROR', e.stack || e.message);
  } finally {
    if (browser) await browser.close();
    process.kill(server.pid, 'SIGTERM'); // chỉ PID đã ghi (r:0b30a607)
    console.log(fails ? `FAILED ${fails}` : 'ALL PASS', '| shots in', SHOTS);
    process.exitCode = fails ? 1 : 0;
  }
})();
