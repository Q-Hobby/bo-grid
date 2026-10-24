<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const STATUS = ['Watch', 'Buy', 'Hold', 'Sell'];
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    // A dropdown editor: the column has `options`.
    { type: 'text', key: 'status', header: 'Status', width: 110, editable: true, options: STATUS },
    // A number editor that refuses negative quantities.
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0, editable: true, validate: (v) => Number(v) >= 0 },
    { type: 'price', key: 'price', header: 'Price', editable: true },
    { type: 'text', key: 'note', header: 'Note', flex: 1, editable: true },
  ];
  let rows = $state(quotes().map((q, i) => ({ ...q, status: STATUS[i % 4], qty: (i + 1) * 100, note: '' })));
  let last = $state('Double-click a cell, or select one and start typing.');
</script>

<p style="margin: 0 0 10px; opacity: 0.8">{last}</p>
<Grid
  {rows}
  {columns}
  height={280}
  onCellEdit={(e) => {
    e.row[e.column.key] = e.value;
    last = `${e.row.symbol} · ${e.column.header} → ${String(e.value)}`;
  }}
/>
