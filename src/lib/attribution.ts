export const ATTRIBUTION_STORAGE_KEY = 'voma_storefront_attribution';
export const ATTRIBUTION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const ALLOWED_ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

export type AttributionKey = (typeof ALLOWED_ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey, string>>;

interface StoredAttributionEnvelope {
  ts: number;
  attribution: Attribution;
}

export function captureAttribution(searchQuery?: string | URLSearchParams): Attribution | null {
  if (typeof window === 'undefined') return null;

  let params: URLSearchParams;
  if (searchQuery instanceof URLSearchParams) {
    params = searchQuery;
  } else if (typeof searchQuery === 'string') {
    params = new URLSearchParams(searchQuery);
  } else {
    params = new URLSearchParams(window.location.search);
  }

  const captured: Attribution = {};
  for (const key of ALLOWED_ATTRIBUTION_KEYS) {
    const val = params.get(key);
    if (val !== null && val.trim() !== '') {
      captured[key] = val.trim();
    }
  }

  // A new landing with any of the params overwrites the stored values
  if (Object.keys(captured).length > 0) {
    try {
      const envelope: StoredAttributionEnvelope = {
        ts: Date.now(),
        attribution: captured,
      };
      localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(envelope));
      return captured;
    } catch {
      // localStorage restricted
    }
  }

  return null;
}

export function readAttribution(): Attribution | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return undefined;

    const parsed: Partial<StoredAttributionEnvelope> = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return undefined;
    }

    const { ts, attribution } = parsed;
    if (typeof ts !== 'number' || !attribution || typeof attribution !== 'object') {
      localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return undefined;
    }

    // 30-day compare: values older than 30 days are ignored and removed
    if (Date.now() - ts > ATTRIBUTION_EXPIRY_MS) {
      localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return undefined;
    }

    const cleaned: Attribution = {};
    for (const key of ALLOWED_ATTRIBUTION_KEYS) {
      const val = attribution[key];
      if (typeof val === 'string' && val.trim() !== '') {
        cleaned[key] = val.trim();
      }
    }

    if (Object.keys(cleaned).length === 0) {
      return undefined;
    }

    return cleaned;
  } catch {
    return undefined;
  }
}
