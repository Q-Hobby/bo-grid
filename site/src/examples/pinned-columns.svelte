<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { quotes } from './data';

  const pct = (r: GridRow, f: number) => Number(r.change) * f;

  // Fixed widths wider than the frame: the middle scrolls sideways under the
  // pinned Symbol column on the left and the Volume column on the right.
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90, pinned: 'left' },
    { type: 'text', key: 'name', header: 'Company', width: 150 },
    { type: 'text', key: 'sector', header: 'Sector', width: 130 },
    { type: 'price', key: 'price', header: 'Price', width: 100 },
    { type: 'percent', key: 'change', header: '1 day', width: 100 },
    { type: 'percent', key: 'w1', header: '1 week', width: 100, value: (r) => pct(r, 2.4) },
    { type: 'percent', key: 'm1', header: '1 month', width: 100, value: (r) => pct(r, -3.1) },
    { type: 'percent', key: 'y1', header: '1 year', width: 100, value: (r) => pct(r, 9.6) },
    { type: 'volume', key: 'volume', header: 'Volume', width: 110, pinned: 'right' },
  ];

  let rows = $state(quotes());
</script>

<Grid {rows} {columns} height={300} />
