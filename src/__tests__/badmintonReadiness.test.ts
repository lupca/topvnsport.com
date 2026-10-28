import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { inferRacketPlayStyle, hasO2OStringing, getPrimaryTierPreview } from '../utils/badmintonReadiness';
import type { Product, TierVariation } from '../types';

const RACKET_CODE = 'VC001491';

const prod = (extra: Record<string, unknown> = {}) =>
  ({ id: 'p1', name: 'SP 1', image: '', specs: {}, categoryCode: RACKET_CODE, ...extra }) as unknown as Product;

const tiers = (...list: Partial<TierVariation>[]): TierVariation[] =>
  list.map((t, i) => ({ tier_index: i + 1, name: 'Phân loại', options: [], ...t })) as TierVariation[];

describe('STOR-050 inferRacketPlayStyle', () => {
  it('sản phẩm ngoài ngành vợt -> undefined dù có mọi tín hiệu', () => {
    expect(inferRacketPlayStyle(prod({ categoryCode: 'c1', characteristics: 'Tấn Công', specs: { balance: 305 } }))).toBeUndefined();
    expect(inferRacketPlayStyle(prod({ categoryCode: undefined, name: 'YONEX ASTROX 88D PRO' }))).toBeUndefined();
  });

  it('Tầng 1 characteristics: Tấn Công / Phòng Thủ -> Phản Tạt / Toàn Diện', () => {
    expect(inferRacketPlayStyle(prod({ characteristics: 'Tấn Công' }))).toBe('Tấn Công');
    expect(inferRacketPlayStyle(prod({ characteristics: 'Phòng Thủ' }))).toBe('Phản Tạt');
    expect(inferRacketPlayStyle(prod({ characteristics: 'Toàn Diện' }))).toBe('Toàn Diện');
  });

  it('Tầng 1 characteristics thắng Tầng 2 tên vợt', () => {
    expect(inferRacketPlayStyle(prod({ characteristics: 'Phòng Thủ', name: 'YONEX ASTROX 88D PRO' }))).toBe('Phản Tạt');
  });

  it('Tầng 1 specs.balance: >=300 tấn công, <=292 phản tạt, 293-299 toàn diện', () => {
    expect(inferRacketPlayStyle(prod({ characteristics: 'Người Mới', specs: { balance: 300 } }))).toBe('Tấn Công');
    expect(inferRacketPlayStyle(prod({ characteristics: 'Người Mới', specs: { balance: 305 } }))).toBe('Tấn Công');
    expect(inferRacketPlayStyle(prod({ specs: { balance: 292 } }))).toBe('Phản Tạt');
    expect(inferRacketPlayStyle(prod({ specs: { balance: 285 } }))).toBe('Phản Tạt');
    expect(inferRacketPlayStyle(prod({ specs: { balance: 293 } }))).toBe('Toàn Diện');
    expect(inferRacketPlayStyle(prod({ specs: { balance: 299 } }))).toBe('Toàn Diện');
  });

  it('Tầng 2 từ khóa trong name và description khi thiếu Tầng 1', () => {
    expect(inferRacketPlayStyle(prod({ name: 'YONEX ASTROX 100 GAME' }))).toBe('Tấn Công');
    expect(inferRacketPlayStyle(prod({ name: 'VICTOR THRUSTER K 9900' }))).toBe('Tấn Công');
    expect(inferRacketPlayStyle(prod({ description: 'Wifee nặng đầu, chuyên công mạnh' }))).toBe('Tấn Công');
    expect(inferRacketPlayStyle(prod({ name: 'YONEX NANOFLARE 1000Z' }))).toBe('Phản Tạt');
    expect(inferRacketPlayStyle(prod({ description: 'Vợt nhẹ đầu, tốc độ xuất cầu nhanh' }))).toBe('Phản Tạt');
    expect(inferRacketPlayStyle(prod({ name: 'VICTOR JETSPEED S 12' }))).toBe('Phản Tạt');
    expect(inferRacketPlayStyle(prod({ name: 'YONEX ARCSABER 11 PRO' }))).toBe('Toàn Diện');
    expect(inferRacketPlayStyle(prod({ description: 'Công thủ toàn diện, even balance' }))).toBe('Toàn Diện');
  });

  it('Tầng 3: vợt không tín hiệu -> undefined, không bịa mặc định', () => {
    expect(inferRacketPlayStyle(prod())).toBeUndefined();
    expect(inferRacketPlayStyle(prod({ name: 'SP 1', description: 'Bảo hành 6 tháng' }))).toBeUndefined();
    expect(inferRacketPlayStyle(prod({ characteristics: 'Người Mới' }))).toBeUndefined();
  });
});

describe('STOR-050 hasO2OStringing', () => {
  it('true khi có tầng chứa lựa chọn khung không dây', () => {
    const p = prod({ tier_variations: tiers({ name: 'Phân loại', options: ['4U', '5U'] }, { name: 'Loại Cước', options: ['Khung Không Dây', 'Đan cước tặng'] }) });
    expect(hasO2OStringing(p)).toBe(true);
  });

  it('false khi không có tier_variations, tier rỗng, hoặc không tầng nào có lựa chọn không dây', () => {
    expect(hasO2OStringing(prod())).toBe(false);
    expect(hasO2OStringing(prod({ tier_variations: [] }))).toBe(false);
    expect(hasO2OStringing(prod({ tier_variations: tiers({ name: 'Màu cước', options: ['Đen', 'Trắng'] }) }))).toBe(false);
  });
});

describe('STOR-050 getPrimaryTierPreview', () => {
  it('lấy tối đa maxOptions lựa chọn đã trim khác rỗng từ tầng đầu không phải tầng cước', () => {
    const p = prod({
      tier_variations: tiers(
        { name: 'Loại Cước', options: ['Khung không dây', 'Đan cước'] },
        { name: 'Phân Loại', options: [' 4U/G5 ', '', '   ', '5U/G5', '3U/G5', '6U/G5'] }
      ),
    });
    expect(getPrimaryTierPreview(p)).toEqual(['4U/G5', '5U/G5', '3U/G5', '6U/G5']);
    expect(getPrimaryTierPreview(p, 2)).toEqual(['4U/G5', '5U/G5']);
    expect(getPrimaryTierPreview(p, 6)).toEqual(['4U/G5', '5U/G5', '3U/G5', '6U/G5']);
  });

  it('trả mảng rỗng khi không có tầng nào không phải tầng cước', () => {
    expect(getPrimaryTierPreview(prod())).toEqual([]);
    expect(getPrimaryTierPreview(prod({ tier_variations: tiers({ name: 'Căng Cước', options: ['Khung không dây'] }) }))).toEqual([]);
  });
});

describe('STOR-050 index.css High-Contrast Ink', () => {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

  it('bỏ font weight 300 khỏi Be Vietnam Pro', () => {
    expect(css).not.toMatch(/0,300/);
    expect(css).not.toMatch(/1,300/);
    expect(css).toMatch(/Be\+Vietnam\+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700/);
  });

  it('định nghĩa đủ 7 biến màu High-Contrast Ink trong @theme', () => {
    expect(css).toContain('--color-ink-primary: #000000;');
    expect(css).toContain('--color-ink-secondary: #18181b;');
    expect(css).toContain('--color-ink-muted: #52525b;');
    expect(css).toContain('--color-brand-sale: #c62828;');
    expect(css).toContain('--color-pill-bg: #e5e5e5;');
    expect(css).toContain('--color-line-tag: #d4d4d8;');
    expect(css).toContain('--color-line-strong: #18181b;');
  });
});
