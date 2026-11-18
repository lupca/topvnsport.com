// Guard for the desktop main menu (md and up is always ONE row; links that do not fit move into the "Xem thêm" menu).
// jsdom cannot lay anything out, so this runs the real page in Chromium: home, catalog and a product page at 768/900/1024/1150/1250/1440
// with 12 and with 25 categories. Fails if the menu has more than one row, a link sticks out of the <ul> content box, is lost, duplicated
// or out of order, the row is not packed as full as it can be, a hidden link is in the DOM while the menu is closed, the "Xem thêm" panel
// runs off the window or is cut by a short window, or the page scrolls horizontally. Then label widths are changed under the page
// (what a late web font does; CI blocks the network so a real font swap cannot be used): the row must refit on the very next frames. Fixtures, routes and stubs come from
// e2e/mobile-audit/audit.cjs; only the category list is extended (a later page.route that falls back for everything else).
//   node e2e/desktop-nav-guard.cjs      one line per page, exit 1 on any failure. PORT (default 4430).
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');

process.env.PLAYWRIGHT ||= path.dirname(require.resolve('playwright-core/package.json'));
process.env.PORT ||= '4430';
const { CATS, stub, ROUTES, waitPort, PRODUCTS, STOCK } = require('./mobile-audit/audit.cjs');
const { chromium } = require('playwright-core');

// <ul> is capped at 1280 px, so 1440/1920 fit like 1280: the discriminating widths are the ones below that.
const WIDTHS = [768, 900, 1024, 1150, 1250, 1440];
const COUNTS = [12, 25];
const IDS = ['home', 'catalog', 'pdp-simple'];
const EXTRA = ['Cước Cầu Lông', 'Balo Túi Vợt', 'Phụ Kiện Cầu Lông', 'Quả Cầu Lông', 'Băng Quấn Cán Vợt', 'Tất Thể Thao', 'Bảo Vệ Cổ Chân', 'Mũ Nón Thể Thao', 'Đồng Phục Câu Lạc Bộ', 'Bình Nước Thể Thao', 'Khăn Thể Thao', 'Trụ Cầu Lông Di Động', 'Máy Đan Vợt Điện Tử', 'Sàn Thi Đấu Cầu Lông', 'Dụng Cụ Tập Luyện Phản Xạ Chuyên Nghiệp', 'Phụ Kiện Bảo Hộ Cổ Tay Và Đầu Gối Cao Cấp', 'Giày Chạy Bộ Nhẹ', 'Áo Khoác Thi Đấu Mùa Đông Nhập Khẩu Chính Hãng', 'Băng Trán Cổ Tay', 'Dây Nhảy Thể Lực', 'Bóng Chuyền Hơi'];

// n categories (4 of the audit fixtures + n-4 extra ones, each with one product), in the order the storefront shows them
// (products per category, descending; ties keep the list order, like getCategoriesSortedByCount). Returns the labels in that order.
function withCategories(n) {
  const cats = [], products = [...PRODUCTS], stock = { ...STOCK }; // a copy: audit.cjs's STOCK is shared with the other guards
  for (let i = 0; i < n - 4; i++) {
    const id = 100 + i, name = EXTRA[i % EXTRA.length] + (i >= EXTRA.length ? ` ${i}` : '');
    cats.push({ id, code: `VC9${id}`, name, display_name: `Cầu lông > ${name}` });
    products.push({ ...PRODUCTS.find((p) => p.voma_category_id === 2), id: 9500 + i, slug: `nav-guard-${i}`, name: `Sản phẩm ${name}`, voma_category_id: id, variants: [{ id: 95000 + i, sku_code: `NAVG-${i}`, price: 100000 }] });
    stock[`NAVG-${i}`] = 9;
  }
  const counts = {};
  for (const p of products) counts[p.voma_category_id] = (counts[p.voma_category_id] || 0) + 1;
  const expected = [...CATS, ...cats].filter((c) => counts[c.id]).sort((a, b) => counts[b.id] - counts[a.id]).map((c) => c.name);
  return { cats, products, stock, expected };
}

// The same /api override for every scenario: the categories and products of withCategories(n), everything else falls back to the audit stub.
async function serve(page, { cats, products, stock }) {
  await stub(page);
  await page.route('**/api/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.endsWith('/public/voma-categories')) return json([...CATS, ...cats]);
    if (p.endsWith('/public/products')) return json({ items: products, total: products.length, page: 1, limit: 100, pages: 1 });
    if (p.endsWith('/public/stock')) return json({ stock, items: Object.keys(stock).map((sku) => ({ sku_code: sku, qty_available: stock[sku], qty_on_hand: stock[sku], qty_reserved: 0, stock_code: sku })) });
    return r.fallback();
  });
}

// One page.evaluate: rows of the menu, links and the button against the <ul> CONTENT box (inside its padding), packing, hidden links
// in the DOM while closed, horizontal scroll; then opens "Xem thêm" to read the panel.
async function measure(expected) {
  const nav = document.querySelector('nav[aria-label="Điều hướng chính"]');
  const ul = nav.querySelector('ul');
  const items = [...ul.children].map((li) => li.querySelector('a,button')).filter(Boolean);
  const rect = (e) => e.getBoundingClientRect();
  const rows = new Set(items.map((e) => Math.round(rect(e).top))).size;
  const button = items.find((e) => e.tagName === 'BUTTON');
  const links = items.filter((e) => e !== button);
  const cs = getComputedStyle(ul), ur = rect(ul);
  const cl = ur.left + parseFloat(cs.paddingLeft), cr = ur.right - parseFloat(cs.paddingRight), gap = parseFloat(cs.columnGap);
  const first = rect(items[0]), last = rect(items[items.length - 1]);
  const clipped = items.filter((e) => { const r = rect(e); return r.width < 1 || r.left < cl - 0.5 || r.right > cr + 0.5; }).map((e) => e.textContent.trim());
  const rowLabels = links.slice(1).map((e) => e.textContent.trim());
  // packed: the first hidden label (width from the hidden measuring copy: [home, ...categories, button]) would NOT have fit next to the row
  const widths = [...nav.querySelector('div[aria-hidden="true"]').firstElementChild.children].map((e) => rect(e).width);
  const next = widths[1 + rowLabels.length];
  const slack = button && next !== undefined ? (cr - cl - 1) - (last.right - first.left + gap + next) : null; // > 0 means the next label would have fit
  const navLinks = [...nav.querySelectorAll('a')].map((a) => a.textContent.trim());
  const hiddenInDom = button ? expected.slice(rowLabels.length).filter((l) => navLinks.includes(l)) : [];
  let menuLabels = [], panel = null;
  if (button) {
    button.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const list = document.getElementById(button.getAttribute('aria-controls'));
    if (list) { const r = rect(list); panel = { left: Math.round(r.left), right: Math.round(r.right) }; menuLabels = [...list.querySelectorAll('a')].map((a) => a.textContent.trim()); }
    button.click();
  }
  return { rows, navH: Math.round(rect(nav).height), hasButton: !!button, rowLabels, menuLabels, panel, clipped, slack, hiddenInDom, scrollWidth: document.documentElement.scrollWidth, innerWidth, expected };
}

// Problems found by measure(), as strings.
function problems(m) {
  const why = [];
  if (m.rows !== 1) why.push(`menu has ${m.rows} rows (must be 1)`);
  if (m.clipped.length) why.push(`outside the <ul> content box: ${m.clipped.join(', ')}`);
  if (m.scrollWidth > m.innerWidth) why.push(`page scrolls horizontally (${m.scrollWidth} > ${m.innerWidth})`);
  if (m.panel && (m.panel.right > m.innerWidth || m.panel.left < 0)) why.push(`panel outside the window (${m.panel.left}..${m.panel.right})`);
  if (m.slack !== null && m.slack > 0.5) why.push(`row not packed: the next label would still fit (${m.slack.toFixed(1)}px spare)`);
  if (m.hiddenInDom.length) why.push(`hidden links are in the DOM while closed: ${m.hiddenInDom.join(', ')}`);
  if (m.hasButton && !m.menuLabels.length) why.push('"Xem thêm" opens an empty or missing panel');
  if (JSON.stringify([...m.rowLabels, ...m.menuLabels]) !== JSON.stringify(m.expected)) why.push(`row + menu != all categories in order: row=${m.rowLabels.length} menu=${m.menuLabels.length} expected=${m.expected.length}`);
  return why;
}

// Label widths change under the page (what a web font swap does, deterministically and offline): per painted frame the row must stay
// inside the <ul> content box and one row. The first frame after the change is skipped: a rAF callback runs before ResizeObserver delivery.
async function fontSwap(page, expected, css, wantMore) {
  const before = await page.evaluate(measure, expected);
  await page.addStyleTag({ content: css });
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const out = []; let n = 0;
    const tick = () => {
      const nav = document.querySelector('nav[aria-label="Điều hướng chính"]'), ul = nav.querySelector('ul');
      const els = [...ul.children].map((li) => li.querySelector('a,button')).filter(Boolean), cs = getComputedStyle(ul), ur = ul.getBoundingClientRect();
      const cl = ur.left + parseFloat(cs.paddingLeft), cr = ur.right - parseFloat(cs.paddingRight);
      const rs = els.map((e) => e.getBoundingClientRect());
      out.push({ rows: new Set(rs.map((r) => Math.round(r.top))).size, over: Math.max(0, cl - Math.min(...rs.map((r) => r.left)), Math.max(...rs.map((r) => r.right)) - cr), hscroll: document.documentElement.scrollWidth > innerWidth });
      if (++n < 7) requestAnimationFrame(tick); else resolve(out.slice(1));
    };
    requestAnimationFrame(tick);
  }));
  const after = await page.evaluate(measure, expected);
  const why = [];
  const bad = frames.filter((f) => f.rows !== 1 || f.over > 0.5 || f.hscroll);
  if (bad.length) why.push(`${bad.length}/${frames.length} frames after the width change are broken: ${JSON.stringify(bad[0])}`);
  why.push(...problems(after).map((w) => `after the change: ${w}`));
  if (wantMore ? !(after.rowLabels.length > before.rowLabels.length) : !(after.rowLabels.length < before.rowLabels.length)) why.push(`row did not refit (${before.rowLabels.length} -> ${after.rowLabels.length} categories)`);
  return why;
}

// A short window must not cut the panel: it ends above the bottom edge, scrolls inside, every item reachable by scrolling and by Tab.
async function shortWindow(browser, routes, data, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  try {
    await serve(page, data);
    await routes.find((r) => r.id === 'home').go(page);
    const btn = page.getByRole('button', { name: /Xem thêm/ });
    await btn.click();
    const list = page.locator(`[id="${await btn.getAttribute('aria-controls')}"]`);
    const g = await list.evaluate((p) => { const r = p.getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight, items: p.querySelectorAll('a').length, scrolls: p.scrollHeight > p.clientHeight, overscroll: getComputedStyle(p).overscrollBehaviorY }; });
    const why = [];
    if (g.bottom > g.vh) why.push(`panel bottom ${Math.round(g.bottom)} is below the window (${g.vh})`);
    if (g.overscroll !== 'contain') why.push(`overscroll-behavior is ${g.overscroll}, not contain`);
    const last = list.locator('a').last();
    await btn.focus();
    for (let i = 0; i < g.items; i++) await page.keyboard.press(i === 0 ? 'ArrowDown' : 'Tab');
    const seen = await page.evaluate(() => { const a = document.activeElement, p = a.closest('ul'), pr = p.getBoundingClientRect(), r = a.getBoundingClientRect(); return { text: a.textContent.trim(), inside: r.top >= pr.top - 0.5 && r.bottom <= pr.bottom + 0.5 && r.bottom <= innerHeight }; });
    if (seen.text !== (await last.textContent()).trim()) why.push(`Tab does not reach the last item (stopped at ${seen.text})`);
    else if (!seen.inside) why.push('the last item is focused but not visible inside the panel / window');
    return why;
  } finally { await ctx.close(); }
}

// Keyboard / pointer behaviour of "Xem thêm" in the real browser (jsdom has no Tab order, no native Enter/Space on buttons).
async function keys(page) {
  const why = [];
  const btn = page.getByRole('button', { name: /Xem thêm/ });
  const expanded = async () => (await btn.getAttribute('aria-expanded')) === 'true';
  const onButton = () => page.evaluate(() => document.activeElement?.textContent?.trim() === 'Xem thêm');
  const check = (ok, msg) => { if (!ok) why.push(msg); };
  await btn.focus();
  await page.keyboard.press('Enter'); check(await expanded(), 'Enter does not open');
  await page.keyboard.press('Enter'); check(!(await expanded()), 'Enter does not close');
  await page.keyboard.press('Space'); check(await expanded(), 'Space does not open');
  await page.keyboard.press('Escape'); check(!(await expanded()) && (await onButton()), 'Escape does not close and return focus to the button');
  await page.keyboard.press('ArrowDown'); check(await expanded(), 'ArrowDown does not open');
  const panel = page.locator(`[id="${await btn.getAttribute('aria-controls')}"] a`);
  const total = await panel.count();
  const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim());
  const labels = await panel.allTextContents();
  check((await focused()) === labels[0], 'ArrowDown does not focus the first item');
  for (let i = 1; i < total; i++) { await page.keyboard.press('Tab'); check((await focused()) === labels[i], `Tab #${i} is not item ${i} (${await focused()})`); }
  check(await panel.last().evaluate((a) => a.getBoundingClientRect().height >= 40), 'menu item is shorter than 40px');
  await page.keyboard.press('Tab'); check(!(await expanded()), 'closes when focus leaves the menu');
  await btn.click(); check(await expanded(), 'click does not open');
  await page.mouse.click(5, 700); check(!(await expanded()), 'click outside does not close');
  await btn.click();
  const target = panel.nth(1);
  const code = new URL(await target.evaluate((a) => a.href)).searchParams.get('category');
  await target.click();
  await page.waitForURL(`**/catalog?category=${code}`);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  check(!(await expanded()), 'choosing an item does not close');
  await btn.evaluate((b) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // let React commit the route change
  check(await btn.evaluate((b) => b.className.split(' ').includes('text-brand-primary')), 'button is not active when the current category is hidden');
  await btn.click();
  check((await page.locator(`[id="${await btn.getAttribute('aria-controls')}"] a[aria-current="page"]`).textContent()) === labels[1], 'item in the menu lacks aria-current');
  return why;
}

async function main() {
  const routes = IDS.map((id) => ROUTES.find((r) => r.id === id));
  if (routes.some((r) => !r)) throw new Error(`audit.cjs ROUTES is missing: ${IDS.filter((id, i) => !routes[i]).join(', ')}`);
  const taken = await new Promise((res) => net.connect(+process.env.PORT, '127.0.0.1').once('connect', function () { this.destroy(); res(true); }).once('error', () => res(false)));
  if (taken) { console.log(`ERROR port ${process.env.PORT} already taken; set PORT to a free port`); process.exitCode = 1; return; }
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', process.env.PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  console.log('dev server pid', server.pid);
  const exited = new Promise((_, rej) => server.once('exit', (code) => rej(new Error(`dev server exited early (code ${code}); port ${process.env.PORT} taken?`))));
  exited.catch(() => {});
  let browser, failures = 0;
  try {
    await Promise.race([waitPort(), exited]);
    const owner = execFileSync('ss', ['-ltnpH', `sport = :${process.env.PORT}`], { encoding: 'utf8' });
    if (server.exitCode !== null || !owner.includes(`pid=${server.pid},`)) throw new Error(`port ${process.env.PORT} is not served by dev server pid ${server.pid}`);
    browser = await chromium.launch();
    for (const n of COUNTS) {
      const data = withCategories(n);
      for (const width of WIDTHS) for (const route of routes) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        const tag = `${String(n).padStart(2)} cats ${width}px ${route.id.padEnd(10)}`;
        try {
          await serve(page, data);
          await route.go(page);
          const m = await page.evaluate(measure, data.expected);
          const why = problems(m);
          if (why.length) failures++;
          console.log(`${tag} ${why.length ? 'FAIL' : 'PASS'} rows=${m.rows} nav=${m.navH}px row=${m.rowLabels.length} menu=${m.menuLabels.length}${why.length ? ' -- ' + why.join('; ') : ''}`);
        } catch (e) {
          failures++;
          console.log(`${tag} FAIL error: ${e.message.split('\n')[0]}`);
        } finally {
          await ctx.close();
        }
      }
      // label widths change under an open page: wider labels -> fewer on the row, narrower -> more (catalog route)
      for (const [width, name, css, wantMore] of [[900, 'wider', 'header nav ul a, header nav ul button, header nav [data-label] { letter-spacing: 0.25em !important; }', false], [1150, 'wider', 'header nav ul a, header nav ul button, header nav [data-label] { letter-spacing: 0.25em !important; }', false], [1250, 'narrower', 'header nav ul a, header nav ul button, header nav [data-label] { letter-spacing: -0.12em !important; }', true]]) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        const tag = `${String(n).padStart(2)} cats ${width}px labels ${name}`;
        try {
          await serve(page, data);
          await routes.find((r) => r.id === 'catalog').go(page);
          const why = await fontSwap(page, data.expected, css, wantMore);
          if (why.length) failures++;
          console.log(`${tag.padEnd(36)} ${why.length ? 'FAIL -- ' + why.join('; ') : 'PASS'}`);
        } catch (e) {
          failures++;
          console.log(`${tag} FAIL error: ${e.message.split('\n')[0]}`);
        } finally {
          await ctx.close();
        }
      }
    }
    for (const [n, width, height] of [[25, 1280, 600], [25, 1024, 600], [12, 1024, 540], [25, 768, 480]]) {
      const tag = `${n} cats ${width}x${height} panel`;
      try {
        const why = await shortWindow(browser, routes, withCategories(n), width, height);
        if (why.length) failures++;
        console.log(`${tag.padEnd(36)} ${why.length ? 'FAIL -- ' + why.join('; ') : 'PASS'}`);
      } catch (e) {
        failures++;
        console.log(`${tag} FAIL error: ${e.message.split('\n')[0]}`);
      }
    }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await serve(page, withCategories(12));
      await routes.find((r) => r.id === 'catalog').go(page);
      const why = await keys(page);
      if (why.length) failures++;
      console.log(`keyboard/pointer 1280px 12 cats ${why.length ? 'FAIL -- ' + why.join('; ') : 'PASS'}`);
    } catch (e) {
      failures++;
      console.log(`keyboard/pointer FAIL error: ${e.message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  } catch (e) {
    failures++;
    console.log('ERROR', e.message.split('\n')[0]);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
      try { process.kill(server.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
    }
    console.log(`stopped dev server pid ${server.pid}; ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
  }
}

main();
