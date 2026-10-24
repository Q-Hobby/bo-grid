---
title: Export & import
description: Export rows to CSV or Excel, print every row, and turn CSV, TSV or JSON text back into rows.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Exports work from your rows and columns, not from what happens to be drawn, so they include every row, even those scrolled out of view. CSV import and export need no dependencies; Excel export loads its writer only when it runs.

Download the rows as CSV, or open a print view of every row. The text under the grid is the CSV string itself.

<Example name="export" title="CSV and print" />

## CSV

```ts
import { exportCSV, toCSV } from 'bo-grid';

exportCSV('quotes.csv', rows, columns);                    // downloads a file
const text = toCSV(rows, columns, { formatted: true });     // or returns the string
```

Both take `{ formatted, header }`:

- By default numbers export as raw numbers, so a spreadsheet can compute on them; `formatted: true` exports the text the cells show instead. Dates always export as text.
- `header: false` leaves out the header row.
- Sparkline columns are skipped.

To export what the reader is looking at, after their filters and sort, use the grid's `api.exportCSV(filename?)`; see [Grid API](../grid-api/).

## Excel

`exportXLSX` writes an `.xlsx` file. It loads the optional `xlsx` package with a dynamic import, so it lands in its own chunk and costs nothing until it runs; install `xlsx` only if you use it:

```ts
import { exportXLSX } from 'bo-grid';

await exportXLSX('quotes.xlsx', rows, columns); // npm i xlsx
```

It takes the same options as CSV.

## Printing

The grid draws only the rows in view, so printing the page would leave the rest out. `printTable(rows, columns, { title })` opens a print window with every row as a plain table (the browser's dialog can save it as a PDF), and `toHTMLTable(rows, columns)` returns that table as an HTML string to put in a page or an email. Values are escaped.

```ts
import { printTable } from 'bo-grid';

printTable(rows, columns, { title: 'Quotes' });
```

<Example id="print" />

## Importing CSV, TSV and JSON

`parseCSV(text, columns)` reads CSV into rows ready for the grid: it handles quoted fields (with commas, quotes and line breaks inside), matches the header row to your columns, converts number and date columns, and gives each row an `id`. `parseTSV` reads tab-separated text, which is what spreadsheets and the grid's own copy put on the clipboard.

```ts
import { parseCSV, toCSV } from 'bo-grid';

const text = toCSV(rows, columns);
const back = parseCSV(text, columns); // a round trip
```

For JSON, `parseJSON(text)` reads an array of objects, and `rowsFromObjects(objects)` converts objects you already have:

```ts
import { rowsFromObjects } from 'bo-grid';

const rows = rowsFromObjects(await (await fetch('/api/positions')).json());
```

`parseRows(text, columns?)` detects JSON, TSV or CSV by itself, which suits a paste handler:

```svelte
<div onpaste={(e) => (rows = parseRows(e.clipboardData?.getData('text') ?? '', columns))}>Paste a table here</div>
```

`parseCSVMatrix(text)` returns the raw cells as a string matrix, for files that need their own mapping.

<Example id="csv" />

## Reference

<Props of="api" names={['exportCSV']} />
