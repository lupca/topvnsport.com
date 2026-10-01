import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { sportApi } from '../../services/sportApi';
import { Blog, Branch, Category, Product, StringOption } from '../../types';

export interface AppDataState {
  products: Product[];
  blogs: Blog[];
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
}

const initialState: AppDataState = {
  products: [],
  blogs: [],
  branches: [],
  stringOptions: [],
  categories: [],
  isLoading: true,
  categoriesError: false,
  productsError: false,
  stringOptionsError: false
};

export const fetchAppData = createAsyncThunk('appData/fetchAppData', async () => {
  const [products, blogs, branches, stringOptions, categories] = await Promise.allSettled([
    sportApi.getProducts(),
    sportApi.getBlogs(),
    sportApi.getBranches(),
    sportApi.getStringOptions(),
    sportApi.getCategories()
  ]);
  // blogs/branches không gọi mạng ném lỗi -- lỗi ở đó vẫn nổi lên.
  for (const other of [blogs, branches]) {
    if (other.status === 'rejected') throw other.reason;
  }

  return {
    products: products.status === 'fulfilled' ? products.value : [],
    productsError: products.status === 'rejected',
    categories: categories.status === 'fulfilled' ? categories.value : [],
    categoriesError: categories.status === 'rejected',
    blogs: (blogs as PromiseFulfilledResult<Blog[]>).value,
    branches: (branches as PromiseFulfilledResult<Branch[]>).value,
    stringOptions: stringOptions.status === 'fulfilled' ? stringOptions.value : [],
    stringOptionsError: stringOptions.status === 'rejected'
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
        state.blogs = action.payload.blogs;
        state.branches = action.payload.branches;
        state.stringOptions = action.payload.stringOptions;
        state.categories = action.payload.categories;
        state.productsError = action.payload.productsError;
        state.categoriesError = action.payload.categoriesError;
        state.stringOptionsError = action.payload.stringOptionsError;
        state.isLoading = false;
      })
      .addCase(fetchAppData.rejected, state => {
        state.isLoading = false;
      });
  }
});

export default appDataSlice.reducer;
