export const SIMULATED_LATENCY = import.meta.env.DEV && import.meta.env.MODE !== 'test' ? 200 : 0;
export const PMI_API_URL = (import.meta as any).env?.VITE_PMI_API_URL || 'http://localhost:18100';
export const WMS_API_URL = (import.meta as any).env?.VITE_WMS_API_URL || 'http://localhost:18102';
export const NO_IMAGE_URL = 'https://via.placeholder.com/300?text=No+Image';

// Public catalog reads (categories/products/WMS stock) go through this site's
// own Vercel serverless proxy (api/pmi, api/wms) instead of hitting VOMA
// directly: the proxy attaches a catalog-grant Bearer token server-side, so
// the browser bundle never holds it and the gateway resolves tenant/seller
// from the grant itself -- no X-Tenant-Id / X-Seller-Id needed from here.
export const PMI_PROXY_URL = '/api/pmi';
export const WMS_PROXY_URL = '/api/wms';
// Checkout (OTP -> order -> SePay) goes through api/oms the same way: the proxy
// adds the catalog-grant token server-side and only allows 4 POST routes.
export const OMS_CHECKOUT_PROXY_URL = '/api/oms/checkout';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
