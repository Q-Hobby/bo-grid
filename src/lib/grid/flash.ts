// Per-cell tick flash.
//
// The grid derives the flash itself — the consumer just sets `flash: 'auto'` on
// a column and streams new values in. No `flashSeq` bookkeeping in app code.
//
// Why identity-keyed state instead of per-component state: the row loop is keyed
// by VISUAL index, so a mounted <Cell> is recycled to show a different row as you
// scroll. State held inside the component would make every scroll look like a
// tick. Keying on (row id, column key) means a cell only flashes when THAT row's
// THAT column actually changed value, whether or not it was on screen at the time.

/** How a column derives its flash. */
export type FlashMode =
  /** Legacy: driven by the row's own `flashSeq`/`flashDir` (`flash: true`). */
  | 'row'
  /** Derived: green on a rise, red on a fall (`flash: 'auto' | 'up-down'`). */
  | 'up-down'
  /** Derived: a neutral flash on any change, numeric or not (`flash: 'change'`). */
  | 'change';

export type FlashDir = 'up' | 'down' | 'same';

export interface FlashState {
  /** Bumps on every real value change — use it to re-key the flashing element. */
  seq: number;
  dir: FlashDir;
  /** Timestamp of the last change (ms). */
  at: number;
  /** True only on the observation that saw the change. */
  changed: boolean;
  /** Size of the last change (new − old) when both values are numbers. */
  delta?: number;
  /** Whether this flash holds instead of fading, decided once as it starts
      (`flashMotion: 'hold' | 'auto'`). */
  hold?: boolean;
}

/** Default flash duration (ms). Matches the CSS animation. */
export const FLASH_MS = 300;

/** Default time a `showChange` delta stays on screen (ms), fade included. */
export const CHANGE_MS = 1000;

/** Max tracked cells before the oldest are evicted. Generous enough for a full
    price board (rows x flashing columns) while staying bounded on a long
    session with a churning symbol universe. */
const DEFAULT_LIMIT = 20_000;

/** Separator for the composite (row, column) map key — a unit separator, which
    cannot appear in a column key. */
const SEP = String.fromCharCode(31);

/** Translate a column's `flash` setting into a mode, or null when it's off. */
export function resolveFlashMode(
  flash: boolean | 'auto' | 'up-down' | 'change' | undefined,
): FlashMode | null {
  if (flash === true) return 'row';
  if (flash === 'auto' || flash === 'up-down') return 'up-down';
  if (flash === 'change') return 'change';
  return null;
}

/** Is this flash still inside its animation window? Lets a recycled cell render
    a past flash's `seq` without replaying the animation. */
export function isFresh(state: FlashState, now: number, ms: number = FLASH_MS): boolean {
  return state.seq > 0 && now - state.at < ms;
}

/** The flash a cell shows: its replay key (`seq` parity picks the keyframes),
    tint, whether it is playing, its duration, and when it started. */
export interface ShownFlash {
  seq: number;
  dir: FlashDir;
  on: boolean;
  ms: number;
  at: number;
  /** Holds instead of fading (decided as the flash started). */
  hold?: boolean;
}

/** One `api.flashCells` request, as the grid hands it to a row's cells. */
export interface CellFlash {
  /** Counts the row's requests, so a repeat replays the animation. */
  seq: number;
  dir: FlashDir;
  at: number;
  /** Duration; each column's own (`flashMs`, else 300 ms) when unset. */
  ms?: number;
  /** The column keys it covers; every column when null. */
  columns: ReadonlySet<string> | null;
  /** Holds instead of fading (decided as the request was made). */
  hold?: boolean;
}

/**
 * A cell's own flash (a tick) merged with an `api.flashCells` request. The
 * newer of the two shows while it is fresh. `seq` is the sum of both, so
 * either one moving flips its parity and replays the animation — and a flash
 * that is always on (`flash: true`) keeps the same key once a request is over.
 */
export function mergeFlash(
  own: ShownFlash | null,
  req: CellFlash | null | undefined,
  colKey: string,
  colMs: number,
  now: number,
): ShownFlash | null {
  if (!req || (req.columns && !req.columns.has(colKey))) return own;
  const seq = (own?.seq ?? 0) + req.seq;
  const ms = req.ms ?? colMs;
  if (now - req.at >= ms || (own?.on && own.at > req.at)) return own ? { ...own, seq } : null;
  return { seq, dir: req.dir, on: true, ms, at: req.at, hold: req.hold };
}

/** How often a held flash is checked for its end (ms): a hold ends up to this
    much after its window. */
export const HOLD_TICK_MS = 50;

/** `flashMotion: 'hold'`: a flash whose window has passed by `now` is off.
    A flash with no start time (the legacy row-driven one) keeps its fade. */
export function holdFlash(f: ShownFlash | null, now: number): ShownFlash | null {
  if (!f?.on || f.at === 0 || now - f.at < f.ms) return f;
  return { ...f, on: false };
}

/**
 * The clock a held flash is ended by. A held tint is static — no CSS animation
 * ends it — so the cells holding one read this clock and drop the tint once
 * their window has passed. One timer per grid, running only from the first
 * `until(deadline)` to the latest deadline.
 */
export class FlashClock {
  private timer: ReturnType<typeof setInterval> | undefined;
  private deadline = 0;

  constructor(
    private readonly onTick: (now: number) => void,
    private readonly tickMs: number = HOLD_TICK_MS,
  ) {}

  get running(): boolean {
    return this.timer !== undefined;
  }

  /** Keep ticking until at least `t` (ms, Date.now() time). */
  until(t: number): void {
    if (t > this.deadline) this.deadline = t;
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      this.onTick(now);
      if (now > this.deadline) this.stop();
    }, this.tickMs);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}

/** `flashMotion: 'auto'`: flashes overlapping within one flash window at which
    new flashes switch to holding, and below which they go back to fading.
    Measured on the Price board, each fading cell costs ~0.02 ms of every frame
    it fades through, so 120 at once is ~2–3 ms a frame. */
export const AUTO_HOLD_ENTER = 120;
export const AUTO_HOLD_EXIT = 80;

/**
 * `flashMotion: 'auto'`: decides, as each flash starts, whether it fades or
 * holds. The load is the number of flashes started within about one flash
 * window (an exponentially decaying count), so a quiet board fades and a busy
 * one holds. The two levels keep it from flipping on every tick near the edge.
 */
export class FlashLoad {
  private level = 0;
  private last = 0;
  private holding = false;

  constructor(
    private readonly enter: number = AUTO_HOLD_ENTER,
    private readonly exit: number = AUTO_HOLD_EXIT,
    private readonly windowMs: number = FLASH_MS,
  ) {}

  /** Count a flash starting at `at` (ms) and say whether it should hold. */
  start(at: number): boolean {
    if (at > this.last) {
      this.level *= Math.exp((this.last - at) / this.windowMs);
      this.last = at;
    }
    this.level += 1;
    this.holding = this.level > (this.holding ? this.exit : this.enter);
    return this.holding;
  }
}

/** A value as a number for `delta`: numbers, and non-blank numeric strings. */
function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return Number.NaN;
}

function direction(prev: unknown, next: unknown, mode: FlashMode): FlashDir {
  if (mode !== 'up-down') return 'same';
  const a = typeof prev === 'number' ? prev : Number(prev);
  const b = typeof next === 'number' ? next : Number(next);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return 'same';
  return b > a ? 'up' : 'down';
}

interface Entry {
  value: unknown;
  state: FlashState;
}

/**
 * Tracks the last seen value per (row, column) and reports when it changed.
 *
 * `observe` is idempotent: calling it again with the same value returns the same
 * state untouched, so a re-render for an unrelated reason (selection, resize)
 * never re-flashes. One tracker per grid instance.
 */
export class FlashTracker {
  private readonly cells = new Map<string, Entry>();
  private readonly limit: number;

  constructor(opts: { limit?: number } = {}) {
    this.limit = opts.limit ?? DEFAULT_LIMIT;
  }

  get size(): number {
    return this.cells.size;
  }

  observe(
    rowKey: string | number,
    colKey: string,
    value: unknown,
    mode: FlashMode,
    now: number,
    /** Asked once per real change: should this flash hold? */
    decide?: (at: number) => boolean,
  ): FlashState {
    const id = `${rowKey}${SEP}${colKey}`;
    const prev = this.cells.get(id);

    // First sight — record the baseline, never flash. This is what keeps a cell
    // quiet when it scrolls into view or when the grid first paints.
    if (prev === undefined) {
      const state: FlashState = { seq: 0, dir: 'same', at: now, changed: false };
      this.evictIfFull();
      this.cells.set(id, { value, state });
      return state;
    }

    if (Object.is(prev.value, value)) {
      // Unchanged: hand back the stored state, with `changed` cleared so a
      // repeated render doesn't count as a new tick. Still touch it for LRU —
      // a cell that's merely being looked at (scrolled past, re-rendered) is
      // "in use" and shouldn't be the first thing evicted.
      if (prev.state.changed) prev.state = { ...prev.state, changed: false };
      this.touch(id, prev);
      return prev.state;
    }

    const a = asNumber(prev.value);
    const b = asNumber(value);
    const state: FlashState = {
      seq: prev.state.seq + 1,
      dir: direction(prev.value, value, mode),
      at: now,
      changed: true,
      delta: Number.isFinite(a) && Number.isFinite(b) ? b - a : undefined,
      hold: decide?.(now),
    };
    prev.value = value;
    prev.state = state;
    this.touch(id, prev);
    return state;
  }

  reset(): void {
    this.cells.clear();
  }

  // Map iteration order is insertion order — re-inserting a key moves it to the
  // end, which is what makes eviction (below) evict the LEAST-recently-touched
  // entry rather than the longest-lived one. Without this, a cell that keeps
  // ticking would sit at its original insertion position forever and become the
  // eviction target ahead of cells nobody has looked at since first sight —
  // exactly backwards from what a bounded cache should drop first.
  private touch(id: string, entry: Entry): void {
    this.cells.delete(id);
    this.cells.set(id, entry);
  }

  // The head of the (now LRU-ordered) map is the least-recently-touched entry.
  // Drop a batch rather than one at a time to avoid per-tick eviction churn.
  private evictIfFull(): void {
    if (this.cells.size < this.limit) return;
    let drop = Math.max(1, Math.floor(this.limit / 4));
    for (const key of this.cells.keys()) {
      this.cells.delete(key);
      if (--drop <= 0) break;
    }
  }
}
