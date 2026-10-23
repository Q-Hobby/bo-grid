// @vitest-environment jsdom
// DepthLadder: rows on the tick grid around the market, following it without
// moving under the pointer, and the actions a click or key asks for.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DepthLadder from './DepthLadder.svelte';
import type { BookLevel, LadderAction, LadderOrder } from './types';
import '../grid/test-fixtures/mount-grid'; // jsdom stubs (ResizeObserver)

const at = (i: number) => Math.round(i * 5) / 100; // tick 0.05, i in ticks
function book(midTicks: number): { bids: BookLevel[]; asks: BookLevel[] } {
  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  for (let i = 1; i <= 20; i++) {
    bids.push([at(midTicks - i), 100 * i]);
    asks.push([at(midTicks + i), 10 * i]);
  }
  return { bids, asks };
}

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

function setup(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const actions: LadderAction[] = [];
  const props: {
    bids: BookLevel[];
    asks: BookLevel[];
    tick: number;
    rows: number;
    orders: LadderOrder[];
    following: boolean;
    last?: number;
    onAction: (a: LadderAction) => void;
    [k: string]: unknown;
  } = $state({ ...book(5000), tick: 0.05, rows: 9, orders: [], following: true, onAction: (a: LadderAction) => actions.push(a), ...extra });
  const ladder = mount(DepthLadder, { target, props });
  flushSync();
  stop = () => {
    unmount(ladder);
    target.remove();
  };
  const wrap = target.querySelector('.bo-ladder') as HTMLElement;
  const rowEls = () =>
    [...target.querySelectorAll('.spacer > .row')].sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')));
  const prices = () => rowEls().map((r) => r.querySelector('[aria-colindex="4"]')?.textContent?.trim());
  const cell = (price: string, col: number) => rowEls().find((r) => r.querySelector('[aria-colindex="4"]')?.textContent?.trim() === price)!.querySelector(`[aria-colindex="${col}"]`) as HTMLElement;
  return { props, actions, wrap, prices, cell };
}

describe('DepthLadder', () => {
  it('lists prices highest first around the mid, with sizes, depth and the best prices', () => {
    const l = setup();
    expect(l.prices()).toEqual(['250.20', '250.15', '250.10', '250.05', '250.00', '249.95', '249.90', '249.85', '249.80']);
    expect(l.cell('250.05', 5).textContent?.trim()).toBe('10');
    expect(l.cell('250.00', 5).textContent?.trim()).toBe('');
    expect(l.cell('249.95', 3).textContent?.trim()).toBe('100');
    expect(l.cell('249.95', 4).classList.contains('bo-lad-best')).toBe(true);
    // Depth bars: one per level with depth, none in the spread.
    expect(l.cell('249.90', 2).querySelector('.bo-databar')).not.toBeNull();
    expect(l.cell('250.00', 2).querySelector('.bo-databar')).toBeNull();
  });

  it('marks the last trade and shows your orders beside their side', () => {
    const l = setup({
      last: 250.05,
      orders: [
        { id: 1, side: 'buy', price: 249.9, qty: 300 },
        { id: 2, side: 'buy', price: 249.9, qty: 200 },
        { id: 3, side: 'sell', price: 250.1, qty: 50 },
      ],
    });
    expect(l.cell('250.05', 4).classList.contains('bo-lad-last')).toBe(true);
    expect(l.cell('249.90', 1).textContent?.trim()).toBe('500');
    expect(l.cell('250.10', 7).textContent?.trim()).toBe('50');
  });

  it('asks to buy on the bid side, sell on the ask side and cancel on your orders', () => {
    const l = setup({ orders: [{ id: 7, side: 'sell', price: 250.1, qty: 50 }] });
    l.cell('249.90', 3).click();
    l.cell('250.15', 5).click();
    l.cell('250.10', 7).click();
    l.cell('250.20', 7).click();
    l.cell('250.00', 4).click(); // the price column asks for nothing
    const ids = (a: LadderAction) => (a.kind === 'cancel' ? a.orders.map((o) => o.id) : []);
    expect(l.actions.map((a) => [a.kind, a.price, ids(a)])).toEqual([
      ['buy', 249.9, []],
      ['sell', 250.15, []],
      ['cancel', 250.1, [7]],
      ['sell', 250.2, []],
    ]);
    expect(l.actions.every((a) => a.via === 'click')).toBe(true);
  });

  it('B, S and Delete act on the focused row; Space follows the market again', () => {
    const l = setup({ orders: [{ id: 1, side: 'buy', price: 249.9, qty: 300 }] });
    const target = l.cell('249.90', 4);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    flushSync();
    const key = (k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key('b');
    key('S');
    key('Delete');
    expect(l.actions.map((a) => [a.kind, a.price, a.via])).toEqual([
      ['buy', 249.9, 'key'],
      ['sell', 249.9, 'key'],
      ['cancel', 249.9, 'key'],
    ]);
    const cancel = l.actions[2];
    expect(cancel.kind === 'cancel' && cancel.orders.map((o) => o.id)).toEqual([1]);
    l.props.following = false;
    flushSync();
    key(' ');
    flushSync();
    expect(l.props.following).toBe(true);
  });

  it('a held key places one order, not one per repeat', () => {
    const l = setup();
    const target = l.cell('249.90', 4);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    flushSync();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
    for (let i = 0; i < 5; i++) target.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', repeat: true, bubbles: true, cancelable: true }));
    expect(l.actions).toHaveLength(1);
  });

  it('a click focuses the grid but does not hold the ladder once the pointer leaves', () => {
    const l = setup();
    l.wrap.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    const target = l.cell('249.90', 3);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    target.click();
    flushSync();
    expect(l.wrap.contains(document.activeElement)).toBe(true);
    l.wrap.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    Object.assign(l.props, book(5010));
    flushSync();
    expect(l.prices()[4]).toBe('250.50');
  });

  it('focus the keyboard works in holds the ladder', () => {
    const l = setup();
    const target = l.cell('249.90', 4);
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    flushSync();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    Object.assign(l.props, book(5010));
    flushSync();
    expect(l.prices()[4]).toBe('250.00');
  });

  it('small wheel steps add up; Ctrl+wheel is left to the browser', () => {
    const l = setup();
    const roll = (deltaY: number, ctrlKey = false) => {
      const e = new WheelEvent('wheel', { deltaY, ctrlKey, cancelable: true, bubbles: true });
      l.wrap.dispatchEvent(e);
      return e.defaultPrevented;
    };
    for (let i = 0; i < 3; i++) roll(-10);
    flushSync();
    expect(l.prices()[4]).toBe('250.00');
    expect(roll(-10)).toBe(true);
    flushSync();
    expect(l.prices()[4]).toBe('250.05');
    expect(roll(-500, true)).toBe(false);
    flushSync();
    expect(l.prices()[4]).toBe('250.05');
  });

  it('the wheel pages through prices and stops following', () => {
    const l = setup();
    l.wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true }));
    flushSync();
    expect(l.prices()[0]).toBe('250.35');
    expect(l.props.following).toBe(false);
    // Not following: the market moving away does not bring it back.
    Object.assign(l.props, book(5040));
    flushSync();
    expect(l.prices()[0]).toBe('250.35');
    // Following again recentres at once, wherever the market is.
    l.props.following = true;
    flushSync();
    expect(l.prices()[4]).toBe('252.00');
  });

  it('following again recentres at once, even with the market still in the middle half', () => {
    const l = setup();
    l.wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true }));
    flushSync();
    expect(l.prices()[4]).toBe('249.85');
    l.props.following = true;
    flushSync();
    expect(l.prices()[4]).toBe('250.00');
  });

  it('recentres only once the market leaves the middle half of the window', () => {
    const l = setup();
    Object.assign(l.props, book(5001));
    flushSync();
    expect(l.prices()[4]).toBe('250.00');
    Object.assign(l.props, book(5003));
    flushSync();
    expect(l.prices()[4]).toBe('250.15');
  });

  it('holds still under the pointer and catches up when it leaves', () => {
    const l = setup();
    l.wrap.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    flushSync();
    Object.assign(l.props, book(5010));
    flushSync();
    expect(l.prices()[4]).toBe('250.00');
    l.wrap.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    flushSync();
    expect(l.prices()[4]).toBe('250.50');
  });

  it('a touch does not hold it', () => {
    const l = setup();
    l.wrap.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    Object.assign(l.props, book(5010));
    flushSync();
    expect(l.prices()[4]).toBe('250.50');
  });

  it('can follow the last trade instead of the mid', () => {
    const l = setup({ center: 'last', last: 249.5 });
    expect(l.prices()[4]).toBe('249.50');
  });

  it('shows nothing until the book or a trade gives it a price', () => {
    const onAction = vi.fn();
    const l = setup({ bids: [], asks: [], onAction });
    expect(l.prices()).toEqual([]);
    l.props.asks = [[251, 5]];
    flushSync();
    expect(l.prices()[4]).toBe('251.00');
  });
});
