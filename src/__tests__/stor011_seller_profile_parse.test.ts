// STOR-011: parser hồ sơ người bán (VITE_SELLER_PROFILE).
import { describe, it, expect } from 'vitest';
import * as mod from '../config/sellerProfile';
import { parseSellerProfile } from '../config/sellerProfile';

describe('parseSellerProfile', () => {
  it('xuất getSellerProfile và parseSellerProfile', () => {
    expect(typeof mod.parseSellerProfile).toBe('function');
    expect(typeof mod.getSellerProfile).toBe('function');
  });
  it('undefined -> {}', () => expect(parseSellerProfile(undefined)).toEqual({}));
  it("'' -> {}", () => expect(parseSellerProfile('')).toEqual({}));
  it("'   ' -> {}", () => expect(parseSellerProfile('   ')).toEqual({}));
  it('JSON hỏng ném lỗi nêu VITE_SELLER_PROFILE', () =>
    expect(() => parseSellerProfile('{bad')).toThrow(/VITE_SELLER_PROFILE/));
  it('mảng ném lỗi nêu VITE_SELLER_PROFILE', () =>
    expect(() => parseSellerProfile('[]')).toThrow(/VITE_SELLER_PROFILE/));
  it('trường sai kiểu ném lỗi nêu tên trường', () =>
    expect(() => parseSellerProfile('{"hotline":5}')).toThrow(/hotline/));
  it('khoá lạ ném lỗi nêu tên khoá', () =>
    expect(() => parseSellerProfile('{"unknownKey":"x"}')).toThrow(/unknownKey/));
  it('chuỗi toàn khoảng trắng -> hotline undefined', () =>
    expect(parseSellerProfile('{"hotline":"  "}').hotline).toBeUndefined());
  it('chuỗi được trim', () =>
    expect(parseSellerProfile('{"hotline":" X "}').hotline).toBe('X'));
  it('chi nhánh thiếu address ném lỗi nêu branches[0].address', () =>
    expect(() => parseSellerProfile('{"branches":[{"id":"a","name":"b"}]}')).toThrow(/branches\[0\]\.address/));
  it('branches không phải mảng ném lỗi nêu branches', () =>
    expect(() => parseSellerProfile('{"branches":{}}')).toThrow(/branches/));
  it('nhận headquartersNote, codPolicy, storeNote', () => {
    const p = parseSellerProfile('{"headquartersNote":"H","codPolicy":"C","storeNote":"S"}');
    expect(p).toEqual({ headquartersNote: 'H', codPolicy: 'C', storeNote: 'S' });
  });
  it('chi nhánh hợp lệ: trường tuỳ chọn trống bị bỏ', () => {
    const p = parseSellerProfile('{"branches":[{"id":"a","name":"b","address":"c","phone":" "}]}');
    expect(p.branches).toEqual([{ id: 'a', name: 'b', address: 'c' }]);
  });
});
