<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';

  // Positions hold a quantity and a cost; value and P&L are derived per row.
  let rows = $state([
    { id: 1, symbol: 'VNM', qty: 1200, cost: 64.2, last: 68.5 },
    { id: 2, symbol: 'FPT', qty: 300, cost: 138.0, last: 132.0 },
    { id: 3, symbol: 'HPG', qty: 5000, cost: 25.1, last: 27.35 },
    { id: 4, symbol: 'VCB', qty: 800, cost: 93.4, last: 91.5 },
    { id: 5, symbol: 'MWG', qty: 1500, cost: 47.9, last: 51.4 },
  ]);

  const num = (row: GridRow, key: string) => Number(row[key]);
  const whole = (v: unknown) => Math.round(Number(v)).toLocaleString('en-US');

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
    { type: 'number', key: 'qty', header: 'Qty', width: 90, groupAgg: 'sum', format: whole },
    { type: 'price', key: 'cost', header: 'Avg cost', width: 96 },
    { type: 'price', key: 'last', header: 'Last', width: 90 },
    // No `value` or `pnl` field on the rows: derived, yet sortable,
    // filterable, totalled in the footer and exported like any column.
    { type: 'number', key: 'value', header: 'Value', width: 110, groupAgg: 'sum', format: whole, value: (r) => num(r, 'qty') * num(r, 'last') },
    {
      type: 'number',
      key: 'pnl',
      header: 'P&L',
      flex: 1,
      format: whole,
      groupAgg: 'sum',
      value: (r) => num(r, 'qty') * (num(r, 'last') - num(r, 'cost')),
      colorScale: { mid: 0 },
    },
  ];
</script>

<Grid {rows} {columns} footer height={220} />
