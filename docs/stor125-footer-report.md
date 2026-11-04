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

## Ghi chú

- http://yonex.vn/ chuyển hướng bằng JS tới https://liningbadminton.vn/; cột này được đặt tên theo URL cuối https://liningbadminton.vn/.
- https://yonex.vn/ không mở được, lỗi TLS: net::ERR_CERT_COMMON_NAME_INVALID.
- Cột "Footer của chúng ta" được đo trên footer render thật (`#topvnsport-footer section.bg-footer-bg`, vite dev với dữ liệu /api giả).
