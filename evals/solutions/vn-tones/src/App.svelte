<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';
  import { resolveTone, vnBands } from 'bo-grid/trading';
  import { stocks } from './board';

  const rows: GridRow[] = stocks.map((s) => {
    const { ceiling, floor } = vnBands(s.ref, s.exchange);
    return { ...s, ceiling, floor };
  });
  const tone = (_v: unknown, row: GridRow) => `tone-${resolveTone(Number(row.price), { ref: Number(row.ref), ceiling: Number(row.ceiling), floor: Number(row.floor) })}`;
  const columns: ColumnDef[] = [
    { type: 'text', key: 'id', header: 'Symbol', cellClass: tone },
    { type: 'number', key: 'ref', header: 'Ref', decimals: 0 },
    { type: 'number', key: 'ceiling', header: 'Ceiling', decimals: 0 },
    { type: 'number', key: 'floor', header: 'Floor', decimals: 0 },
    { type: 'number', key: 'price', header: 'Price', decimals: 0, cellClass: tone },
  ];
</script>

<main>
  <h1>Board</h1>
  <Grid {rows} {columns} height={400} />
</main>

<style>
  :global(.bo-grid .c.tone-ceiling) { color: #e879f9; }
  :global(.bo-grid .c.tone-floor) { color: #22d3ee; }
  :global(.bo-grid .c.tone-ref) { color: #facc15; }
  :global(.bo-grid .c.tone-up) { color: #4ade80; }
  :global(.bo-grid .c.tone-down) { color: #f87171; }
</style>
