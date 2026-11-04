// STOR-125/127 footer research: measures which footer blocks exist (yes/no only, never competitor text) on three
// competitor sites and on our own rendered footer, then writes docs/stor125-footer-report.md (Table 1 only).
// Competitor sites: read-only, page load + a wait only (no login, no form, no clicks), 1440x900.
// Our footer: vite dev on a free port (PID recorded, killed by PID, r:0b30a607) with /api/* fixtures,
// unless OURS_URL is set. A competitor failure -> 'khong doc duoc' in that column only, exit 0.
// Our footer failure -> error printed, report left untouched, exit 1.
// Usage: node scripts/stor125-footer-research/extract.cjs [--selftest]   (SITES=a,b,c  OURS_URL=...  PLAYWRIGHT=...)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const pwPath = process.env.PLAYWRIGHT || path.join(execSync('npm root -g').toString().trim(), 'playwright-core');
const { chromium } = require(pwPath);

const ROOT = path.join(__dirname, '..', '..');
const REPORT = path.join(ROOT, 'docs', 'stor125-footer-report.md');
const SITES = (process.env.SITES || 'https://shopvnb.com/,http://yonex.vn/,https://hvshop.vn/').split(',').map((s) => s.trim()).filter(Boolean);
const YONEX_HTTP = /^http:\/\/yonex\.vn\/?$/;
const VIEWPORT = { width: 1440, height: 900 };
const FAIL = 'khong doc duoc';
const OURS_SELECTOR = '#topvnsport-footer section.bg-footer-bg';

// [key, row label]; the last two are not required.
const ROWS = [
  ['address', 'Tên shop và địa chỉ (shop name and address)'],
  ['hotline', 'Hotline'],
  ['email', 'Email'],
  ['stores', 'Hệ thống cửa hàng (store system)'],
  ['doiTra', 'Chính sách đổi trả (doi tra policy)'],
  ['baoHanh', 'Chính sách bảo hành (bao hanh policy)'],
  ['vanChuyen', 'Chính sách vận chuyển (van chuyen policy)'],
  ['thanhToan', 'Chính sách thanh toán (thanh toan policy)'],
  ['baoMat', 'Chính sách bảo mật (bao mat policy)'],
  ['social', 'Liên kết mạng xã hội (social links)'],
  ['registration', 'Đăng ký kinh doanh (business registration)'],
  ['kiemHang', 'Chính sách kiểm hàng (kiem hang) — không bắt buộc (not required)'],
  ['dieuKhoan', 'Điều khoản sử dụng (dieu khoan) — không bắt buộc (not required)'],
];

// Patterns are strings so they survive serialisation into the page.
const DETECT = {
  // lines matching this are dropped before the address and hotline patterns (a GPKD number is not a phone/address)
  regLine: 'gpkd|đkkd|dkkd|giấy phép|giay phep|mã số thuế|ma so thue',
  address: 'địa chỉ|dia chi|(?:số|ngõ|ngách|đường|phố|phường|quận)\\s*\\d|\\d+[^\\n]{0,40}(?:đường|phố|ngõ|phường|quận|tp\\.|thành phố)',
  hotline: '(?:\\+84|\\b0)(?:[\\s.-]?\\d){8,10}\\b',
  // run on the unfiltered text
  text: {
    email: '[\\w.+-]+@[\\w-]+\\.[\\w.]+',
    stores: 'hệ thống cửa hàng|cửa hàng trải nghiệm|hệ thống showroom',
    registration: 'gpkd|đkkd|dkkd|mã số thuế|\\bmst\\b|giấy phép|đăng ký kinh doanh|giấy chứng nhận|bộ công thương',
  },
  href: {
    hotline: '^tel:',
    email: '^mailto:',
    stores: '/stores\\b|he-thong-cua-hang|showroom',
    social: 'facebook\\.com|fb\\.com|tiktok\\.com|zalo\\.me|zalo\\.vn|youtube\\.com|youtu\\.be|instagram\\.com',
    registration: 'online\\.gov\\.vn|dangkywebvoibocongthuong',
  },
  // anchor text or href slug
  link: {
    doiTra: 'đổi trả|đổi hàng|hoàn tiền|doi-tra|doi-hang|hoan-tien',
    baoHanh: 'bảo hành|bao-hanh',
    vanChuyen: 'vận chuyển|giao hàng|van-chuyen|giao-hang',
    thanhToan: 'thanh toán|thanh-toan',
    baoMat: 'bảo mật|bao-mat|privacy',
    kiemHang: 'kiểm hàng|kiem-hang',
    dieuKhoan: 'điều khoản|dieu-khoan|terms',
  },
};

// Runs in the page. Returns booleans only.
function detectInPage({ selector, detect }) {
  let root = selector ? document.querySelector(selector) : null;
  if (!selector) {
    const f = document.querySelectorAll('footer');
    root = f.length ? f[f.length - 1] : [...document.querySelectorAll('[id*=footer i],[class*=footer i]')].pop() || null;
  }
  if (!root) throw new Error('no footer element');
  const re = (s) => new RegExp(s, 'iu');
  const text = root.innerText || root.textContent || '';
  const dropReg = (t) => t.split('\n').filter((l) => !re(detect.regLine).test(l)).join('\n');
  const anchors = [...root.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href') || '', text: a.innerText || a.getAttribute('title') || '' }));
  const iframes = [...root.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || '');
  const out = {
    address: re(detect.address).test(dropReg(text)),
    hotline: re(detect.hotline).test(dropReg(text)),
  };
  for (const [k, s] of Object.entries(detect.text)) out[k] = re(s).test(text);
  for (const [k, s] of Object.entries(detect.href)) out[k] = Boolean(out[k]) || anchors.some((a) => re(s).test(a.href));
  out.social = out.social || iframes.some((src) => re(detect.href.social).test(src));
  out.social = out.social || Boolean(root.querySelector('.fb-page'));
  for (const [k, s] of Object.entries(detect.link)) out[k] = anchors.some((a) => re(s).test(a.text) || re(s).test(a.href));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errCode = (e) => (String(e && e.message).match(/net::ERR_[A-Z_]+/) || [String(e && e.name) || 'Error'])[0];
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  s.on('error', rej);
});

// /api fixtures for our footer, same pattern as scripts/stor107-walk.
const ITEMS = [1, 2].map((i) => ({
  id: 700 + i, name: `Vợt fixture ${i}`, slug: `vot-fixture-${i}`, description: 'Vợt test.', voma_category_id: 1, image: '',
  attribute_values: [], tier_variations: [],
  variants: [{ id: 70000 + i, product_id: 700 + i, tier_1_option: null, sku_code: `FIX-${i}`, price: 2000000 }],
}));
const STOCK = { stock: Object.fromEntries(ITEMS.map((_, i) => [`FIX-${i + 1}`, 5])), items: ITEMS.map((_, i) => ({ sku_code: `FIX-${i + 1}`, qty_available: 5, qty_on_hand: 5, qty_reserved: 0, stock_code: `FIX-${i + 1}` })) };
const CATS = [{ id: 1, code: 'VC001491', name: 'Vợt cầu lông', display_name: 'Vợt cầu lông' }];

async function measureOurs(browser) {
  let server;
  let base = process.env.OURS_URL;
  try {
    if (!base) {
      const port = await freePort();
      base = `http://127.0.0.1:${port}/`;
      server = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
      console.log(`dev server pid ${server.pid} port ${port}`);
      for (let i = 0; ; i++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        if (server.exitCode !== null) throw new Error(`dev server exited with code ${server.exitCode}`);
        if (i > 120) throw new Error('dev server did not start');
        await sleep(500);
      }
    }
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    try {
      const page = await ctx.newPage();
      if (server) {
        await page.route('**/api/**', (route) => {
          const p = new URL(route.request().url()).pathname;
          const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
          if (p.endsWith('/public/stock')) return json(STOCK);
          if (p.endsWith('/public/voma-categories')) return json(CATS);
          if (p.endsWith('/public/products')) return json({ items: ITEMS, total: ITEMS.length, page: 1, limit: 100, pages: 1 });
          if (p.endsWith('/branches')) return json([]);
          return json({ detail: 'stor125: not stubbed' }, 404);
        });
      }
      await page.goto(base, { timeout: 30000 });
      await page.locator(OURS_SELECTOR).waitFor({ timeout: 30000 });
      return await page.evaluate(detectInPage, { selector: OURS_SELECTOR, detect: DETECT });
    } finally {
      await ctx.close();
    }
  } finally {
    if (server && server.exitCode === null) { process.kill(server.pid); console.log(`killed dev server pid ${server.pid}`); } // recorded PID only (r:0b30a607)
  }
}

async function measureSite(browser, url) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  try {
    const page = await ctx.newPage();
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await sleep(5000); // let a JS redirect happen; no interaction
    await page.waitForLoadState('load').catch(() => {});
    const httpUrl = resp ? resp.url() : url; // after HTTP redirects
    return { finalUrl: page.url(), httpUrl, result: await page.evaluate(detectInPage, { selector: null, detect: DETECT }) };
  } finally {
    await ctx.close();
  }
}

async function selftest() {
  const browser = await chromium.launch();
  let fails = 0;
  const check = (label, got, want) => {
    const ok = got === want;
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${got}${ok ? '' : ' want ' + want}`);
  };
  try {
    const page = await browser.newPage();
    const run = async (html) => { await page.setContent(html); return page.evaluate(detectInPage, { selector: null, detect: DETECT }); };
    const gpkd = await run('<footer><p>Shop ABC</p><p>GPKD số 0101234567 cấp ngày 01/01/2020</p></footer>');
    check('GPKD line is not counted as address', gpkd.address, false);
    check('GPKD line is not counted as hotline', gpkd.hotline, false);
    check('GPKD counts as business registration', gpkd.registration, true);
    check('"Địa chỉ" label counts as address', (await run('<footer><p>Địa chỉ:</p><p>Hà Nội</p></footer>')).address, true);
    const iframe = await run('<footer><iframe src="https://www.facebook.com/plugins/page.php?href=x"></iframe></footer>');
    check('iframe facebook src counts as social', iframe.social, true);
    const fbPage = await run('<footer><div class="fb-page" data-href="x"></div></footer>');
    check('.fb-page counts as social', fbPage.social, true);
    const plain = await run('<footer><p>Shop ABC</p></footer>');
    check('plain footer has no social', plain.social, false);
    check('plain footer has no registration', plain.registration, false);
  } finally {
    await browser.close();
  }
  console.log(fails ? `selftest RED: ${fails} failed` : 'selftest GREEN');
  process.exitCode = fails ? 1 : 0;
}

async function main() {
  const browser = await chromium.launch();
  const cols = [];
  const notes = [];
  try {
    let ours;
    try {
      ours = await measureOurs(browser);
      console.log('ours', JSON.stringify(ours));
    } catch (e) {
      console.error(`own footer (${OURS_SELECTOR}) failed: ${e.message.split('\n')[0]}; report not written`);
      process.exitCode = 1;
      return;
    }
    for (const url of SITES) {
      try {
        const m = await measureSite(browser, url);
        cols.push({ label: m.finalUrl, result: m.result });
        console.log(url, '->', m.finalUrl, JSON.stringify(m.result));
        if (YONEX_HTTP.test(url)) {
          if (m.httpUrl !== url) notes.push(`- ${url} chuyển hướng HTTP tới ${m.httpUrl}.`);
          if (m.finalUrl !== m.httpUrl) notes.push(`- ${m.httpUrl} chuyển hướng bằng JS tới ${m.finalUrl}; cột này được đặt tên theo URL cuối ${m.finalUrl}.`);
          if (m.finalUrl === url) notes.push(`- ${url} không chuyển hướng ở lần chạy này.`);
        }
      } catch (e) {
        cols.push({ label: url, result: null });
        console.error(`${url}: ${FAIL}: ${e.message.split('\n')[0]}`);
        if (YONEX_HTTP.test(url)) notes.push(`- ${url}: ${FAIL}, không xác định được URL cuối.`);
      }
    }
    if (SITES.some((u) => YONEX_HTTP.test(u))) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      try {
        await (await ctx.newPage()).goto('https://yonex.vn/', { waitUntil: 'load', timeout: 30000 });
        notes.push('- https://yonex.vn/ mở được, không lỗi TLS ở lần chạy này.');
      } catch (e) {
        const code = errCode(e);
        console.error(`https://yonex.vn/: ${code}`);
        notes.push(`- https://yonex.vn/ không mở được, lỗi TLS: ${code}.`);
      } finally {
        await ctx.close();
      }
    }
    writeReport(cols, ours, notes);
  } finally {
    await browser.close();
  }
}

function writeReport(cols, ours, notes) {
  const cell = (r, k) => (r ? (r[k] ? 'yes' : 'no') : FAIL);
  const head = [...cols.map((c) => c.label), 'Footer của chúng ta'];
  const lines = [
    '# STOR-125 — Nghiên cứu footer',
    '',
    `Sinh tự động bởi \`scripts/stor125-footer-research/extract.cjs\` ngày ${new Date().toISOString().slice(0, 10)} (viewport 1440x900, chỉ tải trang, không đăng nhập, không gửi form, không bấm). Ô chỉ ghi yes / no / '${FAIL}'; không chép nội dung của site khác.`,
    '',
    '## Bảng 1 — Các khối trong footer',
    '',
    `| Khối | ${head.join(' | ')} |`,
    `|---|${head.map(() => '---').join('|')}|`,
    ...ROWS.map(([k, label]) => `| ${label} | ${[...cols.map((c) => cell(c.result, k)), cell(ours, k)].join(' | ')} |`),
    '',
    'Hai dòng cuối (kiểm hàng, điều khoản) chỉ ghi nhận thêm, không bắt buộc (not required).',
    '',
    '## Ghi chú',
    '',
    ...notes,
    `- Cột "Footer của chúng ta" được đo trên footer render thật (\`${OURS_SELECTOR}\`, vite dev với dữ liệu /api giả).`,
    '',
  ];
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, lines.join('\n'));
  console.log('wrote', path.relative(ROOT, REPORT));
}

module.exports = { detectInPage, DETECT };

if (require.main === module) {
  (process.argv.includes('--selftest') ? selftest() : main()).catch((e) => { console.error(e); process.exitCode = 1; });
}
