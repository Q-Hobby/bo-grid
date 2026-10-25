/** Quantities saved to the server, in order. */
export const saved: { symbol: string; qty: number }[] = [];

/** Saves an order's new quantity. */
export function saveQty(symbol: string, qty: number): void {
  saved.push({ symbol, qty });
}
