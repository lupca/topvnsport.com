// STOR-134 (MOB-A/MOB-E): dưới md danh sách gợi ý tìm kiếm nằm dưới hàng dính (giỏ/Đan cước/logo vẫn bấm được);
// mục danh mục đang chọn được cuộn ngang vào tầm nhìn của thanh 1 hàng. jsdom không có layout nên kiểm class
// z-index và giá trị scrollLeft được gán; số đo thật đo bằng Playwright.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Header from '../components/Header';
import MainNav from '../components/MainNav';
import { Category, Product } from '../types';

const products = [{ id: '1', name: 'Vot Yonex 1', brand: 'Yonex', image: '', price: 1500000, specs: {}, description: '', stock: 5, categoryCode: 'racket' } as Product];
const categories: Category[] = [{ id: 1, name: 'racket', code: 'racket', parent_id: null, display_name: 'Vợt Cầu Lông' }];

const cls = (el: Element | null) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

describe('STOR-134 gợi ý tìm kiếm không che hàng dính dưới md', () => {
  it('dropdown z-[45] dưới md (thấp hơn z-50 của hàng dính), md:z-50 giữ nguyên desktop', () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <Header cartCount={2} openCart={vi.fn()} products={products} categories={categories} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('Tìm vợt Yonex, Lining, cước đan, giày cầu lông...'), { target: { value: 'vot' } });
    const dropdown = screen.getByText('Kết quả tìm kiếm phù hợp').parentElement!;
    expect(cls(dropdown)).toEqual(expect.arrayContaining(['absolute', 'z-[45]', 'md:z-50']));
    expect(cls(dropdown)).not.toContain('z-50');
    expect(cls(screen.getByTestId('mobile-sticky-bar'))).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-50']));
  });
});

const ITEMS = ['a', 'b', 'c', 'd', 'e', 'f'].map(code => ({ code, label: `NGANH ${code.toUpperCase()}` }));

// Giả layout: <ul> rộng 390 tại left 0; mục đang chọn ở left 900 rộng 120.
const fakeLayout = () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = this.tagName === 'UL' ? { left: 0, width: 390 } : { left: 900, width: 120 };
    return { ...box, top: 0, height: 40, right: box.left + box.width, bottom: 40, x: box.left, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  const setLeft = vi.spyOn(Element.prototype, 'scrollLeft', 'set');
  setLeft.mockClear();
  vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(0);
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  return { setLeft, scrollTo, scrollIntoView };
};

const renderNav = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MainNav items={ITEMS} />
    </MemoryRouter>
  );

describe('STOR-134 thanh danh mục 1 hàng cuộn mục đang chọn vào tầm nhìn', () => {
  it('ngành cuối đang chọn: scrollLeft của <ul> được đặt để mục nằm giữa; không cuộn trang', () => {
    const { setLeft, scrollTo, scrollIntoView } = fakeLayout();
    renderNav('/catalog?category=f');
    expect(screen.getByRole('link', { name: 'NGANH F' }).getAttribute('aria-current')).toBe('page');
    // 0 + (900 - 0) - (390 - 120) / 2 = 765
    expect(setLeft).toHaveBeenCalledWith(765);
    expect(setLeft.mock.contexts.every(el => (el as Element).tagName === 'UL')).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('không có mục đang chọn (/stores): không cuộn', () => {
    const { setLeft } = fakeLayout();
    renderNav('/stores');
    expect(setLeft).not.toHaveBeenCalled();
  });
});
