import { afterEach, expect, it } from 'vitest';
import { TOTAL, requestLog } from '../api';
import { header, mountApp, rows, settle, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

it('loads only a window of the orders, and shows the first ones', async () => {
  requestLog.length = 0;
  app = mountApp();
  await settle(400);
  expect(requestLog.length, 'asked the server').toBeGreaterThan(0);
  for (const r of requestLog) expect(r.end - r.start, `a request for ${r.start}–${r.end}`).toBeLessThanOrEqual(5000);
  expect(requestLog.some((r) => r.start === 0 && r.end < TOTAL), 'asked for the first rows').toBe(true);
  const first = rows(app.target)[0]?.join(' ') ?? '';
  expect(first, 'order #1').toMatch(/(^|\D)1(\D|$)/);
  expect(first).toContain('AAPL');
});

it('asks the server to sort when a header is clicked', async () => {
  requestLog.length = 0;
  app = mountApp();
  await settle(400);
  header(app.target, 'Qty', 'Quantity')!.click();
  await settle(400);
  expect(requestLog.some((r) => r.sort?.key === 'qty'), 'a request sorted by qty').toBe(true);
  // Ascending, the orders of quantity 1 come first: #1, then #1001 (unsorted,
  // the second row is #2).
  const second = rows(app.target)[1]?.join(' | ') ?? '';
  expect(second, 'second row').toMatch(/(^|\D)1[,.\s ]?001(\D|$)/);
});
