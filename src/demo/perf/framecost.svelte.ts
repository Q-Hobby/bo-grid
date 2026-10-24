// A live frame-cost readout, measured the way the CI gate's live workloads
// measure a frame (scripts/bench-browser.mjs, PriceBoard's benchLive): from
// the frame's start to a task posted from it, which runs after the frame's
// script, style, layout and paint. So, while the board runs, the demo shows a
// figure comparable to what the gate checks (the gate generates its feed
// inside the frame and drops warm-up frames; the demo feeds from a timer).
//
// The readout itself costs next to nothing: one rAF callback and one message
// per frame, and the shown numbers change four times a second.

/** Frames kept for the rolling figures: two seconds at 60 Hz. */
const WINDOW = 120;
/** How often the shown numbers change, ms. */
const SHOW_EVERY = 250;
/** Frames measured before anything is shown. */
const MIN_SAMPLES = 10;
/** A gap between frames longer than this is a pause (a hidden tab), not a
    frame interval. */
const PAUSE = 250;

export class FrameCostMeter {
  /** Median frame time, ms. */
  p50 = $state(0);
  /** 95th percentile, ms. */
  p95 = $state(0);
  /** Frames over the frame budget (the display's own frame interval). */
  over = $state(0);
  /** The frame budget, ms: the median interval between frames. */
  budget = $state(16.7);
  /** The most recent frames' times, oldest first, for a bar chart. */
  recent = $state.raw<number[]>([]);

  private work: number[] = [];
  private gaps: number[] = [];
  private prev = 0;
  private lastShown = 0;
  private rafId = 0;
  private running = false;
  private channel: MessageChannel | null = null;

  private frame = (ts: number): void => {
    if (!this.running) return;
    if (this.prev && ts - this.prev < PAUSE) push(this.gaps, ts - this.prev);
    this.prev = ts;
    // The frame's start travels with its message, so a message is measured
    // against its own frame even if another frame starts before it arrives.
    this.channel?.port2.postMessage(ts);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private done = (e: MessageEvent<number>): void => {
    const now = performance.now();
    const took = now - e.data;
    if (took >= 0) push(this.work, took);
    if (this.work.length < MIN_SAMPLES || now - this.lastShown < SHOW_EVERY) return;
    this.lastShown = now;
    const sorted = [...this.work].sort((a, b) => a - b);
    const budget = this.gaps.length ? [...this.gaps].sort((a, b) => a - b)[this.gaps.length >> 1] : 16.7;
    this.p50 = sorted[sorted.length >> 1];
    this.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    this.budget = budget;
    this.over = this.work.filter((w) => w > budget).length;
    this.recent = this.work.slice(-60);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.p50 = this.p95 = this.over = 0;
    this.recent = [];
    this.channel = new MessageChannel();
    this.channel.port1.onmessage = this.done;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.channel?.port1.close();
    this.channel = null;
    this.work = [];
    this.gaps = [];
    this.prev = 0;
    this.lastShown = 0;
  }
}

function push(xs: number[], x: number): void {
  xs.push(x);
  if (xs.length > WINDOW) xs.shift();
}
