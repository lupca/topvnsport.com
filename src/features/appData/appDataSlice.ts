import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { sportApi } from '../../services/sportApi';
import { applyWmsStock } from '../../services/sport-api/wmsStock';
import { Branch, Category, Product, StringOption } from '../../types';
import { inlinedCatalog, loadCatalog, saveCatalog, withInlinedProduct } from './catalogCache';

export interface AppDataState {
  products: Product[];
  branches: Branch[];
  stringOptions: StringOption[];
  categories: Category[];
  isLoading: boolean;
  // Lỗi tải riêng từng nguồn: true = tải thất bại (products/categories rỗng
  // KHÔNG có nghĩa là cửa hàng trống).
  categoriesError: boolean;
  productsError: boolean;
  // Lỗi tải cước (stringOptions=[] khi true KHÔNG có nghĩa là shop không có cước).
  stringOptionsError: boolean;
  // Lỗi tải tồn WMS: tồn không biết (stock undefined), không phải hết hàng.
  stockError: boolean;
  // STOR-137: single-flight; không dùng isLoading (khởi tạo true sẽ chặn lần tải đầu).
  loadInFlight: boolean;
  // STOR-141: single-flight riêng cho refetchStock.
  stockRefetching: boolean;
  // STOR-153: requestId của refetchStock hiện hành; fetchAppData.fulfilled xoá -> kết quả
  // refetch cũ về muộn bị bỏ qua. Optional để các literal AppDataState cũ vẫn hợp lệ.
  stockRefetchId?: string | null;
  // Catalog painted from the browser cache: fetchAppData refreshes it in the background, no loading state.
  catalogFromCache?: boolean;
}

type CatalogPayload = Pick<AppDataState, 'products' | 'branches' | 'stringOptions' | 'categories'>;

export function buildInitialState(inlined: Product | undefined = typeof window === 'undefined' ? undefined : window.__PRODUCT__): AppDataState {
  // Server-rendered home/catalog: its inlined catalog (fresher) over the browser cache; both refresh in the background.
  const stored = loadCatalog<CatalogPayload>();
  const page = inlinedCatalog();
  const cached: Partial<CatalogPayload> | null = page ? { ...(stored ?? {}), ...page } : stored;
  return {
    ...baseState,
    ...(cached ?? {}),
    // Server-inlined product: the PDP renders from it before any fetch; Home/Catalog still wait on isLoading.
    products: withInlinedProduct(cached?.products ?? [], inlined),
    isLoading: !cached,
    catalogFromCache: !!cached
  };
}

const baseState: AppDataState = {
  products: [],
  branches: [],
  stringOptions: [],
  categories: [],
  isLoading: true,
  categoriesError: false,
  productsError: false,
  stringOptionsError: false,
  stockError: false,
  loadInFlight: false,
  stockRefetching: false
};

const initialState = buildInitialState();

export const fetchAppData = createAsyncThunk('appData/fetchAppData', async () => {
  // STOR-012: mỗi nguồn tải đúng 1 lần, truyền promise cho nơi cần dùng lại.
  const categoriesP = sportApi.getCategories();
  const stockP = sportApi.getAllStock();
  const productsP = sportApi.getProducts(categoriesP, stockP);
  const stringOptionsP = sportApi.getStringOptions(productsP);
  const [products, branches, stringOptions, categories, stock] = await Promise.allSettled([
    productsP,
    sportApi.getBranches(),
    stringOptionsP,
    categoriesP,
    stockP
  ]);
  // branches không gọi mạng ném lỗi -- lỗi ở đó vẫn nổi lên.
  if (branches.status === 'rejected') throw branches.reason;

  const result = {
    products: products.status === 'fulfilled' ? products.value : [],
    productsError: products.status === 'rejected',
    categories: categories.status === 'fulfilled' ? categories.value : [],
    categoriesError: categories.status === 'rejected',
    branches: (branches as PromiseFulfilledResult<Branch[]>).value,
    stringOptions: stringOptions.status === 'fulfilled' ? stringOptions.value : [],
    stringOptionsError: stringOptions.status === 'rejected',
    stockError: stock.status === 'rejected'
  };
  if (!result.productsError && !result.categoriesError && !result.stockError) {
    saveCatalog<CatalogPayload>({ products: result.products, branches: result.branches, stringOptions: result.stringOptions, categories: result.categories });
  }
  return result;
}, {
  condition: (_, { getState }) => !(getState() as { appData: AppDataState }).appData.loadInFlight
});

type AppDataRoot = { appData: AppDataState };

// STOR-141: chỉ tải lại tồn WMS (1 GET), áp lên products đang có; không đụng isLoading
// (sẽ bật spinner toàn trang), không tải lại sản phẩm/danh mục.
export const refetchStock = createAsyncThunk('appData/refetchStock', async (_, { getState }) => {
  const stock = await sportApi.getAllStock();
  return applyWmsStock((getState() as AppDataRoot).appData.products, stock);
}, {
  condition: (_, { getState }) => !(getState() as AppDataRoot).appData.stockRefetching
});

const appDataSlice = createSlice({
  name: 'appData',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchAppData.pending, state => {
        if (!state.catalogFromCache) state.isLoading = true;
        state.loadInFlight = true;
      })
      .addCase(fetchAppData.fulfilled, (state, action) => {
        const failed = action.payload.productsError || action.payload.categoriesError;
        // A failed load keeps what is already on screen (cached catalog / inlined product); the error banner still shows.
        if (!(failed && state.products.length > 0)) {
          state.products = action.payload.products;
          state.branches = action.payload.branches;
          state.stringOptions = action.payload.stringOptions;
          state.categories = action.payload.categories;
        }
        state.catalogFromCache = false;
        state.productsError = action.payload.productsError;
        state.categoriesError = action.payload.categoriesError;
        state.stringOptionsError = action.payload.stringOptionsError;
        state.stockError = action.payload.stockError;
        state.isLoading = false;
        state.loadInFlight = false;
        // fetchAppData vừa có tồn mới hơn: refetchStock đang bay (nếu có) thành cũ.
        state.stockRefetchId = null;
        state.stockRefetching = false;
      })
      .addCase(refetchStock.pending, (state, action) => {
        state.stockRefetching = true;
        state.stockRefetchId = action.meta.requestId;
      })
      .addCase(refetchStock.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.stockRefetchId) return;
        state.products = action.payload;
        state.stockError = false;
        state.stockRefetching = false;
        state.stockRefetchId = null;
      })
      .addCase(refetchStock.rejected, (state, action) => {
        if (action.meta.requestId !== state.stockRefetchId) return;
        state.stockError = true;
        state.stockRefetching = false;
        state.stockRefetchId = null;
      })
      .addCase(fetchAppData.rejected, state => {
        // Thunk ném = không biết danh sách sản phẩm; không để [] đọc thành "shop trống".
        state.productsError = true;
        state.isLoading = false;
        state.loadInFlight = false;
      });
  }
});

export default appDataSlice.reducer;
