// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import StoreLocator from '../components/StoreLocator';
import { Branch } from '../types';

// STOR-014: /stores không có form đặt lịch giả; liên hệ lấy từ Branch.phone của chi nhánh đang chọn.
function branch(id: string, phone: string): Branch {
  return { id, name: `Chi nhánh ${id}`, address: 'Địa chỉ', phone, schedule: '8h-21h', city: 'Hà Nội' };
}
const two = [branch('A', '0900 111 222'), branch('B', '0900 333 444')];

afterEach(cleanup);

describe('STOR-014 không đặt lịch giả', () => {
  test('không có form', () => {
    const { container } = render(<StoreLocator branches={two} products={[]} />);
    expect(container.querySelector('form')).toBeNull();
    for (const t of ['Xác nhận đặt lịch', 'THÀNH CÔNG', '10 phút', 'Đặt lịch trải nghiệm miễn phí']) {
      expect(container.textContent).not.toContain(t);
    }
  });

  test('tel', () => {
    const { container } = render(<StoreLocator branches={two} products={[]} />);
    const box = container.querySelector('#store-locator-contact')!;
    expect(box.textContent).toContain('0900 111 222');
    expect(box.querySelector('a')!.getAttribute('href')).toBe('tel:0900 111 222');
  });

  test.each(['', '  '])('phone rỗng %j', phone => {
    const { container } = render(<StoreLocator branches={[branch('A', phone)]} products={[]} />);
    expect(container.querySelector('#store-locator-contact')).toBeNull();
  });

  test('đổi chi nhánh', () => {
    const { container } = render(<StoreLocator branches={two} products={[]} />);
    fireEvent.click(screen.getByText('Chi nhánh B'));
    expect(container.querySelector('#store-locator-contact')!.textContent).toContain('0900 333 444');
  });
});
