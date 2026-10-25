// Code shown on the docs pages, per framework. Kept here, not in the pages'
// Markdown, so a sample can hold a </script> tag and stay plain TypeScript.

const columnsTs = `const columns: ColumnDef[] = [
  { type: 'text', key: 'symbol', header: 'Symbol' },
  { type: 'price', key: 'price', header: 'Price', flash: 'auto' },
  { type: 'percent', key: 'change', header: 'Chg %' },
  { type: 'volume', key: 'volume', header: 'Volume' },
];`;

const rowsTs = `[
  { id: 1, symbol: 'VNM', price: 68.5, change: 1.2, volume: 1_204_000 },
  { id: 2, symbol: 'FPT', price: 132, change: -0.4, volume: 860_500 },
]`;

export const firstGrid = {
  svelte: `<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  ${columnsTs.split('\n').join('\n  ')}
  let rows = $state(${rowsTs.split('\n').join('\n  ')});
</script>

<Grid {rows} {columns} height={400} />`,
  react: `import { useState } from 'react';
import { BoGrid } from 'bo-grid/react';
import type { ColumnDef } from 'bo-grid';

${columnsTs}

export function Board() {
  const [rows] = useState(${rowsTs.split('\n').join('\n  ')});
  return <BoGrid rows={rows} columns={columns} height={400} />;
}`,
  vue: `<script setup lang="ts">
import { ref } from 'vue';
import { BoGrid } from 'bo-grid/vue';
import type { ColumnDef } from 'bo-grid';

${columnsTs}
const rows = ref(${rowsTs});
</script>

<template>
  <BoGrid :rows="rows" :columns="columns" :height="400" />
</template>`,
  js: `import { createBoGrid } from 'bo-grid/element';

/** @type {import('bo-grid').ColumnDef[]} */
${columnsTs.replace(': ColumnDef[]', '')}
const rows = ${rowsTs};

const config = { columns, rows, height: 400 };
const grid = createBoGrid(config);
document.querySelector('#board')?.append(grid);
// Later: grid.config = { ...config, rows: nextRows };`,
};

export const liveFeed = {
  svelte: `<script lang="ts">
  import { Grid, type GridApi } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';

  let rows = $state.raw(initialQuotes); // plain objects: the grid writes the ticks
  let api: GridApi;
  const stream = createTickStream<string, Partial<Quote>>({
    apply: (batch) => api.patchRows(batch), // repaints only the cells that changed
  });
  stream.start();
  socket.onmessage = (e) => {
    const q = JSON.parse(e.data);
    stream.push(q.symbol, q);
  };
</script>

<Grid {rows} {columns} getRowId={(r) => String(r.symbol)} onReady={(a) => (api = a)} height={400} />`,
  react: `import { useEffect, useRef } from 'react';
import { BoGrid } from 'bo-grid/react';
import { createTickStream } from 'bo-grid/realtime';
import type { GridApi } from 'bo-grid';

export function Board({ initialQuotes }: { initialQuotes: Quote[] }) {
  const grid = useRef<GridApi>(null);
  useEffect(() => {
    const stream = createTickStream<string, Partial<Quote>>({
      apply: (batch) => grid.current?.patchRows(batch),
    });
    stream.start();
    socket.onmessage = (e) => {
      const q = JSON.parse(e.data);
      stream.push(q.symbol, q);
    };
    return () => stream.stop();
  }, []);
  return <BoGrid ref={grid} rows={initialQuotes} columns={columns} getRowId={(r) => String(r.symbol)} height={400} />;
}`,
  vue: `<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { BoGrid } from 'bo-grid/vue';
import { createTickStream } from 'bo-grid/realtime';

const grid = ref<InstanceType<typeof BoGrid>>();
const stream = createTickStream<string, Partial<Quote>>({
  apply: (batch) => grid.value?.api?.patchRows(batch),
});
onMounted(() => {
  stream.start();
  socket.onmessage = (e) => {
    const q = JSON.parse(e.data);
    stream.push(q.symbol, q);
  };
});
onUnmounted(() => stream.stop());
</script>

<template>
  <BoGrid ref="grid" :rows="initialQuotes" :columns="columns" :get-row-id="(r) => String(r.symbol)" :height="400" />
</template>`,
};
