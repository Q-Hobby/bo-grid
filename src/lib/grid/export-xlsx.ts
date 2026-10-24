import type { ColumnDef, GridRow } from './column';
import { rowsToMatrix, type ExportOptions } from './export';
import { boError } from '../errors';

/**
 * Export rows to a .xlsx file. SheetJS is loaded via dynamic import, so it lands
 * in its own lazy chunk and never bloats the core bundle. `xlsx` is an optional
 * peer dependency — install it only if you use this function.
 */
export async function exportXLSX(
  filename: string,
  rows: readonly GridRow[],
  columns: readonly ColumnDef[],
  opts: ExportOptions = {},
): Promise<void> {
  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch {
    throw boError(Error, 'BG1102', "exportXLSX: the optional peer dependency 'xlsx' is not installed.", 'Install it next to bo-grid: npm i xlsx.');
  }
  const ws = XLSX.utils.aoa_to_sheet(rowsToMatrix(rows, columns, opts));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}
