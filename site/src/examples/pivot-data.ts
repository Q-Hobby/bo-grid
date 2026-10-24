// Trades for the pivot example: one row per fill, by desk and month, notional in $ thousands.
export type Trade = { id: number; desk: string; book: string; month: string; notional: number };

const DESKS = [
  ['Equities', 'Cash'],
  ['Equities', 'Derivatives'],
  ['Rates', 'Govies'],
  ['FX', 'Spot'],
  ['FX', 'Forwards'],
] as const;
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];

export function trades(): Trade[] {
  const out: Trade[] = [];
  let id = 1;
  for (const [desk, book] of DESKS) {
    for (const month of MONTHS) {
      // Two fills a month, sized from the ids so the table is the same on every load.
      for (let k = 0; k < 2; k++, id++) out.push({ id, desk, book, month, notional: ((id * 7919) % 900) + 50 });
    }
  }
  return out;
}
