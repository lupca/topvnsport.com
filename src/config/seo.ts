// SEO text and policy values in one place (server render in api/ and head sync in App.tsx read them).
// Per-product titles/descriptions are NOT here: they come from PIM (listing webstore seo_title /
// seo_description) or are derived from the product name/description in src/utils/seoText.ts.

export const SITE_NAME = 'Top VN Sport';
// Appended to a page title only when the whole title still fits TITLE_MAX.
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

// Home page head. Draft text chosen 14/11 (owner delegated the wording); replace here to change it.
export const HOME_SEO = {
  title: 'Top VN Sport – Vợt cầu lông, cước, giày và phụ kiện',
  description:
    'Top VN Sport bán vợt cầu lông, cước đan, giày, quần áo và phụ kiện Yonex, Li-Ning, Victor. Đan cước theo yêu cầu, showroom tại Hà Nội, giao hàng toàn quốc.',
  h1: 'Vợt cầu lông, cước, giày và phụ kiện cầu lông',
  // Interim: square 1024×1024 banner. A 1200×630 share image is still needed (report 14/11).
  ogImage: { url: 'https://www.topvnsport.com/banners/chinh-hang-yonex.webp', width: 1024, height: 1024 },
};

// Known brands for products whose PIM brand attribute is empty: [display name, ...aliases]
// matched as whole words in the product name, case-insensitive. Order = priority.
export const KNOWN_BRANDS: string[][] = [
  ['Yonex'],
  ['Li-Ning', 'lining', 'li ning', 'li-ning'],
  ['Victor'],
  ['Kizuna'],
  ['Mizuno'],
  ['Kawasaki'],
  ['Apacs'],
  ['VS', 'vse'],
  ['Thành Công'],
  ['Facolos'],
];

// Owner decisions 14/11. hasMerchantReturnPolicy is emitted on every Offer.
export const RETURN_POLICY = {
  enabled: true,
  days: 7,
  // No return-policy page on the site yet; set a URL here when one exists.
  link: undefined as string | undefined,
};

// Owner 14/11: "free shipping nationwide". NOT emitted yet: the live checkout quotes 30.000đ standard /
// 50.000đ express for most products (0đ only where an OMS freeship voucher applies, e.g. product 590),
// and structured data must match what the buyer is charged. Turn on once OMS charges 0đ.
export const SHIPPING = {
  enabled: false,
  rateVnd: 0,
  handlingDays: [0, 1] as [number, number],
  transitDays: [1, 4] as [number, number],
};

// Offer.priceValidUntil = today + this many days (prices are live from PIM; the CDN keeps a page <= 6 min).
export const PRICE_VALID_DAYS = 30;
