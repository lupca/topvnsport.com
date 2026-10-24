// @vitest-environment jsdom
// STOR-044: /checkout/success không khẳng định "đã xác nhận thanh toán" (storefront chưa hỏi OMS);
// mã đơn hiện đúng, không có mã thì không bịa; mã dài được break-all để không tràn 390px.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import CheckoutCallbackPage from '../features/checkout/CheckoutCallbackPage';

afterEach(cleanup);

function mount(url: string) {
  const { container } = render(
    <MemoryRouter initialEntries={[url]}>
      <CheckoutCallbackPage status="success" />
    </MemoryRouter>
  );
  return container;
}

describe('STOR-044 trang success', () => {
  it('không tham số: không khẳng định đã xác nhận thanh toán, không hiện mã', () => {
    const c = mount('/checkout/success');
    expect(c.textContent).not.toMatch(/đã xác nhận thanh toán/i);
    expect(c.textContent).toContain('Cửa hàng sẽ xác nhận khi nhận được thanh toán qua SePay');
    expect(c.textContent).not.toContain('Mã đơn hàng');
  });

  it('?order=ABC: hiện đúng mã, vẫn không khẳng định đã xác nhận', () => {
    const c = mount('/checkout/success?order=ABC');
    expect(c.textContent).not.toMatch(/đã xác nhận thanh toán/i);
    expect(c.textContent).toContain('Đã nhận đơn hàng ABC.');
    expect(screen.getByText('ABC').tagName).toBe('STRONG');
  });

  it('?order dài 300 ký tự: hiện đủ mã và có break-all', () => {
    const long = 'DH' + 'X'.repeat(298);
    const c = mount(`/checkout/success?order=${long}`);
    expect(c.textContent).not.toMatch(/đã xác nhận thanh toán/i);
    const strong = screen.getByText(long);
    expect(strong.textContent).toHaveLength(300);
    expect(strong.closest('.break-all')).not.toBeNull();
  });
});
