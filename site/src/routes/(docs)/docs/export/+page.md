---
title: Export & import
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

CSV export — and import — are dependency-free:

```ts
import { exportCSV, toCSV, parseCSV } from 'bo-grid';

exportCSV('tickers.csv', rows, columns);          // triggers a download
const text = toCSV(rows, columns, { formatted: true }); // or get the string
const rows = parseCSV(text, columns);             // …and back to rows (round-trip)
```

`parseCSV` is RFC4180-aware (quoted fields, embedded commas/quotes/newlines), maps
headers to columns, coerces numeric/`date` columns, and stamps `id` + flash fields
so the result drops straight into `<Grid rows={…}>`. There's also `parseTSV` (tab-
separated — what Ctrl/⌘+C copies), and for JSON/API data, `rowsFromObjects(objects)`
/ `parseJSON(text)`:

```ts
import { rowsFromObjects } from 'bo-grid';
const rows = rowsFromObjects(await (await fetch('/api/rows')).json());
```

Not sure what you'll get? **`parseRows(text, columns?)`** auto-detects JSON / TSV /
CSV — perfect for a paste handler:

```svelte
<div onpaste={(e) => (rows = parseRows(e.clipboardData.getData('text'), columns))}>…</div>
```

See the **CSV import** demo (CSV / TSV / JSON / Auto-detect).

Excel export loads SheetJS via **dynamic import**, so it lands in its own lazy
chunk and never bloats your core bundle. `xlsx` is an **optional peer dependency**
— install it only if you use this:

```ts
import { exportXLSX } from 'bo-grid';
await exportXLSX('tickers.xlsx', rows, columns); // npm i xlsx
```

Sparkline columns are skipped; numeric columns export as raw numbers so
spreadsheets can compute on them (pass `{ formatted: true }` for display strings).
Ctrl/⌘+C still copies the current selection as TSV.

**Printing.** The grid virtualizes, so printing it directly drops off-screen rows.
`printTable(rows, columns, { title })` opens a print window with **all** rows as a
clean table (Save-as-PDF from the dialog); `toHTMLTable(rows, columns)` returns
that table as an HTML string to embed. See the **Print** demo.

```ts
import { printTable } from 'bo-grid';
printTable(rows, columns, { title: 'Sales report' });
```

## Live example

<Example id="csv" />

<Example id="print" />
