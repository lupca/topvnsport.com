// Ad/tracking params (gclid, utm_*, ...) make every click a unique CDN cache key, so each ad landing is a MISS.
// For the canonical /product/<id> URL, rewrite internally to the same path without them: the CDN keys on the
// clean URL (HIT), while the browser address bar keeps the params for client-side analytics.
// Non-canonical (legacy slug) URLs pass through untouched so their 301 keeps the params.
const TRACKING = /^(gclid|gbraid|wbraid|fbclid|msclkid|ttclid|utm_.*)$/i;

export function stripTracking(url: URL): URL | null {
  if (!/^\/product\/\d+\/?$/.test(url.pathname)) return null;
  const clean = new URL(url);
  for (const key of [...clean.searchParams.keys()]) if (TRACKING.test(key)) clean.searchParams.delete(key);
  return clean.search === url.search ? null : clean;
}

export default function middleware(request: Request): Response | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
  const clean = stripTracking(new URL(request.url));
  return clean ? new Response(null, { headers: { 'x-middleware-rewrite': clean.toString() } }) : undefined;
}

export const config = { matcher: '/product/:path*' };
