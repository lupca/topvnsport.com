// @vitest-environment jsdom
// STOR-008: vợt không giá + không vợt nào khớp ngân sách -> lấy 3 vợt đầu, không được vỡ trang.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RacketFinder from '../components/RacketFinder';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product } from '../types';

afterEach(cleanup);

const racket = (id: string, price?: number): Product =>
  ({ id, name: `Vợt ${id}`, brand: 'B', image: '', categoryCode: RACKET_CATEGORY_CODES[0], price, specs: {}, stock: 1 } as any);

it('không vợt nào khớp ngân sách, vợt đầu không giá: không ném, hiện "Liên hệ để biết giá", không bịa số', async () => {
  render(<MemoryRouter><RacketFinder products={[racket('1'), racket('2', 5000000)]} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Mới Tập Chơi / Học Sinh'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  fireEvent.click(await screen.findByText('Công Thủ Toàn Diện'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  // ngân sách thấp: vợt 2 (5tr) bị loại, vợt 1 không giá bị loại -> rỗng -> lấy 3 vợt đầu
  fireEvent.click(await screen.findByText('Dưới 1,5 Triệu VNĐ'));
  fireEvent.click(screen.getByText(/Xem đề xuất/));
  expect(await screen.findByText('Vợt 1')).toBeTruthy();
  expect(screen.getAllByText('Liên hệ để biết giá')).toHaveLength(1);
  expect(screen.getByText('5.000.000đ')).toBeTruthy();
});
