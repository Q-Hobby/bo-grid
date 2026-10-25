import { afterEach, expect, it } from 'vitest';
import { amount, mountApp, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

it("shows each desk's total and the grand total in the grid", () => {
  app = mountApp();
  const grid = app.target.querySelector('[role=grid], [role=treegrid]');
  expect(grid, 'a bo-grid grid').toBeTruthy();
  const text = grid!.textContent ?? '';
  for (const desk of ['Equities', 'Rates', 'FX']) expect(text).toContain(desk);
  expect(text, 'Equities total').toMatch(amount(2_500_000));
  expect(text, 'Rates total').toMatch(amount(8_000_000));
  expect(text, 'FX total').toMatch(amount(3_500_000));
  expect(text, 'grand total').toMatch(amount(14_000_000));
});
