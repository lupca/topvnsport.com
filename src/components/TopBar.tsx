import React from 'react';
import { Link } from 'react-router-dom';

// STOR-054: thanh đen trên cùng theo /design/index.html. Bỏ chấm xanh "Đang mở cửa"
// và "Tra cứu bảo hành" vì chưa có dữ liệu/route thật; giữ lời cam kết PO đã duyệt.
export function TopBar() {
  return (
    <div className="hidden md:block bg-ink-primary text-white text-xs font-semibold px-6 py-2" data-testid="topbar">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/stores"
            className="bg-ink-secondary border border-zinc-700 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold text-white hover:border-white transition"
          >
            Showroom Hà Nội · Đan vợt lấy ngay 30p
          </Link>
          <span>Cam kết 100% chính hãng - Đền gấp 10 nếu giả</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/stores" className="text-white font-semibold hover:underline">Đặt lịch đan vợt O2O</Link>
          <span aria-hidden="true">|</span>
          <a href="tel:0976007006" className="text-white font-semibold hover:underline">Hotline: 097 6007006</a>
        </div>
      </div>
    </div>
  );
}

export function MobileTopStrip() {
  return (
    <div className="md:hidden bg-ink-primary text-white text-center text-[11.5px] font-bold py-1.5 px-2.5" data-testid="mobile-top-strip">
      Đan vợt chuẩn quốc tế 30p
    </div>
  );
}
