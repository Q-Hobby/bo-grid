import { flushSync } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import { mountApp, rowWith, settle, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

const pinned = (target: Element) => [...target.querySelectorAll('.pinned-top .row')].map((r) => r.textContent ?? '').join(' / ');

it('pins a row from its right-click menu, and keeps it pinned after a reload', async () => {
  localStorage.clear();
  app = mountApp();
  rowWith(app.target, 'NVDA')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
  flushSync();
  const item = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((m) => /\bpin\b/i.test(m.textContent ?? ''));
  expect(item, 'a pin item in the row menu').toBeDefined();
  item!.click();
  await settle();
  expect(pinned(app.target), 'NVDA pinned').toContain('NVDA');
  expect(pinned(app.target), 'only NVDA').not.toContain('AAPL');

  app.destroy();
  app = mountApp(); // a reload: same storage, fresh app
  await settle();
  expect(pinned(app.target), 'still pinned after a reload').toContain('NVDA');
});
