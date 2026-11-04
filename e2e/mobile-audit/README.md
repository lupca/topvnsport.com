# e2e/mobile-audit (STOR-128, goal 2c881ad4)

Quét mobile "trước khi sửa": chụp mọi route ở 360x800, 390x844, 430x932, 768x1024 (và 1440x900 làm mốc desktop) và đo bằng `page.evaluate` theo spec MOB-A..G. Chỉ đo và báo cáo, không sửa gì trong `src/`.

    node e2e/mobile-audit/audit.cjs --selftest   # 8 dòng PASS (mỗi phép đo một lỗi cài sẵn + ca sạch), exit 0
    node e2e/mobile-audit/audit.cjs              # chụp + đo, ghi docs/mobile-audit/{before/,desktop-baseline/,before.json,before.md}
    node e2e/mobile-audit/audit.cjs --report-only   # viết lại before.md từ before.json có sẵn (đổi template, không mở trình duyệt)
    node e2e/mobile-audit/audit.cjs --only=cart,checkout --width=390   # chạy một phần để gỡ lỗi (không ghi before.json/md)
    node e2e/mobile-audit/competitors.cjs        # đo header mobile của đối thủ, chỉ đọc
    node e2e/mobile-guard-390.cjs                # chốt chặn CI (STOR-149): 390x844, MOB-A ≤120px + MOB-D, exit 1 nếu lỗi

- Cần `npm ci` và `npx playwright-core install chromium`; `playwright-core` 1.64.1 là devDependency (guard tự dùng bản này; audit.cjs dùng `PLAYWRIGHT=<đường dẫn>` hoặc `npm root -g`).
- Script tự mở vite `--strictPort` trên cổng `PORT` (mặc định 4428), ghi lại PID và tắt đúng PID đó khi xong.
- Mọi `/api/**` được `page.route` trả fixture giả (sản phẩm, tồn, tỉnh/xã, báo giá ship). Tạo đơn, gửi và xác thực OTP là giả; OMS thật không bao giờ được gọi; danh tính là placeholder.
- Route/trạng thái: bảng `ROUTES` đầu phần 4 của `audit.cjs`. Cửa hàng không có trang giỏ/thanh toán/tìm kiếm riêng nên `search` = `/catalog?search=`, `cart`/`checkout`/`order-success` = các bước của CartModal, `stringing` = `STRINGING_CTA_PATH`.
- Chụp bằng `prefers-reduced-motion: reduce` (hero đứng yên), ảnh ngoài thay bằng ô xám, ảnh chụp là màn hình đầu (không phải full page).
- Click chuẩn bị trạng thái đi qua `el.click()` vì header/thanh dưới ở 360–430px che mất nút thật (đó là chính lỗi cần đo).

## Tám phép đo (khóa trong `before.json`)

| khóa | đo gì | MOB |
|---|---|---|
| `a_top_fixed` | cao vùng fixed/sticky trên cùng ở scrollY=0 (`h0`) và sau khi cuộn xuống (`hScrolled`), số hàng chữ/ảnh trong vùng đó (`rowsScrolled`) | A (≤120px, 1 hàng) |
| `b_overflow_x` | `scrollWidth` vs `clientWidth` của trang + phần tử tràn ngoài khung | D |
| `c_nav_rows` | số hàng link của `nav[aria-label="Điều hướng chính"]` (0 = ẩn) | B (≤1) |
| `d_small_targets` | vùng bấm <44x44 (link giữa câu được miễn) | E |
| `e_small_text` | phần tử chữ có font-size <14px (`at11`: số phần tử cỡ 11px theo thiết kế) | F |
| `f_small_inputs` | input/textarea/select font-size <16px | F |
| `g_bottom_overlap` | thanh fixed/sticky đáy: `covers` (che nội dung cuối khi cuộn hết), `barH`, `padBottom` | G |
| `h_promo_lines` | số dòng của dải `data-testid=*-strip` / `topbar` nằm trong màn hình đầu | C (≤1) |

Ngưỡng trừ MOB-D chỉ áp dụng ở 360–430px; 768px chỉ xét MOB-D. Khi có lớp phủ toàn màn hình (giỏ hàng/ngăn menu), phép đo nằm trong lớp phủ vì trang bên dưới bị che.
Hàm `violations()` là nguồn duy nhất ánh xạ số đo -> MOB-x, dùng cho cả `before.md` và selftest.
