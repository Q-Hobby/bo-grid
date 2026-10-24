<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from '../../lib';
  import { CRYPTO_SCHEDULE, fmtSigPrice, fxCentresOpen, fxMarketOpen, fxPipSize, fxQuoteHtml, pipsBetween, sessionLabel, sessionStateAt } from '../../lib/trading';
  import { ui } from '../theme.svelte';

  // Two markets beyond the exchange board. FX quotes show the way a dealing
  // screen does (the big figure small, the pips large, the pipette raised),
  // spreads and moves count in pips, and the header follows the FX week and
  // its centres. A crypto watchlist runs from tens of thousands down to
  // millionths in one column, so prices show to significant digits, and the
  // market never closes.
  interface Pair extends GridRow {
    pair: string;
    bid: number;
    ask: number;
    open: number;
  }
  interface Coin extends GridRow {
    symbol: string;
    last: number;
    open: number;
    volume: number;
  }

  let seed = 0xf00d;
  function rand(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const PAIRS: [string, number, number][] = [
    ['EUR/USD', 1.0845, 0.8],
    ['GBP/USD', 1.2671, 1.1],
    ['USD/JPY', 151.23, 0.9],
    ['AUD/USD', 0.6612, 1.0],
    ['USD/CHF', 0.9031, 1.3],
    ['EUR/JPY', 164.02, 1.6],
  ];
  let pairs = $state.raw<Pair[]>(
    PAIRS.map(([pair, mid, spread], i) => {
      const half = (spread * fxPipSize(pair)) / 2;
      return { id: i, pair, bid: mid - half, ask: mid + half, open: mid };
    }),
  );
  const COINS: [string, number][] = [
    ['BTC', 63250],
    ['ETH', 3456.78],
    ['SOL', 142.31],
    ['DOGE', 0.15234],
    ['SHIB', 0.0000183],
    ['PEPE', 0.0000012345],
  ];
  let coins = $state.raw<Coin[]>(COINS.map(([symbol, last], i) => ({ id: i, symbol, last, open: last, volume: 1e6 * (1 + rand() * 50) })));

  // The clock the session labels read, once a second.
  let now = $state(new Date());
  const fxOpen = $derived(fxMarketOpen(now));
  const centres = $derived(fxCentresOpen(now));
  const crypto = $derived(sessionLabel(sessionStateAt(now, CRYPTO_SCHEDULE, { timeZone: 'UTC', skipWeekends: false })));

  let live = $state(true);
  $effect(() => {
    if (!live) return;
    const tick = setInterval(() => {
      pairs = pairs.map((p) => {
        if (rand() < 0.4) return p;
        const pip = fxPipSize(p.pair);
        const move = Math.round((rand() - 0.5) * 6) * pip * 0.1;
        const spread = (p.ask - p.bid) * (0.9 + rand() * 0.2);
        const mid = (p.bid + p.ask) / 2 + move;
        return { ...p, bid: mid - spread / 2, ask: mid + spread / 2 };
      });
      coins = coins.map((c) => (rand() < 0.5 ? c : { ...c, last: c.last * (1 + (rand() - 0.5) * 0.002), volume: c.volume + rand() * 1e4 }));
    }, 300);
    const clock = setInterval(() => (now = new Date()), 1000);
    return () => {
      clearInterval(tick);
      clearInterval(clock);
    };
  });

  const pair = (r: GridRow) => r as Pair;
  const fxColumns: ColumnDef[] = [
    { type: 'text', key: 'pair', header: 'Pair', width: 88 },
    { type: 'custom', key: 'bid', header: 'Bid', width: 110, align: 'right', render: ({ row }) => fxQuoteHtml(pair(row).bid, pair(row).pair) },
    { type: 'custom', key: 'ask', header: 'Ask', width: 110, align: 'right', render: ({ row }) => fxQuoteHtml(pair(row).ask, pair(row).pair) },
    { type: 'number', key: 'spread', header: 'Spread (pips)', width: 108, decimals: 1, value: (r) => pipsBetween(pair(r).ask, pair(r).bid, pair(r).pair) },
    {
      type: 'number',
      key: 'move',
      header: 'Move (pips)',
      width: 100,
      decimals: 1,
      value: (r) => pipsBetween((pair(r).bid + pair(r).ask) / 2, pair(r).open, pair(r).pair),
      cellClass: (v) => (Number(v) > 0 ? 'fx-up' : Number(v) < 0 ? 'fx-down' : undefined),
    },
  ];
  const coin = (r: GridRow) => r as Coin;
  const cryptoColumns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Coin', width: 72 },
    { type: 'number', key: 'last', header: 'Last', width: 120, format: (v) => fmtSigPrice(Number(v)), flash: 'auto' },
    { type: 'percent', key: 'chg', header: 'Change', width: 90, value: (r) => (100 * (coin(r).last - coin(r).open)) / coin(r).open },
    { type: 'number', key: 'volume', header: 'Volume', width: 120, format: (v) => Math.round(Number(v)).toLocaleString('en-US') },
  ];
</script>

<div class="controls">
  <button class="live" class:on={live} onclick={() => (live = !live)}>
    <span class="dot"></span>{live ? 'Live' : 'Paused'}
  </button>
  <span class="stat">FX <strong>{fxOpen ? 'open' : 'closed'}</strong>{centres.length ? ` · ${centres.join(' + ')}` : ''} · crypto <strong>{crypto}</strong></span>
</div>

<div class="desk">
  <section>
    <h4>FX</h4>
    <Grid rows={pairs} columns={fxColumns} height={6 * 34} rowHeight={34} theme={ui.grid} ariaLabel="FX quotes" />
  </section>
  <section>
    <h4>Crypto</h4>
    <Grid rows={coins} columns={cryptoColumns} height={6 * 32} rowHeight={32} theme={ui.grid} ariaLabel="Crypto watchlist" />
  </section>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .stat strong {
    color: var(--text);
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font: inherit;
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
  .desk {
    display: grid;
    gap: 18px;
  }
  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .desk :global(.fx-up) {
    color: var(--up);
  }
  .desk :global(.fx-down) {
    color: var(--down);
  }
</style>
