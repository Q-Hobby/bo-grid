<script module lang="ts">
  // Column types rendered as structured content (badges, stars, links, a
  // canvas…) rather than a single value span — those cells keep their clip.
  const STRUCTURED_TYPES: ReadonlySet<string> = new Set([
    'text', 'custom', 'sparkline', 'progress', 'rating', 'tags', 'badge', 'boolean', 'avatar', 'link',
  ]);
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ColumnDef, GridRow } from './column';
  import type { GridLabels } from './labels';
  import {
    formatCell,
    tooltipText,
    colStyle,
    candlesOf,
    isNumeric,
    cellValue,
    dataBarGeometry,
    colorScaleBackground,
    pickIcon,
    toneColor,
    safeHref,
  } from './column';
  import { heatColor } from './heatmap';
  import { toDateInput } from './date';
  import { rowView } from './patch';
  import { FlashTracker, resolveFlashMode, isFresh, mergeFlash, holdFlash, FLASH_MS, CHANGE_MS, type CellFlash, type ShownFlash } from './flash';
  import Sparkline from '../sparkline/Sparkline.svelte';

  let {
    col,
    row,
    r,
    c,
    selected = false,
    focused = false,
    pinned = false,
    pinSide = 'left',
    pinOffset = 0,
    dock = 0,
    width,
    alt = false,
    editing = false,
    seed = null,
    fillCorner = false,
    fillpreview = false,
    cfRange = null,
    rowKey = null,
    version = 0,
    fieldVersion = 0,
    flashTracker = null,
    cellFlash = null,
    flashHold = null,
    colIndex,
    cellId,
    cellSnippet,
    tree,
    dragHandle,
    onCellDown,
    onCellEnter,
    onCellClick,
    onCellDblClick,
    onEditCommit,
    onEditCommitValue,
    onEditDraft,
    onEditCancel,
    onFillStart,
    labels,
    span,
    flexStyle,
    colspan,
  }: {
    col: ColumnDef;
    row: GridRow;
    r: number;
    c: number;
    selected?: boolean;
    focused?: boolean;
    pinned?: boolean;
    pinSide?: 'left' | 'right';
    pinOffset?: number;
    /** The first right-pinned cell's left margin: the room the columns leave,
        so the right-pinned columns sit at the right edge. */
    dock?: number;
    /** Fixed pixel width (pinned/horizontal-scroll mode). */
    width?: number;
    alt?: boolean;
    editing?: boolean;
    /** Type-to-edit seed: when set, the editor opens pre-filled with this string
        (the character that triggered the edit) instead of the current value. */
    seed?: string | null;
    /** Show the fill handle (this cell is the selection's bottom-right corner). */
    fillCorner?: boolean;
    /** This cell is inside the in-progress fill drag's preview range. */
    fillpreview?: boolean;
    /** Conditional-formatting data extent (min/max over the view) for this
        column; null when the column has no `dataBar`/`colorScale`. */
    cfRange?: { min: number; max: number } | null;
    /** Stable identity of this cell's row, for derived flash. Cells are recycled
        by visual index as you scroll, so flash state cannot live in the
        component — it is keyed on (rowKey, column) in the grid's tracker. */
    rowKey?: string | number | null;
    /** Bumped when `api.patchRows` changes this row, so plain (non-$state) row
        objects still repaint. */
    version?: number;
    /** Bumped when `api.patchRows` changes this cell's own field. */
    fieldVersion?: number;
    /** The grid's flash tracker; null when no column uses derived flash. */
    flashTracker?: FlashTracker | null;
    /** The latest `api.flashCells` request covering this row, if any. */
    cellFlash?: CellFlash | null;
    /** The grid's flash clock when flashes may hold (`flashMotion: 'hold' | 'auto'`). */
    flashHold?: { clock: () => number; until: (t: number) => void; holds: (at: number) => boolean } | null;
    colIndex?: number;
    cellId?: string;
    cellSnippet?: Snippet<[{ row: GridRow; column: ColumnDef; value: unknown }]>;
    /** Tree-data gutter for the first column: indent + expand chevron. */
    tree?: { depth: number; hasChildren: boolean; expanded: boolean; onToggle: () => void };
    /** Drag-to-reorder handle for the first column (HTML5 draggable grip). */
    dragHandle?: { onStart: () => void; onEnd: () => void };
    onCellDown?: (r: number, c: number, e: PointerEvent) => void;
    onCellEnter?: (r: number, c: number, e: PointerEvent) => void;
    onCellClick?: (r: number, c: number, e: MouseEvent) => void;
    onCellDblClick?: (r: number, c: number) => void;
    onEditCommit?: (raw: string) => void;
    /** A custom editor's committed value (typed, not a string to parse). */
    onEditCommitValue?: (value: unknown) => void;
    /** What has been typed so far in the editor, as it changes. */
    onEditDraft?: (raw: string) => void;
    onEditCancel?: () => void;
    onFillStart?: () => void;
    labels: GridLabels;
    /** Row-span geometry when this cell draws a merged run: `up` px above this
        row to the run's top, total `height`, the first row's height (content
        aligns to it), the run length, and the run's first-row stripe. */
    span?: { up: number; height: number; first: number; rows: number; alt: boolean };
    /** Flex sizing override for a colSpan cell in fit-to-width mode. */
    flexStyle?: string;
    /** Number of columns this cell covers (colSpan), for aria-colspan. */
    colspan?: number;
  } = $props();

  // Avatar initials: first letters of the first two words.
  function initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  let cancelled = false;
  function focusSelect(node: HTMLInputElement) {
    node.focus();
    // Only text/search inputs support text selection; number/date inputs throw.
    if (node.type !== 'text' && node.type !== 'search') return;
    // Type-to-edit: keep the seeded character and put the caret after it;
    // otherwise select the whole value so the next keystroke replaces it.
    if (seed != null) node.setSelectionRange(node.value.length, node.value.length);
    else node.select();
  }
  function focusEl(node: HTMLElement) {
    node.focus();
  }
  function onEditKey(e: KeyboardEvent) {
    e.stopPropagation(); // keep arrows/Enter in the input, not the grid
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
    else if (e.key === 'Escape') {
      cancelled = true;
      (e.currentTarget as HTMLInputElement).blur();
    }
  }
  // Custom editors: keys stay inside the editor (no grid navigation), Escape
  // cancels, and focus leaving the editor altogether cancels — an editor saves
  // by calling commit() itself.
  function onCustomEditKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') onEditCancel?.();
  }
  function onCustomEditFocusOut(e: FocusEvent) {
    const host = e.currentTarget as HTMLElement;
    setTimeout(() => {
      if (!host.isConnected || !host.contains(document.activeElement)) onEditCancel?.();
    }, 0);
  }
  function focusFirst(node: HTMLElement) {
    const target = node.querySelector<HTMLElement>(
      '[autofocus], input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    (target ?? node).focus();
  }
  function onEditBlur(e: FocusEvent) {
    const v = (e.currentTarget as HTMLInputElement).value;
    // Being removed (the edit closed, or moved with its row): some browsers
    // blur a removed input, and that is not the user leaving the editor.
    if (!editing) {
      cancelled = false;
      return;
    }
    if (cancelled) {
      cancelled = false;
      onEditCancel?.();
    } else {
      onEditCommit?.(v);
    }
  }

  // Dynamic field read. row is a runes class instance, so row[col.key] still
  // goes through the $state getter — fine-grained reactivity is preserved even
  // though the key is only known at runtime. Computed columns derive from the
  // whole row via cellValue (their value() reads the row's $state getters too).
  // Under api.patchRows a cell repaints on its own field's version; anything
  // that may read OTHER fields of the row tracks the row's version instead. A
  // function counts as reading the row when it declares a second parameter
  // (`(value, row) => …`), so `(v) => …` formatters skip unrelated ticks.
  const readsRow = (fn: unknown): boolean => typeof fn === 'function' && fn.length >= 2;
  const value = $derived.by(() => {
    if (col.value) version;
    else fieldVersion;
    return cellValue(col, row);
  });
  // Typed inline editor: date columns edit with a date picker, numeric columns
  // with a numeric input; everything else stays a text input.
  const editorType = $derived(col.type === 'date' ? 'date' : isNumeric(col) ? 'number' : 'text');
  const editorValue = $derived(
    col.type === 'date' && Number.isFinite(Number(value))
      ? toDateInput(Number(value))
      : String(value ?? ''),
  );
  // Alignment kind: numbers right-align (tabular); sparkline + text-like rich
  // types (tags/badge/boolean/avatar) left-align. A column's `align` moves the
  // side only (the .right / .left classes), not the number font.
  const kind = $derived(col.type === 'sparkline' ? 'spark' : isNumeric(col) ? 'num' : 'text');
  // Optional per-column cell class (static string or value/row function).
  // Everything below that may read OTHER fields of the row (cellClass/format/
  // tooltip functions, renderers) also reads `version`: with plain row objects
  // fed through api.patchRows, that bump is the only signal that the row moved.
  const extraClass = $derived.by(() => {
    if (typeof col.cellClass !== 'function') return col.cellClass ?? '';
    if (readsRow(col.cellClass)) version;
    return col.cellClass(value, row) ?? '';
  });
  // The display string, shared by every text branch below.
  const text = $derived.by(() => {
    if (readsRow(col.format)) version;
    return formatCell(col, value, row);
  });
  // Row-wide reads that are not this cell's value: a `sub` field, a link's
  // href(row), a sparkline's own series field, the legacy row-driven flash.
  const subField = $derived('sub' in col && typeof col.sub === 'string' ? col.sub : undefined);
  const rowTick = $derived(subField || col.type === 'link' || col.type === 'sparkline' || col.flash === true ? version : 0);
  const subText = $derived.by(() => {
    rowTick;
    return subField ? row[subField] : undefined;
  });
  const candles = $derived.by(() => {
    rowTick;
    return col.type === 'sparkline' ? candlesOf(row, col.sparkKey) : [];
  });
  const linkHref = $derived.by(() => {
    rowTick;
    if (col.type !== 'link') return undefined;
    return safeHref(col.href ? col.href(row) : String(value ?? ''));
  });
  // Styled floating tooltip text (opt-in via column `tooltip`); the grid root
  // renders the actual tooltip from this cell's `data-bo-tip` attribute.
  const tip = $derived.by(() => {
    if (!col.tooltip) return undefined;
    if (readsRow(col.tooltip)) version;
    return tooltipText(col, value, row);
  });

  // ---- Flash ----
  // `'row'` keeps the legacy behaviour (the row owns flashSeq/flashDir). The
  // derived modes ask the grid's tracker whether THIS cell's value just moved.
  // `observe` is idempotent, so re-rendering for an unrelated reason (selection,
  // resize, a sibling column ticking) never re-flashes this cell.
  const flashMode = $derived(resolveFlashMode(col.flash));
  // One tracker observation per value serves both the derived flash and the
  // `showChange` delta.
  const tracked = $derived.by(() => {
    const mode = flashMode && flashMode !== 'row' ? flashMode : col.showChange ? 'up-down' : null;
    if (!mode || !flashTracker || rowKey == null) return null;
    const now = Date.now();
    // Only a flashing column asks whether its flash holds (a `showChange`-only
    // column has no flash to count).
    const decide = flashMode && flashMode !== 'row' ? flashHold?.holds : undefined;
    return { state: flashTracker.observe(rowKey, col.key, value, mode, now, decide), now };
  });
  const flashMs = $derived(col.flashMs ?? FLASH_MS);
  const tick = $derived.by((): ShownFlash | null => {
    if (flashMode === null) return null;
    if (flashMode === 'row') {
      rowTick;
      return { seq: Number(row.flashSeq ?? 0), dir: row.flashDir ?? 'up', on: true, ms: flashMs, at: 0 };
    }
    if (!tracked) return null;
    const { state, now } = tracked;
    return { seq: state.seq, dir: state.dir, on: isFresh(state, now, flashMs), ms: flashMs, at: state.at, hold: state.hold };
  });
  // An `api.flashCells` request plays the same animation, on any value cell.
  const flash = $derived.by(() => {
    const f = cellFlash ? mergeFlash(tick, cellFlash, col.key, flashMs, Date.now()) : tick;
    // Whether it holds was decided once, as the flash started (`f.hold`).
    if (!flashHold || !f?.on || f.at === 0 || !f.hold) return f;
    // Held: no animation ends the tint, so a cell holding one reads the grid's
    // clock (subscribing only while it holds) and drops it once its window has passed.
    const held = holdFlash(f, Math.max(Date.now(), flashHold.clock()));
    if (held?.on) flashHold.until(held.at + held.ms);
    return held;
  });
  const isHeld = $derived(!!flashHold && !!flash?.on && flash.at > 0 && !!flash.hold);
  // showChange: the last change's size beside the value, held then faded by
  // CSS. Rendered only while fresh, so a row scrolling into view shows none.
  const changeOpts = $derived(col.showChange ? (col.showChange === true ? {} : col.showChange) : null);
  const change = $derived.by(() => {
    if (!changeOpts || !tracked) return null;
    const { state, now } = tracked;
    const d = state.delta;
    if (d === undefined || d === 0 || !isFresh(state, now, changeOpts.ms ?? CHANGE_MS)) return null;
    const label = changeOpts.format
      ? changeOpts.format(d, row)
      : `${d > 0 ? '▲' : '▼'}${formatCell(col, Math.abs(d), row)}`;
    return { label, up: d > 0, alt: state.seq % 2 === 1 };
  });
  // The flash as one class string — a single DOM write per tick instead of a
  // toggle per modifier. `alt` alternates keyframes to replay the animation; a
  // held tint has none to replay, so a repeat tick leaves its class untouched.
  const flashClass = $derived.by(() => {
    if (!flash?.on) return '';
    const replay = isHeld ? ' held' : flash.seq % 2 === 1 ? ' alt' : '';
    return `flash${replay}${flash.dir === 'up' ? ' up' : flash.dir === 'down' ? ' down' : ''}${col.flashColor === false ? ' keep' : ''}`;
  });
  // Only emit the duration override when it differs from the stylesheet
  // default, so the common case adds no inline style at all.
  const flashStyle = $derived(flash?.on && !isHeld && flash.ms !== FLASH_MS ? `--bo-flash-ms:${flash.ms}ms` : undefined);

  // JS cell renderer (framework-agnostic alt to the `cell` snippet). Returns an
  // HTML string ({@html}) or a DOM Node (mounted via the action below).
  // Component cells and the `cell` snippet take the row as a prop. A row patched
  // in place (api.patchRows) keeps its identity, so each patch hands them a
  // fresh view of it and they update in place, where they used to remount.
  const rowProp = $derived(version ? rowView(row) : row);

  const rendered = $derived.by(() => {
    if (!col.render) return undefined;
    version;
    return col.render({ value, row, column: col });
  });
  // Mount/replace a Node return value; updates when the derived node changes.
  function renderNode(host: HTMLElement, node: Node | string | null | undefined) {
    const set = (n: Node | string | null | undefined) => {
      if (n instanceof Node) host.replaceChildren(n);
      else host.textContent = n == null ? '' : String(n);
    };
    set(node);
    return { update: set };
  }

  // ---- Conditional formatting (v0.10): data bar + icon set ----
  // Geometry/threshold logic lives in column.ts (pure, unit-tested); here we map
  // it to CSS (left/width %, tone → colour).
  const hasCf = $derived(!!col.dataBar || !!col.icons);
  // A cell that renders nothing but its value span. The span clips and
  // ellipsizes itself inside the cell, so the cell needs no clip of its own:
  // one clip per cell instead of two is measurably cheaper to paint and
  // layerize on a busy board (BENCHMARKS.md), with identical output.
  const plainText = $derived(
    !dragHandle &&
      !tree &&
      !editing &&
      !fillCorner &&
      !col.wrap &&
      !col.component &&
      !col.render &&
      !hasCf &&
      !col.showChange &&
      !STRUCTURED_TYPES.has(col.type ?? ''),
  );
  const bar = $derived.by(() => {
    if (!col.dataBar || !cfRange) return null;
    const g = dataBarGeometry(value, cfRange, col.dataBar);
    if (!g) return null;
    const color = g.negative ? (col.dataBar.negative ?? 'var(--bo-down)') : (col.dataBar.color ?? 'var(--bo-up)');
    // Drawn full width and scaled: a changing scale only repaints the bar,
    // where a changing width also lays it out (~15% of a bar-heavy frame).
    return { transform: `translate(${g.left * 100}%,-50%) scaleX(${g.width})`, color };
  });
  const icon = $derived.by(() => {
    const pick = col.icons ? pickIcon(value, col.icons) : null;
    return pick ? { icon: pick.icon, color: toneColor(pick.tone) } : null;
  });
  // Colour-scale cell tint (applied as a cell background in cellStyle).
  const scaleBg = $derived(col.colorScale && cfRange ? colorScaleBackground(value, cfRange, col.colorScale) : null);

  // Stacking: pinned cells (2) cover scrolled content; a merged run (1, or 3
  // when pinned) paints over the rows below it, which are later in the DOM.
  function cellStyle(): string {
    let s = width != null ? `flex:0 0 ${width}px;width:${width}px;` : (flexStyle ?? colStyle(col));
    if (dock > 0) s += `margin-left:${dock}px;`;
    // Conditional background: heatmap type, else a colour-scale tint (both translucent).
    const bg = col.type === 'heatmap' ? heatColor(Number(value), col.min, col.max) : scaleBg;
    // Opaque cells (pinned, or a run drawn over other rows) layer any translucent
    // tint over the row colour.
    const stripe = span ? span.alt : alt;
    const rowBg = `var(${stripe ? '--bo-row-a' : '--bo-row-b'})`;
    const opaque = bg ? `background:linear-gradient(${bg},${bg}),${rowBg};` : `background:${rowBg};`;
    if (pinned) {
      s += `position:sticky;${pinSide}:${pinOffset}px;z-index:${span ? 3 : 2};${opaque}`;
    } else if (span) {
      s += `z-index:1;${opaque}`;
    } else if (bg) {
      s += `background:${bg};`;
    }
    if (span) {
      s += `height:${span.height}px;align-self:flex-start;align-items:flex-start;`;
      s += `padding-top:calc((${span.first}px - 1.4em) / 2);border-bottom:0.5px solid var(--bo-border);`;
      if (span.up) s += `transform:translateY(-${span.up}px);`;
    }
    return s;
  }
</script>

<!-- Keyboard interaction is handled at the grid level (arrow nav via aria-activedescendant + Enter); this cell click is a pointer affordance. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<span
  class="c {kind} {extraClass}"
  class:right={col.align === 'right'}
  class:left={col.align === 'left'}
  class:dim={col.type === 'volume'}
  class:wrap={col.wrap}
  class:plain={plainText}
  class:pos={col.type === 'percent' && Number(value) >= 0}
  class:neg={col.type === 'percent' && Number(value) < 0}
  class:sel={selected}
  class:focus={focused}
  class:fillpreview={fillpreview}
  style={cellStyle()}
  role="gridcell"
  tabindex="-1"
  id={cellId}
  data-bo-tip={tip}
  aria-colindex={colIndex}
  aria-rowspan={span && !span.up ? span.rows : undefined}
  aria-colspan={colspan}
  aria-selected={selected}
  onpointerdown={(e) => onCellDown?.(r, c, e)}
  onpointerenter={(e) => onCellEnter?.(r, c, e)}
  onclick={(e) => onCellClick?.(r, c, e)}
  ondblclick={() => onCellDblClick?.(r, c)}
>
  {#if dragHandle}
    <span
      class="drag-handle"
      role="button"
      tabindex="-1"
      aria-label={labels.dragToReorder}
      draggable="true"
      onpointerdown={(e) => e.stopPropagation()}
      ondragstart={() => dragHandle.onStart()}
      ondragend={() => dragHandle.onEnd()}
    >⠿</span>
  {/if}
  {#if tree}
    <span class="tree-gutter" style="padding-left:{tree.depth * 16}px">
      {#if tree.hasChildren}
        <button
          class="tree-toggle"
          type="button"
          aria-expanded={tree.expanded}
          aria-label={labels.toggleChildren}
          onpointerdown={(e) => e.stopPropagation()}
          onclick={(e) => {
            e.stopPropagation();
            tree.onToggle();
          }}
        >
          {tree.expanded ? '▾' : '▸'}
        </button>
      {:else}
        <span class="tree-leaf"></span>
      {/if}
    </span>
  {/if}
  {#if editing && col.editor}
    {@const Editor = col.editor}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="bo-edit-custom"
      use:focusFirst
      onkeydown={onCustomEditKey}
      onfocusout={onCustomEditFocusOut}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
      ondblclick={(e) => e.stopPropagation()}
    >
      <Editor
        {value}
        {row}
        column={col}
        {seed}
        commit={(v: unknown) => onEditCommitValue?.(v)}
        cancel={() => onEditCancel?.()}
      />
    </span>
  {:else if editing && col.options && col.options.length > 0}
    <select
      class="bo-edit"
      value={String(value ?? '')}
      use:focusEl
      onkeydown={onEditKey}
      onblur={onEditBlur}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
    >
      {#each col.options as opt (opt)}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
  {:else if editing}
    <input
      class="bo-edit"
      type={editorType}
      value={seed ?? editorValue}
      use:focusSelect
      oninput={(e) => onEditDraft?.(e.currentTarget.value)}
      onkeydown={onEditKey}
      onblur={onEditBlur}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
      ondblclick={(e) => e.stopPropagation()}
    />
  {:else if col.component}
    {@const Renderer = col.component}
    <Renderer {value} row={rowProp} column={col} {text} />
  {:else if col.render}
    {#if typeof rendered === 'string'}
      <span class="bo-render">{@html rendered}</span>
    {:else}
      <span class="bo-render" use:renderNode={rendered}></span>
    {/if}
  {:else if col.type === 'custom'}
    {#if cellSnippet}{@render cellSnippet({ row: rowProp, column: col, value })}{:else}{value ?? ''}{/if}
  {:else if col.type === 'sparkline'}
    <Sparkline {candles} />
  {:else if col.type === 'progress'}
    {@const lo = col.min ?? 0}
    {@const pct = Math.max(0, Math.min(100, (((Number(value) || 0) - lo) / (((col.max ?? 100) - lo) || 1)) * 100))}
    <span class="bo-progress" title={String(value ?? '')}>
      <span class="bo-progress-fill" style="width:{pct}%"></span>
    </span>
  {:else if col.type === 'rating'}
    {@const rmax = col.max ?? 5}
    {@const r = Math.max(0, Math.min(rmax, Math.round(Number(value) || 0)))}
    <span class="bo-rating" aria-label={labels.rating(r, rmax)}>
      <span class="bo-stars-on">{'★'.repeat(r)}</span><span class="bo-stars-off">{'★'.repeat(rmax - r)}</span>
    </span>
  {:else if col.type === 'tags'}
    {@const tags = Array.isArray(value) ? value : String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean)}
    <span class="bo-tags">{#each tags as t (t)}<span class="bo-tag">{t}</span>{/each}</span>
  {:else if col.type === 'badge'}
    <span class="bo-badge bo-badge-{col.tones?.[String(value)] ?? 'neutral'}">{value ?? ''}</span>
  {:else if col.type === 'boolean'}
    {#if value}
      <span class="bo-bool bo-bool-yes">✓{#if col.trueLabel}&nbsp;{col.trueLabel}{/if}</span>
    {:else}
      <span class="bo-bool bo-bool-no">✕{#if col.falseLabel}&nbsp;{col.falseLabel}{/if}</span>
    {/if}
  {:else if col.type === 'avatar'}
    <span class="bo-avatar" aria-hidden="true">{initials(String(value ?? ''))}</span>
    <span class="bo-avatar-name">{value ?? ''}{#if subField}<em>{subText}</em>{/if}</span>
  {:else if col.type === 'link'}
    {@const href = linkHref}
    {#if href}<a
        class="bo-link"
        {href}
        target={col.newTab ? '_blank' : undefined}
        rel={col.newTab ? 'noopener noreferrer' : undefined}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => e.stopPropagation()}>{value ?? ''}</a>{:else}{value ?? ''}{/if}
  {:else if col.type === 'text'}
    <strong class={flashClass || undefined} style={flashStyle}>{text}</strong>{#if subField}<em>{subText}</em>{/if}
  {:else if hasCf}
    {#if bar}<span class="bo-databar" style="transform:{bar.transform};background:{bar.color}"></span>{/if}
    <span class="bo-cf-val {flashClass}" style={flashStyle}>
      {#if icon}<span class="bo-cf-icon" style="color:{icon.color}">{icon.icon}</span>{/if}{text}
    </span>
  {:else}
    <!-- One branch with or without a flash, so a cell that starts flashing keeps its node. -->
    <span class="bo-cell-text {flashClass}" style={flashStyle}>{text}</span>
  {/if}
  {#if change}<span
      class="bo-chg"
      class:down={!change.up}
      class:alt={change.alt}
      style={changeOpts?.ms && changeOpts.ms !== CHANGE_MS ? `--bo-change-ms:${changeOpts.ms}ms` : undefined}
      aria-hidden="true">{change.label}</span
    >{/if}
  {#if fillCorner}
    <span
      class="fill-handle"
      role="button"
      tabindex="-1"
      aria-label={labels.fill}
      onpointerdown={(e) => {
        e.stopPropagation();
        onFillStart?.();
      }}
    ></span>
  {/if}
</span>

<style>
  .bo-edit-custom {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    min-width: 0;
  }
  .c {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0 var(--bo-cell-pad, 8px);
    height: 100%;
    font-size: var(--bo-font-size, 13px);
    line-height: 1.4;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* Value-only cells: the span below clips itself, so the cell does not. */
  .c.plain {
    overflow: visible;
  }
  /* Truncating text node inside the flex cell: a bare text child of a flex
     container won't honour text-overflow, so plain values render through this
     span to get a real ellipsis when they overflow. */
  .bo-cell-text {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* Host for a JS `render` return (string HTML or a DOM node). Lays out inline
     and truncates like a normal cell; consumer markup controls the rest. */
  .bo-render {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Opt-in multi-line wrap (col.wrap) — pair with a taller rowHeight. */
  .c.wrap {
    white-space: normal;
  }
  .c.wrap .bo-cell-text,
  .c.wrap strong {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }
  .num {
    justify-content: flex-end;
    font-family: var(--bo-mono);
    font-variant-numeric: tabular-nums;
  }
  .text {
    gap: 6px;
  }
  /* A column's `align` wins over its type's side, as it does for the header. */
  .c.right {
    justify-content: flex-end;
  }
  .c.left {
    justify-content: flex-start;
  }

  /* ---- Rich cell types (v0.9) — all colours from theme tokens ---- */
  .bo-progress {
    flex: 1;
    min-width: 36px;
    height: 6px;
    border-radius: 999px;
    background: var(--bo-row-hover);
    overflow: hidden;
  }
  .bo-progress-fill {
    display: block;
    height: 100%;
    background: var(--bo-up);
    border-radius: 999px;
  }
  .bo-rating {
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .bo-stars-on {
    color: var(--bo-amber);
  }
  .bo-stars-off {
    color: var(--bo-border);
  }
  .bo-tags {
    display: flex;
    gap: 4px;
    overflow: hidden;
  }
  .bo-tag {
    padding: 1px 7px;
    font-size: 11px;
    color: var(--bo-text-dim);
    background: var(--bo-row-hover);
    border: 0.5px solid var(--bo-border);
    border-radius: 999px;
    white-space: nowrap;
  }
  .bo-badge {
    padding: 2px 9px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 999px;
    white-space: nowrap;
  }
  /* Badge text is its tone mixed 60 / 40 with the theme text colour: darker on
     light themes, lighter on dark ones, so it clears 4.5:1 on its own tinted
     pill in every preset (theme.test.ts) while keeping its hue. */
  .bo-badge-up {
    color: color-mix(in srgb, var(--bo-up) 60%, var(--bo-text));
    background: color-mix(in srgb, var(--bo-up) 15%, transparent);
  }
  .bo-badge-down {
    color: color-mix(in srgb, var(--bo-down) 60%, var(--bo-text));
    background: color-mix(in srgb, var(--bo-down) 15%, transparent);
  }
  .bo-badge-amber {
    color: color-mix(in srgb, var(--bo-amber) 60%, var(--bo-text));
    background: color-mix(in srgb, var(--bo-amber) 15%, transparent);
  }
  .bo-badge-info {
    color: color-mix(in srgb, var(--bo-sel-border) 60%, var(--bo-text));
    background: color-mix(in srgb, var(--bo-sel-border) 15%, transparent);
  }
  .bo-badge-neutral {
    color: var(--bo-text-dim);
    background: var(--bo-row-hover);
  }
  .bo-link {
    color: var(--bo-sel-border);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bo-link:hover {
    text-decoration: underline;
  }
  .bo-bool-yes {
    color: var(--bo-up);
    font-weight: 600;
  }
  .bo-bool-no {
    color: var(--bo-text-dim);
  }
  .bo-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    font-size: 9px;
    font-weight: 700;
    color: var(--bo-bg);
    background: var(--bo-text-dim);
    border-radius: 50%;
  }
  .bo-avatar-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bo-avatar-name em {
    margin-left: 6px;
    font-style: normal;
    font-size: 11px;
    color: var(--bo-text-dim);
  }

  /* ---- Conditional formatting (v0.10): data bars + icon sets ---- */
  .bo-databar {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 62%;
    transform-origin: 0 50%;
    border-radius: 2px;
    opacity: 0.22;
    z-index: 0;
    pointer-events: none;
  }
  /* Value sits above its data bar; carries the (optional) flash colour. */
  .bo-cf-val {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bo-cf-icon {
    flex: none;
    font-size: 11px;
    line-height: 1;
  }
  .text strong {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: var(--bo-mono);
    font-weight: 600;
  }
  .text em {
    flex: none;
    font-style: normal;
    font-size: 10px;
    color: var(--bo-text-dim);
  }
  .spark {
    overflow: visible;
  }
  /* Tree-data gutter: indent + expand chevron, before the cell content. */
  .tree-gutter {
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .tree-toggle {
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 10px;
    line-height: 1;
    color: var(--bo-text-dim);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .tree-toggle:hover {
    color: var(--bo-text);
    background: var(--bo-row-hover);
  }
  /* Visible keyboard focus (WCAG 2.4.7). */
  .tree-toggle:focus-visible,
  .bo-link:focus-visible {
    outline: 2px solid var(--bo-sel-border);
    outline-offset: -1px;
    border-radius: 3px;
  }
  .tree-leaf {
    display: inline-block;
    width: 18px;
  }
  .drag-handle {
    flex: none;
    margin-right: 4px;
    font-size: 12px;
    line-height: 1;
    color: var(--bo-text-dim);
    cursor: grab;
    user-select: none;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .bo-edit {
    width: 100%;
    height: 100%;
    padding: 0 7px;
    font: inherit;
    font-family: var(--bo-mono);
    font-size: 13px;
    text-align: inherit;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 1px solid var(--bo-sel-border);
    outline: none;
  }
  .dim {
    color: var(--bo-text-dim);
  }
  .pos {
    color: var(--bo-up);
  }
  .neg {
    color: var(--bo-down);
  }

  /* Selection: a translucent fill layered via inset box-shadow so it tints even
     over a heatmap background; the focus cell gets a 1px ring on top. */
  .c.sel {
    box-shadow: inset 0 0 0 1000px var(--bo-sel-fill);
  }
  .c.focus {
    box-shadow:
      inset 0 0 0 1000px var(--bo-sel-fill),
      inset 0 0 0 1px var(--bo-sel-border);
  }
  /* Fill: a draggable square at the selection's corner + the drag preview. */
  .fill-handle {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: 7px;
    height: 7px;
    background: var(--bo-sel-border);
    border: 1px solid var(--bo-bg);
    cursor: crosshair;
    z-index: 4;
    touch-action: none;
  }
  .c.fillpreview {
    box-shadow: inset 0 0 0 1px var(--bo-sel-border);
  }

  /* One keyframe, tinted per direction: amber for a neutral change, up/down
     colours for a derived tick — the convention on every trading screen.
     Consecutive changes alternate between two identical keyframes: switching
     animation-name restarts the animation on the SAME element, so a tick never
     rebuilds DOM just to replay the flash. */
  .flash {
    --bo-flash-ms: 300ms;
    --bo-flash-tint: var(--bo-amber);
    animation: flash var(--bo-flash-ms) linear;
  }
  .flash.alt {
    animation-name: flash-alt;
  }
  .flash.up {
    --bo-flash-tint: var(--bo-up);
    color: var(--bo-up);
  }
  .flash.down {
    --bo-flash-tint: var(--bo-down);
    color: var(--bo-down);
  }
  /* flashColor: false — the column owns its text colour; only the background flashes. */
  .flash.keep {
    color: inherit;
  }
  @keyframes flash {
    0% {
      background: color-mix(in srgb, var(--bo-flash-tint) 38%, transparent);
    }
    100% {
      background: transparent;
    }
  }
  @keyframes flash-alt {
    0% {
      background: color-mix(in srgb, var(--bo-flash-tint) 38%, transparent);
    }
    100% {
      background: transparent;
    }
  }
  /* flashMotion: 'hold' — a static tint for the flash window, removed by the
     grid's clock: restyled and repainted when it starts and when it drops,
     where a fade is on every frame between. */
  .flash.held {
    animation: none;
    background: color-mix(in srgb, var(--bo-flash-tint) 30%, transparent);
  }
  /* showChange: the delta beside the value. It fades by animating its text
     colour, a repaint of a few glyphs — not opacity, which would give every
     fading cell its own compositor layer (measured ~9x a frame's work on a
     busy board). In a narrow cell it shrinks away first (flex-shrink 1000),
     so the value is never cut for it. Numbers keep it on the value's left,
     where it never moves the value. Consecutive changes alternate keyframes
     to replay, as the flash does. */
  .bo-chg {
    --bo-chg-tint: var(--bo-up);
    flex: 0 1000 auto;
    min-width: 0;
    overflow: hidden;
    margin-left: 6px;
    font-size: 0.82em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: transparent;
    animation: bo-chg var(--bo-change-ms, 1000ms) linear forwards;
  }
  .bo-chg.down {
    --bo-chg-tint: var(--bo-down);
  }
  .bo-chg.alt {
    animation-name: bo-chg-alt;
  }
  .num .bo-chg {
    order: -1;
    margin-left: 0;
    margin-right: 6px;
  }
  @keyframes bo-chg {
    0%,
    60% {
      color: var(--bo-chg-tint);
    }
    100% {
      color: transparent;
    }
  }
  @keyframes bo-chg-alt {
    0%,
    60% {
      color: var(--bo-chg-tint);
    }
    100% {
      color: transparent;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flash,
    .flash.alt {
      animation: none;
    }
    /* Held tints follow the same rule: no flash under reduced motion. */
    .flash.held {
      background: none;
    }
    /* No fade: the delta shows, then simply disappears. */
    .bo-chg,
    .bo-chg.alt {
      animation-timing-function: steps(1, end);
    }
  }
</style>
