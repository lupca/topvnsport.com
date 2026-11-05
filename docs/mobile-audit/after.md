# Quét mobile sau khi sửa (STOR-150, goal 2c881ad4)

Sinh tự động: `node e2e/mobile-audit/audit.cjs --label=after` rồi `node e2e/mobile-audit/compare.cjs`. Không sửa tay.
Commit đã quét: `1090bf54de51` (origin/main sau `git fetch --all --prune`). Merge mobile có trong commit đó (`git log --first-parent`): STOR-143, STOR-144, STOR-145, STOR-146, STOR-147, STOR-148, STOR-158, STOR-160, STOR-161, STOR-162. Mốc trước: `before.json` (STOR-128).
Cùng fixture giả, cùng 16 route × 360/390/430/768, cùng phép đo `measureInPage` và ánh xạ `violations()` như bản trước. Ảnh: `after/<route>-<độ rộng>.png`.
Ngưỡng trừ MOB-D chỉ xét ở 360–430px; ở 768px chỉ xét MOB-D.

## Màn "Không tải được…" (lỗi /api 503, goal f7549ebc)

Không ảnh nào (64 ảnh mobile + 16 ảnh 1440) có chữ "Không tải được" (`document.body.innerText`, trường `apiError` trong after.json): mọi /api/** được fixture của audit.cjs trả lời, nên không có ảnh nào cần chụp lại hay đánh dấu lỗi /api 503.

## Tổng hợp (số dòng route×độ rộng vi phạm)

| MOB | trước | sau |
|---|---|---|
| MOB-A | 39 | 0 |
| MOB-B | 33 | 0 |
| MOB-C | 33 | 0 |
| MOB-D | 0 | 0 |
| MOB-E | 48 | 39 |
| MOB-F | 84 | 39 |
| MOB-G | 0 | 0 |

## Trước/sau theo route và độ rộng

Cột: MOB vi phạm (chữ cái, — = sạch) · A: `a_top_fixed.h0` (px, ≤120) trước và sau, số hàng khi cuộn (phải 1) · B: `c_nav_rows` · C: `h_promo_lines.lines` · E: `d_small_targets.count` (vùng bấm <44px) · F chữ: `e_small_text.count` (<14px) · F ô nhập: `f_small_inputs.count` (<16px) · G: `g_bottom_overlap.covers` · D: `scrollWidth/clientWidth` trước và sau. `x→y` = trước→sau.

| route | độ rộng | MOB trước | MOB sau | A h0 trước | A h0 sau | A hàng cuộn | B hàng nav | C dòng dải | E vùng bấm <44 | F chữ <14 | F ô nhập <16 | G che | scrollWidth/clientWidth trước | scrollWidth/clientWidth sau |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `home` | 360 | AEF | EF | 79 | 62 | 2→1 | 0 | 1 | 30→1 | 71→4 | 0 | — | 360/360 | 360/360 |
| `home` | 390 | AEF | EF | 79 | 62 | 2→1 | 0 | 1 | 30→1 | 71→4 | 0 | — | 390/390 | 390/390 |
| `home` | 430 | AEF | EF | 79 | 62 | 2→1 | 0 | 1 | 30→1 | 71→4 | 0 | — | 430/430 | 430/430 |
| `home` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 33 | 87 | 2 | — | 768/768 | 768/768 |
| `footer` | 360 | AEF | EF | 79 | 62 | 2→1 | 0 | 1 | 30→1 | 71→4 | 0 | — | 360/360 | 360/360 |
| `footer` | 390 | AEF | EF | 79 | 62 | 2→1 | 0 | 1 | 30→1 | 71→4 | 0 | — | 390/390 | 390/390 |
| `footer` | 430 | AEF | EF | 79 | 62 | 2→1 | 0 | 1 | 30→1 | 71→4 | 0 | — | 430/430 | 430/430 |
| `footer` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 33 | 87 | 2 | — | 768/768 | 768/768 |
| `catalog` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 25→1 | 74→4 | 2→0 | — | 360/360 | 360/360 |
| `catalog` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 26→1 | 74→4 | 2→0 | — | 390/390 | 390/390 |
| `catalog` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 26→1 | 74→4 | 2→0 | — | 430/430 | 430/430 |
| `catalog` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 27 | 91 | 2 | — | 768/768 | 768/768 |
| `category` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 14→1 | 40→4 | 2→0 | — | 360/360 | 360/360 |
| `category` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 14→1 | 40→4 | 2→0 | — | 390/390 | 390/390 |
| `category` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 15→1 | 40→4 | 2→0 | — | 430/430 | 430/430 |
| `category` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 16 | 44 | 2 | — | 768/768 | 768/768 |
| `search` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 14→1 | 36→4 | 2→0 | — | 360/360 | 360/360 |
| `search` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 15→1 | 36→4 | 2→0 | — | 390/390 | 390/390 |
| `search` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 15→1 | 36→4 | 2→0 | — | 430/430 | 430/430 |
| `search` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 16 | 38 | 2 | — | 768/768 | 768/768 |
| `stringing` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 17→1 | 51→4 | 2→0 | — | 360/360 | 360/360 |
| `stringing` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 17→1 | 51→4 | 2→0 | — | 390/390 | 390/390 |
| `stringing` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 18→1 | 51→4 | 2→0 | — | 430/430 | 430/430 |
| `stringing` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 19 | 60 | 2 | — | 768/768 | 768/768 |
| `pdp-racket` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 21→2 | 51→6 | 1→0 | — | 360/360 | 360/360 |
| `pdp-racket` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 21→2 | 51→6 | 1→0 | — | 390/390 | 390/390 |
| `pdp-racket` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 21→2 | 51→6 | 1→0 | — | 430/430 | 430/430 |
| `pdp-racket` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 21 | 53 | 1 | — | 768/768 | 768/768 |
| `pdp-simple` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 15→2 | 37→6 | 1→0 | — | 360/360 | 360/360 |
| `pdp-simple` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 15→2 | 37→6 | 1→0 | — | 390/390 | 390/390 |
| `pdp-simple` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 15→2 | 37→6 | 1→0 | — | 430/430 | 430/430 |
| `pdp-simple` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 15 | 39 | 1 | — | 768/768 | 768/768 |
| `cart` | 360 | EF | — | 0 | 0 | 0 | 0 | 0 | 5→0 | 9→0 | 0 | — | 360/360 | 360/360 |
| `cart` | 390 | EF | — | 0 | 0 | 0 | 0 | 0 | 5→0 | 9→0 | 0 | — | 390/390 | 390/390 |
| `cart` | 430 | EF | — | 0 | 0 | 0 | 0 | 0 | 5→0 | 9→0 | 0 | — | 430/430 | 430/430 |
| `cart` | 768 | — | — | 0 | 0 | 0 | 0 | 0 | 5 | 9 | 0 | — | 768/768 | 768/768 |
| `checkout` | 360 | EF | — | 0 | 0 | 0 | 0 | 0 | 6→0 | 26→0 | 5→0 | — | 360/360 | 360/360 |
| `checkout` | 390 | EF | — | 0 | 0 | 0 | 0 | 0 | 6→0 | 26→0 | 5→0 | — | 390/390 | 390/390 |
| `checkout` | 430 | EF | — | 0 | 0 | 0 | 0 | 0 | 6→0 | 26→0 | 5→0 | — | 430/430 | 430/430 |
| `checkout` | 768 | — | — | 0 | 0 | 0 | 0 | 0 | 6 | 26 | 5 | — | 768/768 | 768/768 |
| `order-success` | 360 | EF | — | 0 | 0 | 0 | 0 | 0 | 2→0 | 15→0 | 0 | — | 360/360 | 360/360 |
| `order-success` | 390 | EF | — | 0 | 0 | 0 | 0 | 0 | 2→0 | 15→0 | 0 | — | 390/390 | 390/390 |
| `order-success` | 430 | EF | — | 0 | 0 | 0 | 0 | 0 | 2→0 | 15→0 | 0 | — | 430/430 | 430/430 |
| `order-success` | 768 | — | — | 0 | 0 | 0 | 0 | 0 | 2 | 15 | 0 | — | 768/768 | 768/768 |
| `checkout-success` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 360/360 | 360/360 |
| `checkout-success` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 390/390 | 390/390 |
| `checkout-success` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 430/430 | 430/430 |
| `checkout-success` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 13 | 35 | 1 | — | 768/768 | 768/768 |
| `checkout-error` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 360/360 | 360/360 |
| `checkout-error` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 390/390 | 390/390 |
| `checkout-error` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 430/430 | 430/430 |
| `checkout-error` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 13 | 35 | 1 | — | 768/768 | 768/768 |
| `checkout-cancel` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 360/360 | 360/360 |
| `checkout-cancel` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 390/390 | 390/390 |
| `checkout-cancel` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 32→4 | 1→0 | — | 430/430 | 430/430 |
| `checkout-cancel` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 13 | 35 | 1 | — | 768/768 | 768/768 |
| `stores` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 14→1 | 39→4 | 1→0 | — | 360/360 | 360/360 |
| `stores` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 14→1 | 39→4 | 1→0 | — | 390/390 | 390/390 |
| `stores` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 14→1 | 39→4 | 1→0 | — | 430/430 | 430/430 |
| `stores` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 15 | 42 | 1 | — | 768/768 | 768/768 |
| `notfound` | 360 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 29→4 | 1→0 | — | 360/360 | 360/360 |
| `notfound` | 390 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 29→4 | 1→0 | — | 390/390 | 390/390 |
| `notfound` | 430 | ABCEF | EF | 420 | 62 | 9→1 | 3→1 | 3→1 | 12→1 | 29→4 | 1→0 | — | 430/430 | 430/430 |
| `notfound` | 768 | — | — | 368 | 368 | 8 | 2 | 3 | 13 | 32 | 1 | — | 768/768 | 768/768 |

## Lỗi còn lại sau sửa (route | độ rộng | MOB | chi tiết)

| route | độ rộng | MOB | chi tiết |
|---|---|---|---|
| home | 360 | MOB-E | 1/58 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| home | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| home | 390 | MOB-E | 1/58 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| home | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| home | 430 | MOB-E | 1/58 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| home | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| footer | 360 | MOB-E | 1/58 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| footer | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| footer | 390 | MOB-E | 1/58 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| footer | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| footer | 430 | MOB-E | 1/58 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| footer | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| catalog | 360 | MOB-E | 1/64 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| catalog | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| catalog | 390 | MOB-E | 1/64 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| catalog | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| catalog | 430 | MOB-E | 1/64 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| catalog | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| category | 360 | MOB-E | 1/31 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| category | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| category | 390 | MOB-E | 1/31 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| category | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| category | 430 | MOB-E | 1/31 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| category | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| search | 360 | MOB-E | 1/27 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| search | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| search | 390 | MOB-E | 1/27 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| search | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| search | 430 | MOB-E | 1/27 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| search | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| stringing | 360 | MOB-E | 1/40 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| stringing | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| stringing | 390 | MOB-E | 1/40 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| stringing | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| stringing | 430 | MOB-E | 1/40 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| stringing | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| pdp-racket | 360 | MOB-E | 2/31 vùng bấm <44px; vd button.text-xs.px-4 116x38, div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| pdp-racket | 360 | MOB-F | 6 phần tử chữ <14px (0 cỡ 11px) (`e_small_text`) |
| pdp-racket | 390 | MOB-E | 2/31 vùng bấm <44px; vd button.text-xs.px-4 116x38, div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| pdp-racket | 390 | MOB-F | 6 phần tử chữ <14px (0 cỡ 11px) (`e_small_text`) |
| pdp-racket | 430 | MOB-E | 2/31 vùng bấm <44px; vd button.text-xs.px-4 116x38, div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| pdp-racket | 430 | MOB-F | 6 phần tử chữ <14px (0 cỡ 11px) (`e_small_text`) |
| pdp-simple | 360 | MOB-E | 2/25 vùng bấm <44px; vd button.text-xs.px-4 116x38, div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| pdp-simple | 360 | MOB-F | 6 phần tử chữ <14px (0 cỡ 11px) (`e_small_text`) |
| pdp-simple | 390 | MOB-E | 2/25 vùng bấm <44px; vd button.text-xs.px-4 116x38, div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| pdp-simple | 390 | MOB-F | 6 phần tử chữ <14px (0 cỡ 11px) (`e_small_text`) |
| pdp-simple | 430 | MOB-E | 2/25 vùng bấm <44px; vd button.text-xs.px-4 116x38, div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| pdp-simple | 430 | MOB-F | 6 phần tử chữ <14px (0 cỡ 11px) (`e_small_text`) |
| checkout-success | 360 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| checkout-success | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-success | 390 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| checkout-success | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-success | 430 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| checkout-success | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-error | 360 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| checkout-error | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-error | 390 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| checkout-error | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-error | 430 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| checkout-error | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-cancel | 360 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| checkout-cancel | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-cancel | 390 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| checkout-cancel | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| checkout-cancel | 430 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| checkout-cancel | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| stores | 360 | MOB-E | 1/27 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| stores | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| stores | 390 | MOB-E | 1/27 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| stores | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| stores | 430 | MOB-E | 1/27 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| stores | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| notfound | 360 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| notfound | 360 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| notfound | 390 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 129x26 (`d_small_targets`) |
| notfound | 390 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |
| notfound | 430 | MOB-E | 1/24 vùng bấm <44px; vd div.cursor-pointer.font-display 158x26 (`d_small_targets`) |
| notfound | 430 | MOB-F | 4 phần tử chữ <14px (4 cỡ 11px) (`e_small_text`) |

## 1440px so với desktop-baseline/

Cách so: so byte PNG `desktop-baseline/<route>-1440.png` với ảnh 1440 chụp trên commit đã quét (1440x900, màn hình đầu, ảnh tạm trong `AFTER_DESKTOP_OUT`, không commit để không đè mốc); nếu khác byte thì giải mã PNG (zlib) và đếm pixel khác, khung bao; mỗi pixel khác được gán cho phần tử fixed chứa nó (hộp + 24px bóng đổ), phần còn lại chia dải y và gán cho phần tử nhỏ nhất chứa khung dải (hình hộp mọi phần tử trong màn hình đầu, đo ở 1440 trên commit đã quét); phần tử khớp danh sách `CAUSES` trong compare.cjs thì ghi lý do, không khớp thì ghi **CHƯA RÕ** và script trả exit 1. Kích thước trang (`scrollWidth×scrollHeight`) là của bản sau; ảnh mốc chỉ là PNG nên không có kích thước trang trước.

| route | byte | pixel khác | khung bao khác (x0,y0–x1,y1) | trang sau (scrollWidth×scrollHeight, scrollY) | vùng khác → phần tử (pixel, khung) → lý do |
|---|---|---|---|---|---|
| `home` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×3275, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `footer` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×3275, 2375 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `catalog` | khác | 16417 (1.27%) | 249,760–1423,899 | 1440×3452, 0 | `div.floating-contact.fixed.right-3` (16177px, 1229,760–1423,894) → floating-contact; `span.text-brand-primary.font-mono` (240px, 249,894–347,899) → price-label |
| `category` | khác | 16674 (1.29%) | 249,760–1423,899 | 1440×1508, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact; `span.text-brand-primary.font-mono` (240px, 249,894–347,899) → price-label |
| `search` | khác | 16424 (1.27%) | 249,760–1423,899 | 1440×1508, 0 | `div.floating-contact.fixed.right-3` (16184px, 1229,760–1423,894) → floating-contact; `span.text-brand-primary.font-mono` (240px, 249,894–347,899) → price-label |
| `stringing` | khác | 16417 (1.27%) | 249,760–1423,899 | 1440×2036, 0 | `div.floating-contact.fixed.right-3` (16177px, 1229,760–1423,894) → floating-contact; `span.text-brand-primary.font-mono` (240px, 249,894–347,899) → price-label |
| `pdp-racket` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×2006, 381 | `div.floating-contact-pdp.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `pdp-simple` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×1764, 0 | `div.floating-contact-pdp.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `cart` | giống | 0 | — | — | — |
| `checkout` | giống | 0 | — | — | — |
| `order-success` | giống | 0 | — | — | — |
| `checkout-success` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×1270, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `checkout-error` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×1270, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `checkout-cancel` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×1270, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `stores` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×1285, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |
| `notfound` | khác | 16434 (1.27%) | 1229,760–1423,894 | 1440×943, 0 | `div.floating-contact.fixed.right-3` (16434px, 1229,760–1423,894) → floating-contact |

Route 1440 khác mốc (pixel): `home`, `footer`, `catalog`, `category`, `search`, `stringing`, `pdp-racket`, `pdp-simple`, `checkout-success`, `checkout-error`, `checkout-cancel`, `stores`, `notfound`. Route giống byte: `cart`, `checkout`, `order-success`.

### Lý do khác ở 1440px

- `floating-contact` (home, footer, catalog, category, search, stringing, pdp-racket, pdp-simple, checkout-success, checkout-error, checkout-cancel, stores, notfound): cụm nút nổi Zalo + hotline góc phải dưới (`FloatingContact`, merge STOR-129 c93b987) vào main sau khi chụp desktop-baseline (1f319b5); không có trong ảnh mốc. Không phải lỗi bố cục, không do STOR-143..148.
- `price-label` (catalog, category, search, stringing): nhãn bộ lọc giá đổi "6.000.000đ" → "Tất cả mức giá" vì STOR-131 (4a009f6) bỏ trần giá mặc định 6 triệu, merge sau khi chụp desktop-baseline. Không phải lỗi bố cục.

Không vùng khác nào nằm ngoài các nguyên nhân trên: các sửa mobile (STOR-143, STOR-144, STOR-145, STOR-146, STOR-147, STOR-148, STOR-158, STOR-160, STOR-161, STOR-162) không đổi pixel nào ở 1440px ngoài những vùng đã liệt kê. `cart`, `checkout`, `order-success` giống byte vì lớp phủ giỏ hàng che cả trang (kể cả cụm nút nổi).
