// @vitest-environment jsdom
// Menu chính từ md luôn 1 hàng: mục không vừa chuyển vào nút "Xem thêm". jsdom không dàn trang nên bề rộng được giả lập:
// chữ trong bản đo = 10px/ký tự, nút Xem thêm = 80 + 6 + 16, khoảng cách 32, padding ul 24+24. Cách tính thật được kiểm ở e2e/desktop-nav-guard.cjs.
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { render, screen, cleanup, within, fireEvent, act } from '@testing-library/react';
import MainNav from '../components/MainNav';

const ITEMS = Array.from({ length: 6 }, (_, i) => ({ code: `C${i + 1}`, label: `Danh mục ${i + 1}` })); // 10 ký tự mỗi nhãn
const nav = () => screen.getByRole('navigation', { name: 'Điều hướng chính' });
const names = () => within(nav()).getAllByRole('link').map(a => a.textContent);
let listWidth = 800;
let charW = 10;

beforeEach(() => {
  listWidth = 800;
  charW = 10;
  window.matchMedia = ((q: string) => ({ matches: q.includes('768'), addEventListener() {}, removeEventListener() {} })) as any;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.tagName === 'UL' ? listWidth : 0; });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const own = (this as HTMLElement).dataset?.label;
    const label = own ?? (this as HTMLElement).querySelector?.('[data-label]')?.getAttribute('data-label');
    const width = label === undefined || label === null ? 0 : label.length * charW + (own === undefined ? 22 : 0);
    return { width, height: 20, top: 0, left: 0, right: width, bottom: 20, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => new Proxy(real(el), { get: (t, k) => (k === 'columnGap' ? '32px' : k === 'paddingLeft' || k === 'paddingRight' ? '24px' : Reflect.get(t, k)) }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const view = (initial = '/', props: Partial<React.ComponentProps<typeof MainNav>> = {}) =>
  render(<MemoryRouter initialEntries={[initial]}><MainNav items={ITEMS} {...props} /></MemoryRouter>);

describe('menu chính 1 hàng từ md (Xem thêm)', () => {
  it('vừa hết: đủ link, không có nút', () => {
    listWidth = 1400;
    view();
    expect(names()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /Xem thêm/ })).toBeNull();
  });

  it('không vừa: hàng giữ trang chủ + số mục vừa, phần còn lại theo đúng thứ tự trong Xem thêm', () => {
    view();
    expect(names()).toEqual(['BADMINTON (TRANG CHỦ)', 'Danh mục 1', 'Danh mục 2', 'Danh mục 3']);
    const button = screen.getByRole('button', { name: /Xem thêm/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: 'Danh mục 4' })).toBeNull(); // mục ẩn không với tới được khi đóng
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(within(panel).getAllByRole('link').map(a => a.textContent)).toEqual(['Danh mục 4', 'Danh mục 5', 'Danh mục 6']);
    expect(within(panel).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/catalog?category=C4', '/catalog?category=C5', '/catalog?category=C6']);
  });

  it('bản đo ẩn không thêm link/chữ vào cây trợ năng', () => {
    view();
    const copy = nav().querySelector('[data-label]')!.closest('[aria-hidden="true"]')!;
    expect(copy.querySelector('a,button')).toBeNull();
    expect(copy.textContent).toBe('');
  });

  it('không mục nào vừa: còn trang chủ và nút', () => {
    listWidth = 400;
    view();
    expect(names()).toEqual(['BADMINTON (TRANG CHỦ)']);
    screen.getByRole('button', { name: /Xem thêm/ });
  });

  it('dưới md hoặc chưa đo được: hiện đủ, không nút', () => {
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
    view();
    expect(names()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /Xem thêm/ })).toBeNull();
  });

  it('mục đang chọn nằm trong Xem thêm: nút mang dạng active, mục trong panel có aria-current', () => {
    view('/catalog?category=C5');
    const button = screen.getByRole('button', { name: /Xem thêm/ });
    expect(button.className.split(' ')).toContain('text-brand-primary');
    expect(button.querySelector('span')!.className).toContain('after:bg-brand-primary');
    fireEvent.click(button);
    expect(screen.getByRole('link', { name: 'Danh mục 5' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Danh mục 4' }).getAttribute('aria-current')).toBeNull();
  });

  it('mục đang chọn nằm trên hàng: nút không active', () => {
    view('/catalog?category=C2');
    expect(screen.getByRole('button', { name: /Xem thêm/ }).className.split(' ')).not.toContain('text-brand-primary');
    expect(screen.getByRole('link', { name: 'Danh mục 2' }).getAttribute('aria-current')).toBe('page');
  });

  // Enter/Space trên <button> là hành vi gốc của trình duyệt (bắn click); kiểm trên Chromium thật ở e2e/desktop-nav-guard.cjs (keys).
  it('ArrowDown mở và vào mục đầu; panel đứng ngay sau nút theo thứ tự DOM nên Tab đi tuần tự', () => {
    view();
    const button = screen.getByRole('button', { name: /Xem thêm/ });
    button.focus();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Danh mục 4' }));
    const tabbables = [...button.closest('li')!.querySelectorAll('button, a')];
    expect(tabbables.map(e => e.textContent)).toEqual(['Xem thêm', 'Danh mục 4', 'Danh mục 5', 'Danh mục 6']);
    expect(tabbables.every(e => e.getAttribute('tabindex') === null)).toBe(true);
  });

  it('Escape đóng và trả focus về nút', () => {
    view();
    const button = screen.getByRole('button', { name: /Xem thêm/ });
    fireEvent.click(button);
    const first = screen.getByRole('link', { name: 'Danh mục 4' });
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('bấm ra ngoài, chọn mục, rời focus, đổi route: đều đóng', () => {
    function Go() { const go = useNavigate(); return <button onClick={() => go('/stores')}>sang trang khác</button>; }
    render(<MemoryRouter><MainNav items={ITEMS} /><input aria-label="ô ngoài" /><Go /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /Xem thêm/ });
    const expanded = () => button.getAttribute('aria-expanded');
    fireEvent.click(button); expect(expanded()).toBe('true');
    fireEvent.pointerDown(button); expect(expanded()).toBe('true'); // bấm chính nút không phải "ra ngoài"
    fireEvent.pointerDown(screen.getByLabelText('ô ngoài')); expect(expanded()).toBe('false');
    fireEvent.click(button); fireEvent.click(screen.getByRole('link', { name: 'Danh mục 5' })); expect(expanded()).toBe('false');
    fireEvent.click(button); act(() => screen.getByRole('link', { name: 'Danh mục 4' }).focus());
    act(() => screen.getByLabelText('ô ngoài').focus()); expect(expanded()).toBe('false');
    fireEvent.click(button); fireEvent.click(screen.getByText('sang trang khác')); expect(expanded()).toBe('false');
  });

  it('placeholder: nút cũng ẩn (giữ chỗ, không ai bấm/Tab được), cùng số mục trên hàng', () => {
    view('/', { placeholder: true });
    const button = screen.getByRole('button', { name: /Xem thêm/, hidden: true });
    expect(button.closest('li')!.className).toContain('invisible');
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(1 + 3 + 1);
  });

  // Số liệu mock: trang chủ 210, mỗi mục 100, nút 102, khoảng cách 32, padding 24+24, trừ 1px dung sai.
  // Hàng có k mục: 210 + 32 + 102 + 132k <= clientWidth - 49.
  describe('biên (bề rộng lẻ)', () => {
    it('tổng đúng bằng chỗ có: hiện đủ, không nút; thiếu 1px: có nút', () => {
      listWidth = 1051; // chỗ có = 1002 = 210 + 6 * 132
      view();
      expect(names()).toHaveLength(7);
      expect(screen.queryByRole('button', { name: /Xem thêm/ })).toBeNull();
      cleanup(); listWidth = 1050; // chỗ có 1001: thiếu 1px (bỏ dung sai -1 thì vẫn "vừa")
      view();
      expect(screen.getByRole('button', { name: /Xem thêm/ })).toBeTruthy();
      expect(names()).toHaveLength(5); // 4 mục + trang chủ (5 mục cần 1004 > 1001)
    });

    it('số mục trên hàng đổi đúng tại biên và tính cả khoảng cách trước nút', () => {
      listWidth = 657; // chỗ có 608 = 344 + 2 * 132: vừa đúng 2 mục
      view();
      expect(names()).toEqual(['BADMINTON (TRANG CHỦ)', 'Danh mục 1', 'Danh mục 2']);
      cleanup(); listWidth = 656; // thiếu 1px: 1 mục (quên một khoảng cách 32 thì vẫn ra 2)
      view();
      expect(names()).toEqual(['BADMINTON (TRANG CHỦ)', 'Danh mục 1']);
    });
  });

  describe('font đổi sau lần vẽ đầu', () => {
    it('bản đo được theo dõi từng nhãn: nhãn rộng ra thì hàng bớt mục ngay, hẹp lại thì thêm mục', () => {
      const callbacks: Array<() => void> = [];
      const observed = new Set<Element>();
      vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { callbacks.push(cb); } observe(el: Element) { observed.add(el); } disconnect() {} unobserve() {} });
      try {
        view();
        expect(names()).toHaveLength(4);
        const copyBoxes = [...nav().querySelector('div[aria-hidden="true"]')!.firstElementChild!.children];
        expect(copyBoxes.length).toBe(1 + 6 + 1);
        expect(copyBoxes.every(el => observed.has(el))).toBe(true);
        const refit = () => act(() => { callbacks.forEach(cb => cb()); });
        charW = 13; refit(); // font rộng hơn
        expect(names().length).toBeLessThan(4);
        charW = 8; refit(); // font hẹp hơn
        expect(names().length).toBeGreaterThan(4);
      } finally { vi.unstubAllGlobals(); }
    });
  });
});
