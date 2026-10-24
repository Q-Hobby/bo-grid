<script lang="ts">
  import type { ColumnDef, GridRow } from './column';
  import { colStyle, formatCell, cellValue } from './column';
  import { aggregate } from './aggregate';
  import type { GroupNode } from './grouping';

  let {
    group,
    columns,
    onToggle,
    rowIndex,
    version = 0,
    colStart = 1,
    focusable = true,
    cellStyle,
  }: {
    group: GroupNode;
    columns: ColumnDef[];
    onToggle: (path: string) => void;
    rowIndex?: number;
    /** Bumped by the grid on every patchRows, so subtotals over plain rows stay live. */
    version?: number;
    /** aria-colindex of the first column (after the grid's leading columns). */
    colStart?: number;
    /** False for the sticky copy shown at the top while scrolling: it is
        aria-hidden, so its toggle must stay out of the tab order. */
    focusable?: boolean;
    /** The style of the cell under column `ci`, from the grid's layout, so the
        group row lines up with the headers (and a pinned column's cell stays
        put). Without it, each cell is sized from its column definition. */
    cellStyle?: (ci: number) => string;
  } = $props();

  const styleOf = (ci: number): string => (cellStyle ? cellStyle(ci) : colStyle(columns[ci]));

  // Aggregate over the group's leaf rows. Reads row $state values, so group
  // subtotals stay live as the feed ticks (only on-screen groups are rendered).
  function aggText(col: ColumnDef): string {
    version;
    // Lazy/server groups carry preformatted aggregate strings (leaf rows aren't
    // loaded), so use those directly when present.
    if (group.aggText) return group.aggText[col.key] ?? '';
    if (col.type === 'sparkline' || col.type === 'text' || !col.groupAgg) return '';
    const vals: number[] = [];
    for (const row of group.rows) {
      const v = Number(cellValue(col, row as GridRow));
      if (Number.isFinite(v)) vals.push(v);
    }
    const a = aggregate(vals);
    if (!a) return '';
    if (col.groupAgg === 'count') return String(a.count);
    return formatCell(col, a[col.groupAgg]);
  }
</script>

<div class="group" role="row" aria-rowindex={rowIndex}>
  <span class="gcell" role="gridcell" aria-colindex={colStart} style={styleOf(0)}>
    <button
      class="toggle"
      type="button"
      tabindex={focusable ? undefined : -1}
      aria-expanded={!group.collapsed}
      onclick={() => onToggle(group.path)}
    >
      <span class="chev" style="margin-left:{group.depth * 12}px">{group.collapsed ? '▸' : '▾'}</span>
      <span class="val">{group.value}</span>
      <span class="count">{group.count}</span>
    </button>
  </span>

  {#each columns as col, ci (ci)}
    {#if ci > 0}
      <span class="agg" role="gridcell" aria-colindex={colStart + ci} style={styleOf(ci)}>{aggText(col)}</span>
    {/if}
  {/each}
</div>

<style>
  .group {
    /* Named, so a pinned (sticky) cell can lay it over an opaque base. */
    --bo-group-bg: color-mix(in srgb, var(--bo-header-bg) 85%, var(--bo-text) 4%);
    display: flex;
    flex: 1 1 0;
    align-items: stretch;
    min-width: 0;
    height: 100%;
    background: var(--bo-group-bg);
    border-bottom: 0.5px solid var(--bo-border);
  }
  /* The first column's cell: sized like the column, filled by the toggle. */
  .gcell {
    display: flex;
    min-width: 0;
  }
  .toggle {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 0 8px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--bo-text);
    background: transparent;
    border: 0;
    cursor: pointer;
    text-align: left;
  }
  .chev {
    font-size: 10px;
    color: var(--bo-text-dim);
  }
  .val {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .count {
    flex: none;
    padding: 0 5px;
    font-family: var(--bo-mono);
    font-size: 10px;
    font-weight: 500;
    color: var(--bo-text-dim);
    background: var(--bo-row-hover);
    border-radius: 999px;
  }
  .agg {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8px;
    font-family: var(--bo-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    /* Between the text and dim colours: subtotals read as secondary while
       clearing 4.5:1 on the group row in every preset. */
    color: color-mix(in srgb, var(--bo-text) 55%, var(--bo-text-dim));
    overflow: hidden;
    white-space: nowrap;
  }
</style>
