# STOR-125 — Nghiên cứu footer

Sinh tự động bởi `scripts/stor125-footer-research/extract.cjs` ngày 2026-11-04 (viewport 1440x900, chỉ tải trang, không đăng nhập, không gửi form, không bấm). Ô chỉ ghi yes / no / 'khong doc duoc'; không chép nội dung của site khác.

## Bảng 1 — Các khối trong footer

| Khối | https://shopvnb.com/ | https://liningbadminton.vn/ | https://hvshop.vn/ | Footer của chúng ta |
|---|---|---|---|---|
| Tên shop và địa chỉ (shop name and address) | yes | yes | yes | yes |
| Hotline | yes | yes | yes | yes |
| Email | yes | yes | no | no |
| Hệ thống cửa hàng (store system) | yes | no | no | yes |
| Chính sách đổi trả (doi tra policy) | yes | yes | yes | no |
| Chính sách bảo hành (bao hanh policy) | yes | no | yes | no |
| Chính sách vận chuyển (van chuyen policy) | yes | yes | yes | no |
| Chính sách thanh toán (thanh toan policy) | yes | yes | yes | no |
| Chính sách bảo mật (bao mat policy) | yes | yes | yes | no |
| Liên kết mạng xã hội (social links) | yes | yes | yes | no |
| Đăng ký kinh doanh (business registration) | yes | yes | yes | no |
| Chính sách kiểm hàng (kiem hang) — không bắt buộc (not required) | no | yes | no | no |
| Điều khoản sử dụng (dieu khoan) — không bắt buộc (not required) | yes | yes | no | no |

Hai dòng cuối (kiểm hàng, điều khoản) chỉ ghi nhận thêm, không bắt buộc (not required).

## Bảng 2 — Thông tin trên footer của chúng ta và nguồn

| Thông tin | Giá trị đo được | Nguồn |
|---|---|---|
| Dòng đại lý (trust line) | Đại lý uỷ quyền Yonex Sunrise. | chủ shop duyệt 04/11 |
| Địa chỉ | Số 1, ngõ 141/3, phố Lê Văn Hiến, Phường Đông Ngạc, Hà Nội | chủ shop duyệt 04/11 |
| Hotline | 097 6007006 (href tel:0976007006) | chủ shop duyệt 04/11 |
| Giờ hotline | Giờ hotline: 08:00 - 22:00 | chủ shop duyệt 04/11 |
| Shopee | Gian hàng trên Shopee (href https://shopee.vn/shop/1406345225) | chủ shop duyệt 04/11 |
| Link danh mục | 2 mục: Vợt Cầu Lông Yonex / Li-Ning (/catalog?category=VC001491); Giày Cầu Lông Chuyên Dụng (/catalog?category=VC001427) | Dữ liệu danh mục VOMA (getVisibleMainNav), xác nhận trên https://www.topvnsport.com |

## Thông tin còn thiếu (chủ shop cần cung cấp)

- Email: chủ shop cần cung cấp
- Đăng ký kinh doanh (số ĐKKD): chủ shop cần cung cấp
- Mã số thuế: chủ shop cần cung cấp
- Link TikTok: chủ shop cần cung cấp
- Link Facebook: chủ shop cần cung cấp
- Link Zalo: chủ shop cần cung cấp
- Link YouTube: chủ shop cần cung cấp
- Trang chính sách đổi trả: chủ shop cần cung cấp đường dẫn trang và nội dung
- Trang chính sách bảo hành: chủ shop cần cung cấp đường dẫn trang và nội dung
- Trang chính sách vận chuyển: chủ shop cần cung cấp đường dẫn trang và nội dung
- Trang chính sách thanh toán: chủ shop cần cung cấp đường dẫn trang và nội dung
- Trang chính sách bảo mật: chủ shop cần cung cấp đường dẫn trang và nội dung

## Ghi chú

- http://yonex.vn/ chuyển hướng bằng JS tới https://liningbadminton.vn/; cột này được đặt tên theo URL cuối https://liningbadminton.vn/.
- https://yonex.vn/ không mở được, lỗi TLS: net::ERR_CERT_COMMON_NAME_INVALID.
- Cột "Footer của chúng ta" được đo trên footer render thật (`#topvnsport-footer section.bg-footer-bg`, vite dev với dữ liệu /api giả).
