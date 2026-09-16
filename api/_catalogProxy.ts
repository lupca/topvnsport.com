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
// ponytail: untyped req/res (no @vercel/node dependency) -- Vercel's builder
// doesn't require the package, and this file isn't in tsconfig's `include`.
export async function proxyToVoma(req: any, res: any, baseUrl: string | undefined) {
  if (!baseUrl || !process.env.CATALOG_GRANT_TOKEN) {
    console.error('Catalog proxy misconfigured: missing upstream URL or CATALOG_GRANT_TOKEN env var');
    res.status(500).json({ detail: 'proxy_misconfigured' });
    return;
  }

  const segments: string[] = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const queryIndex = req.url.indexOf('?');
  const queryString = queryIndex === -1 ? '' : req.url.slice(queryIndex);
  const upstreamUrl = `${baseUrl}/${segments.join('/')}${queryString}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: { Authorization: `Bearer ${process.env.CATALOG_GRANT_TOKEN}` },
    });

    const body = await upstreamResponse.text();
    res.status(upstreamResponse.status);
    res.setHeader('content-type', upstreamResponse.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (error) {
    console.error('Catalog proxy request to VOMA failed:', error);
    res.status(502).json({ detail: 'upstream_unreachable' });
  }
}
