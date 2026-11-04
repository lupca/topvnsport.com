# Quét mobile trước khi sửa (STOR-128, goal 2c881ad4)

Sinh tự động bởi `node e2e/mobile-audit/audit.cjs` từ `before.json` (đo bằng `page.evaluate`, không đo bằng mắt). Không sửa tay.
Ảnh: `before/<route>-<độ rộng>.png` (14 route × 4 độ rộng), mốc desktop `desktop-baseline/<route>-1440.png`.
Dữ liệu: vite dev local + fixture giả (không dữ liệu cá nhân, OMS/OTP giả), `prefers-reduced-motion: reduce` để slide hero đứng yên, ảnh ngoài thay bằng ô xám.

Ngưỡng (spec MOB-A..G): A: vùng cố định/dính trên cùng ≤120px và 1 hàng khi cuộn · B: thanh danh mục ≤1 hàng · C: dải khuyến mãi ≤1 dòng trong màn hình đầu · D: scrollWidth ≤ clientWidth (cả 4 độ rộng) · E: vùng bấm ≥44px · F: chữ ≥14px, ô nhập ≥16px · G: thanh dưới không che nội dung. Mọi ngưỡng trừ D chỉ áp dụng ở 360–430px; ở 768px chỉ MOB-D được xét (số liệu 768 vẫn nằm trong `before.json`).
Ngoại lệ đo: link nằm giữa câu không tính vào MOB-E; khi có lớp phủ toàn màn hình (giỏ hàng) đo bên trong lớp phủ.

## Route → URL / trạng thái

| route | URL / trạng thái | 360 | 390 | 430 | 768 |
|---|---|---|---|---|---|
| `home` | / | AEF | AEF | AEF | — |
| `footer` | / cuộn tới #topvnsport-footer | AEF | AEF | AEF | — |
| `catalog` | /catalog | ABCEF | ABCEF | ABCEF | — |
| `category` | /catalog?category=VC001427 (giày, không phải vợt) | ABCEF | ABCEF | ABCEF | — |
| `search` | /catalog?search=vot | ABCEF | ABCEF | ABCEF | — |
| `stringing` | STRINGING_CTA_PATH = /catalog?category=VC001491 | ABCEF | ABCEF | ABCEF | — |
| `pdp-racket` | /product/vot-yonex-astrox-100zz-kurenai (bật dịch vụ đan cước, chọn màu + cước BG65, cuộn tới bộ chọn cước) | ABCEF | ABCEF | ABCEF | — |
| `pdp-simple` | /product/san-pham-audit-8 (không có phân loại) | ABCEF | ABCEF | ABCEF | — |
| `cart` | CartModal bước 1 (1 món) | EF | EF | EF | — |
| `checkout` | CartModal bước 2 (form đã điền danh tính giả, COD, phí ship đã báo giá) | EF | EF | EF | — |
| `order-success` | CartModal bước 3 (sau OTP + OMS 201 giả) | EF | EF | EF | — |
| `checkout-success` | /checkout/success | ABCEF | ABCEF | ABCEF | — |
| `stores` | /stores (trang O2O / đan vợt) | ABCEF | ABCEF | ABCEF | — |
| `notfound` | /khong-ton-tai (404) | ABCEF | ABCEF | ABCEF | — |

(ô = các chữ cái MOB vi phạm, ví dụ `ADE` = MOB-A, MOB-D, MOB-E; — = không vi phạm.)

## Tổng hợp

- MOB-A: 33 dòng lỗi
- MOB-B: 27 dòng lỗi
- MOB-C: 27 dòng lỗi
- MOB-E: 42 dòng lỗi
- MOB-F: 72 dòng lỗi

## Bảng lỗi (trang | độ rộng | lỗi | MOB-x vi phạm)

| trang | độ rộng | lỗi | MOB-x vi phạm |
|---|---|---|---|
| home | 360 | vùng cố định/dính trên cùng: h0=79px (≤120), sau cuộn 79px, 2 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| home | 360 | 32/59 vùng bấm <44px; vd button.border.border-ink-primary 79x27, button.bg-ink-primary.text-white 66x30 (`d_small_targets`) | MOB-E |
| home | 360 | 77 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| home | 390 | vùng cố định/dính trên cùng: h0=79px (≤120), sau cuộn 79px, 2 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| home | 390 | 32/59 vùng bấm <44px; vd button.border.border-ink-primary 79x27, button.bg-ink-primary.text-white 66x30 (`d_small_targets`) | MOB-E |
| home | 390 | 77 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| home | 430 | vùng cố định/dính trên cùng: h0=79px (≤120), sau cuộn 79px, 2 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| home | 430 | 32/59 vùng bấm <44px; vd button.border.border-ink-primary 83x27, button.bg-ink-primary.text-white 66x30 (`d_small_targets`) | MOB-E |
| home | 430 | 77 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| footer | 360 | vùng cố định/dính trên cùng: h0=79px (≤120), sau cuộn 79px, 2 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| footer | 360 | 32/59 vùng bấm <44px; vd button.border.border-ink-primary 79x27, button.bg-ink-primary.text-white 66x30 (`d_small_targets`) | MOB-E |
| footer | 360 | 77 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| footer | 390 | vùng cố định/dính trên cùng: h0=79px (≤120), sau cuộn 79px, 2 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| footer | 390 | 32/59 vùng bấm <44px; vd button.border.border-ink-primary 79x27, button.bg-ink-primary.text-white 66x30 (`d_small_targets`) | MOB-E |
| footer | 390 | 77 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| footer | 430 | vùng cố định/dính trên cùng: h0=79px (≤120), sau cuộn 79px, 2 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| footer | 430 | 32/59 vùng bấm <44px; vd button.border.border-ink-primary 83x27, button.bg-ink-primary.text-white 66x30 (`d_small_targets`) | MOB-E |
| footer | 430 | 77 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| catalog | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| catalog | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| catalog | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| catalog | 360 | 25/63 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| catalog | 360 | 76 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| catalog | 360 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| catalog | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| catalog | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| catalog | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| catalog | 390 | 26/63 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| catalog | 390 | 76 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| catalog | 390 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| catalog | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| catalog | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| catalog | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| catalog | 430 | 26/63 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| catalog | 430 | 76 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| catalog | 430 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| category | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| category | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| category | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| category | 360 | 14/30 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| category | 360 | 42 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| category | 360 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| category | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| category | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| category | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| category | 390 | 14/30 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| category | 390 | 42 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| category | 390 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| category | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| category | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| category | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| category | 430 | 15/30 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| category | 430 | 42 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| category | 430 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| search | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| search | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| search | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| search | 360 | 14/26 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| search | 360 | 38 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| search | 360 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| search | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| search | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| search | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| search | 390 | 15/26 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| search | 390 | 38 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| search | 390 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| search | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| search | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| search | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| search | 430 | 15/26 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| search | 430 | 38 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| search | 430 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| stringing | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| stringing | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| stringing | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| stringing | 360 | 17/39 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| stringing | 360 | 53 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| stringing | 360 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| stringing | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| stringing | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| stringing | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| stringing | 390 | 17/39 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| stringing | 390 | 53 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| stringing | 390 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| stringing | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| stringing | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| stringing | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| stringing | 430 | 18/39 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| stringing | 430 | 53 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| stringing | 430 | 2 ô nhập <16px; vd input.w-full.min-w-0 12.75px, select.text-xs.font-bold 12.75px (`f_small_inputs`) | MOB-F |
| pdp-racket | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| pdp-racket | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| pdp-racket | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| pdp-racket | 360 | 21/30 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| pdp-racket | 360 | 53 phần tử chữ <14px (3 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| pdp-racket | 360 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| pdp-racket | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| pdp-racket | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| pdp-racket | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| pdp-racket | 390 | 21/30 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| pdp-racket | 390 | 53 phần tử chữ <14px (3 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| pdp-racket | 390 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| pdp-racket | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| pdp-racket | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| pdp-racket | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| pdp-racket | 430 | 21/30 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| pdp-racket | 430 | 53 phần tử chữ <14px (3 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| pdp-racket | 430 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| pdp-simple | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| pdp-simple | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| pdp-simple | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| pdp-simple | 360 | 15/24 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| pdp-simple | 360 | 39 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| pdp-simple | 360 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| pdp-simple | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| pdp-simple | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| pdp-simple | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| pdp-simple | 390 | 15/24 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| pdp-simple | 390 | 39 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| pdp-simple | 390 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| pdp-simple | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| pdp-simple | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| pdp-simple | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| pdp-simple | 430 | 15/24 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| pdp-simple | 430 | 39 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| pdp-simple | 430 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| cart | 360 | 5/5 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, button.w-7.h-7 30x30 (`d_small_targets`) | MOB-E |
| cart | 360 | 9 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| cart | 390 | 5/5 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, button.w-7.h-7 30x30 (`d_small_targets`) | MOB-E |
| cart | 390 | 9 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| cart | 430 | 5/5 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, button.w-7.h-7 30x30 (`d_small_targets`) | MOB-E |
| cart | 430 | 9 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout | 360 | 6/12 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, input.w-full.bg-gray-50 326x36 (`d_small_targets`) | MOB-E |
| checkout | 360 | 26 phần tử chữ <14px (4 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout | 360 | 5 ô nhập <16px; vd input.w-full.bg-gray-50 12.75px, input.w-full.bg-gray-50 12.75px (`f_small_inputs`) | MOB-F |
| checkout | 390 | 6/12 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, input.w-full.bg-gray-50 356x36 (`d_small_targets`) | MOB-E |
| checkout | 390 | 26 phần tử chữ <14px (4 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout | 390 | 5 ô nhập <16px; vd input.w-full.bg-gray-50 12.75px, input.w-full.bg-gray-50 12.75px (`f_small_inputs`) | MOB-F |
| checkout | 430 | 6/12 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, input.w-full.bg-gray-50 396x36 (`d_small_targets`) | MOB-E |
| checkout | 430 | 26 phần tử chữ <14px (4 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout | 430 | 5 ô nhập <16px; vd input.w-full.bg-gray-50 12.75px, input.w-full.bg-gray-50 12.75px (`f_small_inputs`) | MOB-F |
| order-success | 360 | 2/2 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, button.w-full.bg-gray-900 326x42 (`d_small_targets`) | MOB-E |
| order-success | 360 | 15 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| order-success | 390 | 2/2 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, button.w-full.bg-gray-900 356x42 (`d_small_targets`) | MOB-E |
| order-success | 390 | 15 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| order-success | 430 | 2/2 vùng bấm <44px; vd button.p-1.text-gray-400 30x30, button.w-full.bg-gray-900 396x42 (`d_small_targets`) | MOB-E |
| order-success | 430 | 15 phần tử chữ <14px (1 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout-success | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| checkout-success | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| checkout-success | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| checkout-success | 360 | 12/23 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| checkout-success | 360 | 32 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout-success | 360 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| checkout-success | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| checkout-success | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| checkout-success | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| checkout-success | 390 | 12/23 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| checkout-success | 390 | 32 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout-success | 390 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| checkout-success | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| checkout-success | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| checkout-success | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| checkout-success | 430 | 12/23 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| checkout-success | 430 | 32 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| checkout-success | 430 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| stores | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| stores | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| stores | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| stores | 360 | 14/26 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| stores | 360 | 41 phần tử chữ <14px (6 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| stores | 360 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| stores | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| stores | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| stores | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| stores | 390 | 14/26 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| stores | 390 | 41 phần tử chữ <14px (6 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| stores | 390 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| stores | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| stores | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| stores | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| stores | 430 | 14/26 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| stores | 430 | 41 phần tử chữ <14px (6 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| stores | 430 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| notfound | 360 | vùng cố định/dính trên cùng: h0=577px (≤120), sau cuộn 577px, 11 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| notfound | 360 | thanh danh mục 5 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| notfound | 360 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| notfound | 360 | 12/23 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| notfound | 360 | 31 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| notfound | 360 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| notfound | 390 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| notfound | 390 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| notfound | 390 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| notfound | 390 | 12/23 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 79x27 (`d_small_targets`) | MOB-E |
| notfound | 390 | 31 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| notfound | 390 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
| notfound | 430 | vùng cố định/dính trên cùng: h0=499px (≤120), sau cuộn 499px, 10 hàng (phải 1) (`a_top_fixed`) | MOB-A |
| notfound | 430 | thanh danh mục 4 hàng (phải ≤1) (`c_nav_rows`) | MOB-B |
| notfound | 430 | dải khuyến mãi/thông tin 3 dòng trong màn hình đầu: div[data-testid=stringing-strip] 3 dòng (`h_promo_lines`) | MOB-C |
| notfound | 430 | 12/23 vùng bấm <44px; vd button.p-1.-ml-1 34x34, button.border.border-ink-primary 83x27 (`d_small_targets`) | MOB-E |
| notfound | 430 | 31 phần tử chữ <14px (5 cỡ 11px) ⚠ xung đột với thiết kế 11px (spec e7944019) (`e_small_text`) | MOB-F |
| notfound | 430 | 1 ô nhập <16px; vd input.w-full.min-w-0 12.75px (`f_small_inputs`) | MOB-F |
