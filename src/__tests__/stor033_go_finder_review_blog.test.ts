// STOR-033: đã gỡ hẳn Trình cố vấn chọn vợt, tab đánh giá tay vợt và mục bài viết (blog).
// Quét toàn bộ src (trừ chính tệp này): không còn dấu vết nào.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const SELF = join(SRC, '__tests__', 'stor033_go_finder_review_blog.test.ts');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx|json)$/.test(e.name) ? [p] : [];
  });
}
const files = walk(SRC).filter((p) => p !== SELF).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const hits = (re: RegExp) => files.filter((f) => re.test(f.text)).map((f) => f.path.replace(SRC, 'src'));

describe('STOR-033 không còn cố vấn chọn vợt / đánh giá tay vợt / blog trong src', () => {
  it('có tệp để quét', () => expect(files.length).toBeGreaterThan(50));
  it("không có '/blog'", () => expect(hits(/\/blog/)).toEqual([]));
  it("không có 'racket-finder-section'", () => expect(hits(/racket-finder-section/)).toEqual([]));
  it("không có 'RacketFinder'", () => expect(hits(/RacketFinder/)).toEqual([]));
  it("không có 'BlogSection'", () => expect(hits(/BlogSection/)).toEqual([]));
  it("không có 'Đánh giá tay vợt'", () => expect(hits(/Đánh giá tay vợt/)).toEqual([]));
  it("không có 'kiến thức' (không phân biệt hoa thường)", () => expect(hits(/kiến thức/i)).toEqual([]));
  it("không có 'cố vấn' (không phân biệt hoa thường)", () => expect(hits(/cố vấn/i)).toEqual([]));
});
