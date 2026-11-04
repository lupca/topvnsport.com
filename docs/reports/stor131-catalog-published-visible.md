# STOR-131 — /catalog hiện mọi SP Published (bỏ trần giá mặc định 6 triệu)

Đo prod 04/11/2026, chỉ GET `https://www.topvnsport.com/api` (không ghi gì vào voma-pim/WMS).

## Bằng chứng API

```
GET /api/pmi/public/products?page=1&limit=100 -> {total:100, page:1, limit:100, pages:1, items:100}; 100/100 status "Published"
GET /api/wms/public/stock                       -> {stock:{635 sku}, items:[635 dòng]}; 0 dòng tồn âm
```

SP có giá rẻ nhất (`computed_price`) > 6.000.000đ — đúng 4 SP, trùng khít 4 SP bị thiếu:
`jq '[.items[]|{id,min:([.variants[]|(.computed_price//.price)]|min)}|select(.min>6000000)]'`
→ `[{"id":633,"min":6700000},{"id":623,"min":6450000},{"id":545,"min":6700000},{"id":544,"min":6500000}]`

| SP | Tên | Status | Giá (computed_price) | Tồn WMS (`/public/stock`) | Nguyên nhân bị ẩn |
|---|---|---|---|---|---|
| 544 | Yonex Astrox 99 Pro Gen 3 | Published | 1 SKU `VCLYA99PG3TBVQC-NFDQ-DEFAULT` 6.500.000 | `stock`=0, `qty_available`=0, `OUT_OF_STOCK` | Giá 6,5M > trần mặc định 6M. Hết hàng **không** là nguyên nhân (CatalogPage không lọc theo tồn). |
| 545 | Yonex Arcsaber 11 Pro | Published | 1 SKU `VCLYA11PCHTBVQC-5WGQ-DEFAULT` 6.700.000 | `stock`=2, `LOW_STOCK` | Giá 6,7M > 6M (còn hàng). |
| 623 | Victor Auraspeed HS Plus CNY | Published | 1 SKU `BVCLVAHPCPBTMMTDDC-K88J-DEFAULT` 6.450.000 | `stock`=1, `LOW_STOCK` | Giá 6,45M > 6M (còn hàng). |
| 633 | Yonex 88D Pro 2024 | Published | 6 SKU `VCLY88DP2024KSTDCPCC-VYN7-*` 6.700.000–7.200.000 (rẻ nhất `KHUNG-KHONG-DAY` 6,7M) | 0/6 SKU có dòng trong `stock` và `items` | Giá rẻ nhất 6,7M > 6M. Không có dòng WMS → `applyWmsStock` coi SKU vắng = 0 → hết hàng (gắn nhãn, không ẩn). |

Gốc chung: `catalogSlice.initialState.maxPrice = 6000000` (và `resetCatalogFilters` trả về 6000000);
`CatalogPage` lọc `getCheapestPrice(p) > maxPrice` ngay cả khi khách chưa chạm thanh trượt; thanh trượt có `max="6000000"`
nên khách cũng **không thể** kéo để thấy 4 SP này. Tồn kho không phải nguyên nhân (545, 623 còn hàng).

## Thay đổi

- `src/features/catalog/catalogSlice.ts`: `maxPrice: number | null`, mặc định `null`, `resetCatalogFilters` → `null`; `setMaxPrice(number)` giữ nguyên.
- `src/features/catalog/CatalogPage.tsx`: chỉ lọc giá khi `maxPrice !== null`; bộ đếm bộ lọc chỉ tính khi khác `null`;
  đầu phải thanh trượt = giá rẻ nhất cao nhất trong shop làm tròn lên 100K (prod: 6.700.000 → nhãn `6.7Mđ`);
  chưa chạm → nhãn `Tất cả mức giá`, con trượt ở đầu phải. Không còn literal `6000000`/`6.0Mđ` trong `src/features/catalog`.
- `src/services/sport-api/wmsStock.ts` `parseWmsStock`: kẹp tồn về `>= 0` ở cả nhánh `stock` và nhánh `items` (prod hiện 0 dòng âm; chặn tồn âm làm sai tổng biến thể).
- `ProductCard`: không đổi — đã có nhãn `Hết hàng` khi `stock <= 0`, nút giỏ `disabled` với `title="Sản phẩm hết hàng"`; sắp xếp `in-stock-first` đã đẩy hết hàng xuống cuối.

Prod sau sửa: 100 thẻ, trong đó 29 SP hết hàng hiện nhãn ở cuối danh sách (sắp xếp mặc định).

## Test bảo vệ + đột biến (r:7f8cd4dc)

`src/__tests__/stor131_published_all_visible.test.tsx` — fetch giả trả body prod nguyên dạng (cắt còn 6 SP: 544/545/623/633 + 632 còn hàng + 629 tồn đặt −3),
gọi `sportApi.getProducts` THẬT, render `CatalogPage` với state mặc định của store thật. 15 test.

```
=== MUTATION (a): initial maxPrice 6000000 ===
17:  maxPrice: 6000000,
     × mặc định: số thẻ = total PIM
     × mặc định: có thẻ SP 544
     × mặc định: có thẻ SP 545
     × mặc định: có thẻ SP 623
     × mặc định: có thẻ SP 633
     × slice: maxPrice ban đầu null; resetCatalogFilters về null
     × thanh trượt chưa chạm: nhãn "Tất cả mức giá", đầu phải = giá cao nhất làm tròn lên
     × hết hàng: 544, 633 gắn nhãn, nằm sau thẻ còn hàng, nút giỏ khoá
 Test Files  1 failed (1)
      Tests  8 failed | 7 passed (15)
=== (a) REVERTED ===
 Test Files  1 passed (1)
      Tests  15 passed (15)
=== MUTATION (b): clamp removed in stock branch ===
23:      result[sku] = Number(qty) || 0;
     × tồn âm qua getProducts thật kẹp về 0 (629)
     × parseWmsStock nhánh stock: tồn âm -> 0
 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)
=== (b) REVERTED ===
 Test Files  1 passed (1)
      Tests  15 passed (15)
=== MUTATION (c): clamp removed in items branch ===
28:        result[item.sku_code] = Number(item.qty_available ?? item.qty_on_hand ?? 0) || 0;
     × parseWmsStock nhánh items: tồn âm -> 0
 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
=== (c) REVERTED ===
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

## CI trên cây hợp nhất (HEAD = origin/main = c93b987 + thay đổi này)

```
npm ci              EXIT=0
npm run lint        EXIT=0   (0 errors, 19 warnings có sẵn, không ở file của task này)
npm run typecheck   EXIT=0
npm run test        EXIT=0   Test Files 127 passed (127) | Tests 1498 passed (1498)
npm run build       EXIT=0
```

## Walk Playwright (r:75b60f55) — `node scripts/stor131-walk`

Vite dev (PID ghi lại, tắt bằng PID), mọi GET `/api/**` chuyển tới prod (chỉ đọc, non-GET bị chặn). Tìm qua ô tìm kiếm ở header như khách.

```
PIM total (prod GET) 100 | names containing "astrox 99 pro": [ '544' ]
PASS default card count = PIM total: 100
PASS price label untouched: true
PASS card 544 present: 1
PASS card 545 present: 1
PASS card 623 present: 1
PASS card 633 present: 1
PASS 633 Hết hàng visible: true
PASS 633 cart button disabled: true
PASS out-of-stock 544/633 after in-stock 545/623: true
PASS search result cards = PIM names matching: ["544"]
PASS search finds 544: 1
PASS 544 Hết hàng visible: true
ALL PASS | shots in /tmp/stor131/shots
```

## Ngoài phạm vi (STOR-132)

Ngành chỉ có SP hết hàng trong menu/ô ngành/chip (`categories.ts`, `Header.tsx`, `HomePage.tsx`) và mọi cập nhật spec.
Không spec_item active nào nói về trần giá 6M; 29727bc4 (nhãn Hết hàng), 02c4e7f4 (thứ tự sắp xếp), a4f6975e (đủ total PIM) vẫn đúng.
