// @vitest-environment jsdom
// STOR-148 (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): below md the checkout result pages, /stores, the 404 link and the
// whole footer (TrustBadges included) have 44px targets and >=14px text. Only `max-md:` classes are appended, so 768px and
// 1440px are unchanged (measured by docs/stor148-shots/measure.cjs). This file pins every guarded class on every element.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import { store } from '../app/store';
import CheckoutCallbackPage from '../features/checkout/CheckoutCallbackPage';
import StoreLocator from '../components/StoreLocator';
import Footer from '../components/Footer';
import { Category, Product } from '../types';

const api = vi.hoisted(() => ({
  getProducts: vi.fn().mockResolvedValue([]),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));
vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

import App from '../App';

afterEach(cleanup);

const TARGET = ['max-md:min-h-[44px]'];
const FLEX_TARGET = ['max-md:inline-flex', 'max-md:items-center', 'max-md:min-h-[44px]'];
function expectClasses(el: Element | null, classes: string[]) {
  expect(el).not.toBeNull();
  const list = (el as Element).className.split(/\s+/);
  for (const c of classes) expect(list, `${(el as Element).textContent?.slice(0, 30)} needs ${c}`).toContain(c);
}

describe('STOR-148 checkout result pages', () => {
  it.each(['success', 'error', 'cancel'] as const)('%s: button >=44px and 14px, order box 14px', (status) => {
    render(<MemoryRouter initialEntries={['/x?order=AUDIT-0001']}><CheckoutCallbackPage status={status} /></MemoryRouter>);
    expectClasses(screen.getByRole('button'), [...TARGET, 'max-md:text-sm']);
    expectClasses(screen.getByText(/Mã đơn hàng:/).closest('div'), ['max-md:text-sm']);
  });
});

describe('STOR-148 /stores', () => {
  const b = { id: 'A', name: 'Chi nhánh A', address: '1 Phố A', phone: '0900 111 222', schedule: '8h-21h', city: 'Hà Nội' };
  it('targets >=44px and text 14px below md', () => {
    render(<StoreLocator branches={[b]} products={[]} />);
    expectClasses(screen.getByRole('link', { name: /Chỉ đường/ }), [...TARGET, 'max-md:text-sm']);
    expectClasses(screen.getByRole('link', { name: /Gọi điện:/ }), [...TARGET, 'max-md:text-sm']);
    expectClasses(screen.getByRole('link', { name: '0900 111 222' }), [...TARGET, 'max-md:text-sm']);
    const badge = screen.getByText(/Địa điểm Trải Nghiệm/);
    expectClasses(badge, ['inline-block', 'max-md:text-sm']);
    expectClasses(screen.getByText('Bản doanh căng cước và thử vợt'), ['max-md:text-sm']);
    expectClasses(screen.getByText('Hà Nội'), ['max-md:text-sm']);
    expectClasses(screen.getByText('1 Phố A'), ['max-md:text-sm']);
    expectClasses(screen.getByText('8h-21h').parentElement, ['max-md:text-[14px]']);
    expectClasses(screen.getByText('ĐANG CHỌN TRẢI NGHIỆM'), ['max-md:text-[14px]']);
    expectClasses(screen.getByText(/Gọi điện cho chi nhánh/), ['max-md:text-sm']);
  });
});

describe('STOR-148 footer + TrustBadges', () => {
  const cat = (id: number, code: string, name: string): Category => ({ id, code, name, parent_id: null, display_name: `Thể Thao > Cầu Lông > ${name}` });
  const CATS = [cat(1491, 'VC001491', 'Vợt Cầu Lông'), cat(1427, 'VC001427', 'Giày Cầu Lông')];
  const PRODUCTS: Product[] = CATS.map(c => ({ id: c.code, name: 'Sản phẩm', brand: 'Yonex', image: '', categoryCode: c.code, price: 500000, specs: {}, description: '', stock: 1 }));
  it('every footer link is a 44px flex target, every TEXT block and trust description is 14px below md', () => {
    const { container } = render(<MemoryRouter><Footer categories={CATS} products={PRODUCTS} /></MemoryRouter>);
    const footer = container.querySelector('#topvnsport-footer') as HTMLElement;
    const links = within(footer).getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(6); // hotline, Shopee, /stores, 2 categories, stringing
    for (const a of links) expectClasses(a, [...FLEX_TARGET, 'max-md:text-[14px]']);
    const blocks = footer.querySelectorAll('section:not([data-testid=trust-row]) p, section:not([data-testid=trust-row]) ul');
    expect(blocks.length).toBe(7); // 5 <p> in column 1, 2 <ul>
    for (const el of blocks) expectClasses(el, ['max-md:text-[14px]']);
    const trust = footer.querySelectorAll('[data-testid=trust-row] p');
    expect(trust.length).toBe(4);
    for (const p of trust) expectClasses(p, ['max-md:text-[14px]']);
  });
});

describe('STOR-148 404', () => {
  it('"Về trang chủ" is a 44px flex target below md', async () => {
    render(<Provider store={store}><MemoryRouter initialEntries={['/khong-ton-tai']}><App /></MemoryRouter></Provider>);
    await waitFor(() => expect(screen.getByText('Không tìm thấy trang')).toBeInTheDocument());
    expectClasses(screen.getByRole('link', { name: 'Về trang chủ' }), ['inline-block', ...FLEX_TARGET]);
  });
});
