import { flushSync } from 'svelte';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { levels } from '../levels';
import { mountApp, press, rowWith, settle, styling, type MountedApp } from './setup';

beforeAll(() => {
  (globalThis as { __MANUAL_FEED__?: boolean }).__MANUAL_FEED__ = true;
});

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

const mid = (symbol: string) => (levels[symbol].above + levels[symbol].below) / 2;
const look = (symbol: string) => styling(rowWith(app!.target, symbol)!);
/** Waits out the price flashes, so only lasting styles count. */
const calm = () => settle(1500);

async function start() {
  const { emit, SYMBOLS } = await import('../feed');
  app = mountApp();
  await settle();
  for (const symbol of SYMBOLS) emit({ symbol, last: mid(symbol), volume: 1 });
  await calm();
  for (const symbol of SYMBOLS) expect(rowWith(app.target, symbol), symbol).toBeDefined();
  return { emit, before: Object.fromEntries(SYMBOLS.map((s) => [s, look(s)])) };
}

it('lights a row whose price crosses a level, keeps it lit, and A on the row acknowledges it', async () => {
  const { emit, before } = await start();
  emit({ symbol: 'NVDA', last: levels.NVDA.above + 1, volume: 1 });
  await calm();
  expect(look('NVDA'), 'NVDA lit').not.toBe(before.NVDA);
  expect(look('MSFT'), 'MSFT not lit').toBe(before.MSFT);

  emit({ symbol: 'NVDA', last: mid('NVDA'), volume: 1 });
  await calm();
  expect(look('NVDA'), 'still lit after the price comes back').not.toBe(before.NVDA);

  const cell = rowWith(app!.target, 'NVDA')!.querySelector('[role=gridcell]')!;
  cell.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  cell.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
  cell.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  flushSync();
  press(app!.target.querySelector('[role=grid], [role=treegrid]')!, 'a');
  await calm();
  expect(look('NVDA'), 'dark after A').toBe(before.NVDA);
});

it('lights a row that falls to its lower level, and "Acknowledge all" darkens every row', async () => {
  const { emit, before } = await start();
  emit({ symbol: 'MSFT', last: levels.MSFT.below - 1, volume: 1 });
  emit({ symbol: 'AAPL', last: levels.AAPL.above + 1, volume: 1 });
  await calm();
  expect(look('MSFT'), 'MSFT lit').not.toBe(before.MSFT);
  expect(look('AAPL'), 'AAPL lit').not.toBe(before.AAPL);
  const button = [...app!.target.querySelectorAll('button')].find((b) => /acknowledge all/i.test(b.textContent ?? ''));
  expect(button, 'an "Acknowledge all" button').toBeDefined();
  button!.click();
  await calm();
  expect(look('MSFT')).toBe(before.MSFT);
  expect(look('AAPL')).toBe(before.AAPL);
});
