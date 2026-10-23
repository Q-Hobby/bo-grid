import { describe, expect, it } from 'vitest';
import { createEditHistory, type EditEntry } from './history';

const edit = (old: number, value: number): EditEntry<string, string> => ({ row: 'r', col: 'c', old, value });

/** Undo, returning the entries it restored (undefined when nothing was undone). */
function undo<R, C>(h: { undo(apply: (e: EditEntry<R, C>) => void): boolean }): EditEntry<R, C>[] | undefined {
  const seen: EditEntry<R, C>[] = [];
  return h.undo((e) => seen.push(e)) ? seen : undefined;
}
function redo<R, C>(h: { redo(apply: (e: EditEntry<R, C>) => void): boolean }): EditEntry<R, C>[] | undefined {
  const seen: EditEntry<R, C>[] = [];
  return h.redo((e) => seen.push(e)) ? seen : undefined;
}

describe('createEditHistory', () => {
  it('undoes and redoes single edits in order', () => {
    const h = createEditHistory<string, string>();
    expect(h.canUndo).toBe(false);
    h.record(edit(1, 2));
    h.record(edit(2, 3));
    expect(undo(h)).toEqual([edit(2, 3)]);
    expect(undo(h)).toEqual([edit(1, 2)]);
    expect(undo(h)).toBeUndefined();
    expect(h.canRedo).toBe(true);
    expect(redo(h)).toEqual([edit(1, 2)]);
    expect(h.canUndo).toBe(true);
  });

  it('records a batch as one step, and an empty batch as none', () => {
    const h = createEditHistory<string, string>();
    h.batch(() => {
      h.record(edit(1, 2));
      h.record(edit(3, 4));
    });
    h.batch(() => {});
    expect(undo(h)).toEqual([edit(1, 2), edit(3, 4)]);
    expect(h.canUndo).toBe(false);
  });

  it('a nested batch records its own step, closed before the outer one', () => {
    const h = createEditHistory<string, string>();
    h.batch(() => {
      h.record(edit(1, 2));
      h.batch(() => h.record(edit(2, 3)));
    });
    expect(undo(h)).toEqual([edit(1, 2)]);
    expect(undo(h)).toEqual([edit(2, 3)]);
  });

  it('closes the batch when its function throws', () => {
    const h = createEditHistory<string, string>();
    expect(() =>
      h.batch(() => {
        h.record(edit(1, 2));
        throw new Error('boom');
      }),
    ).toThrow('boom');
    h.record(edit(5, 6));
    expect(undo(h)).toEqual([edit(5, 6)]);
    expect(undo(h)).toEqual([edit(1, 2)]);
  });

  it('a new edit clears the redo stack', () => {
    const h = createEditHistory<string, string>();
    h.record(edit(1, 2));
    undo(h);
    h.record(edit(1, 9));
    expect(h.canRedo).toBe(false);
  });

  it('keeps at most `limit` steps, dropping the oldest', () => {
    const h = createEditHistory<string, string>(2);
    h.record(edit(1, 2));
    h.record(edit(2, 3));
    h.record(edit(3, 4));
    expect(undo(h)).toEqual([edit(3, 4)]);
    expect(undo(h)).toEqual([edit(2, 3)]);
    expect(undo(h)).toBeUndefined();
  });

  it('drops a step whose apply throws instead of moving it', () => {
    const h = createEditHistory<string, string>();
    h.record(edit(1, 2));
    expect(() =>
      h.undo(() => {
        throw new Error('app');
      }),
    ).toThrow('app');
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});
