import React, { useState, useEffect, useRef, useContext } from 'react';
import { ReactReduxContext } from 'react-redux';
import { popupService } from '@topvnsport/ui-kit';
import { clearStockNotice } from '../features/cart/cartSlice';
import { fetchAppData } from '../features/appData/appDataSlice';
import { Search, ChevronRight, Menu, X, MapPin } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Category, Product } from '../types';
import { getCategoriesSortedByCount, getCategoryLabel } from '../utils/categories';
import { getProductPath } from '../utils/productSlug';
import { getBrands } from '../utils/brands';
import { getPriceDisplay } from '../utils/priceDisplay';
import MainNav from './MainNav';

export const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const buildSearchIndex = (product: Product) =>
  normalizeSearchText([
    product.name,
    product.brand || '',
    product.series || '',
    product.category || '',
    product.description || '',
    ...(product.features || [])
  ].join(' '));

interface HeaderProps {
  cartCount: number;
  openCart: () => void;
  products: Product[];
  categories: Category[];
  categoriesError?: boolean;
  productsError?: boolean;
}

export default function Header({ cartCount, openCart, products, categories, categoriesError, productsError }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Báo khách khi thêm vượt tồn (cartSlice ghi stockNotice). Header luôn có mặt
  // nên là chỗ chung cho mọi nơi thêm giỏ; không có store (test riêng) thì bỏ qua.
  const store = useContext(ReactReduxContext)?.store;
  const [, setStoreVersion] = useState(0);
  useEffect(() => {
    if (!store) return;
    let prevCategoriesError = Boolean(store.getState().appData?.categoriesError);
    let prevProductsError = Boolean(store.getState().appData?.productsError);
    return store.subscribe(() => {
      const state = store.getState();
      const notice = state.cart?.stockNotice;
      if (notice) {
        store.dispatch(clearStockNotice());
        void popupService.alert(notice);
      }
      const nextCategoriesError = Boolean(state.appData?.categoriesError);
      const nextProductsError = Boolean(state.appData?.productsError);
      if (nextCategoriesError !== prevCategoriesError || nextProductsError !== prevProductsError) {
        prevCategoriesError = nextCategoriesError;
        prevProductsError = nextProductsError;
        setStoreVersion(v => v + 1);
      }
    });
  }, [store]);

  const appDataState = store?.getState()?.appData;
  const resolvedCategoriesError = categoriesError ?? Boolean(appDataState?.categoriesError);
  const resolvedProductsError = productsError ?? Boolean(appDataState?.productsError);
  const hasCatalogLoadError = Boolean(resolvedCategoriesError || resolvedProductsError);

  const handleRetryCatalog = () => {
    if (!store) return;
    store.dispatch(fetchAppData() as unknown as Parameters<typeof store.dispatch>[0]);
  };
  const currentView = location.pathname.includes('catalog') ? 'catalog' : location.pathname.includes('store') ? 'store-locator' : location.pathname === '/' ? 'home' : '';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Khoá cuộn trang nền khi drawer mở; đóng hoặc unmount thì trả lại.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobileMenuOpen]);

  const submitSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/catalog?search=${encodeURIComponent(q)}`);
    setShowSearchDropdown(false);
  };

  // AJAX search emulation
  useEffect(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    if (normalizedQuery.length >= 2) {
      const tokens = normalizedQuery.split(' ').filter(Boolean);
      const filtered = products.filter(product => {
        const searchIndex = buildSearchIndex(product);
        return tokens.every(token => searchIndex.includes(token));
      });
      setSearchResults(filtered.slice(0, 5));
      setShowSearchDropdown(true);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  }, [searchQuery, products]);

  const handleSearchSelect = (product: Product) => {
    navigate(getProductPath(product));
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const sortedCategories = getCategoriesSortedByCount(categories, products);

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50 shadow-xs" id="topvnsport-header">
      {/* Top Bar */}
      <div className="hidden md:flex bg-ink-primary text-white text-xs font-semibold py-2 px-4 md:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/stores')}
              className="inline-flex items-center gap-2 bg-ink-secondary border border-zinc-700 px-2.5 py-0.5 rounded-full text-[11.5px] font-bold text-white hover:border-zinc-500 transition cursor-pointer"
            >
              Showroom Hà Nội · Đan vợt lấy ngay 30p
            </button>
            <span>Cam kết 100% chính hãng - Đền gấp 10 nếu giả</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/stores" className="text-white hover:underline transition">
              Đặt lịch đan vợt O2O
            </Link>
            <span className="text-zinc-600">|</span>
            {/* Chưa có trang tra cứu bảo hành: bảo hành xử lý tại chi nhánh theo SĐT mua hàng. */}
            <Link to="/stores" className="text-white hover:underline transition">
              Tra cứu bảo hành
            </Link>
            <span className="text-zinc-600">|</span>
            <a href="tel:0976007006" className="text-white hover:underline transition">
              Hotline: 097 6007006
            </a>
          </div>
        </div>
      </div>

      {/* Mobile Top Row */}
      <div className="md:hidden flex items-center justify-between gap-2 px-4 py-2 max-[399px]:gap-1 max-[399px]:px-3">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-1 -ml-1 text-gray-700 hover:text-brand-primary rounded-lg transition shrink-0"
          aria-label="Open mobile menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/stores')}
          className="border border-ink-primary text-ink-primary text-xs font-bold px-2.5 max-[399px]:px-2 py-1 rounded-sm hover:bg-ink-primary hover:text-white transition shrink-0"
        >
          Đan cước
        </button>
        <div 
          onClick={() => navigate('/')} 
          className="cursor-pointer font-display font-extrabold text-lg tracking-tight text-gray-900 leading-none min-w-0 truncate"
        >
          TOPVN<span className="text-brand-primary">SPORT</span>
        </div>
        <button 
          type="button"
          onClick={openCart}
          aria-label="Giỏ hàng"
          className="bg-ink-primary text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-brand-primary transition shrink-0 tabular-nums"
        >
          Giỏ ({cartCount})
        </button>
      </div>

      {/* Mobile Black Strip */}
      <div className="md:hidden bg-ink-primary text-white text-center text-[11.5px] font-bold py-1.5 px-3">
        Đan vợt chuẩn quốc tế 30p
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-[16px] md:px-6 lg:px-8 py-2 md:py-4 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
        {/* Desktop Brand Logo */}
        <div 
          onClick={() => navigate('/')} 
          className="hidden md:flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 bg-white rounded-lg border border-gray-100 shadow-xs flex items-center justify-center overflow-hidden group-hover:border-brand-primary/50 transition shrink-0">
            <img 
              src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
              alt="TopVNSport Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <span className="font-display font-extrabold text-2xl tracking-tight text-gray-900 block leading-none">
              TOPVN<span className="text-brand-primary">SPORT</span>
            </span>
            <p className="text-[9px] text-gray-400 tracking-widest uppercase font-semibold mt-0.5">Badminton Specialty Store</p>
          </div>
        </div>

        {/* Search Bar Widget with suggestions */}
        <div className="w-full min-w-0 flex-1 md:max-w-xl relative" ref={dropdownRef}>
          <div className="flex items-center border border-ink-primary rounded-full pl-3.5 pr-1.5 py-1 bg-white focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition">
            <Search className="w-4 h-4 md:w-4.5 md:h-4.5 text-gray-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Tìm vợt Yonex, Lining, cước đan, giày cầu lông..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length >= 2 && setShowSearchDropdown(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
              className="w-full min-w-0 bg-transparent text-xs md:text-sm font-semibold text-ink-primary placeholder:text-ink-muted placeholder:font-normal focus:outline-hidden"
            />
            {searchQuery !== '' && (
              <button
                type="button"
                aria-label="Xoá từ khoá"
                onClick={() => setSearchQuery('')}
                className="p-1 text-gray-400 hover:text-gray-700 shrink-0 mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={submitSearch}
              className="bg-ink-primary hover:bg-brand-primary text-white text-xs font-bold px-3 py-1.5 rounded-full transition shrink-0"
            >
              Tìm kiếm
            </button>
          </div>

          {/* Dynamic Dropdown Search Results (AJAX Mockup) */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-gray-100 rounded-xl shadow-sm z-50 overflow-hidden divide-y divide-gray-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="bg-gray-50 px-4 py-2 text-[11px] font-semibold text-gray-400 tracking-wider uppercase">Kết quả tìm kiếm phù hợp</div>
              {searchResults.length > 0 ? (
                searchResults.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSearchSelect(p)}
                    className="p-3 hover:bg-brand-light/50 cursor-pointer flex items-center gap-3 transition"
                  >
                    <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded-md border border-gray-100" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.brand && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-sm font-mono font-bold uppercase">{p.brand}</span>}
                        {p.specs.weight && <span className="text-[10px] text-gray-400">{p.specs.weight}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-brand-primary">{p.price === undefined ? 'Liên hệ để biết giá' : `${getPriceDisplay(p).salePrice.toLocaleString('vi-VN')}đ`}</p>
                      {p.price !== undefined && getPriceDisplay(p).hasActivePromotion && (
                        <p className="text-[10px] text-gray-400 line-through">{getPriceDisplay(p).originalPrice.toLocaleString('vi-VN')}đ</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500">Không tìm thấy sản phẩm nào khớp với từ khóa.</div>
              )}
              <div 
                onClick={() => {
                  navigate(`/catalog?search=${encodeURIComponent(searchQuery)}`);
                  setShowSearchDropdown(false);
                }} 
                className="p-2.5 bg-brand-light text-center text-xs font-semibold text-brand-primary hover:bg-brand-light cursor-pointer transition"
              >
                Xem tất cả kết quả cho "{searchQuery}"
              </div>
            </div>
          )}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button 
            type="button"
            onClick={() => navigate('/stores')}
            className="hidden lg:inline-flex items-center gap-2 text-xs md:text-sm font-bold text-ink-primary px-3.5 py-2 border border-ink-primary rounded-full hover:bg-ink-primary hover:text-white transition whitespace-nowrap shrink-0"
          >
            Tư vấn Đan Cước
          </button>

          <button 
            type="button"
            onClick={openCart}
            aria-label="Giỏ hàng"
            className="inline-flex items-center gap-2 text-xs md:text-sm font-bold bg-ink-primary text-white px-4 py-2 rounded-full hover:bg-brand-primary transition shrink-0"
          >
            <span>Giỏ hàng</span>
            <span className="bg-brand-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums">
              {cartCount}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Navigation Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" id="mobile-sidebar-drawer">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-black"
            />

            {/* Sidebar content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 bottom-0 left-0 w-4/5 max-w-xs bg-white shadow-2xl flex flex-col justify-between"
            >
              <div>
                {/* Drawer Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <img 
                      src="https://down-zl-vn.img.susercontent.com/vn-11134004-820l4-mdxbg9gyt81z6e_tn.webp" 
                      alt="Logo" 
                      className="w-7 h-7 rounded-md object-cover border border-gray-200 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <span className="font-display font-extrabold text-base text-gray-900 tracking-tight">TOPVN<span className="text-brand-primary">SPORT</span></span>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg bg-white border border-gray-100 transition shadow-xs"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Main Links */}
                <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
                  {/* Shop Section */}
                  {sortedCategories.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Danh Mục Sản Phẩm</h4>
                      <div className="grid grid-cols-1 gap-1">
                        {sortedCategories.map((category) => (
                          <button
                            key={category.id}
                            onClick={() => { navigate(`/catalog?category=${encodeURIComponent(category.code)}`); setIsMobileMenuOpen(false); }}
                            className={`w-full text-left py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${currentView === 'catalog' && new URLSearchParams(location.search).get('category') === category.code ? 'bg-brand-light text-brand-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            {getCategoryLabel(category, categories)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sortedCategories.length === 0 && hasCatalogLoadError && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Danh Mục Sản Phẩm</h4>
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                        <p className="text-xs font-medium text-red-700">Chưa tải được danh mục sản phẩm.</p>
                        <button
                          type="button"
                          onClick={handleRetryCatalog}
                          className="text-xs font-bold text-white bg-brand-primary hover:bg-brand-secondary px-3 py-1.5 rounded-md transition"
                        >
                          Thử lại
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Hot Brands Section */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Thương Hiệu Hot</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {getBrands(products).map(brand => (
                        <button
                          key={brand}
                          onClick={() => { navigate(`/catalog?brand=${encodeURIComponent(brand)}`); setIsMobileMenuOpen(false); }}
                          className="text-[11px] font-bold px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 hover:bg-brand-light hover:text-brand-primary transition"
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div className="space-y-1.5 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-700">
                    <button 
                      onClick={() => { navigate('/stores'); setIsMobileMenuOpen(false); }}
                      className="w-full text-left py-2.5 px-2 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                    >
                      <MapPin className="w-4 h-4 text-brand-primary" />
                      Cửa hàng Trải Nghiệm Hà Nội
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer info */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400 font-medium space-y-1">
                <p>Hotline: 097 6007006</p>
                <p>© TopVNSport • O2O Badminton Hub</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MainNav categories={sortedCategories}>
        {sortedCategories.length === 0 && hasCatalogLoadError && (
          <div className="flex items-center justify-center gap-3 text-xs pb-3">
            <span className="text-red-700 font-medium">Chưa tải được danh mục sản phẩm.</span>
            <button
              type="button"
              onClick={handleRetryCatalog}
              className="font-bold text-white bg-brand-primary hover:bg-brand-secondary px-3 py-1 rounded-md transition shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}
      </MainNav>
    </header>
  );
}
