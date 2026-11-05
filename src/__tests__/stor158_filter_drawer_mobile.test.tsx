// @vitest-environment jsdom
// STOR-158 (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): the catalog filter drawer's title, close X and 'Xem N sản phẩm' CTA
// get 14px text and 44px tap targets below md. Each guarded max-md: token is asserted on its element; removing any one
// from the source must turn this file red (docs/stor158-shots/mutate.sh), restoring it turns it green.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CatalogFilterDrawer from '../features/catalog/CatalogFilterDrawer';

function guard(el: HTMLElement | null, label: string, ...tokens: string[]) {
  expect(el, `${label} rendered`).toBeTruthy();
  const have = (el as HTMLElement).className.toString().split(/\s+/);
  for (const t of tokens) expect(have, `${label} has ${t}`).toContain(t);
}

const mount = (onClose = vi.fn()) => {
  render(<CatalogFilterDrawer resultCount={3} onClose={onClose}><p>children</p></CatalogFilterDrawer>);
  return onClose;
};

afterEach(cleanup);

describe('STOR-158 CatalogFilterDrawer mobile chrome', () => {
  it('title, close X and view CTA carry the max-md: tokens', () => {
    mount();
    guard(screen.getByText('Bộ lọc sản phẩm'), 'title', 'max-md:text-sm');
    guard(screen.getByRole('button', { name: 'Đóng' }), 'close X', 'max-md:min-w-11', 'max-md:min-h-11', 'max-md:inline-flex', 'max-md:items-center', 'max-md:justify-center');
    guard(screen.getByRole('button', { name: 'Xem 3 sản phẩm' }), 'view CTA', 'max-md:text-sm', 'max-md:min-h-11');
  });

  it('keeps dialog semantics and both buttons call onClose', () => {
    const onClose = mount();
    const dlg = screen.getByRole('dialog', { name: 'Bộ lọc sản phẩm' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem 3 sản phẩm' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
