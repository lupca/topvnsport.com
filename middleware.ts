// Ad/tracking params (gclid, utm_*, ...) make every click a unique CDN cache key, so each ad landing is a MISS.
// For canonical URLs, rewrite internally to the same path without them: the CDN keys on the clean URL (HIT),
// while the browser address bar keeps the params for client-side analytics.
// Non-canonical (legacy slug) product URLs pass through untouched so their 301 keeps the params.
// '/' and '/catalog' go to the server render in api/page.ts (a vercel.json rewrite cannot: the static
// index.html wins over rewrites for '/').
const TRACKING = /^(gclid|gbraid|wbraid|fbclid|msclkid|ttclid|utm_.*)$/i;

function withoutTracking(url: URL): URL {
  const clean = new URL(url);
  for (const key of [...clean.searchParams.keys()]) if (TRACKING.test(key)) clean.searchParams.delete(key);
  return clean;
}

export function stripTracking(url: URL): URL | null {
  if (!/^\/product\/\d+\/?$/.test(url.pathname)) return null;
  const clean = withoutTracking(url);
  return clean.search === url.search ? null : clean;
}

// '/' or '/catalog' -> /api/page?route=home|catalog plus the remaining (non-tracking) params.
export function pageRewrite(url: URL): URL | null {
  const route = url.pathname === '/' ? 'home' : /^\/catalog\/?$/.test(url.pathname) ? 'catalog' : null;
  if (!route) return null;
  const target = withoutTracking(url);
  target.pathname = '/api/page';
  target.searchParams.set('route', route);
  return target;
}

// '/product/<slug>/' -> 308 '/product/<slug>' (query kept): with the slash no rewrite matches and the SPA
// shell (home) would be served with 200.
export function productSlashRedirect(url: URL): string | null {
  const m = url.pathname.match(/^(\/product\/[^/]+)\/+$/);
  return m ? `${m[1]}${url.search}` : null;
}

export default function middleware(request: Request): Response | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
  const url = new URL(request.url);
  const slashless = productSlashRedirect(url);
  if (slashless) return new Response(null, { status: 308, headers: { Location: slashless } });
  const target = pageRewrite(url) ?? stripTracking(url);
  return target ? new Response(null, { headers: { 'x-middleware-rewrite': target.toString() } }) : undefined;
}

export const config = { matcher: ['/', '/catalog', '/product/:path*'] };
