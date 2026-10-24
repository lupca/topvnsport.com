import { describe, it, expect } from 'vitest';
import { isStringingTier } from '../components/product-detail/helpers';
import fixture from './fixtures/stor047_stringing_tiers.fixture.json';

// Tầng lấy nguyên văn từ PIM prod (24/10): (product_id, tên tầng) -> có phải tầng cước vợt.
const tier = (productId: number, name: string) => {
  const t = fixture.tiers.find((x) => x.product_id === productId && x.name === name);
  if (!t) throw new Error(`thiếu tầng ${productId} ${name} trong fixture`);
  return t;
};

const CASES: [number, string, boolean][] = [
  [337, 'Loại Cước', true],
  [310, 'Căng Cước', true],
  [312, 'Căng Cước', true],
  [330, 'CĂNG CƯỚC', true],
  [315, 'Độ Căng Cước', true],
  [329, 'Dây Vợt', true],
  [339, 'Dây vợt', true],
  [278, 'Dây Căng', true],
  [316, 'Màu cước', false],
  [284, 'Phân loại', false],
  [337, 'Màu Sắc', false],
  [310, 'Màu Sắc', false],
  [341, 'Size', false],
  [329, 'Phân Loại', false],
  [315, 'Chủng loại', false]
];

describe('STOR-047 isStringingTier theo lựa chọn khung không dây', () => {
  it.each(CASES)('#%i "%s" -> %s', (id, name, expected) => {
    expect(isStringingTier(tier(id, name))).toBe(expected);
  });
});
