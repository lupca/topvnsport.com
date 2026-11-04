# Mẫu mobile của đối thủ (STOR-128, goal 2c881ad4)

Chỉ ghi **pattern** (header, nav, dải khuyến mãi), không chép nội dung, không lưu ảnh chụp của đối thủ.
Cách xem: `node e2e/mobile-audit/competitors.cjs` mở trang chủ ở 390x844 (chỉ tải + chờ + cuộn thụ động; không đăng nhập, không gửi form, không bấm), số đo bằng `page.evaluate`; phần "quan sát" là nhìn bố cục một lần, ảnh tạm không đưa vào repo.
`yonex.vn` không dùng vì lỗi TLS (STOR-125); mẫu Yonex là `yonexshop.jp`. Đo ngày 2026-11-04.

| site | cao khối header | header cố định/dính? | cố định trên cùng khi cuộn | nav | dải thông tin trong header | cuộn ngang trang |
|---|---|---|---|---|---|---|
| shopvnb.com | 80px | không (static) | 0px | hamburger + biểu tượng tìm kiếm, không có hàng danh mục | không có | không |
| yonexshop.jp | 108px (63 thanh logo + 45 dải thông báo) | không (relative) | 0px ở header (số 550px do popup đầu trang, không phải header) | hamburger (biểu tượng, quan sát) | 1 dải, 1 dòng, cao 45px | không |
| hvshop.vn | 70px | không (relative) | 0px | không hamburger, không hàng danh mục trên đầu | không có | không |
| www.topvnsport.com (của ta, trang chủ live) | 79px | có (sticky) | 79px, 2 hàng khi cuộn | hàng danh mục ẩn ở trang chủ (0 hàng); các trang khác xem `before.md` | 1 dải 1 dòng ở trang chủ | không |

## shopvnb.com

- Header 1 hàng duy nhất: bên trái hamburger + tìm kiếm (biểu tượng), giữa logo, bên phải 3 biểu tượng (so sánh, tài khoản, giỏ kèm số). Cao 80px, **không dính** – cuộn đi cùng trang.
- Không có hàng danh mục: toàn bộ danh mục nằm trong ngăn menu (hamburger). Không có dải khuyến mãi phía trên header.
- Khuyến mãi là banner ảnh ngay dưới header (nội dung trang, không phải vùng cố định), tiếp theo là lưới 4 ô cam kết (2×2).
- Nút nổi cố định ở đáy (giỏ hàng, hệ thống cửa hàng) và nút chat tròn; không có thanh tab đáy chiếm hàng.
- Bài học cho ta: nav trong ngăn, header không dính hoặc 1 hàng, khuyến mãi là nội dung chứ không phải thanh cố định.

## yonexshop.jp

- Thanh header đen 63px 1 hàng: logo bên trái; bên phải tìm kiếm, giỏ, yêu thích, hamburger (biểu tượng). Cao tổng 108px kể cả dải thông báo; không dính.
- Dải thông báo ngay dưới header: **1 dòng**, chữ cắt gọn (một câu + nút tạm dừng cho dải luân phiên), nền sáng, cao 45px.
- Danh mục trong hamburger; không có hàng danh mục ngang.
- Vào trang bật popup toàn màn hình (đăng ký kênh chat) và nút liên hệ nổi ở đáy: pattern cần tránh vì che màn hình đầu.
- Bài học: dải thông tin 1 dòng cắt gọn nằm trong header, nav gói vào hamburger.

## hvshop.vn

- Header 70px 1 hàng: logo trái, ô tìm kiếm co giãn ở giữa (luôn hiện, không thu thành biểu tượng), giỏ phải (kèm số). Không dính.
- Không hamburger và không hàng danh mục trong màn hình đầu: danh mục là lưới ô biểu tượng nằm trong nội dung trang chủ (dưới banner và khối 4 cam kết xếp dọc).
- Khuyến mãi là banner ảnh trong nội dung; không có dải thông tin trên cùng.
- Bài học: ô tìm kiếm giữ nguyên trên header, nhưng mọi thứ khác (danh mục, cam kết, khuyến mãi) thành nội dung cuộn được.

## Tổng hợp pattern chung (không phải quyết định thiết kế)

- Cả 3 đối thủ: header mobile **1 hàng, 70–108px**, không hàng danh mục nhiều dòng; cả ba **không dính** (static/relative): khi cuộn, vùng cố định trên cùng là 0px.
- Nav danh mục: hamburger/ngăn menu (shopvnb, yonexshop.jp) hoặc ô nội dung trong trang chủ (hvshop); không site nào xếp danh mục thành nhiều hàng trong header.
- Dải khuyến mãi/thông tin: tối đa 1 dòng và nằm trong header (yonexshop.jp), hoặc là banner trong nội dung (shopvnb, hvshop); không đối thủ nào có dải thông tin nhiều dòng cố định trên cùng.
- Của ta (xem `before.md`): trang chủ header dính 79px; các trang có hàng danh mục (catalog, PDP, …) header dính **420px**, nav 3 hàng + dải đan vợt 3 dòng, đo trên site live (www.topvnsport.com/catalog, 390x844, 2026-11-04, chỉ-đọc) và trùng với bộ fixture của `before.md` (5 liên kết nav). Đối chiếu MOB-A/B/C.
