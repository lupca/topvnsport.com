import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom không có scrollIntoView và matchMedia; STOR-106: chip ngành trang chủ gọi cả hai.
// matchMedia là hàm thường (không phải vi.fn) để resetAllMocks không làm nó trả undefined; mặc định không giảm chuyển động.
Element.prototype.scrollIntoView = vi.fn();
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
