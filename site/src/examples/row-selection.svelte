<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'name', header: 'Company', width: 150 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', flex: 1 },
  ];

  let rows = $state(quotes());
  // Ids, not positions: the selection survives sorting and filtering.
  let selected = $state<Array<string | number>>([]);
</script>

<p class="state">Selected ids: {selected.length ? selected.join(', ') : 'none'}</p>
<Grid {rows} {columns} rowSelection onRowSelectionChange={(ids) => (selected = ids)} height={260} />

<style>
  .state {
    margin: 0 0 10px;
    font-size: 12.5px;
    opacity: 0.8;
  }
</style>
