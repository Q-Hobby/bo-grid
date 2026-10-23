// Undo and redo for cell edits. The grid is controlled (the app owns the data
// through onCellEdit), so undoing re-emits onCellEdit with the old value: the
// history only remembers what was written. Entries hold the row object and
// the column, so they survive sorting, filtering and reordering. Multi-cell
// operations (paste, fill) record as one step.

export interface EditEntry<R, C> {
  row: R;
  col: C;
  old: unknown;
  value: unknown;
}

export const UNDO_LIMIT = 100;

export class EditHistory<R, C> {
  private undoStack: EditEntry<R, C>[][] = [];
  private redoStack: EditEntry<R, C>[][] = [];
  private open: EditEntry<R, C>[] | null = null;

  constructor(private readonly limit = UNDO_LIMIT) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Records one edit: into the batch in progress, else as its own step. */
  record(entry: EditEntry<R, C>): void {
    if (this.open) this.open.push(entry);
    else this.push([entry]);
  }

  /** Groups every edit recorded inside `fn` into a single undo step. */
  batch(fn: () => void): void {
    const prev = this.open;
    this.open = [];
    try {
      fn();
    } finally {
      const group = this.open;
      this.open = prev;
      if (group.length) this.push(group);
    }
  }

  /** The step to undo (its entries carry the values to restore), or undefined. */
  undo(): EditEntry<R, C>[] | undefined {
    const group = this.undoStack.pop();
    if (group) this.redoStack.push(group);
    return group;
  }

  /** The step to redo, or undefined. */
  redo(): EditEntry<R, C>[] | undefined {
    const group = this.redoStack.pop();
    if (group) this.undoStack.push(group);
    return group;
  }

  private push(group: EditEntry<R, C>[]): void {
    this.undoStack.push(group);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
}
