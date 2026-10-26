<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { createOrderBook } from 'bo-grid/realtime';
  import { connectDepth, type DepthMessage } from './depth';

  const columns: ColumnDef[] = [
    { type: 'number', key: 'price', header: 'Price', decimals: 1 },
    { type: 'volume', key: 'size', header: 'Size', flash: 'auto' },
    { type: 'volume', key: 'total', header: 'Total' },
  ];
  const book = createOrderBook({ maxLevels: 1000 });
  let rows: GridRow[] = $state.raw([]);

  $effect(() => {
    let disconnect = () => {};
    const connect = () => {
      book.clear();
      disconnect = connectDepth(onMessage);
    };
    function onMessage(m: DepthMessage) {
      if (m.type === 'snapshot') book.snapshot({ bids: m.bids, asks: m.asks, seq: m.seq });
      else if (book.update({ bids: m.bids, asks: m.asks, from: m.from, seq: m.seq }) === 'gap') {
        disconnect();
        connect();
      }
    }
    connect();
    // Read the book once a frame, and only when it changed.
    let seen = -1;
    let raf = requestAnimationFrame(function frame() {
      if (book.version !== seen) {
        seen = book.version;
        rows = book.rows(10);
      }
      raf = requestAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(raf);
      disconnect();
    };
  });
</script>

<main>
  <h1>Order book</h1>
  <Grid {rows} {columns} rowClass={(r) => String(r.side)} height={480} />
</main>
