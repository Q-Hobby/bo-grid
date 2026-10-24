import { describe, expect, it } from 'vitest';
import { fitInView } from './fit-view';

describe('fitInView', () => {
  it('leaves a box that fits where it opened', () => {
    expect(fitInView(100, 100, 150, 200, 1200, 800)).toEqual({ x: 100, y: 100 });
  });

  it('moves a box left to stay on screen', () => {
    expect(fitInView(1100, 100, 150, 200, 1200, 800)).toEqual({ x: 1046, y: 100 });
  });

  it('opens upward when there is no room below', () => {
    expect(fitInView(100, 700, 150, 200, 1200, 800)).toEqual({ x: 100, y: 500 });
  });

  it('stays inside a window too small for it', () => {
    expect(fitInView(-20, 50, 150, 900, 1200, 800)).toEqual({ x: 4, y: 4 });
  });
});
