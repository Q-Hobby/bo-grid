<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { createOrderBook, type BookLevelInput, type BookRow } from 'bo-grid/realtime';

  // A book kept from a depth feed: a snapshot, then the levels that change.
  const book = createOrderBook({ maxLevels: 500 });
  const size = () => Math.ceil(Math.random() * 40) / 10;
  const price = (side: 'bid' | 'ask', depth: number) => Math.round((side === 'bid' ? 99.9 - depth * 0.1 : 100.1 + depth * 0.1) * 10) / 10;
  const side = (s: 'bid' | 'ask'): BookLevelInput[] => Array.from({ length: 30 }, (_, i) => [price(s, i), size()]);
  book.snapshot({ bids: side('bid'), asks: side('ask') });

  let group = $state(0);
  let rows = $state.raw<BookRow[]>([]);
  const columns: ColumnDef[] = [
    { type: 'number', key: 'price', header: 'Price', decimals: 1, width: 100, cellClass: (_v, r) => (r as BookRow).side },
    { type: 'number', key: 'size', header: 'Size', decimals: 1, flash: 'auto' },
    { type: 'number', key: 'share', header: 'Depth', flex: 1, format: (_v, r) => (r ? (r as BookRow).total.toFixed(1) : ''), dataBar: { min: 0, max: 1, color: 'color-mix(in srgb, var(--bo-amber) 45%, transparent)' } },
  ];

  $effect(() => {
    rows = book.rows(6, { group }); // a new grouping reads at once
  });

  $effect(() => {
    let seen = book.version;
    let frame = 0;
    const read = () => {
      // Read once a frame, not once a message: version bumps on every visible change.
      if (book.version !== seen) {
        seen = book.version;
        rows = book.rows(6, { group });
      }
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
    const feed = setInterval(() => {
      const s = Math.random() < 0.5 ? 'bid' : 'ask';
      const level: BookLevelInput = [price(s, Math.floor(Math.random() * 10)), Math.random() < 0.15 ? 0 : size()]; // size 0 removes a level
      book.update(s === 'bid' ? { bids: [level] } : { asks: [level] });
    }, 60);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(feed);
    };
  });
</script>

<label class="bar">Group levels <select bind:value={group}><option value={0}>none</option><option value={0.5}>0.5</option><option value={1}>1</option></select></label>
<div class="book"><Grid {rows} {columns} rowHeight={28} height={12 * 28} cellSelection={false} /></div>

<style>
  .bar {
    display: block;
    margin: 0 0 8px;
    font-size: 12px;
  }
  select {
    font: inherit;
  }
  .book :global(.c.ask) { color: var(--bo-down); }
  .book :global(.c.bid) { color: var(--bo-up); }
</style>
