import { describe, it, expect } from 'vitest';
import { MAIN_NAV, RACKET_CATEGORY_CODES, getVisibleMainNav, isRacketCategoryCode } from '../config/storefront';

describe('config/storefront', () => {
  it('nhận diện đúng mã ngành vợt', () => {
    expect(isRacketCategoryCode(RACKET_CATEGORY_CODES[0])).toBe(true);
  });

  it('không nhận diện mã ngành khác, hoặc rỗng/undefined, là vợt', () => {
    expect(isRacketCategoryCode('VC001488')).toBe(false);
    expect(isRacketCategoryCode(undefined)).toBe(false);
    expect(isRacketCategoryCode(null)).toBe(false);
    expect(isRacketCategoryCode('')).toBe(false);
  });
});

describe('MAIN_NAV / getVisibleMainNav', () => {
  const live = ['VC000005', 'VC001488', 'VC001489', 'VC001491'].map(code => ({ code }));

  it('mọi mục có menuLabel và có to hoặc codes', () => {
    for (const entry of MAIN_NAV) {
      expect(entry.menuLabel).toBeTruthy();
      expect(Boolean(entry.to) || Array.isArray(entry.codes)).toBe(true);
    }
  });

  it('giữ mục có to kể cả khi chưa tải ngành nào', () => {
    expect(getVisibleMainNav([]).map(e => [e.menuLabel, e.to])).toEqual([['BADMINTON (TRANG CHỦ)', '/']]);
  });

  it('bốn ngành live -> chỉ trang chủ và vợt (mã VC001491)', () => {
    expect(getVisibleMainNav(live).map(e => [e.menuLabel, e.to])).toEqual([
      ['BADMINTON (TRANG CHỦ)', '/'],
      ['VỢT CẦU LÔNG', '/catalog?category=VC001491']
    ]);
  });

  it('mục codes chỉ giữ khi có mã đã tải; khớp theo mã, không theo tên', () => {
    expect(getVisibleMainNav([...live, { code: 'VC001427' }]).map(e => e.menuLabel)).toEqual(['BADMINTON (TRANG CHỦ)', 'VỢT CẦU LÔNG', 'GIÀY CẦU LÔNG']);
    expect(getVisibleMainNav([{ code: 'Giày Cầu Lông' }, { code: 'VỢT CẦU LÔNG' }]).map(e => e.menuLabel)).toEqual(['BADMINTON (TRANG CHỦ)']);
  });
});
