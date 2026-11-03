// AC8 (design 5.6): the one place the storefront sums stock; unknown (undefined) counts as 0.
export const sumStock = (stocks: readonly (number | undefined)[]): number =>
  stocks.reduce((sum: number, s) => sum + (s ?? 0), 0);

// AC8 (design 5.6 / R4): variants sharing a WMS stock_code are ONE row; keep one entry per
// stock_code before sumStock. No stock_code (rule off) = each variant stays its own entry.
// ponytail: members of one stock_code should report the same qty; if they ever differ, keep
// the minimum (never overstate). Unknown members are ignored unless all are unknown.
export const dedupeByStockCode = <T extends { stock_code?: string; stock?: number }>(variants: readonly T[]): T[] => {
  const byKey = new Map<string, T>();
  variants.forEach((v, i) => {
    const key = v.stock_code ? `code:${v.stock_code}` : `idx:${i}`;
    const prev = byKey.get(key);
    if (!prev || prev.stock === undefined || (v.stock !== undefined && v.stock < prev.stock)) byKey.set(key, v);
  });
  return [...byKey.values()];
};
