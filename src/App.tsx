/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, MouseEvent, Suspense, useEffect, useState } from 'react';
import { Link, matchPath, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { popupService } from '@topvnsport/ui-kit';
import { useStore } from 'react-redux';
import { useAppDispatch, useAppSelector } from './app/hooks';
import type { RootState } from './app/store';
import FloatingContact from './components/FloatingContact';
import Footer from './components/Footer';
import Header from './components/Header';
import QuickViewModal from './components/QuickViewModal';
import PageSkeleton from './components/PageSkeleton';
import ScrollToTop from './components/ScrollToTop';
import StoreLocator from './components/StoreLocator';
import { fetchAppData, refetchStock } from './features/appData/appDataSlice';
import CatalogPage from './features/catalog/CatalogPage';
import { catalogFiltersFromUrl } from './features/catalog/catalogSlice';
import {
  addCartItemAndOpen,
  buildDefaultCartItem,
  clearCart,
  closeCart,
  openCart,
  removeCartItem,
  setQuickViewProduct
} from './features/cart/cartSlice';
import HomePage from './features/home/HomePage';
import ProductDetailRoute from './features/product/ProductDetailRoute';
import MobileBottomNav from './features/navigation/MobileBottomNav';
import CheckoutCallbackPage from './features/checkout/CheckoutCallbackPage';
import { pageView } from './lib/tracking.ts';
import { captureAttribution } from './lib/attribution.ts';
import { SITE_ORIGIN } from './config/storefront';
import { findProductBySlug, getProductPath } from './utils/productSlug';
import { catalogHead, homeHead, productHeadValues, readShellHead, syncHead, type ProductHead } from './utils/productHead';

// Read once at load, before any route change rewrites the head.
const SHELL_HEAD = readShellHead(document);

const CartModal = lazy(() => import('./components/CartModal'));

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  // PDP có MobilePurchaseBar sticky là thanh đáy duy nhất: không nav đáy, không pb-16.
  const isPdp = location.pathname.startsWith('/product/');

  const { products, branches, categories, isLoading, categoriesError, productsError, stockError, stockRefetching } = useAppSelector(state => state.appData);
  const { items: cartItems, isOpen: isCartOpen, quickViewProduct } = useAppSelector(state => state.cart);
  const [hasOpenedCart, setHasOpenedCart] = useState(isCartOpen);
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  // STOR-053: trên '/' HomePage tự báo lỗi tải sản phẩm (kèm Thử lại) -> banner bỏ dòng danh mục/sản phẩm, giữ dòng tồn kho.
  const isHome = location.pathname === '/';
  const showCategoriesError = categoriesError && !isHome;
  const showProductsError = productsError && !isHome;

  useEffect(() => {
    captureAttribution(location.search);
    pageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // STOR-072: title/canonical/og follow the route so a server-rendered head never goes stale.
  // Same values as api/product.ts and api/page.ts (home, catalog); other routes get the shell head.
  useEffect(() => {
    const slug = matchPath('/product/:slug', location.pathname)?.params.slug;
    const isCatalog = location.pathname === '/catalog';
    if ((slug || isCatalog) && products.length === 0) return; // catalog not loaded yet: keep the server head
    let head: ProductHead | null = null;
    if (slug) {
      let product;
      try {
        product = findProductBySlug(products, slug);
      } catch {
        product = undefined; // malformed %-escape in the slug
      }
      head = product ? productHeadValues(product, `${SITE_ORIGIN}${getProductPath(product)}`) : null;
    } else if (location.pathname === '/') {
      head = homeHead();
    } else if (isCatalog && !searchParams.has('search') && !searchParams.has('brand')) {
      head = catalogHead(searchParams.get('category') || undefined, categories, products) ?? null;
    }
    syncHead(document, head, SHELL_HEAD);
  }, [location.pathname, searchParams, products, categories]);

  useEffect(() => {
    if (isCartOpen) setHasOpenedCart(true);
  }, [isCartOpen]);

  const appStore = useStore<RootState>();
  useEffect(() => {
    // main.tsx may already have loaded the catalog (server-rendered landing): no second download.
    const loaded = appStore.getState().appData;
    if (!loaded.isLoading && !loaded.catalogFromCache && !loaded.productsError && !loaded.categoriesError && !loaded.stockError && loaded.products.length > 0) return;
    dispatch(fetchAppData()).catch(error => {
      console.error('Failed to fetch data from sportApi:', error);
    });
  }, [dispatch]);

  useEffect(() => {
    if (location.pathname !== '/catalog') return;
    dispatch(catalogFiltersFromUrl(searchParams));
  }, [dispatch, location.pathname, searchParams]);

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

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-brand-primary selection:text-white antialiased ${isPdp ? '' : 'pb-16'} md:pb-0`}>
      <Header
        cartCount={cartCount}
        openCart={() => dispatch(openCart())}
        products={products}
        categories={categories}
        categoriesError={categoriesError}
        productsError={productsError}
      />

      {(showCategoriesError || showProductsError || stockError) && (
        <div role="alert" id="load-error-banner" className="bg-red-50 border-b border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 text-center space-y-0.5">
          {showCategoriesError && <p>Không tải được danh mục sản phẩm. Vui lòng tải lại trang.</p>}
          {showProductsError && <p>Không tải được danh sách sản phẩm. Vui lòng tải lại trang.</p>}
          {stockError && (
            <p>
              Không tải được tồn kho. Vui lòng tải lại trang.{' '}
              <button type="button" disabled={stockRefetching} onClick={() => dispatch(refetchStock())} className="underline font-bold disabled:opacity-50">Thử lại</button>
            </p>
          )}
        </div>
      )}

      <main className="flex-1 min-h-svh">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={isLoading ? <PageSkeleton /> : <HomePage />} />
          <Route path="/catalog" element={isLoading ? <PageSkeleton /> : <CatalogPage />} />
          <Route path="/product/:slug" element={<ProductDetailRoute />} />
          <Route path="/stores" element={isLoading ? <PageSkeleton /> : <StoreLocator branches={branches} products={products} />} />
          <Route path="/checkout/success" element={<CheckoutCallbackPage status="success" />} />
          <Route path="/checkout/error" element={<CheckoutCallbackPage status="error" />} />
          <Route path="/checkout/cancel" element={<CheckoutCallbackPage status="cancel" />} />
          <Route
            path="*"
            element={
              <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4" id="not-found">
                <h1 className="font-display font-black text-2xl text-gray-900">Không tìm thấy trang</h1>
                <Link to="/" className="inline-block text-sm font-bold text-brand-primary hover:underline max-md:inline-flex max-md:items-center max-md:min-h-[44px]">Về trang chủ</Link>
              </div>
            }
          />
        </Routes>
      </main>

      <Footer categories={categories} products={products} />

      <FloatingContact isPdp={isPdp} />

      {hasOpenedCart && (
        <Suspense fallback={null}>
          <CartModal
            isOpen={isCartOpen}
            onClose={() => dispatch(closeCart())}
            cartItems={cartItems}
            onRemoveItem={id => dispatch(removeCartItem(id))}
            onClearCart={() => dispatch(clearCart())}
          />
        </Suspense>
      )}

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => dispatch(setQuickViewProduct(null))}
        onAddToCart={handleAddToCart}
      />

      {!isPdp && (
        <MobileBottomNav
          pathname={location.pathname}
          navigate={navigate}
          cartCount={cartCount}
          onOpenCart={() => dispatch(openCart())}
        />
      )}
    </div>
  );
}
