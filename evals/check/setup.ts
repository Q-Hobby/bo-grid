// Grader helpers. run.mjs copies this file and the task's check.test.ts into
// src/__eval__/ after the agent has finished, so the agent never sees them.
import { flushSync, mount, unmount } from 'svelte';
import App from '../App.svelte';

// jsdom has no ResizeObserver; the grid measures its viewport with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

export interface MountedApp {
  target: HTMLElement;
  destroy(): void;
}

export function mountApp(): MountedApp {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(App, { target });
  flushSync();
  return {
    target,
    destroy() {
      unmount(app);
      target.remove();
    },
  };
}

/** Waits for the grid's next frames (batched updates, flashes). */
export async function settle(ms = 80): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
  flushSync();
}

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The rendered data rows, each as its cells' text. */
export function rows(target: Element): string[][] {
  return [...target.querySelectorAll('.viewport .row')].map((row) => [...row.querySelectorAll('[role=gridcell]')].map(text));
}

/** The first data row with a cell that reads `cell`. */
export function rowWith(target: Element, cell: string): HTMLElement | undefined {
  return [...target.querySelectorAll<HTMLElement>('.viewport .row')].find((row) => [...row.querySelectorAll('[role=gridcell]')].some((c) => text(c) === cell));
}

/** The header cell whose text starts with one of `names` (case-insensitive). */
export function header(target: Element, ...names: string[]): HTMLElement | undefined {
  return [...target.querySelectorAll<HTMLElement>('[role=columnheader]')].find((h) => names.some((n) => text(h).toLowerCase().startsWith(n.toLowerCase())));
}

/** The grid's own passing state on an element: a flash, the selection, the
    focused cell. */
const TRANSIENT = new Set(['flash', 'held', 'alt', 'up', 'down', 'keep', 'sel', 'focus', 'fillpreview']);

/** How an element and everything in it is styled (classes and inline
    styles, without the grid's passing state), not what it says. */
export function styling(el: Element): string {
  return [el, ...el.querySelectorAll('*')]
    .map((e) => {
      const cls = (e.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !TRANSIENT.has(c));
      return `${cls.join(' ')}|${e.getAttribute('style') ?? ''}`;
    })
    .join('/');
}

/** Matches a number however the grid formats it: separators, decimals, a
    minus sign or a typographic minus. */
export function num(n: number): RegExp {
  const [int, frac] = Math.abs(n).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '[,.\\s\\u202f]?');
  const sign = n < 0 ? '[-\\u2212(]' : '(?<![-\\u2212\\d.,])';
  const decimals = frac ? `[.,]${frac}0*` : '([.,]0+)?';
  // Not followed by more digits: 100 does not match 100.5 or 1005.
  return new RegExp(`${sign}\\$?${grouped}${decimals}(?![.,]?\\d)`);
}

/** Like `num`, but also matches a compact amount: 2.5M, 750K. */
export function amount(n: number): RegExp {
  const [div, unit] = Math.abs(n) >= 1e9 ? [1e9, 'B'] : Math.abs(n) >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const [int, frac] = (Math.round((n / div) * 100) / 100).toString().replace('-', '').split('.');
  const compact = `(?<![\\d.,])${n < 0 ? '[-\\u2212]' : ''}\\$?${int}${frac ? `[.,]${frac}0*` : '([.,]0+)?'}\\s?${unit}\\b`;
  return new RegExp(`${num(n).source}|${compact}`);
}

export function press(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  flushSync();
}
