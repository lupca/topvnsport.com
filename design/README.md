# Bản Thiết Kế UI/UX v2.0 — Trang Chủ Badminton TopVNSport (Vượt Chuẩn `yonexshop.jp/?category_id=1`)

> **Trạng thái:** Bản thiết kế tương tác Studio-Grade v2.0 (`design/index.html` & `public/design/index.html`) — Chưa can thiệp code ứng dụng trong `src/`.
> **Link xem trực tiếp (Live Preview):**
> - Production: [https://www.topvnsport.com/design/index.html](https://www.topvnsport.com/design/index.html)
> - Vercel Preview: [https://topvnsport-com.vercel.app/design/index.html](https://topvnsport-com.vercel.app/design/index.html)

---

## 1. Mục Tiêu Cốt Lõi & Định Hướng Nâng Cấp v2.0

1. **Trang chủ (`/`) đi thẳng vào chuyên trang Cầu Lông (`BADMINTON`) theo khung 6 bước của `yonexshop.jp/?category_id=1`:**
   - **Bước 1 (`.title-box`)**: Tiêu đề trung tâm `BADMINTON` (`Montserrat` `34px`, `font-weight: 900`, `#000000`, `21:1`).
   - **Bước 2 (`.cate_select`)**: Thanh viên thuốc chọn nhanh ngành con cầu lông (`#e5e5e5`, `border-radius: 999px`, nút cao `44px`) kèm số lượng SKU (`tabular-nums`).
   - **Bước 3 (`.center-slider-viewport`)**: **Center-Mode Hero Slider** (`1400×600` trên PC, `700×700` trên Mobile; slide giữa `opacity: 1`, 2 slide hai bên `opacity: 0.38`) + **Thẻ Sản Phẩm Tiêu Điểm (`.slide-product-chip`)** gắn trực tiếp vào SKU thật + chấm tiến trình tự động chạy (`4.5s`).
   - **Bước 4 (`#top_rated-wrap`)**: Khối **SẢN PHẨM NỔI BẬT** kèm **Thanh lọc nhanh theo Lối đánh / Thương hiệu / Sắp xếp** và **Thẻ sản phẩm 6 tầng thông tin (`.yonex-product-card`)**.
   - **Bước 5 (`#main_img-wrap_c`)**: Khối **DANH MỤC CẦU LÔNG** gồm 8 ô hình ảnh trực quan (4 cột PC / 2 cột Mobile).
   - **Bước 6 (`#top_btn`)**: Nút đen đặc trung tâm **XEM TẤT CẢ SẢN PHẨM CẦU LÔNG** (`420×54px`, `#000000`).

2. **Khắc phục triệt để lỗi "Font và màu chữ khá nhạt" trên `topvnsport.com` hiện tại:**
   - Loại bỏ hoàn toàn `text-gray-400` (`#9ca3af` — tương phản chỉ đạt **2.54:1**, rớt chuẩn WCAG AA) và `font-light` (weight `300`) ở cỡ `10px–12px`.
   - Áp dụng **Hệ màu mực in độ tương phản cao (High-Contrast Ink System)**:
     - `--ink-primary: #000000` (**21.0:1 AAA**) cho tiêu đề, thanh `.cate_select`, tên sản phẩm (`15.5px–16px` SemiBold), giá bán (`17.5px–18px` ExtraBold `tabular-nums`), và ô `.feature_contents`.
     - `--ink-secondary: #18181b` (**17.4:1 AAA**) cho nhãn phụ, mô tả ngắn, cam kết chính hãng.
     - `--ink-muted: #52525b` (**7.0:1 AAA**) cho giá cũ gạch ngang và placeholder — **cấm dùng màu chữ nhạt hơn `#52525b` trên nền sáng**.

---

## 2. 8 Điểm UI/UX Giúp Bản Thiết Kế v2.0 Vượt Qua `yonexshop.jp/?category_id=1`

| # | Hạng mục UI/UX | Hạn chế trên `yonexshop.jp/?category_id=1` | Nâng cấp trên TopVNSport v2.0 |
|---|---|---|---|
| **1** | **Thanh `.cate_select`** | Chỉ là liên kết tĩnh chuyển trang, không có trạng thái đang chọn hay số lượng sản phẩm. | Chuyển thành **Interactive Pill Filter** cao `44px`, hiển thị trạng thái active `#000000` chữ `#ffffff` và số lượng SKU `tabular-nums` lọc tức thì. |
| **2** | **Center-Mode Hero Slider** | Chỉ là ảnh banner tĩnh, không biết sản phẩm trong ảnh giá bao nhiêu hay còn hàng không. | Giữ khung `1400×600` Center-Mode nhưng bổ sung **Thẻ Sản Phẩm Tiêu Điểm (`.slide-product-chip`)** ngay góc phải dưới banner + nút *"Đan cước ngay"* + chấm tiến trình `4.5s`. |
| **3** | **Giải phẫu Thẻ 6 Tầng** | Trộn lẫn 5–6 mã công nghệ nội bộ trong các ô `.feature_contents` xám giống hệt nhau. | Tách bạch **6 tầng thông tin**: (1) Ảnh 1:1 + Nhãn Lối Đánh, (2) Hãng `#005eb8` + Tồn kho `#166534`, (3) Tên `#000000` 16px, (4) Chấm màu & Trọng lượng `3U/4U/5U`, (5) Giá `tabular-nums`, (6) Tag vật lý Monospace + Nút Đan Cước O2O. |
| **4** | **Trình Cấu Hình Đan Cước O2O** | Không thể chọn loại cước đan và lực căng kg ngay từ trang chủ/danh mục. | Bấm vào bất kỳ thẻ vợt nào mở ngay **Slide-Over O2O Stringing Configurator Drawer**: chọn Tier 1 (`4U G5` / Màu) + chọn Tier 2 (`Khung rời`, `BG66 Ultimax`, `Exbolt 65`, `Kizuna Z61`) + kéo thanh lực căng `9.0–13.0 kg` (`20–29 LBS`) tính tổng tiền tức thì. |
| **5** | **Bộ lọc Lối đánh (Play-Style)** | Người mới chơi không phân biệt được dòng vợt nào thiên công hay phản tạt. | Bổ sung thanh lọc nhanh (*Tấn công Smash*, *Phản tạt tốc độ*, *Công thủ toàn diện*, *Hãng YONEX*, *Hãng LI-NING*, *Có đan cước O2O*) và sắp xếp giá ngay trên lưới. |
| **6** | **Instant Search (`/`) & Mega Menu** | Ô tìm kiếm phải tải lại trang; thanh menu không phân nhóm theo lối chơi. | Phím tắt `/` mở **Instant Search Dropdown** lọc trực tiếp 12 sản phẩm thật từ PIM; **Mega Menu** chia 3 cột trực quan (*Lối đánh*, *Thương hiệu*, *Dịch vụ Đan Vợt O2O*). |
| **7** | **12 Sản Phẩm Thật Từ PIM** | Dữ liệu giả định không phản ánh cấu trúc biến thể 2 tầng của Việt Nam. | Sử dụng 12 sản phẩm thật từ `prod_products.fixture.json` và `pim.voma.vn` (Astrox 77 Tour, Halbertec 9000, Axforce Cannon 5U, Astrox Lite 45i, Halbertec 8000, Bladex 800, Nanoflare 1000 Play, ArcSaber 1, Giày Thunder II Pro, Áo Yonex 8T3G, Cước BG66U, Balo Ace Series 2). |
| **8** | **Chế độ `[X-RAY]` Soi Thông Số** | Không có công cụ kiểm tra thông số trực tiếp trên bản mẫu. | Nút **`[X-RAY] Soi Thông Số UI/UX`** trên thanh công cụ bật/tắt lớp nhãn kỹ thuật (`px`, `font-weight`, `hex`, tỷ lệ tương phản) ngay trên từng thành phần. |

---

## 3. 8 Luật Thiết Kế Bắt Buộc (`L1` – `L8`)

- **`L1` (Contrast Floor):** Cấm tuyệt đối `text-gray-400` (`#9ca3af`, 2.54:1) trên nền sáng. Độ tương phản tối thiểu cho chữ phụ là **7.0:1 AAA** (`#52525b` / `text-zinc-600`).
- **`L2` (Weight & Size Floor):** Loại bỏ hoàn toàn `font-light` (`300`). Cỡ chữ nhỏ nhất cho nhãn phụ/huy hiệu là `11px–12px` SemiBold/Bold.
- **`L3` (Badminton-First Entry):** Trang chủ đi thẳng vào chuyên trang `BADMINTON` theo đúng chuỗi 6 bước của `yonexshop.jp/?category_id=1`.
- **`L4` (Tabular Numerals):** Mọi giá tiền, số lượng SKU, trọng lượng (`3U/4U/5U`), điểm cân bằng (`299mm`) và mức căng (`10.5 kg`) phải bật `font-variant-numeric: tabular-nums`.
- **`L5` (6-Layer Card Alignment):** Khung ảnh cố định tỷ lệ `1:1` trên nền `#f8f9fa`, tên sản phẩm cố định 2 dòng (`min-height: 44px`), `.feature_table` neo đáy (`margin-top: auto`).
- **`L6` (Physics vs. O2O Service Separation):** Tách biệt ô thông số vật lý viền `#d4d4d8` chữ `#000000` với nút hành động Đan Cước O2O nền `#e8f1fb` viền `#005eb8`.
- **`L7` (Structural Hairlines):** Thay thế viền mờ `border-gray-100` bằng `border-zinc-200` (`#e4e4e7`) / `border-zinc-300` (`#d4d4d8`), khi hover chuyển sang `#18181b`.
- **`L8` (Thumb-Zone & STOR-032 Compliance):** Vùng chạm trên Mobile tối thiểu `40px–44px`; không sử dụng ký tự trang trí kiểu AI theo đúng quy tắc `STOR-032`.
