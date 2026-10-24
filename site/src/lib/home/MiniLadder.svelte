<script lang="ts">
  import { DepthLadder, type BookLevel } from 'bo-grid/ladder';
  import { ui } from '$demo/theme.svelte';
  import { rand } from './market';
  import { onScreen } from './reveal';

  // A depth ladder on a simulated book, for the features grid.
  const TICK = 0.05;
  let mid = 5000;
  const at = (i: number) => Math.round(i * TICK * 100) / 100;
  function book(): { bids: BookLevel[]; asks: BookLevel[] } {
    const bids: BookLevel[] = [];
    const asks: BookLevel[] = [];
    for (let i = 1; i <= 14; i++) {
      bids.push([at(mid - i), (1 + Math.floor(rand() * 40)) * 25]);
      asks.push([at(mid + i), (1 + Math.floor(rand() * 40)) * 25]);
    }
    return { bids, asks };
  }
  let { bids, asks } = $state.raw(book());
  let last = $state(at(mid + 1));
  let visible = $state(false);
  $effect(() => {
    if (!visible) return;
    const h = setInterval(() => {
      if (rand() < 0.25) mid += rand() < 0.5 ? -1 : 1;
      ({ bids, asks } = book());
      last = at(mid + (rand() < 0.5 ? -1 : 1));
    }, 420);
    return () => clearInterval(h);
  });
</script>

<div use:onScreen={(v) => (visible = v)}>
  <DepthLadder {bids} {asks} {last} tick={TICK} rows={11} rowHeight={24} theme={ui.grid} ariaLabel="Depth ladder (simulated)" />
</div>
