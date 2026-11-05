// STOR-150 (goal 2c881ad4): before/after report for the mobile audit + 1440px check against desktop-baseline/.
//   node e2e/mobile-audit/audit.cjs --label=after   (first: after/, after.json, 1440 shots + geometry.json in AFTER_DESKTOP_OUT)
//   node e2e/mobile-audit/compare.cjs               -> docs/mobile-audit/after.md
// Numbers only (r:8a172b17): MOB-x via audit.cjs violations(); 1440 = PNG byte compare, then a zlib PNG decode for a
// pixel diff (count + bounding box + rows), mapped onto the landmark boxes measured at 1440 on the scanned tree.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { violations, ROUTES, MOBILE_WIDTHS, AFTER_DESKTOP_OUT, OUT } = require('./audit.cjs');

// Minimal PNG decoder: 8-bit RGB/RGBA, non-interlaced (what Playwright's screenshot writes).
function decodePng(buf) {
  let pos = 8, w, h, ct, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9];
      if (d[8] !== 8 || ![2, 6].includes(ct) || d[12] !== 0) throw new Error('unsupported PNG (need 8-bit RGB/RGBA, non-interlaced)');
    } else if (type === 'IDAT') idat.push(d);
    pos += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + x] = (raw[src + x] + p) & 255;
    }
  }
  return { w, h, bpp, px };
}

// Differing pixels (any RGB channel), their bounding box, and the y-bands (gaps < 8px merged).
function pixelDiff(a, b, pts) {
  if (a.w !== b.w || a.h !== b.h) return { sizeA: `${a.w}x${a.h}`, sizeB: `${b.w}x${b.h}`, count: -1 };
  let count = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const rows = [];
  for (let y = 0; y < a.h; y++) {
    let rowHit = false;
    for (let x = 0; x < a.w; x++) {
      const i = (y * a.w + x) * a.bpp, j = (y * b.w + x) * b.bpp;
      if (a.px[i] !== b.px[j] || a.px[i + 1] !== b.px[j + 1] || a.px[i + 2] !== b.px[j + 2]) {
        count++; rowHit = true; if (pts) pts.push([x, y]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    if (rowHit) { const last = rows[rows.length - 1]; if (last && y - last[1] < 8) last[1] = y; else rows.push([y, y]); }
  }
  return { count, pct: (100 * count) / (a.w * a.h), box: count ? [x0, y0, x1, y1] : null, bands: rows };
}

function selftest() {
  // round-trip through a tiny hand-built PNG with every filter type, then a 1-pixel change
  const w = 5, h = 5, bpp = 3, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let i = 0; i < px.length; i++) px[i] = (i * 37) & 255;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    const f = y % 5; raw[y * (stride + 1)] = f;
    for (let x = 0; x < stride; x++) {
      const o = y * stride, a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
      const p = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      raw[y * (stride + 1) + 1 + x] = (px[o + x] - p) & 255;
    }
  }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return Buffer.concat([l, Buffer.from(t), d, Buffer.alloc(4)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const d = decodePng(png);
  const ok1 = d.px.equals(px);
  const e = { ...d, px: Buffer.from(d.px) }; e.px[(3 * w + 2) * bpp + 1] ^= 1;
  const r = pixelDiff(d, e), same = pixelDiff(d, d);
  const ok2 = r.count === 1 && r.box.join() === '2,3,2,3' && same.count === 0;
  console.log(`${ok1 ? 'PASS' : 'FAIL'} decodePng round-trip (filters 0-4)`);
  console.log(`${ok2 ? 'PASS' : 'FAIL'} pixelDiff finds exactly the changed pixel at (2,3), 0 on identical`);
  process.exitCode = ok1 && ok2 ? 0 : 1;
}

// Known causes of a 1440 diff: changes merged AFTER desktop-baseline/ was shot (1f319b5, STOR-128) that are not mobile fixes.
// A diff region whose element matches none of these is reported as CHƯA RÕ (unexplained) and fails the run.
const CAUSES = [
  { id: 'floating-contact', match: (e) => /floating-contact/.test(e.sel), why: 'cụm nút nổi Zalo + hotline góc phải dưới (`FloatingContact`, merge STOR-129 c93b987) vào main sau khi chụp desktop-baseline (1f319b5); không có trong ảnh mốc. Không phải lỗi bố cục, không do STOR-143..148' },
  { id: 'price-label', match: (e) => /^Tất cả mức giá$/.test(e.t), why: 'nhãn bộ lọc giá đổi "6.000.000đ" → "Tất cả mức giá" vì STOR-131 (4a009f6) bỏ trần giá mặc định 6 triệu, merge sau khi chụp desktop-baseline. Không phải lỗi bố cục' },
];
const SHADOW = 24; // px around a fixed element's box that its box-shadow can paint

// Attribute diff pixels: first to a fixed element (box + SHADOW), else to the smallest element containing the residual bbox.
function attribute(pts, geo) {
  const fixed = geo.els.filter((e) => e.fixed && !(e.x1 - e.x0 > 1400 && e.y1 - e.y0 > 850)).sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0)).reverse();
  const groups = new Map();
  const add = (key, el, x, y) => { const g = groups.get(key) || { el, n: 0, box: [x, y, x, y] }; g.n++; g.box = [Math.min(g.box[0], x), Math.min(g.box[1], y), Math.max(g.box[2], x), Math.max(g.box[3], y)]; groups.set(key, g); };
  const rest = [];
  for (const [x, y] of pts) {
    const f = fixed.find((e) => x >= e.x0 - SHADOW && x <= e.x1 + SHADOW && y >= e.y0 - SHADOW && y <= e.y1 + SHADOW);
    if (f) add('fixed:' + f.sel, f, x, y); else rest.push([x, y]);
  }
  // residual: split into y-bands (gap >= 8px), one container per band
  rest.sort((a, b) => a[1] - b[1]);
  const bands = [];
  for (const p of rest) { const l = bands[bands.length - 1]; if (l && p[1] - l[l.length - 1][1] < 8) l.push(p); else bands.push([p]); }
  for (const band of bands) {
    const bx = [Math.min(...band.map((p) => p[0])), band[0][1], Math.max(...band.map((p) => p[0])), band[band.length - 1][1]];
    const inside = geo.els.filter((e) => e.x0 <= bx[0] && e.y0 <= bx[1] && e.x1 >= bx[2] + 1 && e.y1 >= bx[3] + 1)
      .sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0));
    const el = inside[0] || { sel: '(không phần tử)', t: '' };
    band.forEach(([x, y]) => add('el:' + el.sel + bx[1], el, x, y));
  }
  return [...groups.values()].map((g) => ({ ...g, cause: CAUSES.find((c) => c.match(g.el)) }));
}

const arrow = (a, b) => (a === b ? `${a}` : `${a}→${b}`);
const mobs = (rec) => [...new Set(violations(rec).map((v) => v.mob.replace('MOB-', '')))].sort().join('') || '—';

function main() {
  const before = JSON.parse(fs.readFileSync(path.join(OUT, 'before.json'), 'utf8'));
  const after = JSON.parse(fs.readFileSync(path.join(OUT, 'after.json'), 'utf8'));
  const geo = JSON.parse(fs.readFileSync(path.join(AFTER_DESKTOP_OUT, 'geometry.json'), 'utf8'));
  const recs = after.records;
  const sha = after.scannedSha.replace('+dirty', '');
  const merged = ['143', '144', '145', '146', '147', '148', '158', '160', '161', '162'].map((n) => `STOR-${n}`)
    .filter((t) => execSync(`git log --first-parent --format=%s ${sha}`, { cwd: path.join(__dirname, '..', '..') }).toString().split('\n').some((l) => l.startsWith(`Merge ${t}:`)));
  if (!['143', '144', '145', '146', '147', '148'].every((n) => merged.includes(`STOR-${n}`))) throw new Error(`scanned ${sha} lacks a STOR-143..148 merge: has ${merged}`);
  const find = (list, r, w) => list.find((x) => x.route === r && x.width === w);
  const missing = [];
  ROUTES.forEach((r) => MOBILE_WIDTHS.forEach(([w]) => {
    if (!find(recs, r.id, w)) missing.push(`after.json ${r.id}-${w}`);
    if (!fs.existsSync(path.join(OUT, 'after', `${r.id}-${w}.png`))) missing.push(`after/${r.id}-${w}.png`);
  }));
  if (missing.length) throw new Error('missing: ' + missing.join(', '));

  // ---- before/after table
  const perMob = {};
  const rows = [];
  for (const r of ROUTES) for (const [w] of MOBILE_WIDTHS) {
    const b = find(before, r.id, w), a = find(recs, r.id, w);
    for (const [tag, rec] of [['b', b], ['a', a]]) violations(rec).forEach((v) => { perMob[v.mob] = perMob[v.mob] || { b: 0, a: 0 }; perMob[v.mob][tag]++; });
    rows.push(`| \`${r.id}\` | ${w} | ${mobs(b)} | ${mobs(a)}${a.apiError ? ' ⚠ /api 503 (f7549ebc)' : ''} | ${b.a_top_fixed.h0} | ${a.a_top_fixed.h0} | ${arrow(b.a_top_fixed.rowsScrolled, a.a_top_fixed.rowsScrolled)} | ${arrow(b.c_nav_rows, a.c_nav_rows)} | ${arrow(b.h_promo_lines.lines, a.h_promo_lines.lines)} | ${arrow(b.d_small_targets.count, a.d_small_targets.count)} | ${arrow(b.e_small_text.count, a.e_small_text.count)} | ${arrow(b.f_small_inputs.count, a.f_small_inputs.count)} | ${arrow(b.g_bottom_overlap.covers ? 'che' : '—', a.g_bottom_overlap.covers ? 'che' : '—')} | ${b.b_overflow_x.scrollWidth}/${b.b_overflow_x.clientWidth} | ${a.b_overflow_x.scrollWidth}/${a.b_overflow_x.clientWidth} |`);
  }
  const apiErr = recs.filter((x) => x.apiError).map((x) => `${x.route}-${x.width}`).concat(Object.keys(geo).filter((k) => geo[k].apiError).map((k) => `${k}-1440`));

  // ---- 1440 vs desktop-baseline
  const desk = [];
  for (const r of ROUTES) {
    const fb = path.join(OUT, 'desktop-baseline', `${r.id}-1440.png`), fa = path.join(AFTER_DESKTOP_OUT, `${r.id}-1440.png`);
    const bb = fs.readFileSync(fb), ab = fs.readFileSync(fa);
    if (bb.equals(ab)) { desk.push({ id: r.id, same: true }); continue; }
    const pts = [];
    const d = pixelDiff(decodePng(bb), decodePng(ab), pts);
    desk.push({ id: r.id, same: false, d, g: geo[r.id], groups: d.count > 0 ? attribute(pts, geo[r.id]) : [] });
  }
  const diffs = desk.filter((x) => !x.same && x.d.count !== 0);
  const unexplained = diffs.filter((x) => x.d.count < 0 || x.groups.some((g) => !g.cause)).map((x) => x.id);
  const box = (b) => `${b[0]},${b[1]}–${b[2]},${b[3]}`;

  const md = `# Quét mobile sau khi sửa (STOR-150, goal 2c881ad4)

Sinh tự động: \`node e2e/mobile-audit/audit.cjs --label=after\` rồi \`node e2e/mobile-audit/compare.cjs\`. Không sửa tay.
Commit đã quét: \`${after.scannedSha}\` (origin/main sau \`git fetch --all --prune\`). Merge mobile có trong commit đó (\`git log --first-parent\`): ${merged.join(', ')}. Mốc trước: \`before.json\` (STOR-128).
Cùng fixture giả, cùng 16 route × 360/390/430/768, cùng phép đo \`measureInPage\` và ánh xạ \`violations()\` như bản trước. Ảnh: \`after/<route>-<độ rộng>.png\`.
Ngưỡng trừ MOB-D chỉ xét ở 360–430px; ở 768px chỉ xét MOB-D.

## Màn "Không tải được…" (lỗi /api 503, goal f7549ebc)

${apiErr.length ? `Các ảnh sau hiện "Không tải được…" dù đã chạy với fixture của audit.cjs; đánh dấu là lỗi /api 503 của goal f7549ebc, **không** tính là lỗi bố cục: ${apiErr.join(', ')}.` : `Không ảnh nào (64 ảnh mobile + 16 ảnh 1440) có chữ "Không tải được" (\`document.body.innerText\`, trường \`apiError\` trong after.json): mọi /api/** được fixture của audit.cjs trả lời, nên không có ảnh nào cần chụp lại hay đánh dấu lỗi /api 503.`}

## Tổng hợp (số dòng route×độ rộng vi phạm)

| MOB | trước | sau |
|---|---|---|
${['MOB-A', 'MOB-B', 'MOB-C', 'MOB-D', 'MOB-E', 'MOB-F', 'MOB-G'].map((k) => `| ${k} | ${(perMob[k] || {}).b || 0} | ${(perMob[k] || {}).a || 0} |`).join('\n')}

## Trước/sau theo route và độ rộng

Cột: MOB vi phạm (chữ cái, — = sạch) · A: \`a_top_fixed.h0\` (px, ≤120) trước và sau, số hàng khi cuộn (phải 1) · B: \`c_nav_rows\` · C: \`h_promo_lines.lines\` · E: \`d_small_targets.count\` (vùng bấm <44px) · F chữ: \`e_small_text.count\` (<14px) · F ô nhập: \`f_small_inputs.count\` (<16px) · G: \`g_bottom_overlap.covers\` · D: \`scrollWidth/clientWidth\` trước và sau. \`x→y\` = trước→sau.

| route | độ rộng | MOB trước | MOB sau | A h0 trước | A h0 sau | A hàng cuộn | B hàng nav | C dòng dải | E vùng bấm <44 | F chữ <14 | F ô nhập <16 | G che | scrollWidth/clientWidth trước | scrollWidth/clientWidth sau |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Lỗi còn lại sau sửa (route | độ rộng | MOB | chi tiết)

| route | độ rộng | MOB | chi tiết |
|---|---|---|---|
${recs.flatMap((x) => violations(x).map((v) => `| ${x.route} | ${x.width} | ${v.mob} | ${v.why.replace(/\|/g, '\\|')} (\`${v.key}\`) |`)).join('\n') || '| — | — | — | không còn lỗi |'}

## 1440px so với desktop-baseline/

Cách so: so byte PNG \`desktop-baseline/<route>-1440.png\` với ảnh 1440 chụp trên commit đã quét (1440x900, màn hình đầu, ảnh tạm trong \`AFTER_DESKTOP_OUT\`, không commit để không đè mốc); nếu khác byte thì giải mã PNG (zlib) và đếm pixel khác, khung bao; mỗi pixel khác được gán cho phần tử fixed chứa nó (hộp + ${SHADOW}px bóng đổ), phần còn lại chia dải y và gán cho phần tử nhỏ nhất chứa khung dải (hình hộp mọi phần tử trong màn hình đầu, đo ở 1440 trên commit đã quét); phần tử khớp danh sách \`CAUSES\` trong compare.cjs thì ghi lý do, không khớp thì ghi **CHƯA RÕ** và script trả exit 1. Kích thước trang (\`scrollWidth×scrollHeight\`) là của bản sau; ảnh mốc chỉ là PNG nên không có kích thước trang trước.

| route | byte | pixel khác | khung bao khác (x0,y0–x1,y1) | trang sau (scrollWidth×scrollHeight, scrollY) | vùng khác → phần tử (pixel, khung) → lý do |
|---|---|---|---|---|---|
${desk.map((x) => x.same ? `| \`${x.id}\` | giống | 0 | — | — | — |` : x.d.count < 0 ? `| \`${x.id}\` | khác | khác kích thước ${x.d.sizeA} vs ${x.d.sizeB} | — | — | CHƯA RÕ |` : `| \`${x.id}\` | khác | ${x.d.count} (${x.d.pct.toFixed(2)}%) | ${x.d.box ? box(x.d.box) : '—'} | ${x.g.scrollWidth}×${x.g.scrollHeight}, ${x.g.scrollY} | ${x.groups.map((g) => `\`${g.el.sel.replace(/\|/g, '\\|')}\`${g.el.t && !g.cause ? ` "${g.el.t}"` : ''} (${g.n}px, ${box(g.box)}) → ${g.cause ? g.cause.id : '**CHƯA RÕ**'}`).join('; ') || '—'} |`).join('\n')}

${diffs.length ? `Route 1440 khác mốc (pixel): ${diffs.map((x) => `\`${x.id}\``).join(', ')}. Route giống byte: ${desk.filter((x) => x.same).map((x) => `\`${x.id}\``).join(', ') || 'không có'}.` : 'Không route nào khác ở 1440px.'}
${unexplained.length ? `\n**CHƯA RÕ lý do** (vùng khác không khớp nguyên nhân đã biết): ${unexplained.join(', ')}.\n` : ''}
### Lý do khác ở 1440px

${CAUSES.filter((c) => diffs.some((x) => x.groups.some((g) => g.cause === c))).map((c) => `- \`${c.id}\` (${diffs.filter((x) => x.groups.some((g) => g.cause === c)).map((x) => x.id).join(', ')}): ${c.why}.`).join('\n') || '- không có'}

Không vùng khác nào nằm ngoài các nguyên nhân trên${unexplained.length ? ' — SAI, xem CHƯA RÕ' : ''}: các sửa mobile (${merged.join(', ')}) không đổi pixel nào ở 1440px ngoài những vùng đã liệt kê. \`cart\`, \`checkout\`, \`order-success\` giống byte vì lớp phủ giỏ hàng che cả trang (kể cả cụm nút nổi).
`;
  fs.writeFileSync(path.join(OUT, 'after.md'), md);
  console.log(`wrote after.md: ${rows.length} rows, 1440 differs: ${diffs.map((x) => x.id).join(',') || 'none'}, unexplained: ${unexplained.join(',') || 'none'}, apiError: ${apiErr.length}`);
  if (unexplained.length) process.exitCode = 1;
}

if (process.argv.includes('--selftest')) selftest(); else main();
