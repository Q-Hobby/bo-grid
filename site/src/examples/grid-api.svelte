<script lang="ts">
  import { Grid, type ColumnDef, type GridApi, type GridState } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    { type: 'text', key: 'name', header: 'Name', width: 160 },
    { type: 'price', key: 'price', header: 'Price' },
    { type: 'percent', key: 'change', header: 'Chg %' },
    { type: 'volume', key: 'volume', header: 'Volume', flex: 1 },
  ];
  let rows = $state(quotes());
  let api = $state<GridApi>();
  let saved = $state<GridState | null>(null);
</script>

<p style="margin: 0 0 10px; display: flex; flex-wrap: wrap; gap: 6px">
  <button onclick={() => api?.scrollToRow(11, 'center')}>Scroll to TCB</button>
  <button onclick={() => api?.focusCell(3, 'price')}>Focus HPG price</button>
  <button onclick={() => api?.autosizeColumns()}>Autosize</button>
  <button onclick={() => (saved = api?.getState() ?? null)}>Save layout</button>
  <button disabled={!saved} onclick={() => saved && api?.applyState(saved)}>Restore layout</button>
</p>
<Grid {rows} {columns} height={240} columnMenu onReady={(a) => (api = a)} />
