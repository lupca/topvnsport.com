// @vitest-environment jsdom
// STOR-146 (goal 2c881ad4, MOB-E 5c6e5961 + MOB-F): below md every tap target in the PDP back button, purchase section,
// stringing picker and tabs is >=44px and all their text is >=14px. Only `max-md:` classes are added (plus the tab
// 'text-xs md:text-sm' -> 'text-sm', same 14px at >=md), so 768/1440 are unchanged (docs/stor146-shots/measure.cjs --diff).
// The scan fails on any text-xs / text-[<14px] without max-md:text-sm and on any button, checkbox label, range or
// cursor-pointer row without its 44px class, inside each data-testid root; the explicit asserts pin the layout classes.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup, within } from '@testing-library/react';
import ProductPurchaseSection from '../components/product-detail/ProductPurchaseSection';
import ProductDetailTabs from '../components/product-detail/ProductDetailTabs';
import { Product, StringOption, TierVariation } from '../types';

afterEach(cleanup);

const cls = (el: Element) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const label = (el: Element) => `<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 30)}"`;
function expectClasses(el: Element | null, classes: string[]) {
  expect(el).not.toBeNull();
  for (const c of classes) expect(cls(el as Element), `${label(el as Element)} needs ${c}`).toContain(c);
}
const SMALL = (c: string) => c === 'text-xs' || (/^text-\[\d+(\.\d+)?px\]$/.test(c) && parseFloat(c.slice(6)) < 14);
const RANGE = ['max-md:h-11', 'max-md:py-[19px]', 'max-md:bg-clip-content'];

// Returns how many small-text elements and targets were checked, so a fixture that stops rendering something fails too.
function scan(root: Element) {
  const els = [root, ...root.querySelectorAll('*')];
  const small = els.filter((el) => cls(el).some(SMALL));
  for (const el of small) expect(cls(el), `${label(el)} is under 14px below md`).toContain('max-md:text-sm');
  const targets = els.filter((el) =>
    el.matches('button, input[type=range]') ||
    (el.tagName === 'LABEL' && el.querySelector('input[type=checkbox]')) ||
    cls(el).includes('cursor-pointer'));
  for (const el of targets) expectClasses(el, el.matches('input[type=range]') ? RANGE : ['max-md:min-h-[44px]']);
  return { small: small.length, targets: targets.length };
}

const colourTier: TierVariation = { id: 1, product_id: 1, tier_index: 1, name: 'Màu sắc', options: ['Đen', 'Xanh'] };
const stringTier: TierVariation = { id: 2, product_id: 1, tier_index: 2, name: 'Loại Cước', options: ['Không đan', 'BG65 Titanium', 'BG80 Power'] };
const racket: Product = {
  id: '1', name: 'Vợt Yonex Astrox 100ZZ', brand: 'Yonex', badge: 'HOT', characteristics: 'Tấn Công', image: '',
  categoryCode: 'VC001491', price: 3890000, specs: {}, stock: 10,
  tier_variations: [colourTier, stringTier],
  variants: colourTier.options.flatMap((c, ci) => stringTier.options.map((s, si) => ({
    tier_1_option: c, tier_2_option: s, sku_code: `R-${ci}${si}`, price: 3890000 + si * 150000, stock: c === 'Xanh' ? 0 : 5,
  }))),
};
const stringOptions: StringOption[] = [{ id: 's1', name: 'BG65 Titanium', type: 'Độ bền', thickness: '0.70mm', price: 0, colors: [] }];

function renderPurchase(product: Product, stringing: boolean) {
  return render(
    <MemoryRouter>
      <ProductPurchaseSection
        product={product} totalDisplayPrice={3501000} hasPrice displayOriginalPrice={3890000} hasDiscount discountPercent={10}
        selectedTier1="Đen" selectedTier2="BG65 Titanium" selectedColor="Đen" tension={10.5} stringOptions={stringOptions}
        hasStringingVariation={stringing} stringingVariation={stringing ? stringTier : undefined} stringingTierIndex={stringing ? 2 : undefined}
        isDynamicStringingActive={stringing} activeStringValue="BG65 Titanium" isOutOfStock={false} stockUnknown={false}
        onSetSelectedTier1={vi.fn()} onSetSelectedTier2={vi.fn()} onSetSelectedColor={vi.fn()} onSetTension={vi.fn()} onAddToCart={vi.fn()}
        getVariantStock={(t1) => ({ kind: 'known', stock: t1 === 'Xanh' ? 0 : 5 })}
      />
    </MemoryRouter>
  );
}

describe('STOR-146 purchase section (tiers, out-of-stock option, stringing on)', () => {
  it('every target is 44px and every text >=14px below md; layout classes pinned', () => {
    renderPurchase(racket, true);
    expect(scan(screen.getByTestId('pdp-back'))).toEqual({ small: 0, targets: 1 });
    expect(scan(screen.getByTestId('pdp-purchase'))).toEqual({ small: 21, targets: 8 });

    const options = within(document.getElementById('tier-select-1')!).getAllByRole('button');
    expect(options).toHaveLength(2);
    for (const b of options) expectClasses(b, ['max-md:min-h-[44px]', 'max-md:min-w-[44px]', 'max-md:text-sm']);
    // 'Hết' sits inline inside its button below md (inline-block stops the parent line-through); desktop keeps the 8px corner badge.
    const het = within(options[1]).getByText('Hết');
    expectClasses(het, ['max-md:static', 'max-md:inline-block', 'max-md:ml-1.5', 'max-md:text-sm', 'absolute', '-top-1.5', '-right-1.5', 'text-[8px]']);

    const box = document.getElementById('tier-select-2')!;
    const toggle = box.querySelector('input[type=checkbox]')!.closest('label')!;
    expectClasses(toggle, ['max-md:min-h-[44px]', 'max-md:min-w-[44px]', 'max-md:justify-center']);
    expectClasses(toggle.querySelector('div'), ['max-md:relative']); // knob stays on the track inside the taller label
    const range = box.querySelector('input[type=range]')!;
    expectClasses(range, RANGE);
    expectClasses(range.nextElementSibling, ['max-md:text-sm', 'max-md:flex-wrap', 'max-md:gap-x-2']);
    expect(within(box).getByText('Độ bền • Ø 0.70mm')).toBeTruthy(); // metadata line rendered (scanned above)
  });
});

describe('STOR-146 purchase section (no tiers, two colours)', () => {
  it('colour buttons are 44x44 and the colour row wraps below md', () => {
    renderPurchase({ ...racket, badge: undefined, characteristics: undefined, tier_variations: [], variants: [], colors: ['Đen', 'Trắng'] }, false);
    expect(scan(screen.getByTestId('pdp-purchase'))).toEqual({ small: 8, targets: 4 });
    const colours = ['Đen', 'Trắng'].map((name) => screen.getByRole('button', { name }));
    for (const b of colours) expectClasses(b, ['max-md:min-h-[44px]', 'max-md:min-w-[44px]', 'max-md:text-sm']);
    expectClasses(colours[0].parentElement, ['max-md:flex-wrap']);
  });
});

describe('STOR-146 ProductDetailTabs', () => {
  const product: Product = {
    ...racket,
    specs: { weight: '4U (83g)', stiffness: 'Medium', balance: 295, maxTension: 28, swingWeight: 86 },
    description: 'Mô tả.', features: ['Nhẹ'],
    vomaAttributes: [{ code: 'material', name: 'Chất liệu', value: 'Carbon' }],
    technologies: [{ name: 'Namd', description: 'Sợi carbon.' }],
  };
  it.each([['details', 3, 2], ['tech', 12, 2]] as const)('%s: tabs 44px tall, all text >=14px below md', (tab, small, targets) => {
    render(<ProductDetailTabs product={product} isRacket activeTab={tab} onTabChange={vi.fn()} />);
    const root = screen.getByTestId('pdp-tabs');
    expectClasses(root, ['mt-14', 'border-t']); // testid on the root, not the tab strip
    expect(scan(root)).toEqual({ small, targets });
    const tabs = within(root).getAllByRole('button');
    for (const b of tabs) {
      expectClasses(b, ['text-sm', 'max-md:min-h-[44px]', 'whitespace-nowrap', 'shrink-0']);
      expect(cls(b)).not.toContain('text-xs');
    }
    expectClasses(tabs[0].parentElement, ['overflow-x-auto']);
  });
});
