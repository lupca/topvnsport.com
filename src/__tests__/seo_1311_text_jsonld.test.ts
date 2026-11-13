// SEO audit 13/11 (owner-approved list): titles/descriptions/brand derived in code, JSON-LD offers and
// policies, server-rendered home/catalog, middleware routing, sitemap lastmod.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { productBrand, seoDescriptionFromText, seoTitleFromName } from '../utils/seoText';
import { KNOWN_BRANDS, RETURN_POLICY, SHIPPING } from '../config/seo';
import { offerPolicies, productJsonLd, renderProductPage } from '../../api/product';
import type { Product } from '../types';

const SHELL = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const cp = (s: string) => Array.from(s).length;

describe('seoTitleFromName (item 6)', () => {
  it.each([
    ['[Hỏa Tốc] Vợt cầu lông Lining Bladex 500 - 3U Chính Hãng, Tặng túi+Quấn Cán -Đan cước', 'Vợt cầu lông Lining Bladex 500 - 3U Chính Hãng'],
    ['Vợt cầu lông Yonex Astrox 77 Play - Chính Hãng - Quà Tặng', 'Vợt cầu lông Yonex Astrox 77 Play - Chính Hãng'],
    ['Vợt cầu lông Yonex Voltric 0.1 DG (New) Chính Hãng + Combo 3 quà tặng [Hỏa Tốc]', 'Vợt cầu lông Yonex Voltric 0.1 DG (New) Chính Hãng'],
    ['Cuốn Cán Cao Su Non', 'Cuốn Cán Cao Su Non | Top VN Sport'],
    ['【NEW 2026】Vợt Cầu Lông Yonex Astrox Lite 45i', 'Vợt Cầu Lông Yonex Astrox Lite 45i | Top VN Sport'],
    ['Vợt Cầu Lông Yonex Arcsaber 0 Clear, 0 Feel, Ability - Chính Hãng - Tặng Quà Bao Vợt', 'Vợt Cầu Lông Yonex Arcsaber 0 Clear, 0 Feel, Ability'],
  ])('%s', (name, expected) => {
    const title = seoTitleFromName(name);
    expect(title).toBe(expected);
    expect(cp(title)).toBeLessThanOrEqual(60);
    expect(title).not.toMatch(/[[\]【】]/);
  });

  it('long name without separators is cut at a word, never mid-word, <= 60', () => {
    const t = seoTitleFromName('Vợt ' + 'Abcdefgh '.repeat(20));
    expect(cp(t)).toBeLessThanOrEqual(60);
    expect(t).toMatch(/Abcdefgh$/);
  });
});

describe('seoDescriptionFromText (item 7)', () => {
  it('strips leading emoji, symbols and [..] chunks per line, joins lines as sentences', () => {
    expect(seoDescriptionFromText('🔥 ĐẶC ĐIỂM NỔI BẬT\nChuyên công cầu sau.')).toBe('ĐẶC ĐIỂM NỔI BẬT. Chuyên công cầu sau.');
    expect(seoDescriptionFromText('[CHÍNH HÃNG] Vợt Yonex\n- Khung cứng')).toBe('Vợt Yonex. Khung cứng.');
    expect(seoDescriptionFromText('Bạn tìm vợt có lối đánh\nnhanh, linh hoạt?')).toBe('Bạn tìm vợt có lối đánh nhanh, linh hoạt?');
    expect(seoDescriptionFromText(' \n 🏸 \n')).toBeUndefined();
  });

  it('cuts at the last sentence end within 155 code points', () => {
    const s1 = 'Câu một dài vừa phải để chiếm chỗ trong mô tả sản phẩm cầu lông này.';
    const text = `${s1} ${s1} ${s1}`;
    const d = seoDescriptionFromText(text)!;
    expect(d).toBe(`${s1} ${s1}`);
    expect(cp(d)).toBeLessThanOrEqual(155);
  });
});

describe('productBrand (item 5)', () => {
  it('PIM brand attribute wins (known alias -> canonical spelling), else a known brand in the name', () => {
    expect(productBrand({ brand: 'LI-NING', name: 'x' })).toBe('Li-Ning');
    expect(productBrand({ brand: 'gowin', name: 'Bóng Facolos' })).toBe('gowin');
    expect(productBrand({ name: '[HỎA TỐC] Vợt Cầu Lông Lining Bladex 500' })).toBe('Li-Ning');
    expect(productBrand({ name: 'Túi vải mền đựng vợt yonex chính hãng' })).toBe('Yonex');
    expect(productBrand({ name: 'MỘT ĐOẠN CUỐN CÁN VỢT CẦU LÔNG CHÍNH HÃNG VS (VSE)' })).toBe('VS');
    expect(productBrand({ brand: 'No Brand', name: 'Cuốn Cán Cao Su Non' })).toBeUndefined();
    // whole words only: "versus" is not VS, "Yonexx" is not Yonex
    expect(productBrand({ name: 'versus Yonexx' })).toBeUndefined();
  });

  it('the brand list lives in src/config/seo.ts only', () => {
    expect(KNOWN_BRANDS.map(b => b[0])).toEqual(expect.arrayContaining(['Yonex', 'Li-Ning', 'Victor', 'Kizuna', 'Mizuno', 'Kawasaki', 'Apacs']));
  });
});

const variantProduct = (over: Partial<Product> = {}): Product => ({
  id: '590', name: 'Vợt Yonex Astrox 88D Tour', image: 'https://cdn/x.jpg', gallery: ['https://cdn/x.jpg'], price: 100, salePrice: 100,
  tier_variations: [{ name: 'Cước', tier_index: 1, options: ['Khung', 'BG65'] }],
  variants: [
    { id: 1, tier_1_option: 'Khung', price: 2000000, computedPrice: 1800000, sku_code: 'K', stock: 0 },
    { id: 2, tier_1_option: 'BG65', price: 2200000, sku_code: 'B', stock: 3 },
  ],
  defaultVariantId: 2,
  ...over,
} as unknown as Product);

describe('JSON-LD offers (items 4, 5)', () => {
  const NOW = new Date('2026-11-14T00:00:00Z');

  it('several prices: AggregateOffer low/high/count with one Offer per variant, the page variant first', () => {
    const ld = productJsonLd(variantProduct(), 'https://www.topvnsport.com/product/590', NOW) as any;
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Yonex' });
    expect(ld.sku).toBe('B');
    expect(ld.offers).toMatchObject({ '@type': 'AggregateOffer', priceCurrency: 'VND', lowPrice: 1800000, highPrice: 2200000, offerCount: 2 });
    expect(ld.offers.offers.map((o: any) => [o.sku, o.price, o.availability])).toEqual([
      ['B', 2200000, 'https://schema.org/InStock'],
      ['K', 1800000, 'https://schema.org/OutOfStock'],
    ]);
    for (const o of ld.offers.offers) expect(o.priceValidUntil).toBe('2026-12-14');
    // The price the page shows is the first Offer's.
    expect(renderProductPage(SHELL, variantProduct(), 'https://x')).toContain('<p>2.200.000đ</p>');
  });

  it('return policy from config is on every Offer; shipping is off until OMS charges the configured rate', () => {
    const p = offerPolicies() as any;
    expect(RETURN_POLICY.enabled).toBe(true);
    expect(p.hasMerchantReturnPolicy).toEqual({
      '@type': 'MerchantReturnPolicy', applicableCountry: 'VN', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7, returnMethod: 'https://schema.org/ReturnByMail', returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    });
    expect(SHIPPING.enabled).toBe(false);
    expect(p).not.toHaveProperty('shippingDetails');
  });

  it('og:type=product and the cover <img src alt width height> in the raw #root (item 8)', () => {
    const html = renderProductPage(SHELL, variantProduct(), 'https://www.topvnsport.com/product/590');
    expect(html).toContain('<meta property="og:type" content="product" data-product-head />');
    expect(html).toContain('<img src="https://cdn/x.jpg" alt="Vợt Yonex Astrox 88D Tour" width="600" height="600"');
  });
});

