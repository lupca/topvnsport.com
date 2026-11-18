import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

// Từ md menu chính luôn đúng 1 hàng: bao nhiêu mục danh mục nằm vừa hàng được tính từ bề rộng THẬT
// (ô chứa, chữ từng mục trong bản đo ẩn, khoảng cách, nút "Xem thêm"), không có số cứng.
// Trả về số mục danh mục hiện trên hàng; null = hiện tất cả, không có nút (vừa hết, dưới md, hoặc chưa đo được như jsdom).
// Đo trong useLayoutEffect nên khung hình đầu tiên đã đúng 1 hàng; đo lại khi đổi cỡ cửa sổ, đổi danh sách và mỗi khi bề rộng một nhãn đổi (font tải xong).
export function useNavFit(listRef: RefObject<HTMLUListElement | null>, itemCodes: string) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);

  useLayoutEffect(() => {
    const ul = listRef.current;
    const copy = measureRef.current;
    if (!ul || !copy) return;
    const compute = (): number | null => {
      if (!window.matchMedia?.('(min-width: 768px)').matches) return null;
      const style = getComputedStyle(ul);
      const avail = ul.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 1;
      // Bản đo: [Trang chủ, ...danh mục, nút Xem thêm]
      const w = [...(copy.firstElementChild?.children ?? [])].map(el => el.getBoundingClientRect().width);
      const button = w.pop() ?? 0;
      const gap = parseFloat(style.columnGap) || 0; // khoảng cách của hàng thật; bản đo dùng cùng hằng GAP nên không lệch
      const total = w.reduce((a, b) => a + b, 0) + gap * (w.length - 1);
      if (!(avail > 0) || w.length < 2 || total <= avail) return null;
      let used = w[0] + gap + button;
      let k = 0;
      while (k < w.length - 1 && used + gap + w[k + 1] <= avail) used += gap + w[++k];
      return k;
    };
    const apply = () => setFit(compute());
    apply();
    // flushSync: ResizeObserver chạy trước khi vẽ; commit ngay trong khung hình đó nên kéo cửa sổ hay đổi font không có khung hình tràn/thiếu mục.
    const onChange = () => flushSync(apply);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onChange);
    ro?.observe(ul);
    // Từng nhãn của bản đo: bề rộng đổi ngay khi font chữ của nhãn đó đổi (Google Fonts về sau lần vẽ đầu, từng file một).
    for (const el of copy.firstElementChild?.children ?? []) ro?.observe(el);
    const mq = window.matchMedia?.('(min-width: 768px)');
    mq?.addEventListener('change', onChange);
    return () => {
      ro?.disconnect();
      mq?.removeEventListener('change', onChange);
    };
  }, [listRef, itemCodes]);

  return { fit, measureRef };
}
