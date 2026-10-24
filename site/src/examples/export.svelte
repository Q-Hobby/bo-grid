<script lang="ts">
  import { Grid, exportCSV, printTable, toCSV, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'sector', header: 'Sector', width: 130 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
  // The CSV string, with the cells' displayed text: what a download would hold.
  const preview = $derived(toCSV(rows.slice(0, 4), columns, { formatted: true }));
</script>

<p style="margin: 0 0 10px; display: flex; gap: 6px">
  <button onclick={() => exportCSV('quotes.csv', rows, columns)}>Download CSV</button>
  <button onclick={() => printTable(rows, columns, { title: 'Quotes' })}>Print every row</button>
</p>
<Grid {rows} {columns} height={200} />
<pre style="margin: 10px 0 0; font-size: 12px; opacity: 0.8">{preview}</pre>
