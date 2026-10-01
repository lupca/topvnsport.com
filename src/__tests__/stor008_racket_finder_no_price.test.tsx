// @vitest-environment jsdom
// STOR-008: vợt không giá + không vợt nào khớp ngân sách -> STOR-010: không gợi ý vợt ngoài tiêu chí, không được vỡ trang.
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

it('không vợt nào khớp ngân sách, vợt đầu không giá: không ném, hiện thông báo không có vợt, không gợi ý Vợt 1', async () => {
  render(<MemoryRouter><RacketFinder products={[racket('1'), racket('2', 5000000)]} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Mới Tập Chơi / Học Sinh'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  fireEvent.click(await screen.findByText('Công Thủ Toàn Diện'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  // ngân sách thấp: vợt 2 (5tr) bị loại, vợt 1 không giá bị loại -> rỗng
  fireEvent.click(await screen.findByText('Dưới 1,5 Triệu VNĐ'));
  fireEvent.click(screen.getByText(/Xem đề xuất/));
  expect(await screen.findByText(/Chưa có vợt phù hợp với tiêu chí và ngân sách bạn đã chọn/)).toBeTruthy();
  expect(screen.queryByText('Vợt 1')).toBeNull();
  expect(screen.queryByText('Liên hệ để biết giá')).toBeNull();
});
