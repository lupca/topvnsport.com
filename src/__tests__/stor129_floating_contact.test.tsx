// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { store } from '../app/store';

const ZALO = 'https://zalo.me/955065648695191027';
const contact = vi.hoisted(() => ({ zaloUrl: '', hotlineDisplay: '', hotlineTel: '' }) as Record<string, string | undefined>);
vi.mock('../config/storefront', async importOriginal => ({ ...(await importOriginal<object>()), CONTACT: contact }));

const api = vi.hoisted(() => ({
  getProducts: vi.fn().mockResolvedValue([]),
  getAllStock: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue([]),
  getBranches: vi.fn().mockResolvedValue([]),
  getStringOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/sportApi', () => ({ sportApi: api }));

import FloatingContact from '../components/FloatingContact';
import App from '../App';

const ZALO_LABEL = 'Chat Zalo với TopVNSport';
const CALL_LABEL = 'Gọi hotline 097 6007006';
const root = path.resolve(__dirname, '..');
const zaloA = () => screen.queryByLabelText(ZALO_LABEL);
const callA = () => screen.queryByLabelText(CALL_LABEL);

beforeEach(() => {
  Object.assign(contact, { zaloUrl: ZALO, hotlineDisplay: '097 6007006', hotlineTel: '0976007006' });
  window.gtag = vi.fn();
  window.scrollTo = vi.fn() as any;
  document.addEventListener('click', stopNav); // jsdom cannot navigate
});
const stopNav = (e: Event) => e.preventDefault();
afterEach(() => {
  document.removeEventListener('click', stopNav);
  cleanup();
  delete (window as any).gtag;
});

describe('STOR-129 FloatingContact', () => {
  it('1. App on /product/:slug (root layout) renders the Zalo anchor from CONTACT', async () => {
    render(<Provider store={store}><MemoryRouter initialEntries={['/product/ao-yonex']}><App /></MemoryRouter></Provider>);
    const a = await screen.findByLabelText(ZALO_LABEL);
    expect(a).toHaveAttribute('href', contact.zaloUrl);
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(a.querySelector('svg')).not.toBeNull();
  });

  it('1b. App renders FloatingContact outside <Routes>', () => {
    const src = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
    expect(src.indexOf('<FloatingContact')).toBeGreaterThan(src.indexOf('</Routes>'));
  });

  it('1c. Zalo anchor: href/target/rel from config', () => {
    render(<FloatingContact isPdp={false} />);
    const a = zaloA()!;
    expect(a.getAttribute('href')).toBe(ZALO);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('2. hotline anchor is tel: from config, number beside icon on md+', () => {
    render(<FloatingContact isPdp={false} />);
    const a = callA()!;
    expect(a.getAttribute('href')).toBe('tel:0976007006');
    const label = Array.from(a.querySelectorAll('span')).find(s => s.textContent === '097 6007006')!;
    expect(label.className).toContain('md:inline');
    expect(label.className).toContain('hidden');
  });

  it('3a. blank Zalo URL -> no Zalo anchor, hotline stays', () => {
    contact.zaloUrl = '  ';
    render(<FloatingContact isPdp={false} />);
    expect(zaloA()).toBeNull();
    expect(callA()).not.toBeNull();
  });

  it('3b. blank hotline -> no hotline anchor, Zalo stays', () => {
    contact.hotlineTel = '';
    render(<FloatingContact isPdp={false} />);
    expect(callA()).toBeNull();
    expect(zaloA()).not.toBeNull();
  });

  it('3c. blank display -> no hotline anchor', () => {
    contact.hotlineDisplay = undefined;
    render(<FloatingContact isPdp={false} />);
    expect(screen.queryByRole('link', { name: /hotline/ })).toBeNull();
  });

  it('3d. both blank -> renders nothing', () => {
    Object.assign(contact, { zaloUrl: '', hotlineTel: '', hotlineDisplay: '' });
    const { container } = render(<FloatingContact isPdp={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('3e. component source has no zalo.me or phone literal', () => {
    const src = fs.readFileSync(path.join(root, 'components/FloatingContact.tsx'), 'utf8');
    expect(src).not.toContain('zalo.me');
    expect(src).not.toMatch(/0\d{2}\s?\d{3}\s?\d{4}/);
    expect(src).not.toMatch(/\d{9,}/);
  });

  it('4a. aria-label and title are the exact Vietnamese strings', () => {
    render(<FloatingContact isPdp={false} />);
    expect(zaloA()!.getAttribute('title')).toBe(ZALO_LABEL);
    expect(callA()!.getAttribute('title')).toBe(CALL_LABEL);
  });

  it('4b. tap targets are >=44px (h-12 w-12 = 3rem)', () => {
    render(<FloatingContact isPdp={false} />);
    for (const a of [zaloA()!, callA()!]) {
      expect(a.className).toMatch(/(^|\s)h-12(\s|$)/);
      expect(a.className).toMatch(/(^|\s)w-12(\s|$)/);
    }
  });

  it('4c. offset: PDP class differs from non-PDP; CSS is safe-area aware, above the bar', () => {
    const { container, rerender } = render(<FloatingContact isPdp={false} />);
    const plain = (container.firstChild as HTMLElement).className;
    rerender(<FloatingContact isPdp />);
    const pdp = (container.firstChild as HTMLElement).className;
    expect(plain).toContain('floating-contact');
    expect(plain).not.toContain('floating-contact-pdp');
    expect(pdp).toContain('floating-contact-pdp');
    const css = fs.readFileSync(path.join(root, 'index.css'), 'utf8');
    expect(css).toMatch(/\.floating-contact\s*\{[^}]*bottom:\s*calc\([^}]*var\(--bottom-bar-offset\)[^}]*env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/\.floating-contact-pdp\s*\{[^}]*var\(--pdp-bar-offset\)[^}]*env\(safe-area-inset-bottom\)/);
    // bar heights: 4rem nav (pb-16), PDP bar taller than or equal; cluster never below them
    const nav = parseFloat(/--bottom-bar-offset:\s*([\d.]+)rem/.exec(css)![1]);
    const bar = parseFloat(/--pdp-bar-offset:\s*([\d.]+)rem/.exec(css)![1]);
    expect(nav).toBeGreaterThanOrEqual(4);
    expect(bar).toBeGreaterThanOrEqual(4);
  });

  it('4d. z-index is below the cart drawer / modal overlays (z-50) and bars (z-40)', () => {
    const { container } = render(<FloatingContact isPdp={false} />);
    const z = Number(/(?:^|\s)z-(\d+)(?:\s|$)/.exec((container.firstChild as HTMLElement).className)![1]);
    const cart = Number(/z-(\d+)[^>]*id="cart-drawer-modal"/.exec(fs.readFileSync(path.join(root, 'components/CartModal.tsx'), 'utf8'))![1]);
    expect(z).toBeLessThan(40);
    expect(z).toBeLessThan(cart);
  });

  it('5a. Zalo click -> contact_zalo_click with exactly {location}', () => {
    render(<FloatingContact isPdp={false} />);
    fireEvent.click(zaloA()!);
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'contact_zalo_click', { location: 'floating_button' });
  });

  it('5b. hotline click -> contact_call_click with exactly {location}', () => {
    render(<FloatingContact isPdp={false} />);
    fireEvent.click(callA()!);
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'contact_call_click', { location: 'floating_button' });
  });

  it('5c. no phone digits or ids in event params', () => {
    render(<FloatingContact isPdp={false} />);
    fireEvent.click(callA()!);
    fireEvent.click(zaloA()!);
    for (const call of (window.gtag as any).mock.calls) {
      expect(Object.keys(call[2])).toEqual(['location']);
      expect(JSON.stringify(call[2])).not.toMatch(/\d{4}/);
    }
  });
});
