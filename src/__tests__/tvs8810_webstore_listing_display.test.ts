import { describe, it, expect } from 'vitest';
import { renderProductPage } from '../../api/product';
import { initialTierValue } from '../components/product-detail/helpers';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { NO_IMAGE_URL } from '../services/sport-api/constants';
import type { Product } from '../types';

const SHELL = '<html><head><title>Shell</title></head><body><div id="root"></div></body></html>';
const tier = { id: 1, product_id: 1, tier_index: 1, name: 'Loại cước', options: ['Khung không dây', 'BG65Ti'] };
const variants = [
  { id: 10, tier_1_option: 'Khung không dây', tier_2_option: null, sku_code: 'K', price: 100 },
  { id: 11, tier_1_option: 'BG65Ti', tier_2_option: null, sku_code: 'B', price: 100 },
];
const product = (over: Partial<Product> = {}): Product => ({
  id: '1', name: 'Tên SP', image: NO_IMAGE_URL, gallery: [], specs: {}, tier_variations: [tier], variants, ...over,
} as Product);

describe('webstore listing display fields (seo_title, default_variant_id)', () => {
  it('maps PIM seo_title/default_variant_id; blank seo_title is unset', () => {
    const base = { id: 1, name: 'Tên SP', variants: [], tier_variations: [] };
    expect(mapPmiProduct({ ...base, seo_title: ' SEO ', default_variant_id: 11 }, [])).toMatchObject({ seoTitle: 'SEO', defaultVariantId: 11 });
    const plain = mapPmiProduct({ ...base, seo_title: '  ', default_variant_id: null }, [])!;
    expect([plain.seoTitle, plain.defaultVariantId]).toEqual([undefined, undefined]);
  });

  it('<title> uses seoTitle (escaped), else the cleaned name with the site suffix', () => {
    const title = (p: Product) => renderProductPage(SHELL, p, 'https://x/product/1').match(/<title[^>]*>([^<]*)<\/title>/)![1];
    expect(title(product({ seoTitle: 'A & B | Top VN Sport' }))).toBe('A &amp; B | Top VN Sport');
    expect(title(product())).toBe('Tên SP | Top VN Sport');
  });

  it('pre-selects the default variant option, else the no-string option', () => {
    expect(initialTierValue(product({ defaultVariantId: 11 }), 1)).toBe('BG65Ti');
    expect(initialTierValue(product(), 1)).toBe('Khung không dây');
    expect(initialTierValue(product({ defaultVariantId: 999 }), 1)).toBe('Khung không dây');
  });
});
