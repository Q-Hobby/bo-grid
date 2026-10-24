// Turning typed or pasted text into a cell's stored value. Shared by the
// built-in inline editor, paste and fill; a custom `editor` commits typed values
// directly and skips this.

import { isNumeric, type ColumnDef, type GridRow } from './column';
import { fromDateInput } from './date';

export type ParseResult = { ok: true; value: unknown } | { ok: false };

const rejected = (v: unknown): boolean => v === undefined || (typeof v === 'number' && !Number.isFinite(v));

/** Parse `raw` for `col`: the column's own `parse` when set, otherwise epoch ms
    (local midnight) for `date`, a number for numeric types, the text as typed
    for the rest. */
export function parseCellInput(col: ColumnDef, raw: string, row: GridRow): ParseResult {
  if (col.parse) {
    const v = col.parse(raw, row);
    return rejected(v) ? { ok: false } : { ok: true, value: v };
  }
  if (col.type === 'date') {
    const ms = fromDateInput(raw);
    return Number.isFinite(ms) ? { ok: true, value: ms } : { ok: false };
  }
  if (isNumeric(col)) {
    // A blank is not a number (Number('') is 0): it is refused, not written as 0.
    if (raw.trim() === '') return { ok: false };
    const n = Number(raw);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  return { ok: true, value: raw };
}
