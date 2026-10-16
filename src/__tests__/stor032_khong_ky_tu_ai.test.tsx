// @vitest-environment jsdom
// STOR-032: không biểu tượng/ký tự trang trí kiểu AI (Sparkles, ✨✦✧, emoji), không nhãn "AI" cho tính năng lọc theo luật.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../features/home/HomePage';
import RacketFinder from '../components/RacketFinder';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import MobileBottomNav from '../features/navigation/MobileBottomNav';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

afterEach(cleanup);

const SRC = join(process.cwd(), 'src');
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__tests__') return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const files = walk(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const hits = (re: RegExp) => files.flatMap((f) => f.text.split('\n').filter((l) => re.test(l)).map((l) => `${f.path.replace(SRC, 'src')}: ${l.trim()}`));

describe('STOR-032 nguồn không có ký tự AI', () => {
  it('không tệp nào dùng Sparkles', () => {
    expect(hits(/\bSparkles\b/)).toEqual([]);
  });
  it('không có ký tự ✦ ✧ ✨ (U+2726-2728)', () => {
    expect(hits(/[✦-✨]/)).toEqual([]);
  });
  it('không có emoji pictograph U+1F300-1FAFF', () => {
    expect(hits(/[\u{1F300}-\u{1FAFF}]/u)).toEqual([]);
  });
  it('ký tự U+2600-27BF chỉ còn ở nhãn "✓ Đã mua hàng tại TopVNSport" của ProductDetailTabs (U+2713)', () => {
    const all = hits(/[☀-➿]/);
    expect(all).toHaveLength(1);
    expect(all[0]).toContain('ProductDetailTabs.tsx');
    expect(all[0]).toContain('✓ Đã mua hàng tại TopVNSport');
  });
  it('nút Xác nhận đặt hàng không có ✓', () => {
    const cart = files.find((f) => f.path.endsWith('components/CartModal.tsx'))!;
    expect(cart.text).toContain("'Xác nhận đặt hàng'");
    expect(cart.text).not.toContain('Xác nhận đặt hàng ✓');
  });
});

describe('STOR-032 giao diện không có icon Sparkles', () => {
  const noSparkles = (c: HTMLElement) => expect(c.querySelectorAll('svg.lucide-sparkles').length).toBe(0);

  it('MobileBottomNav: nhãn "Chọn vợt", không chữ AI, mỗi nút đúng một svg, không sparkles', () => {
    const { container, getByText, queryByText } = render(
      <MobileBottomNav pathname="/" navigate={vi.fn() as any} cartCount={0} onOpenCart={vi.fn()} />
    );
    expect(getByText('Chọn vợt')).toBeTruthy();
    expect(queryByText(/\bAI\b/)).toBeNull();
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => expect(b.querySelectorAll('svg').length).toBe(1));
    noSparkles(container);
  });

  it('HomePage không sparkles', () => {
    const store = configureStore({
      reducer: { appData: (state = { products: [{ id: '1', name: 'SP 1', brand: 'B', image: '', price: 100000, specs: {}, stock: 1, reviews: [], categoryCode: 'c1' }], blogs: [], categories: [{ id: 1, name: 'Cầu Lông', code: 'c1', parent_id: null, display_name: 'Thể Thao > Cầu Lông' }] }) => state, cart: cartReducer, catalog: catalogReducer },
    } as any);
    const { container } = render(<Provider store={store}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
    expect(container.textContent).toContain('Danh mục trang thiết bị cầu lông');
    noSparkles(container);
  });

  it('RacketFinder không sparkles', () => {
    const { container } = render(<MemoryRouter><RacketFinder products={[]} /></MemoryRouter>);
    expect(container.textContent).toContain('Trình cố vấn ảo chọn vợt thông minh');
    noSparkles(container);
  });

  it('RacketFinder: dòng thành công bắt đầu bằng "Phân tích hoàn tất!" không có ✓ đứng đầu', async () => {
    const racket = { id: 'r', name: 'Vợt r', brand: 'B', image: '', categoryCode: RACKET_CATEGORY_CODES[0], price: 900000, specs: {}, stock: 1 } as any;
    render(<MemoryRouter><RacketFinder products={[racket]} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Mới Tập Chơi / Học Sinh'));
    fireEvent.click(screen.getByText(/Tiếp tục/));
    fireEvent.click(await screen.findByText('Công Thủ Toàn Diện'));
    fireEvent.click(screen.getByText(/Tiếp tục/));
    fireEvent.click(await screen.findByText(/Dưới .* Triệu/));
    fireEvent.click(screen.getByText(/Xem đề xuất/));
    const line = await screen.findByText(/Phân tích hoàn tất/);
    expect(line.textContent!.startsWith('Phân tích hoàn tất!')).toBe(true);
  });

  it('StringingAssistant (đang bật đan) không sparkles', () => {
    const noop = () => {};
    const product = {
      id: 'r1', name: 'Vợt', brand: 'B', price: 1, image: '', specs: {}, description: '', reviews: [], stock: 5,
      tier_variations: [{ tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'Exbolt 65'] }],
      variants: [{ tier_1_option: '', tier_2_option: 'Exbolt 65', sku_code: 'S2', stock: 5, price: 1 }],
    } as unknown as Product;
    const { container } = render(
      <StringingAssistant
        product={product} hasStringingVariation
        stringingVariation={{ tier_index: 2, name: 'Loại Cước', options: ['Khung không dây', 'Exbolt 65'] }} stringingTierIndex={2}
        isDynamicStringingActive activeStringValue="" selectedTier1="" selectedTier2="" stringOptions={[]} tension={10.5}
        onSetSelectedTier1={noop} onSetSelectedTier2={noop} onSetTension={noop}
      />
    );
    expect(container.textContent).toContain('Dịch vụ đan cước chuyên nghiệp');
    expect(container.textContent).toContain('Mức căng');
    noSparkles(container);
  });
});
