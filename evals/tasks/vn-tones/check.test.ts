import { resolveTone, vnBands } from 'bo-grid/trading';
import { afterEach, expect, it } from 'vitest';
import { stocks } from '../board';
import { mountApp, num, rowWith, styling, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

// The reference: bo-grid's own price-limit rules.
const expected = stocks.map((s) => {
  const bands = vnBands(s.ref, s.exchange);
  return { ...s, bands, tone: resolveTone(s.price, bands) };
});

const cells = (symbol: string) => [...(rowWith(app!.target, symbol)?.querySelectorAll('[role=gridcell]') ?? [])];

it('covers every tone (a check on the data)', () => {
  expect(expected.map((s) => s.tone)).toEqual(['ceiling', 'floor', 'ref', 'up', 'down', 'floor', 'ceiling']);
});

it("shows each stock's ceiling and floor from its exchange's price limit", () => {
  app = mountApp();
  for (const s of expected) {
    const text = rowWith(app.target, s.id)?.textContent ?? '';
    expect(text, `${s.id} ceiling ${s.bands.ceiling}`).toMatch(num(s.bands.ceiling!));
    expect(text, `${s.id} floor ${s.bands.floor}`).toMatch(num(s.bands.floor!));
  }
});

it('colours the price and the symbol by tone: one look per tone', () => {
  app = mountApp();
  type Stock = (typeof expected)[number];
  for (const [what, pick] of [
    // Price is the last column, and a price can equal the ceiling, floor or ref.
    ['price', (s: Stock) => cells(s.id).findLast((c) => num(s.price).test(c.textContent ?? ''))],
    ['symbol', (s: Stock) => cells(s.id).find((c) => c.textContent?.trim() === s.id)],
  ] as const) {
    const looks = new Map<string, string>();
    for (const s of expected) {
      const cell = pick(s);
      expect(cell, `${s.id} ${what} cell`).toBeDefined();
      const l = styling(cell!);
      if (looks.has(s.tone)) expect(l, `${s.id} ${what} looks like the other ${s.tone} stock`).toBe(looks.get(s.tone));
      else {
        expect([...looks.values()], `${s.id} ${what} (${s.tone}) looks different from the other tones`).not.toContain(l);
        looks.set(s.tone, l);
      }
    }
  }
});
