import { describe, expect, it } from 'vitest';
import { EditHistory, type EditEntry } from './history';

const edit = (old: number, value: number): EditEntry<string, string> => ({ row: 'r', col: 'c', old, value });

describe('EditHistory', () => {
  it('undoes and redoes single edits in order', () => {
    const h = new EditHistory<string, string>();
    expect(h.canUndo).toBe(false);
    h.record(edit(1, 2));
    h.record(edit(2, 3));
    expect(h.undo()).toEqual([edit(2, 3)]);
    expect(h.undo()).toEqual([edit(1, 2)]);
    expect(h.undo()).toBeUndefined();
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toEqual([edit(1, 2)]);
    expect(h.canUndo).toBe(true);
  });

  it('records a batch as one step, and an empty batch as none', () => {
    const h = new EditHistory<string, string>();
    h.batch(() => {
      h.record(edit(1, 2));
      h.record(edit(3, 4));
    });
    h.batch(() => {});
    expect(h.undo()).toEqual([edit(1, 2), edit(3, 4)]);
    expect(h.canUndo).toBe(false);
  });

  it('a nested batch records its own step, closed before the outer one', () => {
    const h = new EditHistory<string, string>();
    h.batch(() => {
      h.record(edit(1, 2));
      h.batch(() => h.record(edit(2, 3)));
    });
    expect(h.undo()).toEqual([edit(1, 2)]);
    expect(h.undo()).toEqual([edit(2, 3)]);
  });

  it('closes the batch when its function throws', () => {
    const h = new EditHistory<string, string>();
    expect(() =>
      h.batch(() => {
        h.record(edit(1, 2));
        throw new Error('boom');
      }),
    ).toThrow('boom');
    h.record(edit(5, 6));
    expect(h.undo()).toEqual([edit(5, 6)]);
    expect(h.undo()).toEqual([edit(1, 2)]);
  });

  it('a new edit clears the redo stack', () => {
    const h = new EditHistory<string, string>();
    h.record(edit(1, 2));
    h.undo();
    h.record(edit(1, 9));
    expect(h.canRedo).toBe(false);
  });

  it('keeps at most `limit` steps, dropping the oldest', () => {
    const h = new EditHistory<string, string>(2);
    h.record(edit(1, 2));
    h.record(edit(2, 3));
    h.record(edit(3, 4));
    expect(h.undo()).toEqual([edit(3, 4)]);
    expect(h.undo()).toEqual([edit(2, 3)]);
    expect(h.undo()).toBeUndefined();
  });
});
