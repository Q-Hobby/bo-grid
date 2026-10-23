// Clipboard TSV (tab-separated values) parsing for paste support.
//
// Spreadsheets (Excel, Google Sheets) and the grid's own copy use a simple
// TSV shape: rows joined by "\n", cells within a row joined by "\t". This is
// deliberately not full CSV — no quoting/escaping — to match what copy emits
// and what spreadsheets put on the clipboard for a plain rectangular range.

/**
 * Parse clipboard text into a rectangular grid of cell strings.
 *
 * Tolerates CRLF / lone CR line endings and a single trailing newline
 * (spreadsheets append one when copying a range). Empty input yields `[]`.
 */
export function parseClipboard(text: string): string[][] {
  let t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (t.endsWith('\n')) t = t.slice(0, -1);
  if (t === '') return [];
  return t.split('\n').map((line) => line.split('\t'));
}

/** True when the parsed clipboard holds exactly one cell. */
export function isSingleCell(grid: string[][]): boolean {
  return grid.length === 1 && grid[0].length === 1;
}

// ---- Plans for copy, paste and the fill handle ------------------------------
// Pure geometry: which cells an operation reads or writes. The grid applies a
// plan (formatting, parsing, validation, onCellEdit, undo), so these never
// touch rows or columns themselves.

/** A rectangle of cells, inclusive, in view coordinates. */
export interface CellRect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/** Tab-separated text for the cells of `rect` clipped to the grid. Rows for
    which `hasRow` is false (group headers, unloaded rows) are skipped. */
export function copyText(
  rect: CellRect,
  rowCount: number,
  colCount: number,
  hasRow: (r: number) => boolean,
  text: (r: number, c: number) => string,
): string {
  const lines: string[] = [];
  const rEnd = Math.min(rect.r1, rowCount - 1);
  const cEnd = Math.min(rect.c1, colCount - 1);
  for (let r = rect.r0; r <= rEnd; r++) {
    if (!hasRow(r)) continue;
    const cells: string[] = [];
    for (let c = rect.c0; c <= cEnd; c++) cells.push(text(r, c));
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

/** The cells a paste writes, and the rectangle to select once something was
    written. A single value fills the whole selection, as spreadsheets do; a
    block pastes from the selection's top-left cell, clipped to the grid. */
export function pastePlan(
  grid: string[][],
  sel: CellRect,
  rowCount: number,
  colCount: number,
): { writes: Array<{ r: number; c: number; raw: string }>; extent: CellRect } {
  const single = isSingleCell(grid);
  const { r0, c0 } = sel;
  const rSpan = single ? sel.r1 - sel.r0 + 1 : grid.length;
  const writes: Array<{ r: number; c: number; raw: string }> = [];
  for (let dr = 0; dr < rSpan; dr++) {
    const r = r0 + dr;
    if (r > rowCount - 1) break;
    const srcRow = single ? grid[0] : grid[dr];
    const cSpan = single ? sel.c1 - sel.c0 + 1 : srcRow.length;
    for (let dc = 0; dc < cSpan; dc++) {
      const c = c0 + dc;
      if (c > colCount - 1) break;
      writes.push({ r, c, raw: single ? grid[0][0] : (srcRow[dc] ?? '') });
    }
  }
  const r1 = Math.min(r0 + rSpan - 1, rowCount - 1);
  const c1 = single ? sel.c1 : Math.min(c0 + Math.max(...grid.map((g) => g.length)) - 1, colCount - 1);
  return { writes, extent: { r0, c0, r1, c1 } };
}

/** The rectangle a fill-handle drag from `src` to `to` covers: the source
    block extended down and right, never shrunk. */
export function fillExtent(src: CellRect, to: { r: number; c: number }): CellRect {
  return { r0: src.r0, c0: src.c0, r1: Math.max(src.r1, to.r), c1: Math.max(src.c1, to.c) };
}

/** The cells a fill-handle drag writes, each copied from the source cell
    that tiles onto it, and the rectangle covered. Null when the drag did not
    extend the source block. */
export function fillPlan(
  src: CellRect,
  to: { r: number; c: number },
): { writes: Array<{ r: number; c: number; fromR: number; fromC: number }>; extent: CellRect } | null {
  const extent = fillExtent(src, to);
  if (extent.r1 === src.r1 && extent.c1 === src.c1) return null;
  const srcRows = src.r1 - src.r0 + 1;
  const srcCols = src.c1 - src.c0 + 1;
  const writes: Array<{ r: number; c: number; fromR: number; fromC: number }> = [];
  for (let r = src.r0; r <= extent.r1; r++) {
    for (let c = src.c0; c <= extent.c1; c++) {
      if (r <= src.r1 && c <= src.c1) continue; // the source block itself
      writes.push({ r, c, fromR: src.r0 + ((r - src.r0) % srcRows), fromC: src.c0 + ((c - src.c0) % srcCols) });
    }
  }
  return { writes, extent };
}
