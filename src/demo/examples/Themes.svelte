<script lang="ts">
  import { Grid, themePresets, type ThemePreset, type ColumnDef, type GridRow } from '../../lib';

  // Showcases the built-in theme presets — the same grid re-themed by passing a
  // different preset to the `theme` prop. (Self-themed; ignores the page toggle.)
  const NAMES: ThemePreset[] = [
    'dark',
    'light',
    'high-contrast-dark',
    'high-contrast-light',
    'midnight',
    'terminal',
    'tradecanvas',
    'tradecanvas-light',
  ];
  let active = $state<ThemePreset>('midnight');

  interface Pos extends GridRow {
    symbol: string;
    price: number;
    changePct: number;
    rank: number;
  }
  const SYMS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'COIN'];
  const rows = $state<Pos[]>(
    SYMS.map((symbol, id) => ({
      id,
      flashSeq: 0,
      flashDir: 'up' as const,
      symbol,
      price: 50 + ((id * 37) % 400) + 0.25,
      changePct: ((id * 13) % 21) - 10 + 0.5,
      rank: id + 1,
    })),
  );
  const gridRows = $derived(rows as unknown as GridRow[]);

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 110 },
    { type: 'price', key: 'price', header: 'Price', width: 110, flash: true },
    { type: 'percent', key: 'changePct', header: 'Chg %', width: 100 },
    { type: 'heatmap', key: 'changePct', header: 'Heat', width: 96, min: -10, max: 10 },
    { type: 'number', key: 'rank', header: 'Rank', width: 90, decimals: 0, dataBar: { min: 0, max: 10 } },
  ];
</script>

<div class="theme-picker">
  {#each NAMES as name (name)}
    <button class="tp-btn" class:on={name === active} type="button" onclick={() => (active = name)}>
      {name}
    </button>
  {/each}
</div>

<div class="gridwrap">
  <Grid rows={gridRows} {columns} fitColumns theme={themePresets[active]} height={420} ariaLabel="Theme preview" />
</div>

<style>
  .theme-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }
  .tp-btn {
    padding: 5px 12px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-dim);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
  }
  .tp-btn:hover {
    color: var(--text);
  }
  .tp-btn.on {
    color: var(--on-accent);
    background: var(--accent);
    border-color: var(--accent);
  }
  .tp-btn:focus-visible {
    outline: 2px solid var(--up);
    outline-offset: 2px;
  }
  .gridwrap {
    max-width: 620px;
  }
</style>
