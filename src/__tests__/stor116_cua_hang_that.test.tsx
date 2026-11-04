// @vitest-environment jsdom
// STOR-122: /stores chỉ hiện một showroom thật lấy từ dữ liệu thật (getBranches, không mock).
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoreLocator from '../components/StoreLocator';
import { sportApi } from '../services/sport-api/index';

const NAME = 'TopVNSport';
const ADDRESS = 'Số 1, ngõ 141/3, phố Lê Văn Hiến, Phường Đông Ngạc, Hà Nội';
const PHONE = '097 6007006';
const DIGITS = '0976007006';
// Chuỗi giữ chỗ cũ ghép lúc chạy để git grep trên src không bắt được chính file test này.
const FORBIDDEN = [['09', '81'], ['Prem', 'ium Hub'], ['Cả', ' tuần'], ['Đức', ' Thắng'], ['Bắc Từ', ' Liêm']].map(p => p.join(''));

afterEach(cleanup);

async function renderReal() {
  const branches = await sportApi.getBranches();
  const view = render(
    <MemoryRouter>
      <StoreLocator branches={branches} products={[]} />
    </MemoryRouter>,
  );
  return { branches, ...view };
}

describe('STOR-122 /stores một showroom thật', () => {
  test('dữ liệu: đúng một chi nhánh, không lịch, không bản đồ', async () => {
    const branches = await sportApi.getBranches();
    expect(branches).toHaveLength(1);
    const [b] = branches;
    expect(b.name).toBe(NAME);
    expect(b.address).toBe(ADDRESS);
    expect(b.phone).toBe(PHONE);
    expect(b.city).toBe('Hà Nội');
    expect('schedule' in b).toBe(false);
    expect('mapEmbedUrl' in b).toBe(false);
  });

  test('render: một thẻ, không iframe, không khung bản đồ giữ chỗ', async () => {
    const { container } = await renderReal();
    expect(container.querySelectorAll('h4')).toHaveLength(1);
    expect(container.querySelector('h4')!.textContent).toBe(NAME);
    expect(container.textContent).toContain(ADDRESS);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).not.toContain('Bản đồ cửa hàng đang được cập nhật');
  });

  test('mọi tel: và mọi số giống điện thoại đều là số thật', async () => {
    const { container } = await renderReal();
    const tels = [...container.querySelectorAll('a[href^="tel:"]')].map(a => a.getAttribute('href'));
    expect(tels.length).toBeGreaterThan(0);
    for (const h of tels) expect(h).toBe(`tel:${DIGITS}`);
    const phones = container.textContent!.match(/0\d[\d.\s]{8,11}\d/g) ?? [];
    expect(phones.length).toBeGreaterThan(0);
    for (const p of phones) expect(p.replace(/\D/g, '')).toBe(DIGITS);
  });

  test('không còn chuỗi giữ chỗ cũ', async () => {
    const { container } = await renderReal();
    for (const f of FORBIDDEN) expect(container.textContent).not.toContain(f);
  });
});
