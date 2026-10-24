<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { fmtBps, fxCentresOpen, fxMarketOpen, fxPipSize, fxQuoteHtml, pipsBetween } from 'bo-grid/trading';

  type Pair = { id: number; pair: string; bid: number; ask: number };
  const rows = $state.raw<Pair[]>([
    { id: 1, pair: 'EUR/USD', bid: 1.08452, ask: 1.08461 },
    { id: 2, pair: 'GBP/USD', bid: 1.27118, ask: 1.27131 },
    { id: 3, pair: 'USD/JPY', bid: 151.482, ask: 151.494 },
    { id: 4, pair: 'AUD/USD', bid: 0.65874, ask: 0.65886 },
    { id: 5, pair: 'USD/SGD', bid: 1.34521, ask: 1.34548 },
  ]);

  // A dealing-screen quote: big figure small, pips large, pipette raised.
  const quote = (side: 'bid' | 'ask'): ColumnDef => ({ type: 'custom', key: side, header: side === 'bid' ? 'Bid' : 'Ask', width: 120, align: 'right', render: ({ row }) => fxQuoteHtml(row[side] as number, row.pair as string) });
  const columns: ColumnDef[] = [
    { type: 'text', key: 'pair', header: 'Pair', width: 100 },
    quote('bid'),
    quote('ask'),
    { type: 'number', key: 'spread', header: 'Spread (pips)', decimals: 1, value: (r) => pipsBetween(r.ask as number, r.bid as number, r.pair as string) },
    { type: 'text', key: 'bps', header: 'Spread', flex: 1, value: (r) => fmtBps(((r.ask as number) - (r.bid as number)) / (r.ask as number)) },
  ];

  let api: GridApi | undefined;
  const stream = createTickStream<number, Partial<Pair>>({ apply: (batch) => api?.patchRows(batch) });
  $effect(() => {
    stream.start();
    const timer = setInterval(() => {
      const r = rows[Math.floor(Math.random() * rows.length)];
      const pip = fxPipSize(r.pair);
      const bid = r.bid + Math.round((Math.random() - 0.5) * 30) * (pip / 10);
      stream.push(r.id, { bid, ask: bid + Math.round(8 + Math.random() * 10) * (pip / 10) });
    }, 200);
    return () => {
      clearInterval(timer);
      stream.stop();
    };
  });
</script>

<p class="note">FX market {fxMarketOpen(new Date()) ? 'open' : 'closed'} · centres open now: {fxCentresOpen(new Date()).join(', ') || 'none'}</p>
<Grid {rows} {columns} height={5 * 36} onReady={(a) => (api = a)} />

<style>
  .note {
    margin: 0 0 8px;
    font-size: 12px;
    opacity: 0.8;
  }
</style>
