import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { sportApi } from '../../services/sportApi';
import { Branch, Category, Product, StringOption } from '../../types';

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
}

const initialState: AppDataState = {
  products: [],
  branches: [],
  stringOptions: [],
  categories: [],
  isLoading: true,
  categoriesError: false,
  productsError: false,
  stringOptionsError: false,
  stockError: false
};

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

  return {
    products: products.status === 'fulfilled' ? products.value : [],
    productsError: products.status === 'rejected',
    categories: categories.status === 'fulfilled' ? categories.value : [],
    categoriesError: categories.status === 'rejected',
    branches: (branches as PromiseFulfilledResult<Branch[]>).value,
    stringOptions: stringOptions.status === 'fulfilled' ? stringOptions.value : [],
    stringOptionsError: stringOptions.status === 'rejected',
    stockError: stock.status === 'rejected'
  };
});

const appDataSlice = createSlice({
  name: 'appData',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchAppData.pending, state => {
        state.isLoading = true;
      })
      .addCase(fetchAppData.fulfilled, (state, action) => {
        state.products = action.payload.products;
        state.branches = action.payload.branches;
        state.stringOptions = action.payload.stringOptions;
        state.categories = action.payload.categories;
        state.productsError = action.payload.productsError;
        state.categoriesError = action.payload.categoriesError;
        state.stringOptionsError = action.payload.stringOptionsError;
        state.stockError = action.payload.stockError;
        state.isLoading = false;
      })
      .addCase(fetchAppData.rejected, state => {
        state.isLoading = false;
      });
  }
});

export default appDataSlice.reducer;
