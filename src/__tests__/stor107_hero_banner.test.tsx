// @vitest-environment jsdom
// STOR-107: hero = banner theo cấu hình (src/config/heroBanners.json): trượt 500ms, vuốt, dừng/hover, reduced-motion.
// Mỗi it() gác một nhánh; kiểm đột biến: docs/stor107-shots/mutation-log.txt (r:7f8cd4dc).
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { existsSync, readFileSync, statSync } from 'node:fs';
import HomePage from '../features/home/HomePage';
import HeroBanner from '../features/home/HeroBanner';
import { parseHeroBanners } from '../features/home/heroBanners';
import cartReducer from '../features/cart/cartSlice';
import catalogReducer from '../features/catalog/catalogSlice';
import { STRINGING_CTA_PATH } from '../config/storefront';

// Đọc JSON qua getter để từng test thay cấu hình (thêm 1 banner, cấu hình sai) mà không đổi code.
const cfg = vi.hoisted(() => ({ override: undefined as unknown }));
vi.mock('../config/heroBanners.json', async importOriginal => {
  const real = (await importOriginal()) as { default: unknown };
  return { get default() { return cfg.override ?? real.default; } };
});

const REAL = JSON.parse(readFileSync('src/config/heroBanners.json', 'utf8')) as any[];
const COUNT = REAL.length;
const entry = (over: Record<string, unknown> = {}) => ({ ...structuredClone(REAL[0]), ...over });

const realMatchMedia = window.matchMedia; // test-setup có thể đã gắn bản giả (STOR-106): trả lại đúng bản đó
beforeEach(() => { cfg.override = undefined; });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.matchMedia = realMatchMedia;
});

const renderBanner = () => render(<MemoryRouter><HeroBanner /></MemoryRouter>);
const slides = () => screen.getAllByTestId('hero-banner');
const dots = () => Array.from(screen.getByTestId('slider-dots').querySelectorAll('button'));
const activeIndex = () => dots().findIndex(d => d.getAttribute('aria-current') === 'true');
const tokens = (el: Element) => el.className.toString().split(/\s+/);
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const swipe = (dx: number, dy = 0) => {
  const box = screen.getByTestId('hero-banner-box');
  fireEvent.touchStart(box, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(box, { changedTouches: [{ clientX: 200 + dx, clientY: 100 + dy }] });
};
const prod = (id: string) => ({ id, name: `Vợt Test ${id}`, brand: 'Yonex', image: `https://pim.voma.vn/media/${id}.jpg`, price: 3500000, specs: {}, stock: 5, categoryCode: 'c1' }) as any;

function renderHome() {
  const store = configureStore({ reducer: { appData: (s = { products: [prod('1')], categories: [] }) => s, cart: cartReducer, catalog: catalogReducer } });
  return render(<Provider store={store}><MemoryRouter><HomePage /></MemoryRouter></Provider>);
}

describe('STOR-107 cấu hình và parser', () => {
  it('heroBanners.json có ít nhất 3 banner, mỗi banner đủ headline, subline, cta, image', () => {
    const banners = parseHeroBanners(REAL);
    expect(banners.length).toBeGreaterThanOrEqual(3);
    for (const b of banners) expect([b.headline, b.subline, b.cta.label, b.cta.href, b.image.src, b.image.alt].every(Boolean)).toBe(true);
  });

  it.each([
    ['headline', (b: any) => delete b.headline], ['subline', (b: any) => delete b.subline],
    ['cta', (b: any) => delete b.cta], ['cta.label', (b: any) => delete b.cta.label], ['cta.href', (b: any) => delete b.cta.href],
    ['image', (b: any) => delete b.image], ['image.src', (b: any) => delete b.image.src], ['image.alt', (b: any) => delete b.image.alt],
    ['headline rỗng', (b: any) => { b.headline = '   '; }],
  ])('parser ném lỗi khi banner thiếu %s, thông báo nêu chỉ số', (_, mutate) => {
    const bad = entry();
    mutate(bad);
    expect(() => parseHeroBanners([REAL[0], bad])).toThrow(/banners\[1\]/);
  });

  it('parser ném lỗi khi danh sách rỗng hoặc không phải mảng', () => {
    for (const bad of [[], { banners: REAL }, null]) expect(() => parseHeroBanners(bad)).toThrow(/mảng có ít nhất 1 banner/);
  });

  it.each(['https://shopvnb.com/x', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', 'tel:abc', 'catalog'])('parser ném lỗi với cta.href ngoài site: %s', href => {
    expect(() => parseHeroBanners([entry({ cta: { label: 'Đi', href } })])).toThrow(/cta\.href/);
  });

  it.each(['https://pim.voma.vn/media/a.jpg', '/img/a.webp', '/banners/../a.webp', '/banners/a.gif'])('parser ném lỗi với image.src ngoài /banners/: %s', src => {
    expect(() => parseHeroBanners([entry({ image: { src, alt: 'Ảnh' } })])).toThrow(/image\.src/);
  });

  it('mọi ảnh banner có file trong public/banners/ và nặng tối đa 200KB', () => {
    for (const b of parseHeroBanners(REAL)) {
      const file = `public${b.image.src}`;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThanOrEqual(200_000);
    }
  });

  it('chữ banner không nêu đối thủ hay hãng nào ngoài Yonex Sunrise; không hứa đặt lịch online; CTA đan vợt đi /stores hoặc STRINGING_CTA_PATH', () => {
    const text = JSON.stringify(REAL.map(({ headline, subline, cta, image }) => [headline, subline, cta.label, image.alt]));
    expect(text).not.toMatch(/li-?ning|victor|kizuna|shopvnb|yonexshop|✨|đặt lịch|xác nhận/i);
    for (const m of text.matchAll(/yonex/gi)) expect(text.slice(m.index, m.index! + 13)).toBe('Yonex Sunrise');
    expect(JSON.stringify(REAL)).not.toContain('images.unsplash.com');
    const stringing = REAL.filter(b => /đan vợt|showroom/i.test(b.headline + b.subline));
    expect(stringing.length).toBeGreaterThan(0);
    for (const b of stringing) expect([STRINGING_CTA_PATH, '/stores']).toContain(b.cta.href);
  });
});

describe('STOR-107 hero trên trang chủ', () => {
  it('Home render đúng một hero-banner cho mỗi mục cấu hình, không BadmintonCenterSlider, không tên sản phẩm / giá / "Xem chi tiết"', () => {
    renderHome();
    expect(slides()).toHaveLength(COUNT);
    expect(screen.queryByTestId('badminton-center-slider')).toBeNull();
    expect(screen.queryByTestId('slider-cta')).toBeNull();
    expect(existsSync('src/features/home/BadmintonCenterSlider.tsx')).toBe(false);
    expect(readFileSync('src/features/home/HomePage.tsx', 'utf8')).not.toContain('BadmintonCenterSlider');
    expect(screen.getByTestId('hero-banner-section').textContent).not.toMatch(/Vợt Test|\d[\d.]*đ|Xem chi tiết/);
  });

  it('thêm một mục cấu hình thì thêm đúng một banner và một dot, không đổi code', () => {
    cfg.override = [...REAL, entry({ headline: 'Banner thêm vào' })];
    renderBanner();
    expect(slides()).toHaveLength(COUNT + 1);
    expect(dots()).toHaveLength(COUNT + 1);
    expect(screen.getByText('Banner thêm vào')).toBeTruthy();
  });

  it('mỗi banner có đúng một headline, một subline, một CTA link và một ảnh', () => {
    renderBanner();
    for (const [i, s] of slides().entries()) {
      expect(s.querySelectorAll('h2')).toHaveLength(1);
      expect(s.querySelectorAll('p')).toHaveLength(1);
      expect(s.querySelectorAll('a')).toHaveLength(1);
      expect(s.querySelectorAll('img')).toHaveLength(1);
      expect(s.querySelector('a')!.getAttribute('href')).toBe(REAL[i].cta.href);
      expect(s.querySelector('img')!.getAttribute('alt')).toBe(REAL[i].image.alt);
    }
  });

  it('SEO 13/11: ảnh banner 1 tải ngay (fetchpriority=high, srcset); banner sau chỉ tải khi banner 1 xong và là banner kế tiếp', () => {
    for (const b of REAL) expect(existsSync(`public${b.image.src.replace(/\.webp$/, '-640.webp')}`), b.image.src).toBe(true);
    renderBanner();
    const imgs = () => slides().map(s => s.querySelector('img')!);
    expect(imgs()[0].getAttribute('src')).toBe(REAL[0].image.src);
    expect(imgs()[0].getAttribute('fetchpriority')).toBe('high');
    expect(imgs()[0].getAttribute('srcset')).toBe(`${REAL[0].image.src.replace(/\.webp$/, '-640.webp')} 640w, ${REAL[0].image.src} 1024w`);
    expect(imgs().slice(1).map(i => i.getAttribute('src'))).toEqual(REAL.slice(1).map(() => null));
    fireEvent.load(imgs()[0]);
    expect(imgs().map(i => i.getAttribute('src'))).toEqual(REAL.map((b, i) => (i <= 1 ? b.image.src : null)));
    fireEvent.click(dots()[2]);
    expect(imgs().map(i => i.getAttribute('src'))).toEqual(REAL.map((b, i) => (i <= 3 ? b.image.src : null)));
  });

  it('cấu hình sai: role=alert trong ô hero + console.error, không banner, không dot, không banner mặc định', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    cfg.override = [];
    renderHome();
    const hero = screen.getByTestId('hero-banner-section');
    expect(within(hero).getByRole('alert').textContent).toMatch(/banner/i);
    expect(screen.queryAllByTestId('hero-banner')).toHaveLength(0);
    expect(screen.queryByTestId('slider-dots')).toBeNull();
    expect(err.mock.calls.some(c => String(c[0]).includes('heroBanners.json'))).toBe(true);
  });

  it('chỉ banner đang hiện được lộ ra cho trình đọc màn hình (các banner còn lại aria-hidden)', () => {
    renderBanner();
    fireEvent.click(dots()[1]);
    expect(slides().map(s => s.getAttribute('aria-hidden'))).toEqual(slides().map((_, i) => (i === 1 ? 'false' : 'true')));
  });
});

describe('STOR-107 chuyển slide, khung cố định, vuốt', () => {
  it('track trượt 500ms có easing (duration-500 ease-out) bằng translateX theo chỉ số', () => {
    renderBanner();
    const track = screen.getByTestId('hero-banner-track');
    expect(tokens(track)).toEqual(expect.arrayContaining(['transition-transform', 'duration-500', 'ease-out']));
    expect(track.style.transform).toBe('translateX(-0%)');
    fireEvent.click(dots()[2]);
    expect(track.style.transform).toBe('translateX(-200%)');
  });

  it('khung hero cố định: cao 280-300px ở 390px, không đổi class khi đổi slide', () => {
    renderBanner();
    const box = screen.getByTestId('hero-banner-box');
    const px = Number(/max-md:h-\[(\d+)px\]/.exec(box.className)?.[1]);
    expect(px).toBeGreaterThanOrEqual(280);
    expect(px).toBeLessThanOrEqual(300);
    expect(tokens(box)).toEqual(expect.arrayContaining(['md:aspect-[1440/520]', 'overflow-hidden']));
    const before = box.className;
    for (let i = 0; i < COUNT; i++) {
      fireEvent.click(dots()[i]);
      expect(box.className).toBe(before);
    }
  });

  it('vuốt trái/phải >= 40px đổi banner; dưới 40px hoặc chủ yếu theo chiều dọc thì không đổi', () => {
    renderBanner();
    swipe(-39);
    expect(activeIndex()).toBe(0);
    swipe(39);
    expect(activeIndex()).toBe(0);
    swipe(-60, 80);
    expect(activeIndex()).toBe(0);
    swipe(-40);
    expect(activeIndex()).toBe(1);
    swipe(40);
    expect(activeIndex()).toBe(0);
    swipe(60);
    expect(activeIndex()).toBe(COUNT - 1);
  });
});

describe('STOR-107 autoplay, hover, nút dừng, dots, reduced-motion', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('autoplay chuyển banner sau 5000ms và quay vòng', () => {
    renderBanner();
    tick(4999);
    expect(activeIndex()).toBe(0);
    tick(1);
    expect(activeIndex()).toBe(1);
    for (let i = 1; i < COUNT; i++) tick(5000);
    expect(activeIndex()).toBe(0);
  });

  it('autoplay dừng khi trỏ chuột đang ở trên hero, chạy lại khi rời đi', () => {
    renderBanner();
    const hero = screen.getByTestId('hero-banner-section');
    fireEvent.mouseEnter(hero);
    tick(20000);
    expect(activeIndex()).toBe(0);
    fireEvent.mouseLeave(hero);
    tick(5000);
    expect(activeIndex()).toBe(1);
  });

  it('nút dừng chặn autoplay và đổi aria-label Tạm dừng <-> Phát tiếp', () => {
    renderBanner();
    const toggle = screen.getByTestId('slider-pause-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Tạm dừng');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-label')).toBe('Phát tiếp');
    tick(20000);
    expect(activeIndex()).toBe(0);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-label')).toBe('Tạm dừng');
    tick(5000);
    expect(activeIndex()).toBe(1);
  });

  it('bấm dot hiện đúng banner và đặt aria-current (chỉ trên dot đó)', () => {
    renderBanner();
    fireEvent.click(dots()[2]);
    expect(dots().map(d => d.getAttribute('aria-current'))).toEqual([null, null, 'true', ...Array(COUNT - 3).fill(null)]);
  });

  it('prefers-reduced-motion: tắt autoplay và bỏ transition của track', () => {
    window.matchMedia = vi.fn(() => ({ matches: true })) as any;
    renderBanner();
    tick(20000);
    expect(activeIndex()).toBe(0);
    const track = screen.getByTestId('hero-banner-track');
    expect(tokens(track)).toContain('transition-none');
    expect(tokens(track)).not.toContain('duration-500');
    fireEvent.click(dots()[1]);
    expect(activeIndex()).toBe(1);
  });
});
