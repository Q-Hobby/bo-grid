import { flushSync } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { saved } from '../api';
import { mountApp, press, rowWith, settle, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

/** Double-clicks the order's Qty cell, types `value` and presses Enter; then
    Escape, in case the grid kept the editor open on a refused value. */
async function edit(target: HTMLElement, symbol: string, current: string, value: string): Promise<void> {
  const cell = [...rowWith(target, symbol)!.querySelectorAll<HTMLElement>('[role=gridcell]')].find((c) => c.textContent?.trim() === current);
  expect(cell, `${symbol} qty cell showing ${current}`).toBeDefined();
  cell!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  flushSync();
  const input = target.querySelector<HTMLInputElement>('input');
  expect(input, 'an editor opened').toBeTruthy();
  input!.value = value;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
  press(input!, 'Enter');
  const open = target.querySelector('input');
  if (open) press(open, 'Escape');
  await settle();
}

it('saves a whole number above zero, and shows it', async () => {
  app = mountApp();
  await edit(app.target, 'AAPL', '100', '250');
  expect(saved).toContainEqual({ symbol: 'AAPL', qty: 250 });
  expect(rowWith(app.target, 'AAPL')?.textContent).toContain('250');
});

it('refuses zero, negative and fractional quantities', async () => {
  app = mountApp();
  const before = saved.length;
  for (const bad of ['0', '-5', '1.5']) await edit(app.target, 'MSFT', '40', bad);
  expect(saved.length).toBe(before);
  expect(rowWith(app.target, 'MSFT')?.textContent).toContain('40');
});
