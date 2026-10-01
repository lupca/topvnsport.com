// STOR-011: lời của người bán không còn viết cứng trong mã nguồn.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) return n === '__tests__' || n === 'tests' ? [] : walk(f);
    return /\.(tsx?|json)$/.test(n) && !/\.test\./.test(n) ? [f] : [];
  });
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');
// Mẫu viết bằng RegExp tách khoảng trắng/dấu chấm để chính file test này không chứa chuỗi cũ nguyên văn.
const GLOBAL = [/097\s?6007006/, /0102030405/, /Lê Văn Hiến/, /support@topvnsport/, /0981\.?234\.?567/, /Đền gấp 10/i, /đền bù gấp 10/i, /1 đổi 1/, /lưới gãy 90 ngày/, /hơn 80 chi nhánh TopVNSport/];

describe('không còn giá trị người bán viết cứng', () => {
  const files = walk(SRC).filter(f => !f.endsWith('HomePage.tsx') && !f.endsWith('StoreLocator.tsx'));
  for (const re of GLOBAL) {
    it(`không có ${re}`, () => {
      const hits = files.filter(f => re.test(readFileSync(f, 'utf8')));
      expect(hits).toEqual([]);
    });
  }
  it("Footer.tsx không còn 'số 1 Việt Nam' và 'hàng đầu Việt Nam'", () => {
    const s = read('components/Footer.tsx');
    expect(s).not.toContain('số 1 Việt Nam');
    expect(s).not.toContain('hàng đầu Việt Nam');
  });
  it("Trụ sở chính tại Hà Nội' vắng khỏi Footer.tsx", () => {
    expect(read('components/Footer.tsx')).not.toContain('Trụ sở chính tại Hà Nội');
  });
  it("'COD toàn quốc' vắng khỏi TrustBadges.tsx", () => {
    expect(read('components/TrustBadges.tsx')).not.toContain('COD toàn quốc');
  });
  it("'Cửa hàng Hà Nội' vắng khỏi TrustBadges.tsx", () => {
    expect(read('components/TrustBadges.tsx')).not.toContain('Cửa hàng Hà Nội');
  });
  it("'hơn 80 chi nhánh TopVNSport' vắng khỏi CartModal.tsx", () => {
    expect(read('components/CartModal.tsx')).not.toContain('hơn 80 chi nhánh TopVNSport');
  });
  it('src/data.json không có khoá branches cấp cao', () => {
    expect(Object.keys(JSON.parse(read('data.json')))).not.toContain('branches');
  });
});
