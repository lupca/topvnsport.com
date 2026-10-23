import { ChevronRight } from 'lucide-react';
import { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { popupService } from '@topvnsport/ui-kit';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import ProductCard from '../../components/ProductCard';
import TrustBadges from '../../components/TrustBadges';
import { getCategoriesSortedByCount, getCategoryLabel, getProductCategoryCounts } from '../../utils/categories';
import { sortProducts } from '../../utils/productSort';
import { addCartItem, buildDefaultCartItem, openCart, setQuickViewProduct } from '../cart/cartSlice';
import { categoryTileThemes, getCategoryMonogram, getCategorySubtitle } from './categoryTileThemes';


export default function HomePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const products = useAppSelector(state => state.appData.products ?? []);
  const categories = useAppSelector(state => state.appData.categories ?? []);

  const sortedCategories = getCategoriesSortedByCount(categories, products);
  const categoryCounts = getProductCategoryCounts(products);

  // Chỉ sản phẩm có khuyến mãi thật (mapper đặt hasActivePromotion); không có thì không hiện khối nào.
  const promoProducts = products.filter(p => p.hasActivePromotion);
  const discounts = promoProducts.map(p => p.percentageDiscount).filter((d): d is number => Number.isFinite(d) && (d as number) > 0);
  const maxDiscount = discounts.length > 0 ? Math.max(...discounts) : undefined;

  const inStock = sortProducts(products, 'in-stock-first').filter(p => (p.stock ?? 0) > 0).slice(0, 8);

  const handleAddToCart = (product: (typeof products)[number], e?: MouseEvent) => {
    if (e) e.stopPropagation();
    const item = buildDefaultCartItem(product);
    if (!item) {
      // Không có đúng một SKU bán được -- ProductCard/QuickViewModal đã tự
      // chặn và dẫn khách sang trang chi tiết trước khi gọi tới đây, nhánh
      // này chỉ còn là chốt chặn phòng thủ, dùng đúng câu đã chốt chung.
      void popupService.alert('Phân loại này hiện không có sẵn. Vui lòng chọn phân loại khác.');
      return;
    }
    dispatch(addCartItem(item));
    dispatch(openCart());
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      <TrustBadges />

      {sortedCategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="font-display font-black text-lg md:text-2xl text-gray-900 tracking-tight uppercase mb-6 flex items-center gap-2">
            Danh mục trang thiết bị cầu lông
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
            {sortedCategories.map((cat, index) => {
              const theme = categoryTileThemes[index % categoryTileThemes.length];
              const label = getCategoryLabel(cat, categories);
              const count = categoryCounts[cat.code] || 0;

              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => navigate(`/catalog?category=${encodeURIComponent(cat.code)}`)}
                  aria-label={`Mở danh mục ${label}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 md:p-5 text-left shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${theme.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                  <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${theme.shell}`} />

                  <div className="relative flex h-full min-h-0 md:min-h-[180px] flex-col gap-2 md:gap-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.28em] ${theme.chip}`}>
                        {count} sản phẩm
                      </span>
                      <ChevronRight className={`w-4 h-4 ${theme.badge} transition-transform duration-300 group-hover:translate-x-1`} />
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gray-400 group-hover:text-brand-primary transition">Danh mục</p>
                        <h3 className="mt-1 font-display text-sm md:text-xl font-black tracking-tight text-gray-900 line-clamp-2 group-hover:text-brand-primary transition">
                          {label}
                        </h3>
                        <p className="hidden md:block mt-2 text-sm leading-relaxed text-gray-500 line-clamp-3">
                          {getCategorySubtitle(cat)}
                        </p>
                      </div>

                      <div className={`hidden md:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br ${theme.shell} shadow-inner`}>
                        <span className={`font-display text-xl font-black tracking-tight ${theme.monogram}`}>
                          {getCategoryMonogram(label)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between text-[11px] font-medium text-gray-500">
                      <span className="font-bold text-brand-primary">Khám phá</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {inStock.length > 0 && (
        <section data-testid="instock-shelf" className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display font-black text-lg md:text-2xl text-gray-900 tracking-tight uppercase">Sản phẩm còn hàng</h2>
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-0.5"
            >
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {inStock.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={prod => dispatch(setQuickViewProduct(prod))}
                onAddToCart={(prod, e) => handleAddToCart(prod, e)}
              />
            ))}
          </div>
        </section>
      )}

      {promoProducts.length > 0 && (
        <section data-testid="promo-section" className="max-w-7xl mx-auto px-4 md:px-8">
          <div data-testid="promo-banner" className="bg-brand-accent rounded-2xl p-6 text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

            <div className="space-y-2 text-center lg:text-left">
              <span className="bg-white/10 text-white border border-white/20 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                Đang khuyến mãi
              </span>
              {maxDiscount !== undefined && (
                <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight uppercase leading-none">
                  Giảm đến {maxDiscount}%
                </h3>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {promoProducts.slice(0, 4).map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={prod => dispatch(setQuickViewProduct(prod))}
                onAddToCart={(prod, e) => handleAddToCart(prod, e)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
