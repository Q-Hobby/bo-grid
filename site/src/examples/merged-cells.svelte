<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  // Fills of a few orders: account, order and symbol repeat down the rows.
  let rows = $state([
    { id: 1, account: 'ACC-01', order: 'O-1001', symbol: 'VNM', time: '09:15:02', qty: 500, price: 68.4 },
    { id: 2, account: 'ACC-01', order: 'O-1001', symbol: 'VNM', time: '09:15:09', qty: 700, price: 68.5 },
    { id: 3, account: 'ACC-01', order: 'O-1002', symbol: 'FPT', time: '09:16:40', qty: 300, price: 132.0 },
    { id: 4, account: 'ACC-01', order: 'O-1002', symbol: 'FPT', time: '09:16:41', note: 'Order amended: limit raised to 132.2' },
    { id: 5, account: 'ACC-02', order: 'O-1003', symbol: 'HPG', time: '09:20:11', qty: 2000, price: 27.3 },
    { id: 6, account: 'ACC-02', order: 'O-1003', symbol: 'HPG', time: '09:20:15', qty: 3000, price: 27.35 },
    { id: 7, account: 'ACC-02', order: 'O-1004', symbol: 'VCB', time: '09:31:58', qty: 800, price: 91.5 },
  ]);

  const columns: ColumnDef[] = [
    // `spanRows`: equal values in adjacent rows merge into one cell.
    { type: 'text', key: 'account', header: 'Account', width: 100, spanRows: true },
    { type: 'text', key: 'order', header: 'Order', width: 96, spanRows: true },
    { type: 'text', key: 'symbol', header: 'Symbol', width: 84, spanRows: true },
    { type: 'text', key: 'time', header: 'Time', width: 90 },
    // `colSpan`: a note row covers the fill columns to its right.
    {
      type: 'text',
      key: 'qtyText',
      header: 'Qty',
      width: 90,
      value: (r) => r.note ?? String(r.qty),
      colSpan: (r) => (r.note ? 2 : 1),
    },
    { type: 'price', key: 'price', header: 'Price', flex: 1 },
  ];
</script>

<Grid {rows} {columns} height={280} />
