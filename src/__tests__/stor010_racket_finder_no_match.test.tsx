// @vitest-environment jsdom
// STOR-010: không vợt nào khớp tiêu chí -> báo rõ, KHÔNG lấy vợt ngoài tiêu chí làm gợi ý.
import React from 'react';
import { it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RacketFinder from '../components/RacketFinder';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product } from '../types';

afterEach(cleanup);

const racket = (id: string, price: number): Product =>
  ({ id, name: `Vợt ${id}`, brand: 'B', image: '', categoryCode: RACKET_CATEGORY_CODES[0], price, specs: {}, stock: 1 } as any);

const NO_MATCH = 'Chưa có vợt phù hợp với tiêu chí và ngân sách bạn đã chọn. Vui lòng đổi lựa chọn và thử lại.';

async function chooseHighBudget() {
  render(<MemoryRouter><RacketFinder products={[racket('rẻ', 900000)]} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Mới Tập Chơi / Học Sinh'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  fireEvent.click(await screen.findByText('Công Thủ Toàn Diện'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  fireEvent.click(await screen.findByText(/Trên 3 Triệu VNĐ/));
  fireEvent.click(screen.getByText(/Xem đề xuất/));
}

it('ngân sách cao + chỉ có vợt 900.000đ: không có thẻ vợt, đúng câu báo, không có "Phân tích hoàn tất"', async () => {
  await chooseHighBudget();
  expect(await screen.findByText(NO_MATCH)).toBeTruthy();
  expect(screen.queryByText('Vợt rẻ')).toBeNull();
  expect(screen.queryByText(/Phân tích hoàn tất/)).toBeNull();
});

it('"Làm lại khảo sát" quay về câu hỏi 1', async () => {
  await chooseHighBudget();
  fireEvent.click(await screen.findByText('Làm lại khảo sát'));
  expect(await screen.findByText(/Câu hỏi 1/)).toBeTruthy();
});
