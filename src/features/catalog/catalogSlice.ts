import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CatalogState {
  selectedBrand: string[];
  selectedCategory: string;
  // null = chưa chọn ngân sách: không lọc theo giá (mọi SP Published đều hiện, STOR-131).
  maxPrice: number | null;
  selectedWeight: string[];
  selectedBalance: string;
  selectedStiffness: string;
  searchQuery: string;
}

const initialState: CatalogState = {
  selectedBrand: [],
  selectedCategory: 'Tất cả',
  maxPrice: null,
  selectedWeight: [],
  selectedBalance: 'Tất cả',
  selectedStiffness: 'Tất cả',
  searchQuery: ''
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    setSelectedBrand: (state, action: PayloadAction<string[]>) => {
      state.selectedBrand = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
    },
    setMaxPrice: (state, action: PayloadAction<number>) => {
      state.maxPrice = action.payload;
    },
    setSelectedWeight: (state, action: PayloadAction<string[]>) => {
      state.selectedWeight = action.payload;
    },
    setSelectedBalance: (state, action: PayloadAction<string>) => {
      state.selectedBalance = action.payload;
    },
    setSelectedStiffness: (state, action: PayloadAction<string>) => {
      state.selectedStiffness = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    resetCatalogFilters: state => {
      state.selectedBrand = [];
      state.selectedCategory = 'Tất cả';
      state.maxPrice = null;
      state.selectedWeight = [];
      state.selectedBalance = 'Tất cả';
      state.selectedStiffness = 'Tất cả';
      state.searchQuery = '';
    }
  }
});

export const {
  setSelectedBrand,
  setSelectedCategory,
  setMaxPrice,
  setSelectedWeight,
  setSelectedBalance,
  setSelectedStiffness,
  setSearchQuery,
  resetCatalogFilters
} = catalogSlice.actions;

// Catalog filters from the /catalog URL. App applies it on every URL change; main.tsx also applies it before the
// first render of a server-rendered catalog landing, so the first paint already shows the filtered list.
export const catalogFiltersFromUrl = (params: URLSearchParams) => (dispatch: (action: unknown) => unknown) => {
  const categoryParam = params.get('category');
  const searchParam = params.get('search');
  const brandParam = params.get('brand');
  dispatch(setSelectedCategory(categoryParam ? decodeURIComponent(categoryParam) : 'Tất cả'));
  dispatch(setSelectedBrand(brandParam ? [brandParam] : []));
  dispatch(setSearchQuery(searchParam ? decodeURIComponent(searchParam) : ''));
};

export default catalogSlice.reducer;
