import { MouseEvent } from 'react';
import ProductCard from '../../components/ProductCard';
import { Product } from '../../types';
import { getPriceDisplay } from '../../utils/priceDisplay';
import { getPromotedInStock } from '../../utils/promotions';

interface SaleSectionProps {
  products: Product[];
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, e: MouseEvent) => void;
}

// STOR-110: MỌI SP còn hàng đang KM (luật STOR-109), giữ thứ tự giảm % nhiều nhất trước, không giới hạn.
// "Giảm đến x%" = % giảm lớn nhất thật trong danh sách, cùng số với nhãn -N% trên thẻ.
export default function SaleSection({ products, onQuickView, onAddToCart }: SaleSectionProps) {
  const list = getPromotedInStock(products);
  if (list.length === 0) return null;
  const max = Math.max(...list.map(p => getPriceDisplay(p).discountPercent));

  return (
    <section data-testid="sale-section" className="max-w-[1280px] mx-auto px-4 md:px-[24px]">
      <div className="flex flex-wrap items-center justify-center gap-3 pt-5 pb-6 max-md:pb-[14px]">
        <h2 className="text-center font-display font-black text-2xl max-md:text-[20px] max-md:leading-[30px] md:text-3xl text-ink-primary tracking-wide uppercase">Đang khuyến mãi</h2>
        {Number.isFinite(max) && max > 0 && (
          <span data-testid="sale-max-badge" className="font-display max-md:text-[14px] md:text-[13px] font-extrabold uppercase px-2 py-1 bg-brand-sale text-white">
            Giảm đến {max}%
          </span>
        )}
      </div>
      <div data-testid="sale-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-[16px] md:gap-6">
        {list.map(p => (
          <ProductCard key={p.id} product={p} onQuickView={onQuickView} onAddToCart={onAddToCart} />
        ))}
      </div>
    </section>
  );
}
