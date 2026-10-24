// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

// Resizing or autosizing one column changes that column only: the others keep
// the width they had on screen, flex columns included.
const columns: ColumnDef[] = [
  { type: 'text', key: 'a', header: 'A', width: 100 },
  { type: 'text', key: 'b', header: 'B', flex: 1 },
  { type: 'text', key: 'c', header: 'C', flex: 1 },
];
const rows: GridRow[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }];
// What a browser would lay out for the three headers (jsdom lays out nothing).
const SHOWN = [100, 250, 250];

let grid: MountedGrid | null = null;
afterEach(() => {
  grid?.destroy();
  grid = null;
  vi.restoreAllMocks();
});

function layOut(): void {
  const real = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const head = this.closest('[role=columnheader]');
    const i = head ? Number(head.getAttribute('aria-colindex')) - 1 : -1;
    if (head === this && SHOWN[i] != null) return { width: SHOWN[i], height: 28, left: 0, top: 0, right: SHOWN[i], bottom: 28, x: 0, y: 0, toJSON() {} } as DOMRect;
    return real.call(this);
  });
}

const headers = () => [...grid!.target.querySelectorAll<HTMLElement>('[role=columnheader]')];
const widthOf = (el: HTMLElement) => /flex:\s*0 0 (\d+)px/.exec(el.getAttribute('style') ?? '')?.[1];

describe('changing one column width', () => {
  it('a drag resizes that column only; the flex columns keep their width', () => {
    const onColumnResize = vi.fn();
    grid = mountGrid({ rows, columns, onColumnResize });
    layOut();
    const grip = headers()[0].querySelector('.grip') as HTMLElement;
    grip.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 160 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 160 }));
    flushSync();
    expect(headers().map(widthOf)).toEqual(['160', '250', '250']);
    expect(onColumnResize).toHaveBeenCalledWith('a', 160);
  });

  it('Reset widths in the column menu brings the original layout back', () => {
    grid = mountGrid({ rows, columns, columnMenu: true });
    layOut();
    const grip = headers()[0].querySelector('.grip') as HTMLElement;
    grip.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 140 }));
    flushSync();
    expect(headers().map(widthOf)).toEqual(['140', '250', '250']);
    (headers()[1].querySelector('.hmenu') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    const reset = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find((m) => m.textContent?.trim() === 'Reset widths');
    expect(reset).toBeTruthy();
    reset!.click();
    flushSync();
    expect(headers().map(widthOf)).toEqual(['100', undefined, undefined]);
  });

  it('a click or a double-click on a grip, with no drag, changes no width', () => {
    const onColumnResize = vi.fn();
    grid = mountGrid({ rows, columns, columnMenu: true, onColumnResize });
    layOut();
    const grip = headers()[1].querySelector('.grip') as HTMLElement;
    for (let i = 0; i < 2; i++) {
      grip.dispatchEvent(new MouseEvent('pointerdown', { clientX: 350, bubbles: true }));
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 350 }));
    }
    grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    flushSync();
    // The flex columns still flex: nothing was frozen or saved.
    expect(headers().map(widthOf)).toEqual(['100', undefined, undefined]);
    expect(onColumnResize).not.toHaveBeenCalled();
  });

  it('offers Reset widths only once a width was changed', () => {
    grid = mountGrid({ rows, columns, columnMenu: true });
    (headers()[1].querySelector('.hmenu') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();
    const labels = [...document.querySelectorAll('[role=menuitem]')].map((m) => m.textContent?.trim());
    expect(labels).not.toContain('Reset widths');
  });
});
