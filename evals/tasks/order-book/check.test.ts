import { afterEach, beforeAll, expect, it } from 'vitest';
import { mountApp, num, rows, settle, type MountedApp } from './setup';

beforeAll(() => {
  (globalThis as { __MANUAL_FEED__?: boolean }).__MANUAL_FEED__ = true;
});

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

/** The rows' text, in order. */
const shown = (target: HTMLElement) => rows(target).map((r) => r.join(' | '));
const priceOrder = (target: HTMLElement, prices: number[]) =>
  shown(target)
    .map((text) => prices.findIndex((p) => num(p).test(text)))
    .filter((i) => i >= 0);

it('shows the asks above the bids, with the running total from the spread', async () => {
  const { emitDepth } = await import('../depth');
  app = mountApp();
  await settle();
  emitDepth({ type: 'snapshot', bids: [['100.0', '5'], ['99.5', '3']], asks: [['100.5', '2'], ['101.0', '4']], seq: 1 });
  await settle();
  const text = shown(app.target);
  expect(text, 'four levels').toHaveLength(4);
  // Farthest ask first, then the best ask, the best bid, the farthest bid.
  expect(priceOrder(app.target, [101, 100.5, 100, 99.5])).toEqual([0, 1, 2, 3]);
  const row = (price: number) => text.find((t) => num(price).test(t))!;
  expect(row(101), 'ask 101: 2 + 4').toMatch(num(6));
  expect(row(100.5), 'ask 100.5').toMatch(num(2));
  expect(row(100), 'bid 100').toMatch(num(5));
  expect(row(99.5), 'bid 99.5: 5 + 3').toMatch(num(8));
});

it('applies updates, and removes a level whose size is 0', async () => {
  const { emitDepth } = await import('../depth');
  app = mountApp();
  await settle();
  emitDepth({ type: 'snapshot', bids: [['100.0', '5'], ['99.5', '3']], asks: [['100.5', '2'], ['101.0', '4']], seq: 1 });
  emitDepth({ type: 'update', bids: [['100.0', '0'], ['99.8', '1']], asks: [], from: 2, seq: 2 });
  await settle();
  const text = shown(app.target);
  expect(text.some((t) => num(100).test(t)), 'level 100 removed').toBe(false);
  expect(priceOrder(app.target, [101, 100.5, 99.8, 99.5])).toEqual([0, 1, 2, 3]);
  expect(text.find((t) => num(99.5).test(t)), 'bid 99.5: 1 + 3').toMatch(num(4));
});

it('reconnects for a fresh snapshot when an update skips a sequence number', async () => {
  const { emitDepth, connectionCount } = await import('../depth');
  app = mountApp();
  await settle();
  const before = connectionCount();
  emitDepth({ type: 'snapshot', bids: [['100.0', '5']], asks: [['100.5', '2']], seq: 1 });
  emitDepth({ type: 'update', bids: [['99.9', '7']], asks: [], from: 5, seq: 6 });
  await settle();
  expect(connectionCount(), 'connected again').toBeGreaterThan(before);
  expect(shown(app.target).some((t) => num(99.9).test(t)), 'the out-of-sequence update is not applied').toBe(false);
  emitDepth({ type: 'snapshot', bids: [['98.0', '1']], asks: [['98.5', '1']], seq: 20 });
  await settle();
  expect(priceOrder(app.target, [98.5, 98])).toEqual([0, 1]);
});
