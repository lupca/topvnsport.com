import { useParams } from 'react-router-dom';
import { popupService } from '@topvnsport/ui-kit';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import ProductDetailPage from '../../components/ProductDetailPage';
import { addCartItem, buildConfiguredCartItem, openCart } from '../cart/cartSlice';
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
    const result = buildConfiguredCartItem(targetProduct, weight, color, stringChoice, tension);
    if (result.status === 'missing_selection') {
      void popupService.alert(`Vui lòng chọn ${result.tierName}`);
      return;
    }
    if (result.status === 'not_available') {
      // Tổ hợp phân loại khách vừa chọn không khớp đúng một biến thể thật nào
      // -- không bịa SKU, không thêm vào giỏ.
      void popupService.alert('Phân loại này hiện không có sẵn. Vui lòng chọn phân loại khác.');
      return;
    }

    dispatch(addCartItem(result.item));
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
