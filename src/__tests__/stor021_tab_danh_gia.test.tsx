// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ProductDetailTabs from '../components/product-detail/ProductDetailTabs';
import { Product } from '../types';

const rv = (over: object = {}) => ({ author: 'An', date: '01/10/2026', rating: 4, comment: 'Vợt tốt', ...over });
const mk = (reviews: object[]): Product =>
  ({ id: 'p', name: 'Vợt', image: '', price: 1, specs: {}, reviews, stock: 1, categoryCode: 'VC001491' } as unknown as Product);
const show = (reviews: object[]) =>
  render(<ProductDetailTabs product={mk(reviews)} isRacket={true} activeTab="reviews" onTabChange={vi.fn()} />);

describe('STOR-021 tab đánh giá', () => {
  afterEach(() => cleanup());

  it('không câu cam kết khi 0 đánh giá', () => {
    show([]);
    expect(screen.queryByText(/100%/)).toBeNull();
    expect(screen.queryByText(/kiểm chứng mua hàng/)).toBeNull();
    expect(screen.queryByText(/khách hàng thực tế/)).toBeNull();
  });

  it('empty-state chỉ câu thật', () => {
    show([]);
    expect(screen.getByText('Chưa có đánh giá nào cho cây vợt này.')).toBeTruthy();
    expect(screen.queryByText(/người đầu tiên/)).toBeNull();
  });

  it('thiếu avatar không render img', () => {
    const { container } = show([rv()]);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('unsplash');
  });

  it('có avatar render img đúng src', () => {
    const { container } = show([rv({ avatar: 'https://x.test/a.png' })]);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x.test/a.png');
  });

  it('nhãn đã mua theo verified', () => {
    show([rv({ verified: true })]);
    expect(screen.getByText(/Đã mua hàng tại TopVNSport/)).toBeTruthy();
    cleanup();
    show([rv({ verified: false })]);
    expect(screen.queryByText(/Đã mua hàng tại TopVNSport/)).toBeNull();
  });
});
