// STOR-103 (design 5.6 / R4): the three storefront stock sums go through sumStock.
// Real functions only, no mocks: mutating sumStock or any call site turns a row red.
import { describe, it, expect } from 'vitest';
import { mapPmiProduct } from '../services/sport-api/productMappers';
import { applyWmsStock } from '../services/sport-api/wmsStock';
import { aggregateStock } from '../components/product-detail/helpers';
import { sumStock } from '../utils/stock';
import type { Product } from '../types';
import type { PmiProduct } from '../services/sport-api/types';

const pmi = (stocks: (number | null)[]) =>
  ({
    id: 1,
    name: 'Vợt test',
    variants: stocks.map((stock, i) => ({ id: i + 1, product_id: 1, price: 100, stock, sku_code: `S${i}` }))
  }) as unknown as PmiProduct;

const product = (variants: Partial<Product['variants'][number]>[], extra: Partial<Product> = {}) =>
  ({ id: 1, name: 'P', stock: 99, variants, ...extra }) as unknown as Product;

const pdp = (stocks: (number | undefined)[]) =>
  product(
    stocks.map((stock) => ({ tier_1_option: 'Đỏ', stock })),
    { tier_variations: [{ tier_index: 1, name: 'Màu', options: ['Đỏ', 'Xanh'] }] } as Partial<Product>
  );

const twoSku = product([{ sku_code: 'A' }, { sku_code: 'B' }]);

describe('STOR-103 sumStock behind the three storefront sums', () => {
  it.each<[string, () => unknown, unknown]>([
    ['mapper: -10 + null -> clamped 0', () => mapPmiProduct(pmi([-10, null]), [])?.stock, 0],
    ['mapper: 0 + 5 -> 5', () => mapPmiProduct(pmi([0, 5]), [])?.stock, 5],
    ['mapper: all zero -> 0', () => mapPmiProduct(pmi([0, 0]), [])?.stock, 0],
    ['wms: present SKUs summed', () => applyWmsStock([twoSku], { A: 2, B: 3 })[0].stock, 5],
    ['wms: missing SKU counts 0', () => applyWmsStock([twoSku], { A: 4 })[0].stock, 4],
    ['wms: stockMap null -> undefined', () => applyWmsStock([twoSku], null)[0].stock, undefined],
    ['pdp: known + undefined -> known sum', () => aggregateStock(pdp([2, 3, undefined]), 'Đỏ', ''), { kind: 'known', stock: 5 }],
    ['pdp: known 0 + undefined -> unknown', () => aggregateStock(pdp([0, undefined]), 'Đỏ', ''), { kind: 'unknown' }],
    ['pdp: no matching variant -> none', () => aggregateStock(pdp([2]), 'Xanh', ''), { kind: 'none' }],
    ['sumStock: [] -> 0', () => sumStock([]), 0],
    ['sumStock: [undefined] -> 0', () => sumStock([undefined]), 0],
    ['sumStock: [2, undefined, 3] -> 5', () => sumStock([2, undefined, 3]), 5]
  ])('%s', (_name, run, expected) => {
    expect(run()).toEqual(expected);
  });
});
