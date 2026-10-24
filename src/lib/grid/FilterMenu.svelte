<script lang="ts">
  // Floating header filter menu. Lazy-loaded by Grid (dynamic import) so it
  // stays out of the core bundle until a filter is opened. Presentation-only:
  // the parent owns open/close + position and applies the resulting filter.
  import { untrack } from 'svelte';
  import { fitView } from './fit-view';
  import type { GridLabels } from './labels';
  import type { ColumnDef } from './column';
  import { fromDateInput, toDateInput } from './date';
  import {
    isFilterActive,
    isBuiltinFilter,
    type ColumnFilter,
    type AnyFilter,
    type CustomFilter,
    type FilterTypeDef,
    type TextOp,
    type NumberOp,
    type DateOp,
  } from './filtering';

  let {
    kind,
    header,
    filter,
    values = [],
    x,
    y,
    onApply,
    onClose,
    labels,
    column,
    custom,
  }: {
    kind: string;
    header: string;
    filter: AnyFilter | null;
    /** Distinct column values for a set filter's checklist. */
    values?: string[];
    x: number;
    y: number;
    onApply: (f: AnyFilter | null) => void;
    onClose: () => void;
    labels: GridLabels;
    column: ColumnDef;
    /** A registered filter type: the menu keeps its frame and draws this
        type's editor in the middle. */
    custom?: FilterTypeDef;
  } = $props();

  const L = $derived(labels);
  const TEXT_OPS: Array<{ op: TextOp; label: string }> = $derived([
    { op: 'contains', label: L.opContains },
    { op: 'notContains', label: L.opNotContains },
    { op: 'equals', label: L.opEquals },
    { op: 'starts', label: L.opStartsWith },
    { op: 'ends', label: L.opEndsWith },
  ]);
  const NUMBER_OPS: Array<{ op: NumberOp; label: string }> = $derived([
    { op: 'eq', label: '=' },
    { op: 'ne', label: '≠' },
    { op: 'lt', label: '<' },
    { op: 'le', label: '≤' },
    { op: 'gt', label: '>' },
    { op: 'ge', label: '≥' },
    { op: 'between', label: L.opBetween },
  ]);
  const DATE_OPS: Array<{ op: DateOp; label: string }> = $derived([
    { op: 'on', label: L.opOn },
    { op: 'before', label: L.opBefore },
    { op: 'after', label: L.opAfter },
    { op: 'between', label: L.opBetween },
  ]);


  // Local draft, seeded once from the active filter. The menu is recreated each
  // time it opens, so capturing the initial prop value (not tracking it) is what
  // we want.
  const initial = untrack(() => filter);
  const init = initial && isBuiltinFilter(initial) ? initial : null;
  let textOp = $state<TextOp>(init?.kind === 'text' ? init.op : 'contains');
  let textQ = $state(init?.kind === 'text' ? init.q : '');
  let numOp = $state<NumberOp>(init?.kind === 'number' ? init.op : 'eq');
  let numA = $state<number | null>(init?.kind === 'number' && Number.isFinite(init.a) ? init.a : null);
  let numB = $state<number | null>(
    init?.kind === 'number' && init.b != null && Number.isFinite(init.b) ? init.b : null,
  );
  let dateOp = $state<DateOp>(init?.kind === 'date' ? init.op : 'on');
  let dateA = $state(init?.kind === 'date' ? toDateInput(init.a) : '');
  let dateB = $state(init?.kind === 'date' && init.b != null ? toDateInput(init.b) : '');
  // Set filter: track the *excluded* values (unchecked boxes).
  let excluded = $state(new Set<string>(init?.kind === 'set' ? init.excluded : []));
  let search = $state('');
  const shown = $derived(values.filter((v) => v.toLowerCase().includes(search.trim().toLowerCase())));
  function toggleVal(v: string) {
    const n = new Set(excluded);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    excluded = n;
  }

  // A registered type's draft, edited by its own component.
  let draft = $state<CustomFilter | null>(initial && !isBuiltinFilter(initial) ? initial : null);

  function build(): AnyFilter | null {
    if (custom) return draft && isFilterActive(draft, { [kind]: custom }) ? draft : null;
    let f: ColumnFilter;
    if (kind === 'number') {
      f = { kind: 'number', op: numOp, a: numA ?? NaN, b: numB ?? undefined };
    } else if (kind === 'date') {
      f = { kind: 'date', op: dateOp, a: fromDateInput(dateA), b: dateB ? fromDateInput(dateB) : undefined };
    } else if (kind === 'set') {
      f = { kind: 'set', excluded: [...excluded] };
    } else {
      f = { kind: 'text', op: textOp, q: textQ };
    }
    return isFilterActive(f) ? f : null;
  }

  function apply() {
    onApply(build());
  }
  function clear() {
    onApply(null);
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') apply();
    else if (e.key === 'Escape') onClose();
  }
</script>

<div
  class="bo-filtermenu"
  role="dialog"
  tabindex="-1"
  aria-label={L.filterFor(header)}
  use:fitView={{ x, y }}
  onpointerdown={(e) => e.stopPropagation()}
  onkeydown={onKey}
>
  <div class="bo-fm-head">{header}</div>

  {#if custom}
    {@const Editor = custom.component}
    <div class="bo-fm-custom">
      <Editor filter={draft} onChange={(f) => (draft = f)} {column} {values} {labels} />
    </div>
  {:else if kind === 'number'}
    <select class="bo-fm-op" bind:value={numOp} aria-label={L.operator}>
      {#each NUMBER_OPS as o (o.op)}<option value={o.op}>{o.label}</option>{/each}
    </select>
    <input class="bo-fm-in" type="number" bind:value={numA} placeholder={L.valuePlaceholder} aria-label={L.value} />
    {#if numOp === 'between'}
      <input class="bo-fm-in" type="number" bind:value={numB} placeholder={L.and} aria-label={L.upperValue} />
    {/if}
  {:else if kind === 'date'}
    <select class="bo-fm-op" bind:value={dateOp} aria-label={L.operator}>
      {#each DATE_OPS as o (o.op)}<option value={o.op}>{o.label}</option>{/each}
    </select>
    <input class="bo-fm-in" type="date" bind:value={dateA} aria-label={L.date} />
    {#if dateOp === 'between'}
      <input class="bo-fm-in" type="date" bind:value={dateB} aria-label={L.endDate} />
    {/if}
  {:else if kind === 'set'}
    <input class="bo-fm-in" type="search" bind:value={search} placeholder={L.searchPlaceholder} aria-label={L.searchValues} />
    <div class="bo-fm-setbar">
      <button type="button" class="bo-fm-link" onclick={() => (excluded = new Set())}>{L.all}</button>
      <button type="button" class="bo-fm-link" onclick={() => (excluded = new Set(values))}>{L.none}</button>
    </div>
    <div class="bo-fm-list">
      {#each shown as v (v)}
        <label class="bo-fm-opt">
          <input type="checkbox" checked={!excluded.has(v)} onchange={() => toggleVal(v)} />
          <span>{v === '' ? L.blank : v}</span>
        </label>
      {/each}
    </div>
  {:else}
    <select class="bo-fm-op" bind:value={textOp} aria-label={L.operator}>
      {#each TEXT_OPS as o (o.op)}<option value={o.op}>{o.label}</option>{/each}
    </select>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="bo-fm-in" type="text" bind:value={textQ} placeholder={L.filterPlaceholder} aria-label={L.value} autofocus />
  {/if}

  <div class="bo-fm-actions">
    <button class="bo-fm-btn" type="button" onclick={clear}>{L.clear}</button>
    <button class="bo-fm-btn bo-fm-apply" type="button" onclick={apply}>{L.apply}</button>
  </div>
</div>

<style>
  .bo-filtermenu {
    position: fixed;
    /* Never taller than the window: it scrolls instead. */
    max-height: calc(100vh - 8px);
    overflow: auto;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 200px;
    padding: 10px;
    background: var(--bo-header-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    font-size: 12px;
    color: var(--bo-text);
  }
  .bo-fm-head {
    font-weight: 600;
    color: var(--bo-text-dim);
    padding-bottom: 2px;
  }
  .bo-fm-op,
  .bo-fm-in {
    width: 100%;
    padding: 5px 7px;
    font: inherit;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 5px;
  }
  .bo-fm-setbar {
    display: flex;
    gap: 12px;
  }
  .bo-fm-link {
    padding: 0;
    font: inherit;
    font-size: 11px;
    color: var(--bo-up);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .bo-fm-link:hover {
    text-decoration: underline;
  }
  .bo-fm-list {
    display: flex;
    flex-direction: column;
    max-height: 180px;
    overflow-y: auto;
    border: 0.5px solid var(--bo-border);
    border-radius: 5px;
  }
  .bo-fm-opt {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 7px;
    cursor: pointer;
    white-space: nowrap;
  }
  .bo-fm-opt:hover {
    background: var(--bo-row-hover);
  }
  .bo-fm-opt span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bo-fm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 2px;
  }
  .bo-fm-btn {
    padding: 5px 12px;
    font: inherit;
    font-size: 11px;
    color: var(--bo-text-dim);
    background: transparent;
    border: 0.5px solid var(--bo-border);
    border-radius: 5px;
    cursor: pointer;
  }
  .bo-fm-btn:hover {
    color: var(--bo-text);
  }
  /* Visible keyboard focus (WCAG 2.4.7) for the menu's custom buttons. */
  .bo-fm-btn:focus-visible,
  .bo-fm-link:focus-visible {
    outline: 2px solid var(--bo-sel-border);
    outline-offset: 1px;
    border-radius: 5px;
  }
  .bo-fm-apply {
    color: #0a0a0a;
    background: var(--bo-up);
    border-color: var(--bo-up);
  }
</style>
