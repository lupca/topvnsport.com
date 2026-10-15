// @vitest-environment jsdom
// STOR-026: kết quả RacketFinder gọn trên mobile; mô tả ngân sách không in tên thương hiệu; dải ngân sách khớp nhãn.
import React from 'react';
import { it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RacketFinder from '../components/RacketFinder';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product } from '../types';

afterEach(cleanup);

const racket = (price: number): Product =>
  ({ id: `p${price}`, name: `Vợt ${price}`, brand: 'B', image: '', categoryCode: RACKET_CATEGORY_CODES[0], price, specs: {}, stock: 1 } as any);

const PRODUCTS = [1200000, 1499999, 1500000, 3000000, 3000001].map(racket);

async function toBudgetStep() {
  render(<MemoryRouter><RacketFinder products={PRODUCTS} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Mới Tập Chơi / Học Sinh'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  fireEvent.click(await screen.findByText('Công Thủ Toàn Diện'));
  fireEvent.click(screen.getByText(/Tiếp tục/));
  await screen.findByText(/Câu hỏi 3/);
}

async function results(budgetTitle: RegExp) {
  await toBudgetStep();
  fireEvent.click(screen.getByText(budgetTitle));
  fireEvent.click(screen.getByText(/Xem đề xuất/));
  await screen.findByText(/Làm lại khảo sát/);
}

const LOW = /Dưới 1,5 Triệu/, MID = /Từ 1,5 - 3 Triệu/, HIGH = /Trên 3 Triệu/;
const has = (price: number) => screen.queryByAltText(`Vợt ${price}`) !== null;

it('mobile: khung ảnh w-20 h-20', async () => {
  await results(MID);
  const frame = screen.getAllByRole('img')[0].parentElement!;
  expect(frame.classList.contains('w-20')).toBe(true);
  expect(frame.classList.contains('h-20')).toBe(true);
  expect(frame.classList.contains('md:aspect-square')).toBe(true);
  expect(frame.classList.contains('aspect-square')).toBe(false);
});

it('mobile: thẻ flex-row', async () => {
  await results(MID);
  const card = screen.getAllByRole('img')[0].closest('[class*="cursor-pointer"]')!;
  expect(card.classList.contains('flex-row')).toBe(true);
  expect(card.classList.contains('md:flex-col')).toBe(true);
});

it('desktop: lưới md:grid-cols-3', async () => {
  await results(MID);
  const grid = screen.getAllByRole('img')[0].closest('[class*="cursor-pointer"]')!.parentElement!;
  expect(grid.classList.contains('md:grid-cols-3')).toBe(true);
});

it('ngân sách: không tên thương hiệu', async () => {
  await toBudgetStep();
  expect(screen.queryByText(/Kumpoo|VNB|Apacs|Yonex|Lining/)).toBeNull();
});

it('medium: 1.200.000 không khớp', async () => {
  await results(MID);
  expect(has(1200000)).toBe(false);
  expect(has(1499999)).toBe(false);
});

it('medium: 1.500.000 khớp', async () => {
  await results(MID);
  expect(has(1500000)).toBe(true);
  expect(has(3000000)).toBe(true);
});

it('low: 1.500.000 không khớp', async () => {
  await results(LOW);
  expect(has(1499999)).toBe(true);
  expect(has(1500000)).toBe(false);
});

it('high: 3.000.000 không khớp', async () => {
  await results(HIGH);
  expect(has(3000000)).toBe(false);
  expect(has(3000001)).toBe(true);
});
