<script lang="ts">
  import { untrack } from 'svelte';
  import {
    Grid,
    pivot,
    type ColumnDef,
    type GridRow,
    type PivotConfig,
    type SortState,
    type AnyFilter,
  } from '../../lib';
  import { ui } from '../theme.svelte';
  import { generateTickers } from '../data/generate';

  // A static "positions" book derived from the shared ticker seeds. No realtime
  // feed here — this example is about grouping, subtotals, and pivoting.
  interface Position extends GridRow {
    symbol: string;
    name: string;
    sector: string;
    exchange: string;
    shares: number;
    avgCost: number;
    last: number;
    marketValue: number;
    pnl: number;
    pnlPct: number;
  }

  function buildPositions(count: number): Position[] {
    return generateTickers(count).map((s) => {
      // Deterministic share count so reloads are stable (seed off the id).
      const shares = 25 + ((s.id * 37) % 480);
      const avgCost = s.dayOpen;
      const last = s.price;
      const marketValue = shares * last;
      const costBasis = shares * avgCost;
      const pnl = marketValue - costBasis;
      return {
        id: s.id,
        flashSeq: 0,
        flashDir: 'up',
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        exchange: s.exchange,
        shares,
        avgCost,
        last,
        marketValue,
        pnl,
        pnlPct: (pnl / costBasis) * 100,
      } satisfies Position;
    });
  }

  const rows = $state<Position[]>(buildPositions(180));
  const gridRows = $derived(rows as unknown as GridRow[]);

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', sub: 'sector', header: 'Symbol', width: 124, pinned: true, group: 'Holding' },
    { type: 'text', key: 'exchange', header: 'Exch', width: 78, group: 'Holding', filter: 'set' },
    { type: 'number', key: 'shares', header: 'Shares', width: 92, decimals: 0, groupAgg: 'sum', group: 'Holding' },
    { type: 'price', key: 'avgCost', header: 'Avg Cost', width: 96, group: 'Pricing' },
    { type: 'price', key: 'last', header: 'Last', width: 92, group: 'Pricing' },
    // Data bar (proportional, anchored at 0): in-cell magnitude of each holding.
    { type: 'volume', key: 'marketValue', header: 'Mkt Value', width: 132, groupAgg: 'sum', group: 'Valuation', dataBar: { min: 0 } },
    // Computed column: no `cost` field on the row — value() derives it. Still
    // sorts, aggregates (subtotal/footer) and exports like a real column.
    { type: 'volume', key: 'cost', header: 'Cost Basis', width: 116, groupAgg: 'sum', group: 'Valuation',
      value: (row) => (row.shares as number) * (row.avgCost as number) },
    // Colour scale (diverging around 0, auto-ranged): a soft, theme-tinted heat ramp.
    { type: 'number', key: 'pnlPct', header: 'P&L %', width: 92, decimals: 1, groupAgg: 'avg', group: 'P&L', colorScale: { mid: 0 } },
    // Data bar (diverging around zero) + an icon set keyed by sign.
    {
      type: 'number', key: 'pnl', header: 'P&L $', width: 140, decimals: 0, groupAgg: 'sum', group: 'P&L',
      dataBar: {},
      icons: [
        { at: -Infinity, icon: '▼', tone: 'down' },
        { at: 0, icon: '▲', tone: 'up' },
      ],
    },
  ];

  let grouped = $state(true);
  let pivotMode = $state(false);

  const pivotConfig: PivotConfig = {
    rowFields: ['sector'],
    columnField: 'exchange',
    measure: 'marketValue',
    agg: 'sum',
    decimals: 0,
  };
  const pv = $derived(pivotMode ? untrack(() => pivot(gridRows, pivotConfig)) : null);

  const effRows = $derived(pivotMode && pv ? pv.rows : gridRows);
  const effColumns = $derived(pivotMode && pv ? pv.columns : columns);
  const groupBy = $derived(pivotMode ? [] : grouped ? ['sector'] : []);

  // Book-level totals for the summary strip.
  const totalValue = $derived(rows.reduce((a, r) => a + r.marketValue, 0));
  const totalPnl = $derived(rows.reduce((a, r) => a + r.pnl, 0));
  const fmtMoney = (n: number) =>
    n.toLocaleString('en-US', { maximumFractionDigits: 0, signDisplay: 'auto' });

  // Click a position to inspect it (cleared when switching to pivot view).
  let picked = $state<Position | null>(null);
  $effect(() => {
    if (pivotMode) picked = null;
  });

  // Controlled filters: the example owns the column-filter map (mirrors sort).
  let columnFilters = $state<Record<string, AnyFilter>>({});

  // Controlled sort: the example owns the sort order, so it can show and clear it.
  let sortState = $state<SortState[]>([]);
  const sortLabel = $derived(
    sortState.map((s) => `${s.key} ${s.dir === 'asc' ? '↑' : '↓'}`).join(', '),
  );
</script>

<div class="controls">
  <button class="pill" class:on={grouped} disabled={pivotMode} onclick={() => (grouped = !grouped)}>
    Group by sector
  </button>
  <button class="pill" class:on={pivotMode} onclick={() => (pivotMode = !pivotMode)}>
    Pivot · value by exchange
  </button>
  {#if sortState.length}
    <button class="pill clear" onclick={() => (sortState = [])} title="Clear sort">
      Sort: {sortLabel} ✕
    </button>
  {/if}
  <span class="spacer"></span>
  {#if picked}
    <span class="picked">
      ▸ <strong>{picked.symbol}</strong> · {picked.shares} sh · ${fmtMoney(picked.marketValue)}
      <span class:up={picked.pnl >= 0} class:down={picked.pnl < 0}>
        {picked.pnl >= 0 ? '+' : ''}${fmtMoney(picked.pnl)}
      </span>
    </span>
  {/if}
  <span class="stat">Book value <strong>${fmtMoney(totalValue)}</strong></span>
  <span class="stat" class:up={totalPnl >= 0} class:down={totalPnl < 0}>
    Unrealised P&L <strong>{totalPnl >= 0 ? '+' : ''}${fmtMoney(totalPnl)}</strong>
  </span>
</div>

<div class="gridwrap">
  <Grid
    fitColumns
    rows={effRows}
    columns={effColumns}
    {groupBy}
    filterMenu={!pivotMode}
    columnMenu={!pivotMode}
    columnsPanel={!pivotMode}
    {columnFilters}
    onFilterChange={(f) => (columnFilters = f)}
    theme={ui.grid}
    persistKey="demo-portfolio"
    height={620}
    sort={sortState}
    onSortChange={(s) => (sortState = s)}
    onRowClick={(r) => !pivotMode && (picked = r as Position)}
    rowMenu={(r) =>
      pivotMode
        ? []
        : [
            { label: 'Inspect position', onSelect: () => (picked = r as Position) },
            { label: 'Clear', onSelect: () => (picked = null) },
          ]}
    footer={!pivotMode}
  />
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    font-family: var(--mono);
    font-size: 12px;
  }
  .spacer {
    flex: 1;
  }
  .pill {
    padding: 5px 12px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-dim);
    background: transparent;
    border: 0.5px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
  }
  .pill.on {
    color: var(--on-accent);
    background: var(--accent);
    border-color: var(--accent);
  }
  .pill:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pill.clear {
    color: var(--text);
    border-color: var(--up);
  }
  .stat {
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .stat strong {
    color: var(--text);
    font-weight: 600;
  }
  .stat.up strong {
    color: var(--up);
  }
  .stat.down strong {
    color: var(--down);
  }
  .picked {
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .picked strong {
    color: var(--text);
  }
  .picked .up {
    color: var(--up);
  }
  .picked .down {
    color: var(--down);
  }
  .gridwrap {
    max-width: 900px;
  }
</style>
