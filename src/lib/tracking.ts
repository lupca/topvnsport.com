declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    fbq: any;
    _fbq: any;
  }
}

export interface TrackingProduct {
  id: string | number;
  name: string;
  price: number;
}

export interface TrackingCartItem {
  id?: string | number;
  productId?: string | number;
  name?: string;
  price: number;
  quantity?: number;
}

export interface TrackingCheckoutParams {
  items?: TrackingCartItem[];
  value?: number;
}

export interface TrackingOrderItem {
  id?: string | number;
  productId?: string | number;
  item_id?: string | number;
  name?: string;
  item_name?: string;
  price: number;
  quantity?: number;
}

export interface TrackingOrder {
  order_number: string;
  value: number;
  items: TrackingOrderItem[];
}

let gaScriptInjected = false;
let metaScriptInjected = false;
let _configuredGaId: string | null = null;
let _configuredPixelId: string | null = null;
let lastTrackedPath: string | null = null;

const PURCHASE_GUARD_KEY_PREFIX = 'purchase_tracked_';

export function _resetTrackingForTesting(): void {
  gaScriptInjected = false;
  metaScriptInjected = false;
  _configuredGaId = null;
  _configuredPixelId = null;
  lastTrackedPath = null;
}

function safeGtag(...args: any[]): void {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag(...args);
    }
  } catch {
    // safe no-op
  }
}

function safeFbq(...args: any[]): void {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq(...args);
    }
  } catch {
    // safe no-op
  }
}

export function initTracking(gaIdOverride?: string, pixelIdOverride?: string): void {
  if (typeof window === 'undefined') return;

  const gaId = (gaIdOverride !== undefined ? gaIdOverride : import.meta.env.VITE_GA4_ID)?.trim();
  const pixelId = (pixelIdOverride !== undefined ? pixelIdOverride : import.meta.env.VITE_META_PIXEL_ID)?.trim();

  // missing-ID guard: if an ID is missing, that tag is not loaded, nothing throws
  if (gaId) {
    _configuredGaId = gaId;
    const existingGa = document.head.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!existingGa && !gaScriptInjected) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      document.head.appendChild(script);
      gaScriptInjected = true;
    }

    window.dataLayer = window.dataLayer || [];
    function gtagImpl(...args: any[]) {
      window.dataLayer.push(args);
    }
    window.gtag = window.gtag || gtagImpl;
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: false });
  }

  if (pixelId) {
    _configuredPixelId = pixelId;
    const existingFb = document.head.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]');
    if (!existingFb && !metaScriptInjected) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
      metaScriptInjected = true;
    }

    if (!window.fbq) {
      const fbqImpl: any = function (...args: any[]) {
        fbqImpl.callMethod ? fbqImpl.callMethod.apply(fbqImpl, args) : fbqImpl.queue.push(args);
      };
      fbqImpl.push = fbqImpl;
      fbqImpl.loaded = true;
      fbqImpl.version = '2.0';
      fbqImpl.queue = [];
      window.fbq = fbqImpl;
      window._fbq = fbqImpl;
    }
    window.fbq('init', pixelId);
    // Explicitly NO auto fbq('track', 'PageView') on init
  }
}

export const init = initTracking;

export function pageView(path?: string): void {
  const currentPath = path ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');

  // page_view dedupe: ignore identical consecutive path (handles StrictMode double-effect on mount)
  if (lastTrackedPath === currentPath) {
    return;
  }
  lastTrackedPath = currentPath;

  safeGtag('event', 'page_view', {
    page_path: currentPath,
  });
  safeFbq('track', 'PageView');
}

export function viewItem(product: TrackingProduct): void {
  if (!product) return;
  const productId = String(product.id);
  const value = Number(product.price) || 0;

  safeGtag('event', 'view_item', {
    currency: 'VND',
    value,
    items: [
      {
        item_id: productId,
        item_name: product.name,
        price: value,
      },
    ],
  });

  safeFbq('track', 'ViewContent', {
    content_ids: [productId],
    content_name: product.name,
    content_type: 'product',
    value,
    currency: 'VND',
  });
}

export function addToCart(item: TrackingCartItem): void {
  if (!item) return;
  const itemId = String(item.productId || item.id || '');
  const price = Number(item.price) || 0;
  const quantity = Number(item.quantity) || 1;
  const value = price * quantity;

  safeGtag('event', 'add_to_cart', {
    currency: 'VND',
    value,
    items: [
      {
        item_id: itemId,
        item_name: item.name || '',
        price,
        quantity,
      },
    ],
  });

  safeFbq('track', 'AddToCart', {
    content_ids: [itemId],
    content_name: item.name || '',
    content_type: 'product',
    value,
    currency: 'VND',
  });
}

export function beginCheckout(params?: TrackingCheckoutParams | TrackingCartItem[], valueArg?: number): void {
  let items: TrackingCartItem[] = [];
  let value = 0;

  if (Array.isArray(params)) {
    items = params;
    value = typeof valueArg === 'number' ? valueArg : items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0);
  } else if (params && typeof params === 'object') {
    items = params.items || [];
    value = typeof params.value === 'number' ? params.value : items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0);
  }

  const gaItems = items.map(item => ({
    item_id: String(item.productId || item.id || ''),
    item_name: item.name || '',
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
  }));

  const contentIds = items.map(item => String(item.productId || item.id || ''));

  safeGtag('event', 'begin_checkout', {
    currency: 'VND',
    value,
    items: gaItems,
  });

  safeFbq('track', 'InitiateCheckout', {
    content_ids: contentIds,
    content_type: 'product',
    value,
    currency: 'VND',
    num_items: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
  });
}

export function zaloAuthStart(): void {
  safeGtag('event', 'zalo_auth_start');
  safeFbq('trackCustom', 'zalo_auth_start');
}

export function zaloAuthDone(): void {
  safeGtag('event', 'zalo_auth_done');
  safeFbq('trackCustom', 'zalo_auth_done');
}

export function purchase(order: TrackingOrder): void {
  if (!order || !order.order_number) return;
  const orderNumber = String(order.order_number);
  const guardKey = `${PURCHASE_GUARD_KEY_PREFIX}${orderNumber}`;

  // once-per-order guard via localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem(guardKey)) {
        return;
      }
      localStorage.setItem(guardKey, '1');
    }
  } catch {
    // safe no-op if storage blocked
  }

  const value = Number(order.value) || 0;
  const items = (order.items || []).map(item => ({
    item_id: String(item.item_id || item.productId || item.id || ''),
    item_name: item.item_name || item.name || '',
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 1,
  }));

  const contentIds = items.map(item => item.item_id);

  safeGtag('event', 'purchase', {
    transaction_id: orderNumber,
    value,
    currency: 'VND',
    items,
  });

  safeFbq(
    'track',
    'Purchase',
    {
      value,
      currency: 'VND',
      content_ids: contentIds,
      contents: items.map(item => ({
        id: item.item_id,
        quantity: item.quantity,
        item_price: item.price,
      })),
      content_type: 'product',
    },
    { eventID: orderNumber }
  );
}
