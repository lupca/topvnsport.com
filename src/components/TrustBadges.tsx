import React from 'react';
import { Product } from '../types';
import { getBrands } from '../utils/brands';
import { isStringingTier } from './product-detail/helpers';

// Dải cam kết đầu footer (bản thiết kế /design/index.html .trust-strip).
// Tên thương hiệu/cước của thiết kế chỉ hiện khi có trong dữ liệu đã tải (spec 37f60f5b).
const DESIGN_BRANDS = ['Yonex', 'Li-Ning', 'Victor', 'Kizuna'];
const DESIGN_STRINGS = ['BG66U', 'Exbolt 65', 'Kizuna Z61'];

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function getTrustBrands(products: Product[]): string[] {
  const loaded = new Set(getBrands(products).map(b => b.toLowerCase()));
  return DESIGN_BRANDS.filter(b => loaded.has(b.toLowerCase()));
}

export function getTrustStrings(products: Product[]): string[] {
  const options = new Set(
    products.flatMap(p => (p.tier_variations ?? []).filter(t => Array.isArray(t.options) && isStringingTier(t)).flatMap(t => t.options.map(normalize)))
  );
  return DESIGN_STRINGS.filter(s => options.has(normalize(s)));
}

export default function TrustBadges({ products }: { products: Product[] }) {
  const others = getTrustBrands(products).filter(b => b !== 'Yonex');
  const strings = getTrustStrings(products);
  const items = [
    // Shop chỉ là đại lý uỷ quyền của Yonex Sunrise; hãng khác chỉ được cam kết chính hãng, không ghi "phân phối chính thức".
    { title: '100% Chính Hãng', text: `Đại lý uỷ quyền Yonex Sunrise${others.length ? `, cam kết chính hãng ${others.join(', ')}` : ''}. Đền gấp 10 lần nếu phát hiện hàng giả.` },
    { title: 'Đan Vợt Điện Tử O2O', text: `Tùy chọn cước${strings.length ? ` ${strings.join(', ')}` : ''} và mức căng 9.0–13.0kg ngay khi đặt vợt.` },
    { title: 'Giao Hỏa Tốc & Đồng Kiểm', text: 'Kiểm tra khung vợt, mã tem chống giả và độ căng mặt lưới trước khi thanh toán.' },
    { title: 'Showroom Trải Nghiệm', text: 'Cầm thử trực tiếp trọng lượng 3U / 4U / 5U và đo điểm cân bằng tại cửa hàng Hà Nội.' }
  ];
  return (
    <section data-testid="trust-row" className="bg-[#f8f9fa] border-y border-zinc-200 px-[24px] py-[36px]">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
        {items.map(item => (
          <div key={item.title} className="border-l-[3px] border-ink-primary pl-[16px]">
            <h4 className="font-display font-extrabold uppercase text-[14px] leading-[1.5] text-ink-primary mb-[4px]">{item.title}</h4>
            <p className="text-[13.5px] leading-[1.45] text-ink-secondary font-medium">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
