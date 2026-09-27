import { describe, it, expect } from 'vitest';
import {
  getCategoriesSortedByCount,
  getCategoryLabel,
  getProductCategoryCounts
} from '../utils/categories';
import { getCategorySubtitle } from '../features/home/categoryTileThemes';
import { Category, Product } from '../types';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id || 'p1',
    name: overrides.name || 'Sản phẩm',
    brand: 'Yonex',
    image: '',
    category: overrides.category || 'Chưa phân loại',
    categoryCode: overrides.categoryCode,
    price: 100000,
    specs: {},
    description: '',
    reviews: [],
    stock: 1
  };
}

describe('utils/categories', () => {
  const racket: Category = {
    id: 1,
    name: 'Vợt Cầu Lông',
    code: 'VC001491',
    parent_id: 3,
    display_name: 'Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Vợt Cầu Lông'
  };
  const otherUnderBadminton: Category = {
    id: 2,
    name: 'Khác',
    code: 'VC001488',
    parent_id: 3,
    display_name: 'Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông > Khác'
  };
  const otherUnderSports: Category = {
    id: 3,
    name: 'Khác',
    code: 'VC009999',
    parent_id: 4,
    display_name: 'Thể Thao & Dã Ngoại > Khác'
  };

  describe('getProductCategoryCounts / getCategoriesSortedByCount', () => {
    it('đếm theo categoryCode và sắp xếp danh mục theo số sản phẩm giảm dần', () => {
      const products = [
        makeProduct({ id: 'a', categoryCode: 'VC001488' }),
        makeProduct({ id: 'b', categoryCode: 'VC001491' }),
        makeProduct({ id: 'c', categoryCode: 'VC001491' }),
        makeProduct({ id: 'd', categoryCode: 'VC001491' }),
        makeProduct({ id: 'e' }) // chưa gắn ngành -- không tính vào ngành nào
      ];

      const counts = getProductCategoryCounts(products);
      expect(counts['VC001491']).toBe(3);
      expect(counts['VC001488']).toBe(1);

      const sorted = getCategoriesSortedByCount([otherUnderBadminton, racket], products);
      expect(sorted.map(c => c.code)).toEqual(['VC001491', 'VC001488']);
    });

    it('bỏ hẳn ngành có 0 sản phẩm trong danh sách đã tải (không chỉ xếp cuối)', () => {
      const emptyCategory: Category = {
        id: 99,
        name: 'Ngành rỗng',
        code: 'VC000099',
        parent_id: 3,
        display_name: 'Thể Thao & Dã Ngoại > Ngành rỗng'
      };
      const products = [makeProduct({ id: 'a', categoryCode: 'VC001491' })];

      const sorted = getCategoriesSortedByCount([racket, emptyCategory], products);

      expect(sorted.map(c => c.code)).toEqual(['VC001491']);
      expect(sorted.some(c => c.code === 'VC000099')).toBe(false);
    });
  });

  describe('getCategoryLabel', () => {
    it('trả về tên gốc khi không có ngành nào khác trùng tên', () => {
      const all = [racket, otherUnderBadminton];
      expect(getCategoryLabel(racket, all)).toBe('Vợt Cầu Lông');
    });

    it('ghép thêm đoạn cha khi hai ngành trùng tên trong danh sách', () => {
      const all = [racket, otherUnderBadminton, otherUnderSports];
      expect(getCategoryLabel(otherUnderBadminton, all)).toBe('Cầu Lông – Khác');
      expect(getCategoryLabel(otherUnderSports, all)).toBe('Thể Thao & Dã Ngoại – Khác');
    });

    it('thêm dần tới 3 tầng khi cả tên lá lẫn tên cha trực tiếp đều trùng (vd Áo thun Nam/Nữ)', () => {
      const aoThunNam: Category = {
        id: 10,
        name: 'Áo thun',
        code: 'VC000101',
        parent_id: 20,
        display_name: 'Thời Trang Nam > Áo > Áo thun'
      };
      const aoThunNu: Category = {
        id: 11,
        name: 'Áo thun',
        code: 'VC000102',
        parent_id: 21,
        display_name: 'Thời Trang Nữ > Áo > Áo thun'
      };
      const all = [aoThunNam, aoThunNu];

      // Một cấp cha ("Áo") chưa đủ phân biệt -- phải lên tới cấp 2 ("Thời
      // Trang Nam/Nữ") mới ra nhãn duy nhất.
      expect(getCategoryLabel(aoThunNam, all)).toBe('Thời Trang Nam – Áo – Áo thun');
      expect(getCategoryLabel(aoThunNu, all)).toBe('Thời Trang Nữ – Áo – Áo thun');
    });
  });

  describe('getCategorySubtitle', () => {
    it('trả về đường dẫn tổ tiên, bỏ đoạn cuối (chính là tên ngành)', () => {
      expect(getCategorySubtitle(racket)).toBe('Thể Thao & Dã Ngoại > Dụng Cụ Thể Thao & Dã Ngoại > Cầu Lông');
    });

    it('trả về rỗng khi ngành nằm ở gốc (không có đoạn cha)', () => {
      const rootCategory: Category = { id: 9, name: 'Gốc', code: 'VC000001', parent_id: null, display_name: 'Gốc' };
      expect(getCategorySubtitle(rootCategory)).toBe('');
    });
  });
});
