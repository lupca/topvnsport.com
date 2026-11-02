// Manual harness script: validates JSON-LD emitted on product pages against allowlists.
// Usage: PORT=4391 node scripts/stor072-walk/jsonld-check.cjs
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 4372);

const FIXTURES = [
  { id: 101, slug: 'vot-yonex-astrox-99', image: true, av: 'InStock' },
  { id: 103, slug: 'cuoc-bg65-titanium', image: false, av: 'OutOfStock' },
  { id: 104, slug: 'giay-lining', image: false, av: 'InStock' },
];

const PRODUCT_ALLOWLIST = new Set([
  '@context',
  '@type',
  'name',
  'description',
  'image',
  'sku',
  'brand',
  'offers',
]);

const BRAND_ALLOWLIST = new Set([
  '@type',
  'name',
]);

const OFFER_ALLOWLIST = new Set([
  '@type',
  'price',
  'priceCurrency',
  'url',
  'availability',
]);

(async () => {
  let fails = 0;

  for (const f of FIXTURES) {
    try {
      const resp = await fetch(`${BASE}/product/${f.slug}`);
      if (resp.status !== 200) {
        throw new Error(`expected status 200, got ${resp.status}`);
      }
      const html = await resp.text();
      const matches = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
      if (matches.length !== 1) {
        throw new Error(`expected exactly 1 application/ld+json script, found ${matches.length}`);
      }

      let data;
      try {
        data = JSON.parse(matches[0][1]);
      } catch (e) {
        throw new Error(`failed to parse JSON-LD: ${e.message}`);
      }

      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('JSON-LD must be an object');
      }

      // Check Product allowlist and verify non-brand/offers are not objects/arrays
      for (const [k, v] of Object.entries(data)) {
        if (!PRODUCT_ALLOWLIST.has(k)) {
          throw new Error(`bogus top-level key: ${k}`);
        }
        if (k !== 'brand' && k !== 'offers') {
          if (typeof v === 'object' && v !== null) {
            throw new Error(`nested object or array at key: ${k}`);
          }
        }
      }

      if (data['@context'] !== 'https://schema.org') {
        throw new Error(`@context must be https://schema.org, got ${data['@context']}`);
      }
      if (data['@type'] !== 'Product') {
        throw new Error(`@type must be Product, got ${data['@type']}`);
      }

      // Check image
      if (f.image) {
        if (typeof data.image !== 'string' || !data.image) {
          throw new Error('image required as non-empty string');
        }
      } else {
        if ('image' in data || data.image !== undefined) {
          throw new Error('image must be absent');
        }
      }

      // Check brand (if present)
      if ('brand' in data) {
        if (typeof data.brand !== 'object' || data.brand === null || Array.isArray(data.brand)) {
          throw new Error('brand must be a plain object');
        }
        for (const [k, v] of Object.entries(data.brand)) {
          if (!BRAND_ALLOWLIST.has(k)) {
            throw new Error(`bogus key in Brand: ${k}`);
          }
          if (typeof v === 'object' && v !== null) {
            throw new Error(`nested object or array inside Brand at key: ${k}`);
          }
        }
        if (data.brand['@type'] !== 'Brand') {
          throw new Error(`brand.@type must be Brand, got ${data.brand['@type']}`);
        }
        if (typeof data.brand.name !== 'string') {
          throw new Error('brand.name must be a string');
        }
      }

      // Check offers
      if (!('offers' in data) || typeof data.offers !== 'object' || data.offers === null || Array.isArray(data.offers)) {
        throw new Error('offers must be a plain object');
      }
      for (const [k, v] of Object.entries(data.offers)) {
        if (!OFFER_ALLOWLIST.has(k)) {
          throw new Error(`bogus key in Offer: ${k}`);
        }
        if (typeof v === 'object' && v !== null) {
          throw new Error(`nested object or array inside Offer at key: ${k}`);
        }
      }
      if (data.offers['@type'] !== 'Offer') {
        throw new Error(`offers.@type must be Offer, got ${data.offers['@type']}`);
      }

      const expectedAv = `https://schema.org/${f.av}`;
      if (data.offers.availability !== expectedAv) {
        throw new Error(`offers.availability expected ${expectedAv}, got ${data.offers.availability}`);
      }

      console.log(`PASS ${f.id}`);
    } catch (err) {
      console.log(`FAIL ${f.id} ${err.message}`);
      fails++;
    }
  }

  process.exit(fails ? 1 : 0);
})();
