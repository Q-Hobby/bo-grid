import { afterEach, beforeAll, expect, it } from 'vitest';
import { mountApp, num, rowWith, rows, settle, type MountedApp } from './setup';

beforeAll(() => {
  (globalThis as { __MANUAL_FEED__?: boolean }).__MANUAL_FEED__ = true;
});

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

it('shows a row for each symbol, and applies quotes', async () => {
  const { emit } = await import('../feed');
  app = mountApp();
  await settle();
  expect(rows(app.target)).toHaveLength(8);
  emit({ symbol: 'NVDA', last: 123.45, volume: 9000 });
  await settle();
  expect(rowWith(app.target, 'NVDA')?.textContent).toMatch(num(123.45));
  emit({ symbol: 'NVDA', last: 124.5, volume: 9100 });
  emit({ symbol: 'MSFT', last: 410.25, volume: 500 });
  await settle();
  expect(rowWith(app.target, 'NVDA')?.textContent).toMatch(num(124.5));
  expect(rowWith(app.target, 'MSFT')?.textContent).toMatch(num(410.25));
});
