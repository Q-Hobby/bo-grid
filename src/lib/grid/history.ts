// Undo and redo for cell edits. The grid is controlled (the app owns the data
// through onCellEdit), so undoing re-emits onCellEdit with the old value: the
// history only remembers what was written. Entries hold the row object and
// the column, so they survive sorting, filtering and reordering. Multi-cell
// operations (paste, fill) record as one step. A factory rather than a class,
// so its state stays in local variables, which minify.

export interface EditEntry<R, C> {
  row: R;
  col: C;
  old: unknown;
  value: unknown;
}

export interface EditHistory<R, C> {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Records one edit: into the batch in progress, else as its own step. */
  record(entry: EditEntry<R, C>): void;
  /** Groups every edit recorded inside `fn` into a single undo step. */
  batch(fn: () => void): void;
  /** Undoes the last step: `apply` restores each entry (the grid re-emits
      `old`), then the step moves to the redo stack. False when there is none. */
  undo(apply: (entry: EditEntry<R, C>) => void): boolean;
  /** Redoes the last undone step (`apply` re-emits `value`). False when there is none. */
  redo(apply: (entry: EditEntry<R, C>) => void): boolean;
}

export const UNDO_LIMIT = 100;

export function createEditHistory<R, C>(limit = UNDO_LIMIT): EditHistory<R, C> {
  const undoStack: EditEntry<R, C>[][] = [];
  let redoStack: EditEntry<R, C>[][] = [];
  let open: EditEntry<R, C>[] | null = null;
  const push = (group: EditEntry<R, C>[]) => {
    undoStack.push(group);
    if (undoStack.length > limit) undoStack.shift();
    redoStack = [];
  };
  return {
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    record(entry) {
      if (open) open.push(entry);
      else push([entry]);
    },
    batch(fn) {
      const prev = open;
      const group: EditEntry<R, C>[] = (open = []);
      try {
        fn();
      } finally {
        open = prev;
        if (group.length) push(group);
      }
    },
    // A step moves to the other stack only once `apply` has run for all of
    // it: if the app's onCellEdit throws, the step is dropped, not half-kept.
    undo(apply) {
      const group = undoStack.pop();
      if (!group) return false;
      for (const e of group) apply(e);
      redoStack.push(group);
      return true;
    },
    redo(apply) {
      const group = redoStack.pop();
      if (!group) return false;
      for (const e of group) apply(e);
      undoStack.push(group);
      return true;
    },
  };
}
