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

// Tra SKU thật theo đúng cặp (tier1, tier2) trong product.variants -- KHÔNG
// còn tra qua skuByColor/skuByVariant (nguồn SKU sai cho sản phẩm hai tầng: nó
// giữ biến thể CUỐI cùng của mỗi tier1, không phải biến thể khách đang chọn).
// Không khớp được -> trả về undefined để caller CHẶN thêm vào giỏ, không bịa
// SKU giả (`SKU-${id}-...` như code cũ) và không lấy đại một SKU đại diện.
export function resolveSkuCode(product: Product, tier1: string, tier2: string): string | undefined {
  const variants = product.variants || [];
  if (variants.length === 0) {
    return undefined;
  }

  const hasTier1 = Boolean(product.tier_variations?.some(tv => tv.tier_index === 1));
  const hasTier2 = Boolean(product.tier_variations?.some(tv => tv.tier_index === 2));

  if (!hasTier1 && !hasTier2) {
    // Không có tầng phân loại nào -- chỉ suy ra được SKU khi sản phẩm có ĐÚNG
    // một biến thể. Nhiều biến thể mà không có tier_variations là dữ liệu mơ
    // hồ, không đoán đại một cái.
    return variants.length === 1 ? (variants[0].sku_code || undefined) : undefined;
  }

  const match = variants.find(v =>
    (!hasTier1 || v.tier_1_option === tier1) &&
    (!hasTier2 || v.tier_2_option === tier2)
  );

  return match?.sku_code || undefined;
}

// SKU bịa dạng `SKU-<id>-...` mà bản build cũ từng ghi vào giỏ hàng khi không
// khớp được biến thể thật. SKU thật từ PIM luôn có tiền tố "PRD-" hoặc "SP-",
// không bao giờ là "SKU-<số>-...", nên nhận diện được để chặn gửi đi cho các
// giỏ hàng cũ còn lưu trong localStorage của khách.
export function isFabricatedSkuCode(skuCode: string | undefined): boolean {
  return Boolean(skuCode && /^SKU-\d+-/.test(skuCode));
}

export function buildDefaultCartItem(product: Product): CartItem | null {
  const hasTier2 = Boolean(product.tier_variations?.some(tv => tv.tier_index === 2));
  if (hasTier2) {
    // Sản phẩm hai tầng: thêm nhanh không được tự chọn tổ hợp đại diện rồi
    // gửi SKU -- phải để khách vào trang chi tiết chọn đủ cả hai tầng.
    return null;
  }

  const selectedColor = product.colors && product.colors.length > 0 ? product.colors[0] : 'Tiêu chuẩn';
  // Không bịa trọng lượng theo ngành -- lấy từ thông số thật nếu có, còn lại
  // dùng sentinel "Tiêu chuẩn" chung (giống màu sắc) khi sản phẩm chưa có dữ liệu.
  const selectedWeight = product.specs?.weight || 'Tiêu chuẩn';

  const skuCode = resolveSkuCode(product, selectedColor, selectedWeight);
  if (!skuCode) {
    return null;
  }

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

export function buildConfiguredCartItem(
  product: Product,
  weight: string,
  color: string,
  stringChoice: StringOption | null,
  tension: number
): CartItem | null {
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
    price: product.salePrice || product.price,
    selectedWeight: weight,
    selectedColor: color,
    stringOption: stringChoice,
    tension,
    quantity: 1
  };
}

export default cartSlice.reducer;
