import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

// STOR-039: popup của ui-kit (SystemPopupProvider: fixed inset-0 z-[100]) chỉ có CSS khi
// Tailwind quét thư mục ui-kit; thiếu @source thì popup nằm dưới drawer giỏ (z-50).
describe('STOR-039 Tailwind quét ui-kit', () => {
  const cssPath = resolve(__dirname, '../index.css');
  const css = readFileSync(cssPath, 'utf8');

  it('index.css có @source trỏ tới thư mục chứa SystemPopupProvider dùng z-[100]', () => {
    const sources = [...css.matchAll(/@source\s+"([^"]+)"/g)].map(m => resolve(dirname(cssPath), m[1]));
    const popup = sources
      .map(dir => resolve(dir, 'components/Popup/SystemPopupProvider.tsx'))
      .find(p => existsSync(p));
    expect(popup).toBeDefined();
    expect(readFileSync(popup!, 'utf8')).toContain('z-[100]');
  });
});
