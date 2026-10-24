<script lang="ts">
  import { Grid, type ColumnDef, type SortState } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 110 },
    { type: 'text', key: 'sector', header: 'Sector', width: 140, filter: 'set' },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
  // Controlled sort: start sorted by volume, highest first.
  let sort = $state<SortState[]>([{ key: 'volume', dir: 'desc' }]);
</script>

<Grid {rows} {columns} height={300} filterMenu quickFilter {sort} onSortChange={(s) => (sort = s)} />
