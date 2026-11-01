import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { popupService } from '@topvnsport/ui-kit';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import ProductCard from '../../components/ProductCard';
import TrustBadges from '../../components/TrustBadges';
import { NO_IMAGE_URL } from '../../services/sport-api/constants';
import { hasO2OStringing } from '../../utils/badmintonReadiness';
import { getBrands } from '../../utils/brands';
import { getCategoriesSortedByCount, getCategoryLabel, getProductCategoryCounts } from '../../utils/categories';
import { SORT_OPTIONS, SortMode, sortProducts } from '../../utils/productSort';
import { fetchAppData } from '../appData/appDataSlice';
import { addCartItemAndOpen, buildDefaultCartItem, setQuickViewProduct } from '../cart/cartSlice';
import BadmintonCenterSlider from './BadmintonCenterSlider';

const ALL = 'ALL';
const O2O = 'O2O';
const ACTIVE_CHIP = 'bg-ink-primary text-white shadow-md';

export default function HomePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const products = useAppSelector(state => state.appData.products ?? []);
  const categories = useAppSelector(state => state.appData.categories ?? []);
  const productsError = useAppSelector(state => state.appData.productsError);

  const sortedCategories = getCategoriesSortedByCount(categories, products);
  const categoryCounts = getProductCategoryCounts(products);

  // Chỉ sản phẩm có khuyến mãi thật (mapper đặt hasActivePromotion); không có thì không hiện khối nào.
  const promoProducts = products.filter(p => p.hasActivePromotion);
  const discounts = promoProducts.map(p => p.percentageDiscount).filter((d): d is number => Number.isFinite(d) && (d as number) > 0);
  const maxDiscount = discounts.length > 0 ? Math.max(...discounts) : undefined;

  const allInStock = sortProducts(products, 'in-stock-first').filter(p => (p.stock ?? 0) > 0);
  const brands = getBrands(allInStock);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [quickFilter, setQuickFilter] = useState<string>(ALL);
  const [sortMode, setSortMode] = useState<SortMode>('in-stock-first');

  // STOR-056: chỉ lọc theo dữ liệu VOMA thật (ngành, thương hiệu, tầng cước); lối đánh không có nguồn nên không lọc.
  const matched = sortProducts(products, sortMode)
    .filter(p => (p.stock ?? 0) > 0)
    .filter(p => selectedCategory === ALL || p.categoryCode === selectedCategory)
    .filter(p =>
      quickFilter === ALL ? true : quickFilter === O2O ? hasO2OStringing(p) : `brand:${p.brand?.trim()}` === quickFilter
    );
  const shown = matched.slice(0, 8);

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
    dispatch(addCartItemAndOpen(item));
  };

  // STOR-053: lỗi tải sản phẩm và shop chưa có sản phẩm là hai câu khác nhau.
  if (productsError || products.length === 0) {
    return (
      <section className="max-w-xl mx-auto px-4 py-16 text-center">
        {productsError && (
          <div role="alert" className="space-y-4">
            <p className="text-base font-medium text-ink-primary">Cửa hàng chưa tải được sản phẩm lúc này. Vui lòng thử lại sau.</p>
            <button
              type="button"
              onClick={() => dispatch(fetchAppData())}
              className="rounded-full bg-ink-primary text-white px-5 py-2 text-sm font-bold hover:opacity-90 transition"
            >
              Thử lại
            </button>
          </div>
        )}
        {!productsError && <p role="status" className="text-base font-medium text-ink-primary">Cửa hàng chưa có sản phẩm nào đang bán.</p>}
      </section>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      <TrustBadges />

      {sortedCategories.length > 0 && (
        <section data-testid="badminton-hub-header" className="max-w-7xl mx-auto px-4 md:px-8 pt-2">
          <div className="title-box text-center mb-4">
            <h1 className="font-display font-black text-2xl md:text-4xl tracking-tight text-ink-primary uppercase">
              BADMINTON
            </h1>
          </div>
          {/* STOR-056: chip lọc kệ ngay trên trang (không rời /), "Tất cả" đứng đầu. */}
          <div
            data-testid="cate-select-bar"
            role="tablist"
            aria-label="Danh mục"
            className="cate_select mx-auto w-fit max-w-full bg-pill-bg border border-line-tag rounded-2xl md:rounded-full p-2 md:p-1.5 flex flex-wrap items-center justify-center gap-1"
          >
            {[{ code: ALL, id: ALL, label: 'Tất cả', count: products.length }, ...sortedCategories.map(cat => ({ code: cat.code, id: cat.id, label: getCategoryLabel(cat, categories), count: categoryCounts[cat.code] || 0 }))].map(chip => {
              const active = selectedCategory === chip.code;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  key={chip.id}
                  data-testid={`cate-pill-${chip.code}`}
                  onClick={() => setSelectedCategory(chip.code)}
                  className={`min-h-11 rounded-full px-3 md:px-[18px] py-1.5 md:py-2 text-[13px] md:text-sm font-bold whitespace-nowrap transition flex items-center gap-1.5 ${active ? ACTIVE_CHIP : 'bg-transparent text-ink-primary hover:bg-white/75 hover:text-brand-primary'}`}
                >
                  <span>{chip.label}</span>
                  <span className="font-mono text-[11.5px] tabular-nums opacity-90">({chip.count})</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <BadmintonCenterSlider products={allInStock.slice(0, 5)} />

      {allInStock.length > 0 && (
        <section data-testid="instock-shelf" className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="text-center font-display font-black text-2xl md:text-3xl text-ink-primary tracking-wide uppercase pt-5 pb-6">SẢN PHẨM NỔI BẬT</h2>

          <div className="flex flex-wrap items-center justify-between gap-4 bg-brand-light border border-line-tag rounded-[10px] px-4 py-3 mb-7">
            <div data-testid="quick-filter-bar" className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11.5px] font-bold uppercase text-ink-secondary mr-1">Lọc nhanh:</span>
              {[
                { key: ALL, label: 'Tất cả' },
                ...brands.map(b => ({ key: `brand:${b}`, label: b })),
                ...(allInStock.some(hasO2OStringing) ? [{ key: O2O, label: 'Có đan cước O2O' }] : []),
              ].map(chip => (
                <button
                  type="button"
                  key={chip.key}
                  data-testid={`quick-chip-${chip.key}`}
                  aria-pressed={quickFilter === chip.key}
                  onClick={() => setQuickFilter(chip.key)}
                  className={`rounded-md border px-3 py-1.5 text-[12.5px] font-bold transition ${quickFilter === chip.key ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-line-tag text-ink-primary hover:border-ink-primary'}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span data-testid="result-counter" className="font-mono text-xs font-bold text-ink-secondary tabular-nums">
                Hiển thị {shown.length} / {matched.length} sản phẩm
              </span>
              <select
                data-testid="sort-select"
                aria-label="Sắp xếp sản phẩm"
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="bg-white border-[1.5px] border-ink-primary text-ink-primary text-[13px] font-bold px-3 py-1.5 rounded-md cursor-pointer"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {shown.length === 0 && <p role="status" className="text-center text-sm font-medium text-ink-muted py-8">Không có sản phẩm còn hàng phù hợp bộ lọc.</p>}
          <div data-testid="featured-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {shown.map(p => (
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

      {sortedCategories.length > 0 && (
        <section data-testid="category-tiles" className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="text-center font-display font-black text-2xl md:text-3xl text-ink-primary tracking-wide uppercase pt-5 pb-6">Danh mục cầu lông</h2>

          <div data-testid="category-tile-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-[18px] lg:gap-x-6 lg:gap-y-7">
            {sortedCategories.slice(0, 8).map(cat => {
              const label = getCategoryLabel(cat, categories);
              // Ảnh ngành = ảnh bìa thật của một sản phẩm còn hàng trong ngành (VOMA không có ảnh ngành).
              const image = allInStock.find(p => p.categoryCode === cat.code && p.image && p.image !== NO_IMAGE_URL)?.image;
              return (
                <button
                  type="button"
                  key={cat.id}
                  data-testid={`cat-tile-${cat.code}`}
                  onClick={() => navigate(`/catalog?category=${encodeURIComponent(cat.code)}`)}
                  aria-label={`Mở danh mục ${label}`}
                  className="group flex flex-col bg-white border border-line-tag text-left transition hover:border-ink-primary hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  <div className="w-full aspect-[4/3] overflow-hidden bg-brand-light border-b border-line-tag">
                    {image ? (
                      <img src={image} alt={label} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div data-testid="cat-tile-placeholder" aria-hidden="true" className="w-full h-full bg-brand-light" />
                    )}
                  </div>
                  <div className="px-3 py-3.5 text-center">
                    <h3 className="text-sm md:text-[15.5px] font-extrabold text-ink-primary line-clamp-2 group-hover:text-brand-primary transition">{label}</h3>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-center pt-5 pb-9">
            <button
              type="button"
              data-testid="view-all-catalog"
              onClick={() => navigate('/catalog')}
              className="inline-flex items-center justify-center w-[420px] max-w-[90%] h-[54px] bg-black text-white border-2 border-black rounded-[5px] font-display text-[15.5px] font-extrabold tracking-wider uppercase transition hover:bg-brand-primary hover:border-brand-primary"
            >
              XEM TẤT CẢ SẢN PHẨM CẦU LÔNG
            </button>
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
