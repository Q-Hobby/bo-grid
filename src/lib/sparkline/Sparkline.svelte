<script lang="ts">
  import type { Candle } from '../types';
  import { setupHiDpiCanvas, drawCandles, summarize, candleAtX } from './sparkline-render';
  import { fmtPrice } from '../format/format';

  let {
    candles,
    width,
    height = 26,
  }: {
    candles: Candle[];
    /** A fixed width in px. Without one, the chart fills its cell and follows
        the column's width (a resize, fitColumns). */
    width?: number;
    height?: number;
  } = $props();

  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let hover = $state<number | null>(null);

  // The cell's width, measured as it changes; 104 until the first measure
  // (and where nothing can measure, such as on the server).
  let fill = $state(0);
  $effect(() => {
    if (width != null || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry?.contentRect.width ?? 0);
      if (w > 0 && w !== fill) fill = w;
    });
    ro.observe(box);
    return () => ro.disconnect();
  });
  const w = $derived(width ?? (fill || 104));

  // Redraw whenever the candle array reference changes. Only mounted (= visible)
  // sparklines run this, so the realtime feed never repaints off-screen charts.
  $effect(() => {
    const ctx = setupHiDpiCanvas(canvas, w, height);
    // Pull the grid's up/down colors so candles follow the active theme
    // (inherited --bo-up/--bo-down; falls back to the built-in defaults).
    const cs = getComputedStyle(canvas);
    drawCandles(ctx, candles, w, height, {
      up: cs.getPropertyValue('--bo-up').trim() || undefined,
      down: cs.getPropertyValue('--bo-down').trim() || undefined,
    });
  });

  const label = $derived(summarize(candles));

  function onMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hover = candleAtX(e.clientX - rect.left, w, candles.length);
  }
</script>

<div class="spark" bind:this={box} style="width:{width != null ? `${width}px` : '100%'};height:{height}px" role="img" aria-label={label}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="hit"
    role="presentation"
    onmousemove={onMove}
    onmouseleave={() => (hover = null)}
  ></div>
  {#if hover !== null && candles[hover]}
    <div class="tip">
      O {fmtPrice(candles[hover].open)} · H {fmtPrice(candles[hover].high)} · L
      {fmtPrice(candles[hover].low)} · C {fmtPrice(candles[hover].close)}
    </div>
  {/if}
</div>

<style>
  .spark {
    position: relative;
    display: inline-block;
    /* Never wider than the cell, even before the first measure. */
    max-width: 100%;
    overflow: hidden;
  }
  canvas {
    display: block;
  }
  .hit {
    position: absolute;
    inset: 0;
    cursor: crosshair;
  }
  .tip {
    position: absolute;
    bottom: calc(100% + 4px);
    right: 0;
    z-index: 10;
    white-space: nowrap;
    padding: 4px 6px;
    font-family: var(--bo-mono, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace);
    font-size: 10px;
    color: var(--bo-text, #e5e5e5);
    background: var(--bo-header-bg, #0f0f0f);
    border: 0.5px solid var(--bo-border, rgba(255, 255, 255, 0.12));
    border-radius: 4px;
    pointer-events: none;
  }
</style>
