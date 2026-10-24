<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'name', header: 'Name', width: 160 },
    { type: 'text', key: 'sector', header: 'Sector', width: 130 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
  let api = $state<GridApi>();
</script>

<p style="margin: 0 0 10px">
  <button onclick={() => api?.openFind('Financials')}>Find “Financials”</button>
  <span style="opacity: 0.7">or click a cell and press Ctrl/⌘+F</span>
</p>
<Grid {rows} {columns} height={280} findBar onReady={(a) => (api = a)} />
