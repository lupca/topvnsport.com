import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product, ProductVariant, StringOption } from '../../types';
import { CartItem } from '../../components/CartModal';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  quickViewProduct: Product | null;
}

const CART_STORAGE_KEY = 'cart_items';

export function loadCartItemsFromStorage(): CartItem[] {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCartItemsToStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // Ignore errors in storage restricted environments
  }
}

const initialState: CartState = {
  items: loadCartItemsFromStorage(),
  isOpen: false,
  quickViewProduct: null
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addCartItem: (state, action: PayloadAction<CartItem>) => {
      const existingIndex = state.items.findIndex(item => item.id === action.payload.id);
      if (existingIndex > -1) {
        state.items[existingIndex].quantity += action.payload.quantity || 1;
      } else {
        state.items.push(action.payload);
      }
      saveCartItemsToStorage(state.items);
    },
    removeCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      saveCartItemsToStorage(state.items);
    },
    updateCartItemQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        state.items = state.items.filter(item => item.id !== id);
      } else {
        const item = state.items.find(i => i.id === id);
        if (item) {
          item.quantity = quantity;
        }
      }
      saveCartItemsToStorage(state.items);
    },
    clearCart: state => {
      state.items = [];
      saveCartItemsToStorage(state.items);
    },
    openCart: state => {
      state.isOpen = true;
    },
    closeCart: state => {
      state.isOpen = false;
    },
    setQuickViewProduct: (state, action: PayloadAction<Product | null>) => {
      state.quickViewProduct = action.payload;
    }
  }
});

export const {
  addCartItem,
  removeCartItem,
  updateCartItemQuantity,
  clearCart,
  openCart,
  closeCart,
  setQuickViewProduct
} = cartSlice.actions;

export type SkuSelectionDescription =
  | { status: 'ok'; skuCode: string }
  | { status: 'missing_selection'; tierName: string }
  | { status: 'not_available' };

// "SKU bán được" = biến thể có sku_code khác rỗng. Biến thể sku_code rỗng
// không được tính vào bất kỳ phép đếm/khớp nào (không đoán đại một biến thể
// vô danh).
function sellableVariantsOf(product: Product) {
  return (product.variants || []).filter(v => Boolean(v.sku_code));
}

// Tra SKU thật theo đúng cặp (tier1, tier2) trong product.variants -- KHÔNG
// còn tra qua skuByColor/skuByVariant (nguồn SKU sai cho sản phẩm hai tầng: nó
// giữ biến thể CUỐI cùng của mỗi tier1, không phân biệt tier2). Ba kết quả:
// - 'ok': khớp ĐÚNG MỘT biến thể bán được -> skuCode thật.
// - 'missing_selection': tầng đó có thật (tier_variations) nhưng chưa chọn
//   giá trị -- caller hỏi lại đúng tên tầng (vd "Vui lòng chọn Kích cỡ").
// - 'not_available': không có biến thể nào khớp, HOẶC khớp nhiều hơn một
//   (dữ liệu trùng tier_1_option/tier_2_option) -- không đoán đại một cái,
//   console.error ghi lại product id + tổ hợp để dò dữ liệu nguồn.
export function describeSkuSelection(product: Product, tier1: string, tier2: string): SkuSelectionDescription {
  const tier1Def = product.tier_variations?.find(tv => tv.tier_index === 1);
  const tier2Def = product.tier_variations?.find(tv => tv.tier_index === 2);
  const hasTier1 = Boolean(tier1Def);
  const hasTier2 = Boolean(tier2Def);

  if (hasTier1 && !tier1) {
    console.error(`describeSkuSelection: sản phẩm ${product.id} thiếu lựa chọn tầng "${tier1Def!.name}".`);
    return { status: 'missing_selection', tierName: tier1Def!.name };
  }
  if (hasTier2 && !tier2) {
    console.error(`describeSkuSelection: sản phẩm ${product.id} thiếu lựa chọn tầng "${tier2Def!.name}".`);
    return { status: 'missing_selection', tierName: tier2Def!.name };
  }

  const sellable = sellableVariantsOf(product);
  const candidates = (!hasTier1 && !hasTier2)
    ? sellable
    : sellable.filter(v =>
        (!hasTier1 || v.tier_1_option === tier1) &&
        (!hasTier2 || v.tier_2_option === tier2)
      );

  if (candidates.length === 1) {
    return { status: 'ok', skuCode: candidates[0].sku_code };
  }

  console.error(
    `describeSkuSelection: sản phẩm ${product.id} tổ hợp (${tier1 || '—'} / ${tier2 || '—'}) khớp ${candidates.length} biến thể bán được -- không đoán SKU.`
  );
  return { status: 'not_available' };
}

// Chỉ lấy SKU thật -- không khớp/nhiều ứng viên -> null. Lý do chặn cụ thể
// (thiếu tầng nào, hay không có sẵn) tra riêng qua describeSkuSelection (dùng
// ở nơi cần hiển thị câu báo, ví dụ ProductDetailRoute).
export function resolveSkuCode(product: Product, tier1: string, tier2: string): string | null {
  const result = describeSkuSelection(product, tier1, tier2);
  return result.status === 'ok' ? result.skuCode : null;
}

// Biến thể bán được DUY NHẤT của sản phẩm (không tầng, hoặc mọi tầng chỉ có
// một lựa chọn duy nhất) -- trường hợp DUY NHẤT được phép thêm nhanh từ thẻ
// sản phẩm mà không cần khách vào trang chi tiết chọn phân loại. Không dùng
// options[0]/colors[0] để đoán khi có từ hai biến thể bán được trở lên.
export function getSingleSellableVariant(product: Product): ProductVariant | null {
  const sellable = sellableVariantsOf(product);
  return sellable.length === 1 ? sellable[0] : null;
}

export function getSingleSellableSku(product: Product): string | null {
  return getSingleSellableVariant(product)?.sku_code ?? null;
}

// Nhãn phân loại hiển thị trong giỏ hàng, dựng từ TÊN TẦNG THẬT (tier_variations)
// + giá trị đã chọn -- không dùng chuỗi cứng "Phiên bản: {weight} | {color}".
// Sản phẩm không có tầng nào (hoặc tầng không có tên/giá trị thật) -> undefined,
// để UI tự ẩn dòng này thay vì hiện nhãn rỗng/sai.
export function buildVariantLabel(product: Product, tier1: string, tier2: string): string | undefined {
  const tier1Def = product.tier_variations?.find(tv => tv.tier_index === 1);
  const tier2Def = product.tier_variations?.find(tv => tv.tier_index === 2);

  const parts: string[] = [];
  if (tier1Def && tier1) parts.push(`${tier1Def.name}: ${tier1}`);
  if (tier2Def && tier2) parts.push(`${tier2Def.name}: ${tier2}`);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export type CartItemSkuStatus = 'ok' | 'product_not_found' | 'sku_changed';

// Phân biệt RÕ hai lý do khiến món hàng không còn hợp lệ, để UI báo đúng câu
// (lời người bán) cho từng ca thay vì gộp chung:
// - 'product_not_found': sản phẩm không còn trong dữ liệu đã tải (bị gỡ khỏi
//   cửa hàng, hoặc ngoài trang đầu danh sách) -- KHÔNG đoán, không suy diễn.
// - 'sku_changed': sản phẩm vẫn còn, nhưng skuCode không khớp ĐÚNG một biến
//   thể bán được nào của chính sản phẩm đó (PIM đã đổi/xoá tổ hợp).
export function describeCartItemSkuStatus(item: CartItem, products: Product[]): CartItemSkuStatus {
  const product = products.find(p => p.id === item.productId);
  if (!product) return 'product_not_found';
  if (item.skuCode && sellableVariantsOf(product).some(v => v.sku_code === item.skuCode)) {
    return 'ok';
  }
  return 'sku_changed';
}

// Món hàng trong giỏ hợp lệ khi (1) sản phẩm của nó vẫn còn trong dữ liệu đã
// tải (theo productId) và (2) skuCode khớp ĐÚNG một biến thể bán được của
// chính sản phẩm đó -- không chỉ kiểm rỗng/khớp mẫu chuỗi "SKU-<id>-...".
// Sản phẩm không tìm thấy hoặc biến thể đã đổi/xoá (PIM cập nhật lại tổ hợp)
// đều bị coi là không hợp lệ, không đoán.
export function isCartItemSkuValid(item: CartItem, products: Product[]): boolean {
  return describeCartItemSkuStatus(item, products) === 'ok';
}

export function buildDefaultCartItem(product: Product): CartItem | null {
  // Không có giá thật thì không bao giờ tạo món hàng (không gửi giá bịa đi).
  if (product.price === undefined) return null;
  const variant = getSingleSellableVariant(product);
  if (!variant) {
    // Có từ hai biến thể bán được trở lên (một tầng nhiều lựa chọn, hoặc hai
    // tầng) -- thêm nhanh không được tự chọn tổ hợp đại diện. Xem ProductCard/
    // QuickViewModal: những nơi gọi hàm này phải tự chặn từ trước bằng
    // getSingleSellableSku và dẫn khách sang trang chi tiết thay vì gọi đây.
    return null;
  }

  // Dùng ĐÚNG tier_1_option/tier_2_option của chính biến thể bán được duy
  // nhất -- không suy đoán qua colors[]/specs.weight. "Tiêu chuẩn" chỉ là
  // sentinel hiển thị khi biến thể thật sự KHÔNG có tầng đó, không bao giờ
  // được coi là một lựa chọn thật trong buildVariantLabel.
  const selectedColor = variant.tier_1_option || 'Tiêu chuẩn';
  const selectedWeight = variant.tier_2_option || product.specs?.weight || 'Tiêu chuẩn';

  return {
    id: `${product.id}-${selectedWeight}-${selectedColor}`,
    productId: product.id,
    skuCode: variant.sku_code,
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.salePrice || (product.price as number),
    selectedWeight,
    selectedColor,
    variantLabel: buildVariantLabel(product, selectedColor, selectedWeight),
    stringOption: null,
    tension: 10.5,
    quantity: 1
  };
}

export function buildConfiguredCartItem(
  product: Product,
  weight: string,
  color: string,
  stringChoice: StringOption | null,
  tension: number
): CartItem | null {
  if (product.price === undefined) return null;
  const skuCode = resolveSkuCode(product, color, weight);
  if (!skuCode) {
    return null;
  }

  return {
    id: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${tension}`,
    productId: product.id,
    skuCode,
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.salePrice || (product.price as number),
    selectedWeight: weight,
    selectedColor: color,
    variantLabel: buildVariantLabel(product, color, weight),
    stringOption: stringChoice,
    tension,
    quantity: 1
  };
}

export default cartSlice.reducer;
