// @vitest-environment jsdom
// STOR-031: /stores có liên kết Chỉ đường theo địa chỉ chi nhánh; badge/icon không méo.
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import StoreLocator from '../components/StoreLocator';
import { Branch } from '../types';

function branch(id: string, address: string): Branch {
  return { id, name: `Chi nhánh ${id}`, address, phone: '0900 111 222', schedule: '8h-21h', city: 'Hà Nội' };
}
const maps = (a: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
const two = [branch('A', '1 Phố A, Hà Nội'), branch('B', '2 Phố B & C, Hà Nội')];

afterEach(cleanup);

describe('STOR-031 /stores', () => {
  test('chỉ đường theo địa chỉ', () => {
    render(<StoreLocator branches={two} products={[]} />);
    const a = screen.getByRole('link', { name: /Chỉ đường/ });
    expect(a.getAttribute('href')).toBe(maps('1 Phố A, Hà Nội'));
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  test('đổi chi nhánh đổi chỉ đường', () => {
    render(<StoreLocator branches={two} products={[]} />);
    fireEvent.click(screen.getByText('Chi nhánh B'));
    expect(screen.getByRole('link', { name: /Chỉ đường/ }).getAttribute('href')).toBe(maps('2 Phố B & C, Hà Nội'));
  });

  test.each(['', '  '])('address rỗng không có chỉ đường %j', address => {
    render(<StoreLocator branches={[branch('A', address)]} products={[]} />);
    expect(screen.queryByRole('link', { name: /Chỉ đường/ })).toBeNull();
  });

  test('badge inline-block', () => {
    render(<StoreLocator branches={two} products={[]} />);
    expect(screen.getByText(/Địa điểm Trải Nghiệm/).className.split(/\s+/)).toContain('inline-block');
  });

  test('calendar shrink-0', () => {
    const { container } = render(<StoreLocator branches={two} products={[]} />);
    const svg = container.querySelector('#store-locator-contact svg')!;
    expect(svg.getAttribute('class')).toContain('shrink-0');
  });
});
