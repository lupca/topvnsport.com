# Thiết Kế Trang Chủ TopVNSport — Chuyên Trang BADMINTON (Theo mẫu `yonexshop.jp/?category_id=1`)

> **Trạng thái:** Bản thiết kế (Design Spec & Interactive Prototype) — **Chưa can thiệp code ứng dụng (`src/`)**
> **Tệp mẫu tương tác:** [`design/index.html`](./index.html) (gồm 4 chế độ xem: Desktop 1440px, Mobile 390px, Đối chiếu Chữ Trước/Sau, Bảng Token Kỹ thuật)
> **Tham chiếu gốc:** [`https://yonexshop.jp/?category_id=1`](https://yonexshop.jp/?category_id=1) (Chuyên trang Cầu lông chính thức của Yonex Nhật Bản)

---

## 1. Định hướng cốt lõi

Vì **TopVNSport** là chuyên trang thiết bị cầu lông (*Badminton Specialty Store*), khách vào trang chủ (`/`) sẽ **đi thẳng vào không gian BADMINTON** giống hệt cấu trúc danh mục cầu lông của `yonexshop.jp/?category_id=1`, thay vì qua các khối giới thiệu chung chung:

1. **Đầu trang đi thẳng vào `BADMINTON` + Thanh chọn nhanh danh mục con (`.cate_select`)** hình viên thuốc màu xám sáng (`#e5e5e5`), chữ đen đậm (`#000000`, `15px`, `font-weight: 700`).
2. **Ngay bên dưới là Hero Slider kiểu Center-Mode (`.slick-slider-pc` / `.slick-slider-sp`)**:
   - Slide trung tâm hiển thị rõ `100%` (`opacity: 1`, tỷ lệ `1400×600` trên PC và vuông `700×700` trên Mobile).
   - Hai slide liền kề hé ở 2 mép trái/phải với `opacity: 0.4` tạo chiều sâu thị giác đặc trưng của Yonex Nhật Bản.
   - Điều hướng dưới slider gồm hàng chấm tròn (`.slick-dots`: chấm đang chọn `#000000`, chấm chờ `#9ca3af`) và nút Tạm dừng / Phát tiếp (`.slick_pause`).
3. **Tiếp nối ngay sau Slider là khối `SẢN PHẨM NỔI BẬT` (`#top_rated-wrap` — おすすめ商品)**:
   - Tiêu đề căn giữa cỡ lớn (`30px` PC / `21px` Mobile, `font-weight: 800`, `#000000`).
   - Lưới **4 cột trên PC** (`repeat(4, 1fr)`) và **2 cột trên Mobile** (`repeat(2, 1fr)`).
   - Mỗi thẻ sản phẩm dùng nền ảnh vuông sáng sạch (`#f8f9fa`), chữ đen tuyền `#000000` sắc nét và **bảng tag thông số đóng khung viền vuông (`.feature_table > .feature_contents`)** đặt ngay dưới giá bán.
4. **Khối `DANH MỤC CẦU LÔNG` bằng hình ảnh (`#main_img-wrap_c` — カテゴリー)** và nút đen đặc trung tâm **`XEM TẤT CẢ SẢN PHẨM` (`#top_btn`)**.

---

## 2. Cấu trúc bố cục trang chủ (Wireframe đối chiếu 1–1 với `yonexshop.jp/?category_id=1`)

```text
+-----------------------------------------------------------------------------------+
| TOPBAR (#000000, chữ #FFFFFF): Hotline 097 6007006 | Cam kết 100% Chính Hãng      |
+-----------------------------------------------------------------------------------+
| HEADER STICKY (#FFFFFF, viền #D4D4D8)                                             |
| [Logo TOPVNSPORT]   CẦU LÔNG | VỢT | GIÀY | CƯỚC | TRANG PHỤC   [Tìm kiếm] [Giỏ] |
+-----------------------------------------------------------------------------------+
| THANH THÔNG BÁO (.yonex-textbnr - nền #F4F4F5, chữ #000000 13.5px Bold)           |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                                    BADMINTON                                      |
|                           (32px Montserrat ExtraBold #000)                        |
|                                                                                   |
|        ( Tất cả | Vợt cầu lông | Cước đan vợt | Giày | Quần áo | Bao vợt )        |
|             (.cate_select: nền #E5E5E5, bo tròn 50px, chữ 15px Bold #000)         |
|                                                                                   |
|  +---------+-------------------------------------------------------+---------+    |
|  | Slide   |                                                       | Slide   |    |
|  | Trước   |        HERO BANNER SLIDER TRUNG TÂM (1400x600)        | Kế tiếp |    |
|  | ( mờ    |              (opacity: 1.0 - rõ nét 100%)             | ( mờ    |    |
|  |  40% )  |                                                       |  40% )  |    |
|  +---------+-------------------------------------------------------+---------+    |
|                              [←]  ● ○ ○ ○ ○  [→]  [❚❚ Tạm dừng]                   |
|                                                                                   |
|                                SẢN PHẨM NỔI BẬT                                   |
|                         (#top_rated-wrap - 30px Bold #000)                        |
|                                                                                   |
|  +-------------------+ +-------------------+ +-------------------+ +------------+ |
|  | [Ảnh vuông 1:1]   | | [Ảnh vuông 1:1]   | | [Ảnh vuông 1:1]   | | [Ảnh 1:1]  | |
|  | YONEX · VỢT       | | LI-NING · VỢT     | | LI-NING · VỢT     | | LI-NING    | |
|  | Astrox 77 Tour    | | Halbertec 9000    | | Halbertec 8000    | | Bladex 800 | |
|  | 3.080.000đ        | | 5.890.000đ        | | 5.320.000đ        | | 4.750.000đ | |
|  | [4U][CB 299mm]    | | [4U/3U][CB 295mm] | | [4U G5][HDF]      | | [4U][Speed]| |
|  | [Đan cước]        | | [Đan cước]        | | [Đan cước]        | | [Đan cước] | |
|  +-------------------+ +-------------------+ +-------------------+ +------------+ |
|  (Hàng 2: thêm 4 sản phẩm nổi bật: Vợt, Giày, Áo đấu, Cước đan...)                |
|                                                                                   |
|                                DANH MỤC CẦU LÔNG                                  |
|                        (#main_img-wrap_c - 30px Bold #000)                        |
|                                                                                   |
|  +-------------------+ +-------------------+ +-------------------+ +------------+ |
|  | [Ảnh Vợt]         | | [Ảnh Giày]        | | [Ảnh Trang phục]  | | [Ảnh Áo]   | |
|  | Vợt Cầu Lông      | | Giày Cầu Lông     | | Trang Phục Tập    | | Áo Đấu Giải| |
|  +-------------------+ +-------------------+ +-------------------+ +------------+ |
|  +-------------------+ +-------------------+ +-------------------+ +------------+ |
|  | [Ảnh Bao vợt]     | | [Ảnh Cước đan]    | | [Ảnh Quả cầu]     | | [Ảnh PK]   | |
|  | Bao Vợt & Balo    | | Cước Đan Vợt      | | Quả Cầu Lông      | | Phụ Kiện   | |
|  +-------------------+ +-------------------+ +-------------------+ +------------+ |
|                                                                                   |
|                      +---------------------------------------+                    |
|                      |    XEM TẤT CẢ SẢN PHẨM CẦU LÔNG       |                    |
|                      +---------------------------------------+                    |
|                       (#top_btn: 400x52px, nền #000, chữ #FFF)                    |
+-----------------------------------------------------------------------------------+
```

---

## 3. Chẩn đoán & Giải pháp khắc phục lỗi "Font và màu chữ khá nhạt"

### 3.1. Nguyên nhân khiến chữ trên web hiện tại bị nhạt

Qua kiểm tra trực tiếp mã nguồn hiện tại (`src/index.css`, `src/components/Header.tsx`, `src/features/home/HomePage.tsx`, `src/components/ProductCard.tsx`, `src/components/TrustBadges.tsx`):

1. **Lạm dụng `text-gray-400` (`#9ca3af`) và `text-gray-500` (`#6b7280`) trên nền trắng:**
   - Màu `#9ca3af` trên nền `#ffffff` chỉ có tỷ lệ tương phản **2.54 : 1** (thấp hơn rất nhiều so với ngưỡng tối thiểu WCAG AA là **4.5 : 1**).
   - Đang được dùng ở: dòng phụ đề logo (`Header.tsx`), từ khóa xu hướng (`Header.tsx`), nhãn ngành hàng trên thẻ sản phẩm (`ProductCard.tsx`), nhãn thông số kỹ thuật `"Trọng lượng:"`, `"Điểm CB:"`, `"Độ cứng:"` (`ProductCard.tsx`), nhãn `"Danh mục"` (`HomePage.tsx`).
2. **Dùng `font-light` (`font-weight: 300`) kèm cỡ chữ siêu nhỏ `10px` (`text-[10px]`):**
   - Trong `TrustBadges.tsx`, cả 4 dòng mô tả cam kết đều dùng `text-[10px] text-gray-500 font-light`, khiến nét chữ cực mảnh và bợt màu.
3. **Tên sản phẩm và bảng thông số vợt thiếu độ đậm khối:**
   - `ProductCard.tsx` đang dùng `text-sm text-gray-800` (`14px`) cho tên sản phẩm và `text-[10px] text-gray-500` cho bảng thông số, trong khi `yonexshop.jp` dùng màu **đen tuyền `#000000`**, cỡ `16px` cho tên và đóng khung viền rõ nét cho từng thông số (`.feature_contents` `font-weight: 600`).

### 3.2. Hệ thống Token Chữ & Màu mới (High-Contrast Ink System)

| Token thiết kế | Mã màu mới | Độ tương phản trên `#FFFFFF` | Thay thế cho class cũ | Quy tắc áp dụng |
| :--- | :--- | :--- | :--- | :--- |
| `--ink-primary` | `#000000` | **21.0 : 1** (Chuẩn AAA) | `text-gray-900`, `text-gray-800`, `text-gray-700` | Toàn bộ tiêu đề (`BADMINTON`, `SẢN PHẨM NỔI BẬT`, `DANH MỤC`), chữ trong `.cate_select`, tên sản phẩm (`.item-name`), giá bán, chữ trong ô `.feature_contents`, liên kết điều hướng. |
| `--ink-secondary` | `#18181b` (`zinc-900`) | **17.4 : 1** (Chuẩn AAA) | `text-gray-600`, `text-gray-500` | Dòng mô tả phụ dưới tiêu đề, nội dung cam kết `TrustBadges`, tên ngành phụ trên thẻ sản phẩm, nhãn lọc trong `CatalogPage`. |
| `--ink-muted` | `#52525b` (`zinc-600`) | **7.0 : 1** (Chuẩn AAA) | `text-gray-400` (`#9ca3af`) | Giá gạch ngang khi khuyến mãi, placeholder ô tìm kiếm, chú thích phụ. **Tuyệt đối không dùng màu chữ nào nhạt hơn `#52525b` trên nền sáng.** |
| `--brand-primary` | `#005eb8` | **6.4 : 1** (Chuẩn AA+) | Giữ nguyên | Nhãn thương hiệu (`YONEX`, `LI-NING`), gạch chân mục đang chọn, tag `"Đan cước theo yêu cầu"`. |
| `--brand-sale` | `#c62828` | **5.9 : 1** (Chuẩn AA+) | `text-red-500` / `text-red-600` | Giá khuyến mãi và huy hiệu giảm giá `-X%`. |

### 3.3. Quy chuẩn Font & Cỡ chữ mới

| Thành phần giao diện | Font Family | Cỡ chữ (PC / Mobile) | Độ đậm (`font-weight`) | Màu chữ |
| :--- | :--- | :--- | :--- | :--- |
| Tiêu đề chuyên trang (`BADMINTON`) | `Montserrat` | `32px` / `24px` | `800` (ExtraBold) | `#000000` |
| Tiêu đề khối (`SẢN PHẨM NỔI BẬT`, `DANH MỤC`) | `Montserrat` | `30px` / `21px` | `800` (ExtraBold) | `#000000` |
| Thanh pill danh mục (`.cate_select button`) | `Be Vietnam Pro` | `15px` / `13.5px` | `700` (Bold) | `#000000` (Active: `#005eb8`) |
| Nhãn Thương hiệu · Ngành (`.category-name`) | `JetBrains Mono` | `12px` / `10.5px` | `700` (Bold) | `#005eb8` & `#18181b` |
| Tên sản phẩm trên thẻ (`.item-name`) | `Be Vietnam Pro` | `16px` / `13.5px` | `600` (SemiBold) | `#000000` |
| Giá bán sản phẩm (`.price`) | `Montserrat` | `17px` / `14.5px` | `800` (ExtraBold) | `#000000` (Sale: `#c62828`) |
| Tag thông số đóng khung (`.feature_contents`) | `Be Vietnam Pro` | `12px` / `10.5px` | `600` (SemiBold) | `#000000` (Viền `1px solid #d4d4d8`) |
| Nhãn ô danh mục hình ảnh (`#main_img-wrap_c p`) | `Be Vietnam Pro` | `15.5px` / `13px` | `700` (Bold) | `#000000` |
| Nút chính cuối trang (`#top_btn`) | `Montserrat` | `16px` / `14px` | `700` (Bold) | `#ffffff` trên nền `#000000` |

---

## 4. Cách xem bản thiết kế tương tác (`design/index.html`)

Mở trực tiếp tệp [`design/index.html`](./index.html) trên trình duyệt (hoặc qua máy chủ tĩnh bất kỳ):

- **Tab 1 — Trang chủ Desktop (1440px):** Trải nghiệm đầy đủ bố cục `BADMINTON` giống `yonexshop.jp/?category_id=1`, có thể bấm chuyển slide hoặc tạm dừng Hero Slider, bấm lọc thử các viên thuốc danh mục trong `.cate_select`, và xem lưới 8 sản phẩm thật của TopVNSport với kiểu thẻ chữ đen sắc nét.
- **Tab 2 — Trang chủ Mobile (390px):** Xem bố cục chuẩn Smartphone (`max-width: 750px` của Yonex): thanh `.cate_select` cuộn ngang có gạch chân, slider vuông `1:1` hé 2 cạnh, lưới sản phẩm và danh mục 2 cột.
- **Tab 3 — Đối chiếu Font & Màu chữ (Trước / Sau):** Đặt cạnh nhau thẻ sản phẩm hiện tại (chữ xám nhạt) và thẻ sản phẩm mới (mực đen `#000000` + khung thông số `.feature_contents`).
- **Tab 4 — Đặc tả Kỹ thuật & Token:** Bảng tra cứu đầy đủ mã màu, độ tương phản và thông số kích thước để sử dụng khi bắt đầu giai đoạn code.
