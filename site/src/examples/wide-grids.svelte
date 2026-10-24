<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  // 40 trading days of closes per symbol: 41 columns, only the visible ones render.
  const DAYS = 40;
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100, pinned: 'left' },
    ...Array.from({ length: DAYS }, (_, d): ColumnDef => ({ type: 'price', key: `d${d}`, header: `Day ${d + 1}`, width: 88 })),
  ];
  let rows = $state(
    quotes().map((q) => {
      const row: Record<string, unknown> = { id: q.id, symbol: q.symbol };
      for (let d = 0; d < DAYS; d++) row[`d${d}`] = +(q.price * (1 + Math.sin((d + q.id) / 4) * 0.04)).toFixed(2);
      return row as { id: number };
    }),
  );
</script>

<Grid {rows} {columns} height={300} virtualizeColumns columnHover />
