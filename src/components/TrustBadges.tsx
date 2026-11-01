import React from 'react';

// Dải cam kết đầu footer (bản thiết kế /design/index.html .trust-strip).
// Bỏ Victor/Kizuna và "Giao Hỏa Tốc": không có dữ liệu chứng minh (spec 37f60f5b).
const TRUST_ITEMS = [
  { title: '100% Chính Hãng', text: 'Phân phối chính thức Yonex, Li-Ning. Đền gấp 10 lần nếu phát hiện hàng giả.' },
  { title: 'Đan Vợt Điện Tử O2O', text: 'Tùy chọn cước và mức căng 9.0–13.0kg ngay khi đặt vợt.' },
  { title: 'Đồng Kiểm', text: 'Kiểm tra khung vợt, mã tem chống giả và độ căng mặt lưới trước khi thanh toán.' },
  { title: 'Showroom Trải Nghiệm', text: 'Cầm thử trực tiếp trọng lượng 3U / 4U / 5U và đo điểm cân bằng tại cửa hàng Hà Nội.' }
];

export default function TrustBadges() {
  return (
    <section data-testid="trust-row" className="bg-[#f8f9fa] border-y border-zinc-200 px-[24px] py-[36px]">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
        {TRUST_ITEMS.map(item => (
          <div key={item.title} className="border-l-[3px] border-ink-primary pl-[16px]">
            <h4 className="font-display font-extrabold uppercase text-[14px] leading-[1.5] text-ink-primary mb-[4px]">{item.title}</h4>
            <p className="text-[13.5px] leading-[1.45] text-ink-secondary font-medium">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
