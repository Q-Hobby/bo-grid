<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { darkToneColors, fmtTradingPrice, lightToneColors, resolveTone, roundToTick, sessionLabel, sessionStateAt, vnBands, vnTickSize, VN_HOSE_SCHEDULE, type Tone } from 'bo-grid/trading';

  type Row = { id: number; symbol: string; ref: number; ceiling: number; floor: number; price: number };
  const SEED: Array<[string, number]> = [['VNM', 68_500], ['FPT', 132_000], ['HPG', 27_150], ['VCB', 91_000], ['MWG', 51_400], ['SSI', 33_450], ['VIC', 44_200]];
  const rows = $state.raw<Row[]>(
    SEED.map(([symbol, ref], id) => {
      const { ceiling = ref, floor = ref } = vnBands(ref, 'HOSE'); // tick-rounded daily band
      return { id, symbol, ref, ceiling, floor, price: ref };
    }),
  );

  // Each tone as a CSS variable; light-dark() follows the grid's colour scheme.
  const TONES: Tone[] = ['ceiling', 'floor', 'ref', 'up', 'down'];
  const toneVars = TONES.map((t) => `--tone-${t}: light-dark(${lightToneColors[t]}, ${darkToneColors[t]})`).join(';');
  const tone = (_v: unknown, row: GridRow) => `tone-${resolveTone((row as Row).price, row as Row)}`;
  const price = (v: unknown) => fmtTradingPrice(Number(v), vnTickSize(Number(v), 'HOSE')); // "68,500"
  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 90, cellClass: tone },
    { type: 'number', key: 'ceiling', header: 'Ceiling', format: price, cellClass: 'tone-ceiling' },
    { type: 'number', key: 'floor', header: 'Floor', format: price, cellClass: 'tone-floor' },
    { type: 'number', key: 'ref', header: 'Ref', format: price, cellClass: 'tone-ref' },
    { type: 'number', key: 'price', header: 'Price', flex: 1, format: price, cellClass: tone, flash: 'auto', flashColor: false },
  ];

  let api: GridApi | undefined;
  const stream = createTickStream<number, Partial<Row>>({ apply: (batch) => api?.patchRows(batch) });
  $effect(() => {
    stream.start();
    const timer = setInterval(() => {
      const r = rows[Math.floor(Math.random() * rows.length)];
      const next = r.price + Math.round((Math.random() - 0.48) * 8) * vnTickSize(r.price, 'HOSE');
      stream.push(r.id, { price: Math.min(r.ceiling, Math.max(r.floor, roundToTick(next, vnTickSize(next, 'HOSE')))) });
    }, 150);
    return () => {
      clearInterval(timer);
      stream.stop();
    };
  });
</script>

<p class="note">HOSE session now: <b>{sessionLabel(sessionStateAt(new Date(), VN_HOSE_SCHEDULE))}</b> · prices move on the tick table, inside the daily band</p>
<div class="board" style={toneVars}>
  <Grid {rows} {columns} height={7 * 36} onReady={(a) => (api = a)} />
</div>

<style>
  .note {
    margin: 0 0 8px;
    font-size: 12px;
    opacity: 0.8;
  }
  .board :global(.c.tone-ceiling) { color: var(--tone-ceiling); }
  .board :global(.c.tone-floor) { color: var(--tone-floor); }
  .board :global(.c.tone-ref) { color: var(--tone-ref); }
  .board :global(.c.tone-up) { color: var(--tone-up); }
  .board :global(.c.tone-down) { color: var(--tone-down); }
</style>
