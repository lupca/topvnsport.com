// @vitest-environment jsdom
// STOR-068: Mobile header row fits at 320, 360 and 375px, including a two-digit cart count
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import Header from '../components/Header';
import { Category, Product } from '../types';

const categories: Category[] = [
  { id: 1, name: 'racket', code: 'racket', parent_id: null, display_name: 'Vợt Cầu Lông' },
];

const products: Product[] = [];

function setupHeader(cartCount = 12) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header
        cartCount={cartCount}
        openCart={vi.fn()}
        products={products}
        categories={categories}
      />
    </MemoryRouter>
  );
}

function getMobileRowElements(container: HTMLElement) {
  const danCuocBtn = screen.getByRole('button', { name: 'Đan cước' });
  const mobileRow = (danCuocBtn.parentElement ?? container.querySelector('.md\\:hidden.flex')) as HTMLElement;
  expect(mobileRow).not.toBeNull();

  const hamburger = mobileRow.querySelector('button[aria-label="Open mobile menu"]') as HTMLElement;
  const cartPills = screen.getAllByRole('button', { name: 'Giỏ hàng' });
  const mobileCartPill = cartPills.find(b => b.textContent?.includes('Giỏ (')) as HTMLElement;
  const wordmark = Array.from(mobileRow.querySelectorAll('div')).find(
    d => d.textContent?.trim() === 'TOPVNSPORT'
  ) as HTMLElement;

  return { mobileRow, hamburger, danCuocBtn, mobileCartPill, wordmark };
}

beforeEach(() => {
  window.innerWidth = 360;
  window.innerHeight = 800;
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('STOR-068: Mobile header row fits viewport and guards class tokens', () => {
  it('F1: mobile wordmark includes min-w-0 class token', () => {
    const { container } = setupHeader(12);
    const { wordmark } = getMobileRowElements(container);
    expect(wordmark).toBeDefined();
    expect(wordmark.classList.contains('min-w-0')).toBe(true);
  });

  it('F2: mobile wordmark includes truncate class token', () => {
    const { container } = setupHeader(12);
    const { wordmark } = getMobileRowElements(container);
    expect(wordmark).toBeDefined();
    expect(wordmark.classList.contains('truncate')).toBe(true);
  });

  it('F3: mobile wordmark excludes shrink-0 class token', () => {
    const { container } = setupHeader(12);
    const { wordmark } = getMobileRowElements(container);
    expect(wordmark).toBeDefined();
    expect(wordmark.classList.contains('shrink-0')).toBe(false);
  });

  it('F4: mobile controls (hamburger, Đan cước, cart pill) retain shrink-0', () => {
    const { container } = setupHeader(12);
    const { hamburger, danCuocBtn, mobileCartPill } = getMobileRowElements(container);
    expect(hamburger).toBeDefined();
    expect(hamburger.classList.contains('shrink-0')).toBe(true);

    expect(danCuocBtn).toBeDefined();
    expect(danCuocBtn.classList.contains('shrink-0')).toBe(true);

    expect(mobileCartPill).toBeDefined();
    expect(mobileCartPill.classList.contains('shrink-0')).toBe(true);
  });
});
