// Review 14/11 item 5: a meta description never ends in a word-cut "…".
import { describe, it, expect } from 'vitest';
import { seoDescriptionFromText } from '../utils/seoText';

describe('seoDescriptionFromText without a late sentence end', () => {
  it('cuts at the last comma/semicolon in the second half and closes with a period', () => {
    const d = seoDescriptionFromText(`${'Vợt nhẹ tay '.repeat(9)}, thân dẻo trợ lực; ${'cầu đi xa '.repeat(12)}`)!;
    expect(d.endsWith('trợ lực.')).toBe(true);
  });
  it('else the full sentence that fits, even if short', () => {
    expect(seoDescriptionFromText(`Giới thiệu vợt Yonex. ${'rất nhẹ '.repeat(30)}`)).toBe('Giới thiệu vợt Yonex.');
  });
  it('else a word cut closed with a period; never "…"', () => {
    const d = seoDescriptionFromText('xx '.repeat(100))!;
    expect(d).toMatch(/x\.$/);
    expect(d.length).toBeLessThanOrEqual(155);
  });
});
