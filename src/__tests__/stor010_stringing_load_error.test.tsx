// @vitest-environment jsdom
// STOR-010 (sau STOR-016): vợt không phân loại cước -> StringingAssistant không render gì.
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import StringingAssistant from '../components/product-detail/StringingAssistant';
import { RACKET_CATEGORY_CODES } from '../config/storefront';
import { Product } from '../types';

vi.mock('@topvnsport/ui-kit', () => ({ popupService: { alert: vi.fn() } }));

afterEach(cleanup);

const racket: Product = {
  id: 'r1', slug: 'vot-test', name: 'Vợt test', brand: 'B', categoryCode: RACKET_CATEGORY_CODES[0],
  price: 1000000, image: '', specs: {}, description: '', reviews: [], stock: 5
} as any;

const noop = () => {};
const baseProps = {
  product: racket, isRacket: true, hasStringingVariation: false, isDynamicStringingActive: false,
  activeStringValue: '', selectedTier1: '', selectedTier2: '',
  stringOptions: [], tension: 0, onSetSelectedTier1: noop, onSetSelectedTier2: noop,
  onSetTension: noop
};

it('danh sách cước rỗng: không render gì', () => {
  const { container } = render(<StringingAssistant {...baseProps} />);
  expect(container.innerHTML).toBe('');
});
