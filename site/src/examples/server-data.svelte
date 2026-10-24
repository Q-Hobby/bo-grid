<script lang="ts">
  import { Grid, createArraySource, type ColumnDef } from 'bo-grid';

  // 50,000 orders behind a source that answers after 300 ms, like a server.
  const SIDES = ['Buy', 'Sell'];
  const SYMBOLS = ['VNM', 'FPT', 'HPG', 'VCB', 'MWG', 'SSI', 'VIC', 'GAS'];
  const all = Array.from({ length: 50_000 }, (_, i) => ({
    id: i + 1,
    order: `ORD-${String(i + 1).padStart(6, '0')}`,
    symbol: SYMBOLS[i % SYMBOLS.length],
    side: SIDES[(i * 7) % 2],
    qty: ((i * 37) % 50) * 100 + 100,
    price: 20 + ((i * 131) % 9000) / 100,
  }));
  const source = createArraySource(all, { latency: 300, filterKeys: ['order', 'symbol'] });

  const columns: ColumnDef[] = [
    { type: 'text', key: 'order', header: 'Order', width: 140 },
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'side', header: 'Side', width: 80 },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0 },
    { type: 'price', key: 'price', header: 'Price', flex: 1 },
  ];
  // In source mode the search text goes to the source, which filters `filterKeys`.
  let q = $state('');
</script>

<p style="margin: 0 0 10px"><input type="search" placeholder="Search order or symbol" bind:value={q} /></p>
<Grid rows={[]} {columns} {source} filter={q} height={280} />
