// Shared body for api/pmi/[...path].ts and api/wms/[...path].ts.
//
// Both routes forward the storefront's public catalog reads (PMI products/
// categories, WMS stock) to VOMA behind a catalog-grant Bearer token that
// lives only in this Vercel serverless function's env (never in a VITE_
// var, so it never reaches the browser bundle). See
// voma/CLAUDE.md / catalog-grant spec for the contract this proxy relies on:
// no header, or a bad token -> 401 {"detail":"invalid_catalog_token"};
// a valid token -> 200, seller/tenant scope resolved server-side from the
// grant itself (no X-Tenant-Id / X-Seller-Id needed from the client).
//
// CATALOG_GRANT_TOKENS holds one token per seller ({"<seller_id>":"<token>"}),
// keyed exactly like the seller_id used to mint each token via POST
// /site/token. STOREFRONT_SELLER_ID picks which key this deployment uses --
// server-side only, never sent to or read from the client -- because today
// one deployment always serves exactly one seller; per-request seller
// selection (e.g. a path segment) is deferred until a real second seller
// needs to share one deployment.
//
// ponytail: untyped req/res (no @vercel/node dependency) -- Vercel's builder
// doesn't require the package, and this file isn't in tsconfig's `include`.

function resolveCatalogGrantToken(): string | undefined {
  const raw = process.env.CATALOG_GRANT_TOKENS;
  const sellerId = process.env.STOREFRONT_SELLER_ID;
  if (!raw || !sellerId) return undefined;

  let tokens: unknown;
  try {
    tokens = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof tokens !== 'object' || tokens === null || Array.isArray(tokens)) return undefined;

  const token = (tokens as Record<string, unknown>)[sellerId];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

// STOR-012: CDN Vercel cache phản hồi 200 (Vercel-CDN-Cache-Control), trình
// duyệt vẫn max-age=0. Độ cũ tối đa giá/tồn khách thấy ≈ 360s (60s tươi + 300s
// stale-while-revalidate) cộng thời gian revalidate; OMS vẫn tính tiền theo giá
// PIM lúc đặt. Mọi nhánh khác 200 gắn no-store (không cache lỗi).
const CDN_CACHE_CONTROL = 'max-age=60, stale-while-revalidate=300';

export async function proxyToVoma(req: any, res: any, baseUrl: string | undefined) {
  // This proxy exists only to attach a read-scoped catalog-grant token to
  // public catalog/stock reads -- it must never forward a write. Reject
  // before resolving the token so a non-GET request never even confirms
  // whether a seller/token is configured.
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ detail: 'method_not_allowed' });
    return;
  }

  const token = resolveCatalogGrantToken();
  if (!baseUrl || !token) {
    console.error('Catalog proxy misconfigured: missing upstream URL, or no valid CATALOG_GRANT_TOKENS entry for STOREFRONT_SELLER_ID');
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ detail: 'proxy_misconfigured' });
    return;
  }

  const segments: string[] = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const queryIndex = req.url.indexOf('?');
  // `path` is injected by the vercel.json rewrite that routes multi-segment
  // requests here -- it is not a client parameter, so it must not be forwarded.
  const params = new URLSearchParams(queryIndex === -1 ? '' : req.url.slice(queryIndex + 1));
  params.delete('path');
  const queryString = params.size > 0 ? `?${params}` : '';
  const upstreamUrl = `${baseUrl}/${segments.join('/')}${queryString}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await upstreamResponse.text();
    res.status(upstreamResponse.status);
    res.setHeader('content-type', upstreamResponse.headers.get('content-type') || 'application/json');
    if (upstreamResponse.status === 200) {
      res.setHeader('Vercel-CDN-Cache-Control', CDN_CACHE_CONTROL);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    res.send(body);
  } catch (error) {
    console.error('Catalog proxy request to VOMA failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ detail: 'upstream_unreachable' });
  }
}

// STOR-034: checkout (OTP -> order -> SePay) proxy to the OMS public API.
// POST only, 4 whitelisted paths; method/path are checked BEFORE the token is
// resolved so a bad request never reveals whether a token is configured.
const OMS_CHECKOUT_PATHS = new Set(['checkout/send-otp', 'checkout/verify-otp', 'checkout/orders', 'checkout/payments']);

export async function proxyOmsCheckout(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'method_not_allowed' });
    return;
  }

  const segments: string[] = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const path = segments.join('/');
  if (!OMS_CHECKOUT_PATHS.has(path)) {
    res.status(404).json({ detail: 'not_found' });
    return;
  }

  const baseUrl = process.env.VITE_OMS_API_URL;
  const token = resolveCatalogGrantToken();
  if (!baseUrl || !token) {
    console.error('OMS checkout proxy misconfigured: missing VITE_OMS_API_URL, or no valid CATALOG_GRANT_TOKENS entry for STOREFRONT_SELLER_ID');
    res.status(500).json({ detail: 'proxy_misconfigured' });
    return;
  }

  try {
    // Vercel's Node runtime parses application/json into req.body (object);
    // a string body is forwarded verbatim.
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const upstreamResponse = await fetch(`${baseUrl}/public/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
    const text = await upstreamResponse.text();
    res.status(upstreamResponse.status);
    res.setHeader('content-type', upstreamResponse.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    console.error('OMS checkout proxy request failed:', error);
    res.status(502).json({ detail: 'upstream_unreachable' });
  }
}
