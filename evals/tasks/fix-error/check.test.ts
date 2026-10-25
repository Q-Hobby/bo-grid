import { afterEach, expect, it } from 'vitest';
import { mountApp, rows, type MountedApp } from './setup';

let app: MountedApp | undefined;
afterEach(() => app?.destroy());

it('starts without a ?keep= parameter, and shows the trades', () => {
  expect(() => (app = mountApp())).not.toThrow();
  expect(rows(app!.target)).toHaveLength(2);
});
