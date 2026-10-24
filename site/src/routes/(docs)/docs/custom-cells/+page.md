---
title: Custom cells
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Use `type: 'custom'` and pass a `cell` snippet to render anything — badges,
buttons, links. The snippet receives `{ row, column, value }`:

```svelte
{#snippet cell({ row })}
  <span class:up={row.changePct > 0}>{row.changePct > 0 ? '▲' : '▼'}</span>
{/snippet}

<Grid {rows} {columns} {cell} height={640} />
```

**From plain JS (React/Vue/vanilla, `<bo-grid>`):** snippets are Svelte-only, so
give a column a **`render(ctx)`** function instead. Return an `HTMLElement`/`Node`
(appended as-is — safe) or an HTML **string** (inserted as innerHTML — sanitize
any untrusted data yourself; prefer a Node for that). `ctx` is `{ value, row,
column }`. Display only — sort, filter, tooltip, copy and export still use the
value / `format`:

```js
{ type: 'custom', key: 'trend', header: 'Trend', render: ({ row }) => {
    const el = document.createElement('span');
    el.textContent = row.changePct > 0 ? '▲' : '▼';
    el.style.color = row.changePct > 0 ? 'var(--bo-grid-up)' : 'var(--bo-grid-down)';
    return el;
  } }
```

**A Svelte component per column:** set `component` on any column. It receives
`{ value, row, column, text }` (`text` is the value as copy/export see it):

```ts
import StatusPill from './StatusPill.svelte';
{ type: 'text', key: 'status', header: 'Status', component: StatusPill }
```

## Tooltips & truncation

Long cell values truncate with an **ellipsis** by default. Set `tooltip` on a
column to reveal the full text in a **styled floating tooltip** on hover (themed,
instant — not the native `title`). `tooltip: true` shows the formatted value;
pass a function for custom text built from the whole row (works for any type,
including `custom`):

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'note', header: 'Notes', width: 220, tooltip: true },
  { type: 'badge', key: 'status', header: 'Status',
    tooltip: (value, row) => `${value} · ${row.role}` },     // custom text
  { type: 'text', key: 'bio', header: 'Bio', flex: 1, wrap: true }, // wrap, no ellipsis
];
```

Set `wrap: true` to let a column wrap onto multiple lines instead of truncating
(pair with a taller `rowHeight`).

**Header tooltips:** `headerTooltip` shows the same styled bubble on the column
header (describe the metric, units, caveats); add `headerInfo: true` for a small
ⓘ cue:

```ts
{ type: 'progress', key: 'workload', header: 'Workload', min: 0, max: 100,
  headerTooltip: 'Share of capacity allocated this sprint (0–100%).',
  headerInfo: true }
```

## Live example

<Example id="leaderboard" />

<Example id="team" />
