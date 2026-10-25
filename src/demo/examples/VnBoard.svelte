<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from '../../lib';
  import { createTickStream, createRowIndex, applyPatches } from '../../lib/realtime';
  import {
    vnBands,
    vnTickSize,
    resolveTone,
    toneColor,
    darkToneColors,
    lightToneColors,
    fmtTradingPrice,
    sessionStateAt,
    sessionLabel,
    VN_HOSE_SCHEDULE,
    type Exchange,
    type Tone,
  } from '../../lib/trading';
  import { ui } from '../theme.svelte';

  // Tone colours follow the page theme: each palette reads at AA on its own.
  const tones = $derived(ui.theme === 'light' ? lightToneColors : darkToneColors);

  // A HOSE-style board: price-LIMIT colouring (purple ceiling / cyan floor /
  // yellow reference / green up / red down — not just up/down), tick-aware VND
  // formatting, and the live session badge — all from `bo-grid/trading`, a pure
  // helper library with no Grid/Cell changes of its own. Realtime price motion
  // reuses the same `createTickStream` from `bo-grid/realtime` as the Trading
  // desk example, clamped to each symbol's own ceiling/floor.
  interface Board extends GridRow {
    id: number;
    symbol: string;
    exchange: Exchange;
    ref: number;
    price: number;
    volume: number;
  }

  // A representative slice of HOSE/HNX/UPCOM tickers with plausible reference
  // prices (VND) — enough spread to show all three exchanges' tick/band rules.
  const SEED: Array<[string, Exchange, number]> = [
    ['VNM', 'HOSE', 68_500],
    ['VIC', 'HOSE', 44_200],
    ['VHM', 'HOSE', 39_800],
    ['HPG', 'HOSE', 27_150],
    ['FPT', 'HOSE', 132_000],
    ['MWG', 'HOSE', 51_400],
    ['VPB', 'HOSE', 19_650],
    ['GAS', 'HOSE', 71_800],
    ['MSN', 'HOSE', 63_200],
    ['SSI', 'HOSE', 33_450],
    ['VCB', 'HOSE', 91_000],
    ['SHS', 'HNX', 14_800],
    ['PVS', 'HNX', 33_600],
    ['BSR', 'UPCOM', 18_900],
    ['VEA', 'UPCOM', 45_700],
  ];

  function build(): Board[] {
    return SEED.map(([symbol, exchange, ref], id) => ({
      id,
      symbol,
      exchange,
      ref,
      price: ref,
      volume: 0,
    }));
  }

  const rows = $state<Board[]>(build());
  const gridRows = $derived(rows as unknown as GridRow[]);
  // Per-row bands are a pure function of `ref`/`exchange`, both fixed at build
  // time — computed once and looked up by id rather than recomputed per cell.
  const bandsById = new Map(rows.map((r) => [r.id, vnBands(r.ref, r.exchange)]));

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 84, sortable: false },
    { type: 'badge', key: 'exchange', header: 'Exch', width: 76, sortable: false,
      tones: { HOSE: 'info', HNX: 'amber', UPCOM: 'neutral' } },
    { type: 'custom', key: 'ref', header: 'Ref', width: 92, align: 'right', sortable: false },
    { type: 'custom', key: 'ceiling', header: 'Ceiling', width: 92, align: 'right', sortable: false },
    { type: 'custom', key: 'floor', header: 'Floor', width: 92, align: 'right', sortable: false },
    { type: 'custom', key: 'price', header: 'Price', width: 96, align: 'right', sortable: false },
    { type: 'custom', key: 'changePct', header: 'Chg %', width: 84, align: 'right', sortable: false },
    { type: 'volume', key: 'volume', header: 'Volume', width: 90, flash: 'auto', sortable: false },
  ];

  // Live price motion: bo-grid/realtime's tick pipeline, clamped to each row's
  // own ceiling/floor — the composition of 1.1 (realtime) and 1.2 (bands).
  const index = createRowIndex(rows, (r) => r.id);
  const stream = createTickStream<number, { price: number; volume: number }>({
    cap: 100,
    apply: (batch) => applyPatches(index, batch),
  });

  let live = $state(false);
  $effect(() => {
    if (!live) return;
    stream.start();
    const h = setInterval(() => {
      for (let n = 0; n < 3; n++) {
        const r = rows[Math.floor(Math.random() * rows.length)];
        const bands = bandsById.get(r.id)!;
        const tick = vnTickSize(r.price, r.exchange);
        const move = Math.round(((Math.random() - 0.5) * 3) * tick);
        const next = Math.min(bands.ceiling ?? Infinity, Math.max(bands.floor ?? 0, r.price + move));
        stream.push(r.id, { price: next, volume: r.volume + Math.floor(Math.random() * 5_000) });
      }
    }, 400);
    return () => {
      clearInterval(h);
      stream.stop();
    };
  });

  // Session badge — recomputed once a second off the real clock. Evaluated in
  // Asia/Ho_Chi_Minh regardless of the viewer's own time zone (see
  // sessionStateAt's `timeZone` option) — a correct badge for a trader in any
  // location, not just one in Vietnam.
  let now = $state(Date.now());
  $effect(() => {
    const h = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(h);
  });
  const session = $derived(sessionStateAt(new Date(now), VN_HOSE_SCHEDULE));

  function tone(row: Board): Tone {
    return resolveTone(row.price, bandsById.get(row.id)!);
  }
</script>

{#snippet cell({ row, column }: { row: GridRow; column: ColumnDef })}
  {@const r = row as Board}
  {@const bands = bandsById.get(r.id)!}
  {@const t = tone(r)}
  {#if column.key === 'ref'}
    <span class="num">{fmtTradingPrice(r.ref, vnTickSize(r.ref, r.exchange))}</span>
  {:else if column.key === 'ceiling'}
    <span class="num" style:color={toneColor('ceiling', tones)}>{fmtTradingPrice(bands.ceiling ?? r.ref, vnTickSize(r.ref, r.exchange))}</span>
  {:else if column.key === 'floor'}
    <span class="num" style:color={toneColor('floor', tones)}>{fmtTradingPrice(bands.floor ?? r.ref, vnTickSize(r.ref, r.exchange))}</span>
  {:else if column.key === 'price'}
    <span class="num" style:color={toneColor(t, tones)}>{fmtTradingPrice(r.price, vnTickSize(r.price, r.exchange))}</span>
  {:else if column.key === 'changePct'}
    {@const pct = ((r.price - r.ref) / r.ref) * 100}
    <span class="num" style:color={toneColor(t, tones)}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</span>
  {/if}
{/snippet}

<div class="controls">
  <span class="session session-{session}">
    <span class="dot"></span>{sessionLabel(session)}
  </span>
  <button class="live" class:on={live} onclick={() => (live = !live)}>
    <span class="dot"></span>{live ? 'Live' : 'Paused'}
  </button>
  <div class="legend">
    <span><i style:background={toneColor('ceiling', tones)}></i>Ceiling</span>
    <span><i style:background={toneColor('floor', tones)}></i>Floor</span>
    <span><i style:background={toneColor('ref', tones)}></i>Reference</span>
    <span><i style:background={toneColor('up', tones)}></i>Up</span>
    <span><i style:background={toneColor('down', tones)}></i>Down</span>
  </div>
</div>

<div class="gridwrap">
  <Grid rows={gridRows} {columns} fitColumns theme={ui.grid} height={480} {cell} />
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .session,
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    color: var(--text);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: 999px;
  }
  .live {
    cursor: pointer;
    font: inherit;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-dim);
  }
  .live.on .dot {
    background: var(--up);
    box-shadow: 0 0 6px var(--up);
  }
  .session-continuous .dot {
    background: var(--up);
    box-shadow: 0 0 6px var(--up);
  }
  .session-ato .dot,
  .session-atc .dot {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
  }
  .legend {
    display: flex;
    gap: 12px;
    margin-left: auto;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .legend i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .gridwrap {
    max-width: 780px;
  }
</style>
