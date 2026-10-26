import { afterEach, expect, it } from 'vitest';
import { header, mountApp, num, rowWith, rows, settle, styling, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

const symbolOf = (row: string[]) => row.find((cell) => /^[A-Z]{4}$/.test(cell));

it('shows the five positions with their P&L', () => {
  app = mountApp();
  expect(rows(app.target)).toHaveLength(5);
  const pnl = { AAPL: 930, MSFT: -245, NVDA: 2250, TSLA: -372, AMZN: 64 };
  for (const [symbol, value] of Object.entries(pnl)) {
    const row = rowWith(app.target, symbol);
    expect(row, symbol).toBeDefined();
    expect(row!.textContent).toMatch(num(value));
  }
});

it('colours a positive P&L differently from a negative one', () => {
  app = mountApp();
  const pnlCell = (symbol: string, value: number) =>
    [...rowWith(app!.target, symbol)!.querySelectorAll<HTMLElement>('[role=gridcell]')].find((c) => num(value).test(c.textContent ?? ''));
  const up = pnlCell('AAPL', 930);
  const down = pnlCell('MSFT', -245);
  expect(up && down, 'the P&L cells').toBeTruthy();
  expect(styling(up!)).not.toBe(styling(down!));
});

it('sorts by Qty from its header', async () => {
  app = mountApp();
  expect(symbolOf(rows(app.target)[0])).toBe('AAPL');
  const qty = header(app.target, 'Qty', 'Quantity');
  expect(qty).toBeDefined();
  qty!.click();
  await settle();
  // Ascending puts TSLA (-30) first; descending, NVDA (200).
  expect(['TSLA', 'NVDA']).toContain(symbolOf(rows(app.target)[0]));
});
