// AC8 (design 5.6): the one place the storefront sums stock; unknown (undefined) counts as 0.
export const sumStock = (stocks: readonly (number | undefined)[]): number =>
  stocks.reduce((sum: number, s) => sum + (s ?? 0), 0);
