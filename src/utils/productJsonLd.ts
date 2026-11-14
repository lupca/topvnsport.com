import { PRICE_VALID_DAYS, RETURN_POLICY, SHIPPING } from '../config/seo.js';
import { productBrand } from './seoText.js';
import { aggregateStock, getPdpPrice, initialTierValue } from '../components/product-detail/helpers.js';
import type { Product, ProductVariant } from '../types.js';

// Product JSON-LD, shared by api/product.ts (server head) and App.tsx (head sync on route change).
const SCHEMA_STOCK = (stock: number) => (stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock');

// Policy properties every Offer carries, read from src/config/seo.ts (owner decisions); off = omitted.
export function offerPolicies(): Record<string, unknown> {
  const days = (min: number, max: number) => ({ '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' });
  return {
    ...(SHIPPING.enabled && {
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: SHIPPING.rateVnd, currency: 'VND' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'VN' },
        deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: days(...SHIPPING.handlingDays), transitTime: days(...SHIPPING.transitDays) },
      },
    }),
    ...(RETURN_POLICY.enabled && {
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'VN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: RETURN_POLICY.days,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
        ...(RETURN_POLICY.link && { merchantReturnLink: RETURN_POLICY.link }),
      },
    }),
  };
}

// schema.org Product from the values the page shows. Offers only when the page shows a price (never on
// NO_PRICE_TEXT): one Offer per priced variant (sku, its own price, its WMS availability), the variant the
// page shows first leading; several variants -> AggregateOffer(lowPrice/highPrice/offerCount) around them,
// also when no variant is preselected (two-tier products).
export function productJsonLd(product: Product, canonicalUrl: string, now = new Date()): Record<string, unknown> {
  const description = (product.description ?? '').trim();
  const image = product.gallery?.find((src) => /^https?:\/\/\S+$/i.test(src));
  const price = getPdpPrice(product, initialTierValue(product, 1), initialTierValue(product, 2));
  const priced = price.hasPrice && price.salePrice > 0;
  const sku = price.matchedVariant?.sku_code ?? product.defaultSku;
  const brand = productBrand(product);
  const priceValidUntil = new Date(now.getTime() + PRICE_VALID_DAYS * 86400000).toISOString().slice(0, 10);
  const base = { '@type': 'Offer', priceCurrency: 'VND', priceValidUntil, url: canonicalUrl, ...offerPolicies() };

  let offers: Record<string, unknown> | undefined;
  const variants = (product.variants ?? []).filter((v) => v.price > 0);
  if (priced && variants.length > 0) {
    // One Offer per priced variant the web shows (PIM already dropped hidden ones), each with its sku, price and
    // WMS availability; the variant the page shows first leads. Several -> AggregateOffer around them.
    const first = price.matchedVariant && variants.includes(price.matchedVariant) ? price.matchedVariant : undefined;
    const ordered: ProductVariant[] = first ? [first, ...variants.filter((v) => v !== first)] : variants;
    const list = ordered.map((v) => ({
      ...base,
      ...(v.sku_code && { sku: v.sku_code }),
      price: v.computedPrice ?? v.price,
      ...(v.stock !== undefined && { availability: SCHEMA_STOCK(v.stock) }),
    }));
    const prices = list.map((o) => o.price as number);
    offers = list.length === 1
      ? list[0]
      : { '@type': 'AggregateOffer', priceCurrency: 'VND', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: list.length, offers: list };
  } else if (priced) {
    // No priced variant: availability only from WMS stock at the PDP's initial tiers; 'unknown' and 'none' omit it, never invented.
    const stock = aggregateStock(product, initialTierValue(product, 1), initialTierValue(product, 2));
    offers = { ...base, price: price.salePrice, ...(stock.kind === 'known' && { availability: SCHEMA_STOCK(stock.stock) }) };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(description && { description }),
    ...(image && { image }),
    ...(sku && { sku }),
    ...(brand && { brand: { '@type': 'Brand', name: brand } }),
    ...(offers && { offers }),
  };
}
