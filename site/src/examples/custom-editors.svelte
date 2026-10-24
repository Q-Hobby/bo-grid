<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { quotes } from './data';
  import Stepper from './custom-editors-stepper.svelte';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', width: 100 },
    // A custom editor component instead of the built-in input.
    { type: 'number', key: 'qty', header: 'Qty (lots of 100)', width: 230, decimals: 0, editable: true, editor: Stepper },
    // `parse` reads typed or pasted text: "1,250.5" or "$1250.5" become 1250.5.
    {
      type: 'price', key: 'price', header: 'Price', width: 130, editable: true,
      parse: (raw) => (/\d/.test(raw) ? Number(raw.replace(/[^\d.-]/g, '')) : undefined),
    },
    // `options` swaps the text input for a dropdown.
    { type: 'text', key: 'side', header: 'Side', flex: 1, editable: true, options: ['Buy', 'Sell'] },
  ];
  let rows = $state(quotes().map((q, i) => ({ ...q, qty: (i % 5) * 100 + 100, side: i % 3 ? 'Buy' : 'Sell' })));
</script>

<Grid {rows} {columns} height={280} defaultColumn={{ resizable: false }} onCellEdit={(e) => (e.row[e.column.key] = e.value)} />
