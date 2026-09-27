import { describe, it, expect } from 'vitest';
import { mapPmiProduct, mapProductVariant, extractItems } from '../services/sport-api/productMappers';
import { PmiProduct, PmiVariant } from '../services/sport-api/types';
import { Category } from '../types';

describe('productMappers', () => {
  const mockCategories: Category[] = [
    { id: 1, name: 'Vợt cầu lông', code: 'VC001491', parent_id: 10, display_name: 'Thể Thao > Cầu Lông > Vợt cầu lông' },
    { id: 2, name: 'Giày cầu lông', code: 'VC002000', parent_id: 10, display_name: 'Thể Thao > Cầu Lông > Giày cầu lông' }
  ];

  it('extractItems extracts array items from direct array or paginated object', () => {
    expect(extractItems([1, 2, 3])).toEqual([1, 2, 3]);
    expect(extractItems({ items: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(extractItems(null)).toEqual([]);
    expect(extractItems({})).toEqual([]);
  });

  it('mapProductVariant calculates computed promotion fields correctly', () => {
    const pmiVariant: PmiVariant = {
      id: 101,
      product_id: 1,
      price: 2000000,
      stock: 5,
      tier_1_option: 'Đỏ',
      tier_2_option: '3U',
      sku_code: 'YONEX-ASTROX88-RED-3U',
      computed_price: 1600000,
      original_price: 2000000,
      percentage_discount: 20,
      has_active_promotion: true
    };

    const mapped = mapProductVariant(pmiVariant, 1);

    expect(mapped.id).toBe(101);
    expect(mapped.product_id).toBe(1);
    expect(mapped.price).toBe(2000000);
    expect(mapped.originalPrice).toBe(2000000);
    expect(mapped.computedPrice).toBe(1600000);
    expect(mapped.percentageDiscount).toBe(20);
    expect(mapped.hasActivePromotion).toBe(true);
    expect(mapped.stock).toBe(5);
  });

  it('mapPmiProduct maps promoted product data to Storefront product model', () => {
    const pmiProduct: PmiProduct = {
      id: '1',
      name: 'Vợt Yonex Astrox 88D Pro',
      description: 'Dòng vợt tấn công mạnh mẽ.',
      voma_category_id: 1,
      weight: '4U',
      attribute_values: [
        { id: 1, attribute_id: 10, value_string: 'Yonex', attribute: { code: 'brand', name: 'Thương hiệu' } },
        { id: 2, attribute_id: 11, value_string: '4U5', attribute: { code: 'weightClass', name: 'Trọng lượng' } },
        { id: 3, attribute_id: 12, value_decimal: 305, attribute: { code: 'balance', name: 'Điểm cân bằng' } }
      ],
      media: [
        { image_url: 'http://localhost/cover.jpg', is_cover: true, display_order: 1, variant_id: 101 },
        { image_url: 'http://localhost/gallery.jpg', is_cover: false, display_order: 2 }
      ],
      variants: [
        {
          id: 101,
          price: 2500000,
          original_price: 2500000,
          computed_price: 2000000,
          percentage_discount: 20,
          has_active_promotion: true,
          stock: 10,
          tier_1_option: 'Đỏ',
          sku_code: 'AX88D-RED'
        }
      ]
    };

    const product = mapPmiProduct(pmiProduct, mockCategories);

    expect(product.id).toBe('1');
    expect(product.name).toBe('Vợt Yonex Astrox 88D Pro');
    expect(product.brand).toBe('Yonex');
    expect(product.category).toBe('Vợt cầu lông');
    expect(product.categoryCode).toBe('VC001491');
    expect(product.image).toBe('http://localhost/cover.jpg');
    expect(product.gallery).toHaveLength(2);
    expect(product.hasActivePromotion).toBe(true);
    expect(product.computedPrice).toBe(2000000);
    expect(product.originalPrice).toBe(2500000);
    expect(product.percentageDiscount).toBe(20);
    expect(product.salePrice).toBe(2000000);
    expect(product.stock).toBe(10);
    expect(product.variants).toHaveLength(1);
    expect(product.variants![0].hasActivePromotion).toBe(true);
  });

  it('mapPmiProduct handles brands and unpromoted product gracefully', () => {
    const pmiProduct: PmiProduct = {
      id: '2',
      name: 'Giày Victor A970ACE',
      voma_category_id: 2,
      has_active_promotion: false,
      attribute_values: [
        { id: 1, attribute_id: 10, value_string: 'Lining', attribute: { code: 'brand', name: 'Thương hiệu' } }
      ],
      variants: [
        {
          id: 201,
          price: 1800000,
          stock: 8,
          tier_1_option: 'Trắng',
          sku_code: 'A970-WHT'
        }
      ]
    };

    const product = mapPmiProduct(pmiProduct, mockCategories);

    expect(product.id).toBe('2');
    expect(product.brand).toBe('Lining');
    expect(product.hasActivePromotion).toBe(false);
    expect(product.computedPrice).toBeUndefined();
    expect(product.originalPrice).toBeUndefined();
    expect(product.percentageDiscount).toBeUndefined();
    expect(product.salePrice).toBe(1800000);
    expect(product.price).toBe(1800000);
  });

  it('mapPmiProduct gán "Chưa phân loại" và không có categoryCode khi voma_category_id không khớp ngành nào', () => {
    const pmiProduct: PmiProduct = {
      id: '3',
      name: 'Sản phẩm chưa gắn ngành',
      voma_category_id: 999,
      variants: []
    };

    const product = mapPmiProduct(pmiProduct, mockCategories);

    expect(product.category).toBe('Chưa phân loại');
    expect(product.categoryCode).toBeUndefined();
  });

  it('mapPmiProduct gán "Chưa phân loại" khi sản phẩm không có voma_category_id', () => {
    const pmiProduct: PmiProduct = {
      id: '4',
      name: 'Sản phẩm không gắn ngành',
      variants: []
    };

    const product = mapPmiProduct(pmiProduct, mockCategories);

    expect(product.category).toBe('Chưa phân loại');
    expect(product.categoryCode).toBeUndefined();
  });

  it('mapPmiProduct không bịa giá trị thông số vợt khi PIM chưa có thuộc tính', () => {
    const pmiProduct: PmiProduct = {
      id: '5',
      name: 'Vợt chưa có thông số',
      voma_category_id: 1,
      variants: []
    };

    const product = mapPmiProduct(pmiProduct, mockCategories);

    expect(product.specs.weight).toBeUndefined();
    expect(product.specs.stiffness).toBeUndefined();
    expect(product.specs.balance).toBeUndefined();
    expect(product.specs.maxTension).toBeUndefined();
  });
});
