import { useParams } from 'react-router-dom';
import { popupService } from '@topvnsport/ui-kit';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import ProductDetailPage from '../../components/ProductDetailPage';
import { addCartItem, buildConfiguredCartItem, describeSkuSelection, openCart } from '../cart/cartSlice';
import { StringOption } from '../../types';
import { findProductBySlug } from '../../utils/productSlug';

export default function ProductDetailRoute() {
  const dispatch = useAppDispatch();
  const { slug } = useParams<{ slug: string }>();
  const products = useAppSelector(state => state.appData.products);
  const stringOptions = useAppSelector(state => state.appData.stringOptions);
  const product = findProductBySlug(products, slug);

  if (!product) return <div>Not Found</div>;

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

    dispatch(addCartItem(item));
    dispatch(openCart());
  };

  return (
    <ProductDetailPage
      product={product}
      stringOptions={stringOptions}
      onAddToCartWithSpecs={handleAddToCartWithSpecs}
    />
  );
}
