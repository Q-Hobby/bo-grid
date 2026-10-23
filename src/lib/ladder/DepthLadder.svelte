<script lang="ts">
  // A price ladder (depth of market) on the grid: one row per price on the
  // tick grid, highest first, with the book's bid and ask sizes, their depth
  // from the best price outward as bars, and your own orders beside each side.
  //
  // It follows the market: the window recentres on the mid (or the last trade)
  // only once the market drifts out of its middle half, so the rows sit still
  // between moves. It never moves while the pointer is over it, or while the
  // keyboard is working in it, so a price cannot shift under a click or a
  // key. The wheel pages through prices and stops following; Space (or
  // `recenter()`) follows again.
  //
  // Order entry is the app's: a click on the bid side asks to buy at that
  // price, on the ask side to sell, on your orders to cancel them; B, S and
  // Delete do the same on the focused row. Each action carries the price of
  // the row as it was shown.
  import { untrack } from 'svelte';
  import Grid from '../grid/Grid.svelte';
  import type { GridApi } from '../grid/api';
  import type { ColumnDef, GridRow } from '../grid/column';
  import type { GridTheme } from '../grid/theme';
  import { numberFormat } from '../format/intl';
  import { fmtTradingPrice } from '../trading/format';
  import { ladderPrices, ladderRows, midPrice, ordersAt, snapToTick, stepPrice } from './levels';
  import type { BookLevel, LadderAction, LadderHeaders, LadderOrder, LadderRow, Tick } from './types';

  interface Props {
    /** Resting bids, `[price, size]`, in any order. */
    bids: readonly BookLevel[];
    /** Resting asks, `[price, size]`, in any order. */
    asks: readonly BookLevel[];
    /** The price step, or a function of the price for a tick table. */
    tick: Tick;
    /** The last trade's price: its row is marked. */
    last?: number;
    /** Your working orders, summed per price beside their side. */
    orders?: readonly LadderOrder[];
    /** Prices on screen. Default 21. */
    rows?: number;
    /** Row height in px. Default 24. */
    rowHeight?: number;
    /** What the ladder follows: the middle of the spread (default) or the last
        trade. Either falls back to the other while it has no price. */
    center?: 'mid' | 'last';
    /** Whether it follows the market. The wheel turns it off; Space,
        `recenter()` or setting it back to true turns it on and recentres at
        once. Bind it (`bind:following`) to see the wheel turn it off.
        Default true. */
    following?: boolean;
    /** Formats a price. Default: the tick's decimals. */
    format?: (price: number) => string;
    /** Locale for the default price and size formats. Default 'en-US'. */
    locale?: string;
    /** Column headers. */
    headers?: LadderHeaders;
    /** A buy, sell or cancel the user asked for, by click or key. */
    onAction?: (action: LadderAction, event: MouseEvent | KeyboardEvent) => void;
    /** Built-in theme name or a custom token map, as on `<Grid>`. */
    theme?: 'dark' | 'light' | GridTheme;
    /** Accessible name. Default 'Price ladder'. */
    ariaLabel?: string;
  }

  let {
    bids,
    asks,
    tick,
    last,
    orders = [],
    rows = 21,
    rowHeight = 24,
    center = 'mid',
    following = $bindable(true),
    format,
    locale = 'en-US',
    headers = {},
    onAction,
    theme,
    ariaLabel = 'Price ladder',
  }: Props = $props();

  // How far the wheel scrolls (px) for one price: a mouse notch (~100 px)
  // moves three, and a trackpad's small steps add up to the same.
  const WHEEL_PX = 33;

  const mid = $derived(midPrice(bids, asks, tick));
  const market = $derived(center === 'last' ? (last ?? mid) : (mid ?? last));
  // The price the window is centred on; set by following, the wheel and
  // recenter(). It starts on the market, so a server render has rows too.
  let centerPrice = $state<number | undefined>(untrack(() => market));
  // Nothing moves while the pointer is over the ladder, or while the keyboard
  // works in it (focus that came from a key). A click also focuses the grid,
  // but that focus alone does not hold it: once the pointer leaves, it
  // follows again.
  let hovered = $state(false);
  let focused = $state(false);
  let keyed = $state(false);
  const holding = $derived(hovered || (focused && keyed));

  const prices = $derived(centerPrice === undefined ? [] : ladderPrices(centerPrice, rows, tick));
  const levels = $derived.by(() => {
    const fmt = format;
    const t = tick;
    const loc = locale;
    const text = fmt ?? ((p: number) => fmtTradingPrice(p, typeof t === 'number' ? t : t(p), loc));
    return ladderRows(prices, { bids, asks, orders, last, format: text });
  });

  /** Whether `price` sits in the middle half of the window. */
  function settled(price: number): boolean {
    const i = prices.indexOf(snapToTick(price, tick));
    const margin = Math.max(1, Math.floor(prices.length / 4));
    return i >= margin && i <= prices.length - 1 - margin;
  }
  // Following again (the parent set `following`, or Space) recentres at
  // once; while it follows, it recentres when the market leaves the middle,
  // or the window changes (`rows`, `tick`) and leaves it there.
  let wasFollowing = following;
  $effect(() => {
    const m = market;
    const f = following;
    const h = holding;
    void rows;
    void tick;
    untrack(() => {
      const resumed = f && !wasFollowing;
      wasFollowing = f;
      if (m === undefined) return;
      if (centerPrice === undefined || resumed || (f && !h && !settled(m))) centerPrice = m;
    });
  });

  /** Centres on the market now and follows it again. */
  export function recenter(): void {
    following = true;
    if (market !== undefined) centerPrice = market;
  }

  const row = (r: GridRow) => r as unknown as LadderRow;
  // The columns depend only on the header texts and the locale, so a parent
  // that passes a new `headers` object, `tick` or `format` on every render
  // does not rebuild them (the price text comes with each row).
  const headerText = $derived(
    [headers.myBid ?? 'Mine', headers.bid ?? 'Bid', headers.price ?? 'Price', headers.ask ?? 'Ask', headers.myAsk ?? 'Mine'].join('\u0001'),
  );
  const columns = $derived.by<ColumnDef[]>(() => {
    const [myBid, bid, price, ask, myAsk] = headerText.split('\u0001');
    // Sizes, grouped; an empty level shows nothing.
    const nf = numberFormat(locale, 'ladder-size', { maximumFractionDigits: 8 });
    const size = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? nf.format(v) : '');
    const blank = () => '';
    return [
      { type: 'number', key: 'myBid', header: myBid, width: 56, sortable: false, format: size, cellClass: 'bo-lad-mine' },
      // Depth bars, on one scale for both sides (`bidShare`, `askShare`).
      // Bids grow from the price column outward: a negative bar, ranged to 0.
      {
        type: 'number',
        key: 'bidDepth',
        header: '',
        width: 64,
        sortable: false,
        value: (r) => (row(r).bidShare === undefined ? undefined : -row(r).bidShare!),
        format: blank,
        dataBar: { min: -1, max: 0, negative: 'var(--bo-up)' },
        cellClass: 'bo-lad-depth',
      },
      { type: 'number', key: 'bid', header: bid, width: 64, sortable: false, format: size, flash: 'auto', flashColor: false, cellClass: 'bo-lad-bid' },
      {
        type: 'text',
        key: 'text',
        header: price,
        width: 84,
        align: 'right',
        sortable: false,
        cellClass: (_v, r) => `bo-lad-price${row(r).bestBid || row(r).bestAsk ? ' bo-lad-best' : ''}${row(r).last ? ' bo-lad-last' : ''}`,
      },
      { type: 'number', key: 'ask', header: ask, width: 64, sortable: false, format: size, flash: 'auto', flashColor: false, cellClass: 'bo-lad-ask' },
      {
        type: 'number',
        key: 'askDepth',
        header: '',
        width: 64,
        sortable: false,
        value: (r) => row(r).askShare,
        format: blank,
        dataBar: { min: 0, max: 1, color: 'var(--bo-down)' },
        cellClass: 'bo-lad-depth',
      },
      { type: 'number', key: 'myAsk', header: myAsk, width: 56, sortable: false, format: size, cellClass: 'bo-lad-mine' },
    ];
  });

  const BUY = new Set(['myBid', 'bidDepth', 'bid']);
  const SELL = new Set(['myAsk', 'askDepth', 'ask']);
  /** The action a click or key asks for on `r`, from where it landed. */
  function act(r: LadderRow, key: string, via: 'click' | 'key', event: MouseEvent | KeyboardEvent): void {
    const side = BUY.has(key) ? 'buy' : SELL.has(key) ? 'sell' : null;
    if (!side) return;
    const own = key === 'myBid' || key === 'myAsk' ? ordersAt(orders, r.price, side) : [];
    if (own.length > 0) onAction?.({ kind: 'cancel', price: r.price, side, orders: own, via }, event);
    else onAction?.({ kind: side, price: r.price, via }, event);
  }

  const typing = (t: EventTarget | null): boolean =>
    t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

  let api: GridApi | undefined;
  function onkeydown(e: KeyboardEvent): void {
    // Any key the user works the ladder with holds it while it has focus.
    keyed = true;
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    const key = e.key.toLowerCase();
    const trade = key === 'b' || key === 's' || e.key === 'Delete' || e.key === 'Backspace';
    if (e.key === ' ') {
      e.preventDefault();
      recenter();
      return;
    }
    if (!trade) return;
    e.preventDefault();
    // A held key repeats: one order per press, never one per repeat.
    if (e.repeat) return;
    const f = api?.getFocusedCell();
    if (!f) return;
    const r = row(f.row);
    if (key === 'b') act(r, 'bid', 'key', e);
    else if (key === 's') act(r, 'ask', 'key', e);
    else {
      const own = ordersAt(orders, r.price);
      if (own.length > 0) onAction?.({ kind: 'cancel', price: r.price, orders: own, via: 'key' }, e);
    }
  }

  // The wheel pages through prices (a listener of our own: it has to be able
  // to stop the page from scrolling). Scroll adds up until it is worth a
  // price; Ctrl+wheel is the browser's zoom and is left alone.
  function wheel(node: HTMLElement) {
    let carry = 0;
    const on = (e: WheelEvent) => {
      if (e.ctrlKey || centerPrice === undefined || e.deltaY === 0) return;
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * rowHeight : e.deltaMode === 2 ? e.deltaY * rows * rowHeight : e.deltaY;
      // A turn the other way starts over.
      if (Math.sign(px) !== Math.sign(carry)) carry = 0;
      carry += px;
      const steps = Math.trunc(carry / WHEEL_PX);
      if (steps === 0) return;
      carry -= steps * WHEEL_PX;
      following = false;
      const dir = steps > 0 ? -1 : 1;
      let p = centerPrice;
      for (let i = 0; i < Math.abs(steps); i++) {
        const next = stepPrice(p, tick, dir);
        if (!(next > 0)) break;
        p = next;
      }
      centerPrice = p;
    };
    node.addEventListener('wheel', on, { passive: false });
    return { destroy: () => node.removeEventListener('wheel', on) };
  }
</script>

<!-- The keys and pointer come from the grid inside (role="grid", focusable):
     this wrapper only hears them bubble up, for the hotkeys and the hold. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bo-ladder"
  class:following
  use:wheel
  {onkeydown}
  onpointerdown={() => (keyed = false)}
  onpointerenter={(e) => (hovered = e.pointerType !== 'touch')}
  onpointerleave={() => (hovered = false)}
  onfocusin={() => (focused = true)}
  onfocusout={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) focused = false;
  }}
>
  <Grid
    rows={levels as unknown as GridRow[]}
    {columns}
    {theme}
    {ariaLabel}
    {rowHeight}
    height={rows * rowHeight}
    rowClass={(r) => `bo-lad-${row(r).zone}`}
    onCellClick={({ row: r, column }, e) => act(row(r), column.key, 'click', e)}
    onReady={(a) => (api = a)}
  />
</div>

<style>
  .bo-ladder {
    display: inline-block;
    max-width: 100%;
  }
  .bo-ladder :global(.row.bo-lad-ask .bo-lad-price) {
    color: var(--bo-down);
  }
  .bo-ladder :global(.row.bo-lad-bid .bo-lad-price) {
    color: var(--bo-up);
  }
  .bo-ladder :global(.bo-lad-best) {
    font-weight: 700;
  }
  .bo-ladder :global(.bo-lad-last) {
    background: color-mix(in srgb, var(--bo-amber) 24%, transparent);
    font-weight: 700;
  }
  .bo-ladder :global(.bo-lad-bid),
  .bo-ladder :global(.bo-lad-ask),
  .bo-ladder :global(.bo-lad-mine) {
    cursor: pointer;
  }
  .bo-ladder :global(.bo-lad-mine) {
    color: var(--bo-amber);
    font-weight: 600;
  }
  /* A depth column holds only its bar: stronger than a bar behind text. */
  .bo-ladder :global(.bo-lad-depth .bo-databar) {
    opacity: 0.4;
  }
</style>
