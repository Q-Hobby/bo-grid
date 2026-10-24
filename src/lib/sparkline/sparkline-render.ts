import type { Candle } from '../types';
import { boError } from '../errors';

const UP = '#34d399';
const DOWN = '#f87171';

/**
 * Size a canvas for the current devicePixelRatio so 1px CSS strokes render
 * crisp on HiDPI/Retina. Returns a context already scaled to CSS pixels —
 * callers draw in CSS-pixel coordinates and forget dpr exists.
 */
export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw boError(Error, 'BG1201', 'sparkline: a 2d canvas context is not available here.', 'Draw sparklines in a browser; in a test environment, stub HTMLCanvasElement.prototype.getContext.');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

interface Extent {
  min: number;
  max: number;
}

function priceExtent(candles: Candle[]): Extent {
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  return { min, max };
}

/** Map a price to a y pixel (inverted: high price = small y). */
function yOf(price: number, ext: Extent, h: number, pad: number): number {
  const span = ext.max - ext.min || 1;
  return pad + (1 - (price - ext.min) / span) * (h - pad * 2);
}

/**
 * Draw compact candlesticks. Body shows open→close, wick shows low→high.
 * Color by per-candle direction. Canvas (not SVG) so 100+ of these stay cheap.
 */
export function drawCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  w: number,
  h: number,
  colors: { up?: string; down?: string } = {},
): void {
  ctx.clearRect(0, 0, w, h);
  if (candles.length === 0) return;

  const upColor = colors.up || UP;
  const downColor = colors.down || DOWN;
  const ext = priceExtent(candles);
  const pad = 2;
  const n = candles.length;
  const slot = w / n;
  const bodyW = Math.max(1, Math.min(6, slot * 0.6));

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const cx = i * slot + slot / 2;
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? upColor : downColor;
    ctx.fillStyle = up ? upColor : downColor;

    // wick
    ctx.beginPath();
    ctx.moveTo(Math.round(cx) + 0.5, yOf(c.high, ext, h, pad));
    ctx.lineTo(Math.round(cx) + 0.5, yOf(c.low, ext, h, pad));
    ctx.stroke();

    // body
    const yo = yOf(c.open, ext, h, pad);
    const yc = yOf(c.close, ext, h, pad);
    const top = Math.min(yo, yc);
    const bh = Math.max(1, Math.abs(yc - yo));
    ctx.fillRect(cx - bodyW / 2, top, bodyW, bh);
  }
}

/** Screen-reader text — canvas alone is invisible to AT, so we narrate trend. */
export function summarize(candles: Candle[]): string {
  if (candles.length === 0) return 'no data';
  const first = candles[0].open;
  const last = candles[candles.length - 1].close;
  const pct = ((last - first) / first) * 100;
  const dir = pct >= 0 ? 'up' : 'down';
  return `sparkline ${dir} ${Math.abs(pct).toFixed(1)}% over ${candles.length} periods`;
}

/** Which candle index sits under an x offset (for hover tooltips). */
export function candleAtX(x: number, w: number, n: number): number {
  if (n === 0) return -1;
  return Math.max(0, Math.min(n - 1, Math.floor((x / w) * n)));
}
