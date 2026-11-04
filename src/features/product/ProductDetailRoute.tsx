import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { popupService } from '@topvnsport/ui-kit';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import ProductDetailPage from '../../components/ProductDetailPage';
import { addCartItemAndOpen, buildConfiguredCartItem, describeSkuSelection } from '../cart/cartSlice';
import { StringOption } from '../../types';
import { findProductBySlug } from '../../utils/productSlug';
import { viewItem } from '../../lib/tracking.ts';
import { getPdpPrice, initialTierValue } from '../../components/product-detail/helpers';
import { fetchAppData } from '../appData/appDataSlice';
import HomeLoadState from '../home/HomeLoadState';

export default function ProductDetailRoute() {
  const dispatch = useAppDispatch();
  const { slug } = useParams<{ slug: string }>();
  const products = useAppSelector(state => state.appData.products);
  const stringOptions = useAppSelector(state => state.appData.stringOptions);
  const productsError = useAppSelector(state => state.appData.productsError);
  const product = findProductBySlug(products, slug);

  useEffect(() => {
    if (product) {
      viewItem({
        id: product.id,
        name: product.name,
        // Giá hiển thị lúc mở trang (biến thể chọn sẵn, hoặc giá sản phẩm nếu không có).
        price: getPdpPrice(product, initialTierValue(product, 1), initialTierValue(product, 2)).salePrice,
      });
    }
  }, [product?.id]);

  // STOR-141: catalog không tải được -> không biết SP có tồn tại; báo lỗi + Thử lại, không giả 404.
  if (!product && productsError) return <HomeLoadState error onRetry={() => dispatch(fetchAppData())} />;

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4" id="not-found">
        <h1 className="font-display font-black text-2xl text-gray-900">Không tìm thấy trang</h1>
        <Link to="/" className="inline-block text-sm font-bold text-brand-primary hover:underline">Về trang chủ</Link>
      </div>
    );
  }

  const handleAddToCartWithSpecs = (
    targetProduct: (typeof products)[number],
    weight: string,
    color: string,
    stringChoice: StringOption | null,
    tension: number
  ) => {
    const item = buildConfiguredCartItem(targetProduct, weight, color, stringChoice, tension);
    if (!item) {
      // Không khớp đúng một biến thể bán được -- không bịa SKU, không thêm
      // vào giỏ. Tra riêng lý do cụ thể để báo đúng câu.
      const description = describeSkuSelection(targetProduct, color, weight);
      if (description.status === 'missing_selection') {
        void popupService.alert(`Vui lòng chọn ${description.tierName}`);
        const tier = targetProduct.tier_variations?.find(tv => tv.name === description.tierName);
        const frame = tier ? document.getElementById(`tier-select-${tier.tier_index}`) : null;
        if (frame) {
          frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.error(`Không tìm thấy khung chọn "${description.tierName}" để cuộn tới (sản phẩm ${targetProduct.id})`);
        }
      } else {
        void popupService.alert('Phân loại này hiện không có sẵn. Vui lòng chọn phân loại khác.');
      }
      return;
    }

    dispatch(addCartItemAndOpen(item));
  };

  return (
    <ProductDetailPage
      product={product}
      stringOptions={stringOptions}
      onAddToCartWithSpecs={handleAddToCartWithSpecs}
    />
  );
}
