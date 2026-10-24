<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from '../../lib';
  import { createOrderBook, type BookLevel, type BookPairRow, type BookRow } from '../../lib/realtime';
  import { fmtTradingPrice } from '../../lib/trading';
  import { ui } from '../theme.svelte';

  // A live order book kept by bo-grid/realtime's createOrderBook from a
  // depth feed: a snapshot, then the levels that change (size 0 removes
  // one). The grid shows the best levels stacked (asks above bids) or side
  // by side, merged into price buckets on request, each row with its depth
  // from the spread. Sizes flash per level: a level keeps its row id while
  // the book moves around it.
  const TICK = 0.05;
  const LEVELS = 16;
  const GROUPS = [0.05, 0.1, 0.5, 1];

  // Deterministic seed so the first book is stable across reloads.
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(0xb0_0c);
  const at = (ticks: number) => Math.round(ticks) * TICK;

  const book = createOrderBook({ maxLevels: 400 });
  let bestBidTicks = 5000; // 250.00
  book.snapshot({
    bids: Array.from({ length: 80 }, (_, i): BookLevel => [at(bestBidTicks - i), 40 + Math.floor(rng() * 900)]),
    asks: Array.from({ length: 80 }, (_, i): BookLevel => [at(bestBidTicks + 1 + i), 40 + Math.floor(rng() * 900)]),
  });

  // One message of the feed: a few levels near the spread change, some go,
  // and now and then the market moves a tick.
  function message(): { bids: BookLevel[]; asks: BookLevel[] } {
    const bids: BookLevel[] = [];
    const asks: BookLevel[] = [];
    if (rng() < 0.15) {
      const up = rng() < 0.5;
      bestBidTicks += up ? 1 : -1;
      if (up) {
        asks.push([at(bestBidTicks), 0]);
        bids.push([at(bestBidTicks), 40 + Math.floor(rng() * 400)]);
      } else {
        bids.push([at(bestBidTicks + 1), 0]);
        asks.push([at(bestBidTicks + 1), 40 + Math.floor(rng() * 400)]);
      }
    }
    for (let n = 0; n < 4; n++) {
      const depth = Math.floor(rng() * rng() * 30);
      const size = rng() < 0.15 ? 0 : 20 + Math.floor(rng() * 900);
      if (rng() < 0.5) bids.push([at(bestBidTicks - depth), size]);
      else asks.push([at(bestBidTicks + 1 + depth), size]);
    }
    return { bids, asks };
  }

  let group = $state(TICK);
  let layout = $state<'stacked' | 'side'>('stacked');
  // The book changes as messages arrive; the grid reads it once a batch (a
  // real feed would read once a frame), when its version has moved.
  let version = $state(book.version);
  const stacked = $derived.by(() => {
    void version;
    return layout === 'stacked' ? book.rows(LEVELS, { group }) : [];
  });
  const pairs = $derived.by(() => {
    void version;
    return layout === 'side' ? book.pairs(LEVELS, { group }) : [];
  });
  const best = $derived.by(() => {
    void version;
    return book.best();
  });
  const fmt = (v: unknown) => (typeof v === 'number' ? fmtTradingPrice(v, group) : '');

  let live = $state(false);
  $effect(() => {
    if (!live) return;
    const h = setInterval(() => {
      for (let m = 0; m < 3; m++) book.update(message());
      version = book.version;
    }, 250);
    return () => clearInterval(h);
  });

  const stackedColumns: ColumnDef[] = $derived([
    { type: 'number', key: 'price', header: 'Price', width: 110, sortable: false, format: fmt },
    { type: 'volume', key: 'size', header: 'Size', width: 100, flash: 'auto', sortable: false },
    { type: 'custom', key: 'total', header: 'Depth', flex: 1, sortable: false },
  ]);
  const pairColumns: ColumnDef[] = $derived([
    { type: 'custom', key: 'bidTotal', header: 'Depth', flex: 1, sortable: false },
    { type: 'volume', key: 'bidSize', header: 'Bid size', width: 86, sortable: false },
    { type: 'number', key: 'bidPrice', header: 'Bid', width: 84, sortable: false, format: fmt, cellClass: 'bid' },
    { type: 'number', key: 'askPrice', header: 'Ask', width: 84, sortable: false, format: fmt, cellClass: 'ask' },
    { type: 'volume', key: 'askSize', header: 'Ask size', width: 86, sortable: false },
    { type: 'custom', key: 'askTotal', header: 'Depth', flex: 1, sortable: false },
  ]);
</script>

{#snippet bar(side: 'bid' | 'ask', share: number | undefined, total: number | undefined)}
  {#if total !== undefined}
    <div class="depth {side}">
      <div class="fill {side}" style:width="{(share ?? 0) * 100}%"></div>
      <span class="tot">{total.toLocaleString()}</span>
    </div>
  {/if}
{/snippet}

{#snippet stackedCell({ row }: { row: GridRow })}
  {@const lvl = row as BookRow}
  {@render bar(lvl.side, lvl.share, lvl.total)}
{/snippet}

{#snippet pairCell({ row, column }: { row: GridRow; column: ColumnDef })}
  {@const p = row as BookPairRow}
  {#if column.key === 'bidTotal'}{@render bar('bid', p.bidShare, p.bidTotal)}{:else}{@render bar('ask', p.askShare, p.askTotal)}{/if}
{/snippet}

<div class="controls">
  <span class="stat ask">Ask <strong>{fmt(best.ask)}</strong></span>
  <span class="stat bid">Bid <strong>{fmt(best.bid)}</strong></span>
  <span class="stat">Spread <strong>{best.ask !== undefined && best.bid !== undefined ? (best.ask - best.bid).toFixed(2) : ''}</strong></span>
  <label class="pick">Group
    <select class="group" value={group} onchange={(e) => (group = Number(e.currentTarget.value))}>
      {#each GROUPS as g (g)}<option value={g}>{g}</option>{/each}
    </select>
  </label>
  <span class="seg" role="group" aria-label="Layout">
    <button class="layout" class:on={layout === 'stacked'} onclick={() => (layout = 'stacked')}>Stacked</button>
    <button class="layout" class:on={layout === 'side'} onclick={() => (layout = 'side')}>Side by side</button>
  </span>
  <button class="live" class:on={live} onclick={() => (live = !live)}>
    <span class="dot"></span>{live ? 'Live' : 'Paused'}
  </button>
</div>

<div class="gridwrap" class:wide={layout === 'side'}>
  {#if layout === 'stacked'}
    <Grid rows={stacked} columns={stackedColumns} theme={ui.grid} height={620} rowClass={(r) => (r as BookRow).side} cell={stackedCell} ariaLabel="Order book" />
  {:else}
    <Grid rows={pairs} columns={pairColumns} theme={ui.grid} height={LEVELS * 36 + 44} cell={pairCell} ariaLabel="Order book, side by side" />
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .stat strong {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .stat.ask strong {
    color: var(--down);
  }
  .stat.bid strong {
    color: var(--up);
  }
  .pick select {
    margin-left: 4px;
    font: inherit;
  }
  .seg {
    display: inline-flex;
    border: 0.5px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .layout {
    padding: 4px 10px;
    font: inherit;
    color: var(--text-dim);
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .layout.on {
    color: var(--text);
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
  }
  .live .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-dim);
  }
  .live.on .dot {
    background: var(--up);
    box-shadow: 0 0 6px var(--up);
  }
  .gridwrap {
    max-width: 560px;
  }
  .gridwrap.wide {
    max-width: 760px;
  }

  /* Depth-bar cell + per-row side colouring (rows live inside the grid, so the
     row classes are targeted with :global). Bid bars grow from the spread
     side in the side-by-side layout, as ask bars do. */
  .depth {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .depth .fill {
    position: absolute;
    top: 4px;
    bottom: 4px;
    right: 0;
    border-radius: 2px;
    opacity: 0.28;
  }
  .wide .depth.ask {
    justify-content: flex-start;
  }
  .wide .depth.ask .fill {
    right: auto;
    left: 0;
  }
  .depth .fill.ask {
    background: var(--down);
  }
  .depth .fill.bid {
    background: var(--up);
  }
  .depth .tot {
    position: relative;
    font-size: 11px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  :global(.bo-grid .row.ask .num) {
    color: var(--down);
  }
  :global(.bo-grid .row.bid .num) {
    color: var(--up);
  }
  :global(.bo-grid .c.bid) {
    color: var(--up);
  }
  :global(.bo-grid .c.ask) {
    color: var(--down);
  }
</style>
