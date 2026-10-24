<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'name', header: 'Company', width: 160 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', flex: 1 },
  ];

  let rows = $state(quotes());
</script>

<!-- Anything can go in the panel: text, a form, another grid. -->
{#snippet detail({ row }: { row: GridRow })}
  <div class="detail">
    <strong>{row.name}</strong> · {row.sector}
    <dl>
      <dt>Last</dt><dd>{Number(row.price).toFixed(2)}</dd>
      <dt>Change</dt><dd>{Number(row.change).toFixed(2)}%</dd>
      <dt>Volume</dt><dd>{Number(row.volume).toLocaleString()}</dd>
    </dl>
  </div>
{/snippet}

<Grid {rows} {columns} {detail} detailHeight={96} height={300} />

<style>
  .detail {
    padding: 12px 16px;
    font-size: 13px;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(3, max-content max-content);
    gap: 4px 12px;
    margin: 8px 0 0;
  }
  dt {
    opacity: 0.6;
  }
  dd {
    margin: 0 16px 0 0;
  }
</style>
