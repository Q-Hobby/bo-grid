<script lang="ts">
  import { onScreen } from './reveal';
  import { rand } from './market';

  // A tape of instruments under the hero, moving left; prices tick while it
  // is on screen. The strip is drawn twice so the loop has no seam.
  const items = $state(
    [
      ['NVDA', 131.42, 2.31], ['EUR/USD', 1.0842, -0.12], ['BTC-USD', 67412.5, 1.84], ['AAPL', 228.15, 0.42],
      ['USD/JPY', 151.37, 0.08], ['TSLA', 251.06, -1.73], ['ETH-USD', 2631.2, 2.66], ['MSFT', 417.8, 0.21],
      ['XAU/USD', 2734.6, 0.35], ['GBP/USD', 1.2987, -0.27], ['AMD', 154.47, -0.88], ['SOL-USD', 171.04, 4.12],
    ].map(([sym, px, pct]) => ({ sym: sym as string, px: px as number, pct: pct as number, dir: 0 })),
  );
  const dp = (px: number) => (px < 10 ? 4 : 2);

  let visible = $state(false);
  $effect(() => {
    if (!visible) return;
    const h = setInterval(() => {
      const it = items[Math.floor(rand() * items.length)];
      const move = (rand() - 0.48) * it.px * 0.0012;
      it.px = Math.max(0.0001, it.px + move);
      it.pct += (move / it.px) * 100;
      it.dir = move >= 0 ? 1 : -1;
    }, 260);
    return () => clearInterval(h);
  });
</script>

<div class="tape" use:onScreen={(v) => (visible = v)} aria-label="Market tape (simulated)">
  <div class="track">
    {#each [0, 1] as copy (copy)}
      <ul aria-hidden={copy === 1}>
        {#each items as it (it.sym)}
          <li>
            <span class="sym">{it.sym}</span>
            <span class="px" class:up={it.dir > 0} class:down={it.dir < 0}>{it.px.toLocaleString('en-US', { minimumFractionDigits: dp(it.px), maximumFractionDigits: dp(it.px) })}</span>
            <span class="pct" class:up={it.pct >= 0} class:down={it.pct < 0}>{it.pct >= 0 ? '▲' : '▼'} {Math.abs(it.pct).toFixed(2)}%</span>
          </li>
        {/each}
      </ul>
    {/each}
  </div>
</div>

<style>
  .tape {
    position: relative;
    overflow: hidden;
    border-block: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel) 70%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }
  .track {
    display: flex;
    width: max-content;
    animation: tape 60s linear infinite;
  }
  .tape:hover .track {
    animation-play-state: paused;
  }
  ul {
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 12px 28px;
    font-family: var(--font-mono);
    font-size: 13px;
    white-space: nowrap;
    border-right: 1px solid var(--line-soft);
  }
  .sym {
    font-weight: 600;
    color: var(--text);
  }
  .px {
    color: var(--text-2);
    transition: color 0.4s ease;
  }
  .up {
    color: var(--up);
  }
  .down {
    color: var(--down);
  }
  .pct {
    font-size: 12px;
  }
  @keyframes tape {
    to {
      transform: translateX(-50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .track {
      animation: none;
    }
  }
</style>
