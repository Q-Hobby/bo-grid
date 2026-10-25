<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridRow } from '../lib';
  import { createTickStream } from '../lib/realtime';
  import { vnBands, vnTickSize } from '../lib/trading';
  import { ui } from './theme.svelte';

  // The hero's "Fig. 1": a small live board fed exactly like a production one —
  // plain rows, a coalescing tick stream, api.patchRows. It pauses when it is
  // scrolled away or the tab is hidden.
  interface Q extends GridRow {
    id: number;
    sym: string;
    ref: number;
    ceil: number;
    floor: number;
    px: number;
    chg: number;
    pct: number;
    vol: number;
  }

  const SEED: Array<[string, number]> = [
    ['VNM', 68_500], ['FPT', 132_000], ['HPG', 27_150], ['VCB', 91_000],
    ['MWG', 51_400], ['SSI', 33_450], ['VIC', 44_200], ['GAS', 71_800],
  ];
  const rows = $state.raw<Q[]>(
    SEED.map(([sym, ref], id) => {
      const { ceiling, floor } = vnBands(ref, 'HOSE');
      return { id, sym, ref, ceil: ceiling ?? ref, floor: floor ?? ref, px: ref, chg: 0, pct: 0, vol: 0 };
    }),
  );

  const k = (v: unknown) => (Number(v) / 1000).toFixed(2);
  function tone(_v: unknown, r: GridRow): string {
    const q = r as Q;
    if (q.px >= q.ceil) return 'hb-ceil';
    if (q.px <= q.floor) return 'hb-floor';
    if (q.px === q.ref) return 'hb-ref';
    return q.px > q.ref ? 'hb-up' : 'hb-down';
  }
  const columns: ColumnDef[] = [
    { type: 'text', key: 'sym', header: 'Mã', flex: 1, width: 64, cellClass: tone, sortable: false },
    { type: 'price', key: 'px', header: 'Giá', flex: 1.2, width: 74, format: k, cellClass: tone, flash: 'auto', flashColor: false, showChange: true, sortable: false },
    { type: 'number', key: 'chg', header: '+/-', flex: 1.1, width: 66, format: (v) => (Number(v) > 0 ? '+' : '') + k(v), cellClass: tone, sortable: false },
    { type: 'percent', key: 'pct', header: '%', flex: 1.1, width: 72, cellClass: tone, sortable: false },
    { type: 'volume', key: 'vol', header: 'KL', flex: 1.1, width: 72, flash: 'auto', sortable: false },
  ];

  let api: GridApi | null = null;
  const stream = createTickStream<number, Partial<Q>>({ apply: (b) => api?.patchRows(b) });

  let host: HTMLElement;
  let onScreen = $state(false);
  let tabVisible = $state(true);
  $effect(() => {
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    io.observe(host);
    const vis = () => (tabVisible = document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  $effect(() => {
    if (!onScreen || !tabVisible) return;
    stream.start();
    const h = setInterval(() => {
      for (let n = 0; n < 3; n++) {
        const q = rows[Math.floor(Math.random() * rows.length)];
        const t = vnTickSize(q.px, 'HOSE');
        const px = Math.min(q.ceil, Math.max(q.floor, q.px + Math.round((Math.random() - 0.48) * 3) * t));
        stream.push(q.id, { px, chg: px - q.ref, pct: ((px - q.ref) / q.ref) * 100, vol: q.vol + Math.floor(Math.random() * 40) * 100 });
      }
    }, 140);
    return () => {
      clearInterval(h);
      stream.stop();
    };
  });
</script>

<div class="hb" bind:this={host}>
  <Grid
    rows={rows as unknown as GridRow[]}
    {columns}
    height={8 * 36}
    theme={ui.grid}
    cellSelection={false}
    resizable={false}
    ariaLabel="Live price board sample"
    onReady={(a) => (api = a)}
  />
</div>

<style>
  .hb :global(.hb-up) { color: var(--up); }
  .hb :global(.hb-down) { color: var(--down); }
  .hb :global(.hb-ref) { color: var(--accent); }
  .hb :global(.hb-ceil) { color: var(--ceil); }
  .hb :global(.hb-floor) { color: var(--floor); }
</style>
