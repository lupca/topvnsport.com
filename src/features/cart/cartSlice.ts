import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product, StringOption } from '../../types';
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

export type SkuLookupResult =
  | { status: 'ok'; skuCode: string }
  | { status: 'missing_selection'; tierName: string }
  | { status: 'not_available' };

// Tra SKU thật theo đúng cặp (tier1, tier2) trong product.variants -- KHÔNG
// còn tra qua skuByColor/skuByVariant (nguồn SKU sai cho sản phẩm hai tầng: nó
// giữ biến thể CUỐI cùng của mỗi tier1, không phân biệt tier2). Ba kết quả:
// - 'ok': khớp ĐÚNG MỘT biến thể -> skuCode thật.
// - 'missing_selection': tầng đó có thật (tier_variations) nhưng chưa chọn
//   giá trị -- caller hỏi lại đúng tên tầng (vd "Vui lòng chọn Kích cỡ").
// - 'not_available': không có biến thể nào khớp, HOẶC khớp nhiều hơn một
//   (dữ liệu trùng tier_1_option/tier_2_option) -- không đoán đại một cái,
//   console.error ghi lại product id + tổ hợp để dò dữ liệu nguồn.
export function resolveSkuCode(product: Product, tier1: string, tier2: string): SkuLookupResult {
  const variants = product.variants || [];
  const tier1Def = product.tier_variations?.find(tv => tv.tier_index === 1);
  const tier2Def = product.tier_variations?.find(tv => tv.tier_index === 2);
  const hasTier1 = Boolean(tier1Def);
  const hasTier2 = Boolean(tier2Def);

  if (hasTier1 && !tier1) {
    console.error(`resolveSkuCode: sản phẩm ${product.id} thiếu lựa chọn tầng "${tier1Def!.name}".`);
    return { status: 'missing_selection', tierName: tier1Def!.name };
  }
  if (hasTier2 && !tier2) {
    console.error(`resolveSkuCode: sản phẩm ${product.id} thiếu lựa chọn tầng "${tier2Def!.name}".`);
    return { status: 'missing_selection', tierName: tier2Def!.name };
  }

  const candidates = (!hasTier1 && !hasTier2)
    ? variants
    : variants.filter(v =>
        (!hasTier1 || v.tier_1_option === tier1) &&
        (!hasTier2 || v.tier_2_option === tier2)
      );

  if (candidates.length === 1 && candidates[0].sku_code) {
    return { status: 'ok', skuCode: candidates[0].sku_code };
  }

  console.error(
    `resolveSkuCode: sản phẩm ${product.id} tổ hợp (${tier1 || '—'} / ${tier2 || '—'}) khớp ${candidates.length} biến thể -- không đoán SKU.`
  );
  return { status: 'not_available' };
}

// SKU bịa dạng `SKU-<id>-...` mà bản build cũ từng ghi vào giỏ hàng khi không
// khớp được biến thể thật. SKU thật từ PIM luôn có tiền tố "PRD-" hoặc "SP-",
// không bao giờ là "SKU-<số>-...", nên nhận diện được để chặn gửi đi cho các
// giỏ hàng cũ còn lưu trong localStorage của khách.
export function isFabricatedSkuCode(skuCode: string | undefined): boolean {
  return Boolean(skuCode && /^SKU-\d+-/.test(skuCode));
}

// Sản phẩm có ĐÚNG một biến thể bán được (không tầng, hoặc mọi tầng chỉ có
// một lựa chọn duy nhất) -- trường hợp DUY NHẤT được phép thêm nhanh từ thẻ
// sản phẩm mà không cần khách vào trang chi tiết chọn phân loại. Không dùng
// options[0]/colors[0] để đoán khi có từ hai biến thể trở lên.
export function getSingleSellableSku(product: Product): string | null {
  const variants = product.variants || [];
  return variants.length === 1 && variants[0].sku_code ? variants[0].sku_code : null;
}

export function buildDefaultCartItem(product: Product): CartItem | null {
  const skuCode = getSingleSellableSku(product);
  if (!skuCode) {
    // Có từ hai biến thể trở lên (một tầng nhiều lựa chọn, hoặc hai tầng) --
    // thêm nhanh không được tự chọn tổ hợp đại diện. Xem ProductCard/
    // QuickViewModal: những nơi gọi hàm này phải tự chặn từ trước bằng
    // getSingleSellableSku và dẫn khách sang trang chi tiết thay vì gọi đây.
    return null;
  }

  const selectedColor = product.colors && product.colors.length === 1 ? product.colors[0] : 'Tiêu chuẩn';
  // Không bịa trọng lượng theo ngành -- lấy từ thông số thật nếu có, còn lại
  // dùng sentinel "Tiêu chuẩn" chung (giống màu sắc) khi sản phẩm chưa có dữ liệu.
  const selectedWeight = product.specs?.weight || 'Tiêu chuẩn';

  return {
    id: `${product.id}-${selectedWeight}-${selectedColor}`,
    productId: product.id,
    skuCode,
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.salePrice || product.price,
    selectedWeight,
    selectedColor,
    stringOption: null,
    tension: 10.5,
    quantity: 1
  };
}

export type BuildCartItemResult =
  | { status: 'ok'; item: CartItem }
  | { status: 'missing_selection'; tierName: string }
  | { status: 'not_available' };

export function buildConfiguredCartItem(
  product: Product,
  weight: string,
  color: string,
  stringChoice: StringOption | null,
  tension: number
): BuildCartItemResult {
  const lookup = resolveSkuCode(product, color, weight);
  if (lookup.status !== 'ok') {
    return lookup;
  }

  return {
    status: 'ok',
    item: {
      id: `${product.id}-${weight}-${color}-${stringChoice?.id || 'none'}-${tension}`,
      productId: product.id,
      skuCode: lookup.skuCode,
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.salePrice || product.price,
      selectedWeight: weight,
      selectedColor: color,
      stringOption: stringChoice,
      tension,
      quantity: 1
    }
  };
}

export default cartSlice.reducer;
