import type { ColumnDef, GridRow } from './column';
import { formatCell, isNumeric, cellValue } from './column';
import { boError } from '../errors';

export interface ExportOptions {
  /** Use formatted display strings instead of raw values. Default false. */
  formatted?: boolean;
  /** Include a header row. Default true. */
  header?: boolean;
}

type Cell = string | number;

function rawValue(col: ColumnDef, v: unknown): Cell {
  if (col.type === 'date') return formatCell(col, v); // epoch ms isn't useful raw
  if (isNumeric(col)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }
  return v == null ? '' : String(v);
}

/**
 * Build a 2-D matrix (rows × columns) for export. Sparkline columns are skipped.
 * `formatted` produces display strings; otherwise numeric columns stay numbers
 * so spreadsheets can compute on them.
 */
export function rowsToMatrix(
  rows: readonly GridRow[],
  columns: readonly ColumnDef[],
  opts: ExportOptions = {},
): Cell[][] {
  const cols = columns.filter((c) => c.type !== 'sparkline' && c.type !== 'custom');
  const matrix: Cell[][] = [];
  if (opts.header !== false) matrix.push(cols.map((c) => c.header));
  for (const row of rows) {
    matrix.push(
      cols.map((c) => {
        const v = cellValue(c, row);
        return opts.formatted ? formatCell(c, v, row) : rawValue(c, v);
      }),
    );
  }
  return matrix;
}

function csvCell(v: Cell): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(
  rows: readonly GridRow[],
  columns: readonly ColumnDef[],
  opts: ExportOptions = {},
): string {
  return rowsToMatrix(rows, columns, opts)
    .map((r) => r.map(csvCell).join(','))
    .join('\r\n');
}

/** Trigger a browser download of text content. No-op outside the browser. */
export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(
  filename: string,
  rows: readonly GridRow[],
  columns: readonly ColumnDef[],
  opts: ExportOptions = {},
): void {
  download(filename, toCSV(rows, columns, opts));
}

/**
 * Parse delimited text (CSV/TSV) into a 2-D string matrix — handles quoted fields
 * with embedded delimiters, doubled quotes and newlines, and CRLF or LF endings.
 */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === delim) {
      endField();
      i++;
    } else if (c === '\n') {
      endRow();
      i++;
    } else if (c === '\r') {
      i++; // CRLF: the \n ends the row
    } else {
      field += c;
      i++;
    }
  }
  if (field !== '' || row.length > 0) endRow(); // trailing line without a newline
  return rows;
}

/** Parse RFC4180 CSV text into a 2-D string matrix. Pure; inverse of `rowsToMatrix`. */
export function parseCSVMatrix(text: string): string[][] {
  return parseDelimited(text, ',');
}

// Header-row matrix → grid rows: map each header to a column (by `header` or
// `key`), coerce numeric columns to numbers and `date` columns to epoch ms, leave
// blanks/unparseable as-is, and stamp id + flash fields. Drops blank lines.
function matrixToRows(matrix: string[][], columns: readonly ColumnDef[]): GridRow[] {
  const m = matrix.filter((r) => !(r.length === 1 && r[0] === ''));
  if (m.length < 1) return [];
  const headers = m[0];
  const cols = headers.map((h) => columns.find((c) => c.header === h || c.key === h));
  return m.slice(1).map((cells, i) => {
    const row: Record<string, unknown> = { id: i, flashSeq: 0, flashDir: 'up' };
    headers.forEach((h, c) => {
      const col = cols[c];
      const raw = cells[c] ?? '';
      const key = col ? col.key : h;
      if (raw === '') {
        row[key] = '';
      } else if (col?.type === 'date') {
        const ms = Date.parse(raw);
        row[key] = Number.isFinite(ms) ? ms : raw;
      } else if (col && isNumeric(col)) {
        const n = Number(raw);
        row[key] = Number.isFinite(n) ? n : raw;
      } else {
        row[key] = raw;
      }
    });
    return row as GridRow;
  });
}

/**
 * Parse CSV text into grid rows. The first line is the header (mapped to columns
 * by `header` or `key`); numeric columns coerce to numbers, `date` columns to
 * epoch ms. Rows get `id` + flash fields so they're `GridRow`-ready. Inverse of
 * `toCSV` — round-trips. Pure; unit-tested.
 */
export function parseCSV(text: string, columns: readonly ColumnDef[] = []): GridRow[] {
  return matrixToRows(parseDelimited(text, ','), columns);
}

/** Parse TAB-separated text into grid rows (same mapping as `parseCSV`). Handy for
    spreadsheet/clipboard data — `Ctrl/⌘+C` copies the selection as TSV. */
export function parseTSV(text: string, columns: readonly ColumnDef[] = []): GridRow[] {
  return matrixToRows(parseDelimited(text, '\t'), columns);
}

/**
 * Adapt plain objects (e.g. a JSON API response) to grid rows: stamp `id` (the
 * object's own `id`, else the index) and `flashSeq`/`flashDir` if absent, keeping
 * all fields. The cheapest path from `await res.json()` to `<Grid rows>`.
 */
export function rowsFromObjects(objects: readonly Record<string, unknown>[]): GridRow[] {
  return objects.map((o, i) => ({ id: i, flashSeq: 0, flashDir: 'up', ...o }) as GridRow);
}

/** Parse a JSON array of objects into grid rows (`JSON.parse` + `rowsFromObjects`).
    Throws on invalid JSON or a non-array top level. */
export function parseJSON(text: string): GridRow[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw boError(SyntaxError, 'BG1103', `parseJSON: the text is not valid JSON (${(e as Error).message}).`, 'Pass the JSON text as received; for CSV or TSV text use parseCSV or parseTSV, or parseRows to detect the format.');
  }
  if (!Array.isArray(data)) throw boError(Error, 'BG1101', 'parseJSON: expected a JSON array of objects.', 'Pass text like [{"id":1,"sym":"AAA"}]; wrap a single object in [ ].');
  return rowsFromObjects(data);
}

/**
 * Smart import: detect the format of `text` — a JSON array, TSV, or CSV — and
 * parse it into grid rows. Ideal for a paste handler where the source is unknown:
 *
 *   el.addEventListener('paste', (e) => {
 *     rows = parseRows(e.clipboardData.getData('text'), columns);
 *   });
 *
 * Leading `[` → JSON (falls through to delimited if it isn't valid JSON); a tab in
 * the first line → TSV; otherwise CSV. Pure; unit-tested.
 */
export function parseRows(text: string, columns: readonly ColumnDef[] = []): GridRow[] {
  if (text.trimStart().startsWith('[')) {
    try {
      return parseJSON(text);
    } catch {
      // Not valid JSON after all — treat it as delimited text below.
    }
  }
  const nl = text.indexOf('\n');
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  return firstLine.includes('\t') ? parseTSV(text, columns) : parseCSV(text, columns);
}
