// Measures cell text for `autoWidth` columns without forcing layout on a live
// board: each column's font and padding are read once from one rendered cell
// (kept until the theme changes), and text is measured on a canvas.

export interface CellMetrics {
  /** The font of the cell's text, as a canvas font string. */
  font: string;
  /** The cell's horizontal padding, plus 2 px for sub-pixel text and the
      ellipsis threshold. */
  pad: number;
}

/** Text width per character when there is no canvas (a DOM without one). */
const FALLBACK_CHAR_PX = 7.5;

export class TextMeter {
  private ctx: CanvasRenderingContext2D | null | undefined;
  private readonly metrics = new Map<string, CellMetrics>();

  /** Forgets every column's font (the theme changed). */
  reset(): void {
    this.metrics.clear();
  }

  /** A column's metrics, read from `findCell()` the first time; null while no
      cell of the column is rendered. */
  metricsFor(key: string, findCell: () => HTMLElement | null | undefined): CellMetrics | null {
    const hit = this.metrics.get(key);
    if (hit) return hit;
    const cell = findCell();
    if (!cell) return null;
    const text = cell.querySelector<HTMLElement>('.bo-cell-text, strong, .bo-cf-val') ?? cell;
    const cs = getComputedStyle(cell);
    const ts = getComputedStyle(text);
    // From the longhands: Chrome returns an empty `font` shorthand for text with
    // tabular figures (font-variant-numeric), which every numeric cell has.
    const font = `${ts.fontStyle} ${ts.fontWeight} ${ts.fontSize} ${ts.fontFamily}`;
    const m = { font, pad: (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2 };
    this.metrics.set(key, m);
    return m;
  }

  /** The width of `text` in `font`, in px. */
  width(text: string, font: string): number {
    if (this.ctx === undefined) this.ctx = document.createElement('canvas').getContext('2d');
    if (this.ctx && typeof this.ctx.measureText === 'function') {
      this.ctx.font = font;
      const w = this.ctx.measureText(text)?.width;
      if (typeof w === 'number') return w;
    }
    return text.length * FALLBACK_CHAR_PX;
  }
}
