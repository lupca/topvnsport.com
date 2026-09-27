import { describe, it, expect } from 'vitest';
import { RACKET_CATEGORY_CODES, isRacketCategoryCode } from '../config/storefront';

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
