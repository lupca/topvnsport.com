// SEO audit 13/11 item 9: sitemap <lastmod> from PIM products.updated_at.
import { describe, it, expect } from 'vitest';
import { lastmodOf } from '../../api/sitemap';

describe('sitemap lastmod (item 9)', () => {
  it('PIM updated_at -> UTC W3C datetime; missing or bad -> none', () => {
    expect(lastmodOf('2026-11-13T09:12:02.123456+07:00')).toBe('2026-11-13T02:12:02Z');
    expect(lastmodOf('2026-11-13T02:12:02.5')).toBe('2026-11-13T02:12:02Z');
    expect(lastmodOf(null)).toBeUndefined();
    expect(lastmodOf('soon')).toBeUndefined();
  });
});
