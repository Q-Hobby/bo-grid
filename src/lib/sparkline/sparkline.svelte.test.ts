// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Sparkline from './Sparkline.svelte';
import type { Candle } from '../types';

// The chart fills its cell: it follows the column's width (a resize,
// fitColumns) instead of a fixed 104px that overflows narrow columns and
// leaves wide ones half empty.
const candles: Candle[] = [
  { open: 1, high: 2, low: 0.5, close: 1.5, volume: 0 },
  { open: 1.5, high: 2.5, low: 1, close: 2, volume: 0 },
];

let observed: ((width: number) => void) | null = null;
class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(): void {
    observed = (width) => this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {
    observed = null;
  }
}

let app: ReturnType<typeof mount> | null = null;
let target: HTMLElement;
afterEach(() => {
  if (app) unmount(app);
  app = null;
  target?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function render(props: Record<string, unknown>): HTMLCanvasElement {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  const ctx = new Proxy({}, { get: () => () => {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  target = document.createElement('div');
  document.body.appendChild(target);
  app = mount(Sparkline, { target, props: { candles, ...props } as never });
  flushSync();
  return target.querySelector('canvas')!;
}

describe('Sparkline', () => {
  it('takes the width of its cell, and follows it', () => {
    const canvas = render({});
    observed?.(180);
    flushSync();
    expect(canvas.style.width).toBe('180px');
    observed?.(72);
    flushSync();
    expect(canvas.style.width).toBe('72px');
  });

  it('keeps a width given to it', () => {
    const canvas = render({ width: 120 });
    observed?.(300);
    flushSync();
    expect(canvas.style.width).toBe('120px');
  });
});
