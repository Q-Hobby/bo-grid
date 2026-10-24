---
title: Conditional formatting
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Paint analytics cues straight into numeric cells — no custom snippet needed.

**Data bars** (`dataBar`): an in-cell bar behind the value, scaled across the
column's range. The range auto-computes over the current view, or set `min`/`max`
(`min: 0` gives absolute proportional bars). When the range spans negatives, bars
diverge left/right around a zero baseline. `color`/`negative` override the default
up/down theme colours.

**Icon sets** (`icons`): an icon beside the value, chosen by the highest threshold
`at` that is ≤ the value. Each rule carries a semantic `tone` (`up` · `down` ·
`amber` · `info` · `neutral`) for its colour.

**Colour scales** (`colorScale`): tint the cell background across the value range —
a soft, themed heat ramp. Auto-ranges over the view (or set `min`/`max`); pass
`mid` for a 3-stop diverging scale; `colors` overrides the stops. Works on any
numeric column (the fixed `heatmap` type still exists for an absolute ramp).

```ts
const columns: ColumnDef[] = [
  // Proportional bar from zero:
  { type: 'volume', key: 'marketValue', header: 'Mkt Value', dataBar: { min: 0 } },
  // Diverging bar (auto-ranged) + an icon keyed by sign:
  { type: 'number', key: 'pnl', header: 'P&L', decimals: 0,
    dataBar: {},
    icons: [
      { at: -Infinity, icon: '▼', tone: 'down' },
      { at: 0,         icon: '▲', tone: 'up' },
    ] },
  // Diverging colour scale around zero (auto-ranged):
  { type: 'number', key: 'pnlPct', header: 'P&L %', decimals: 1, colorScale: { mid: 0 } },
];
```

All three compose with flashing/live cells and add nothing to the core for grids
that don't use them. (In-memory auto-ranging; pass explicit `min`/`max` in source
mode.)

## Live example

<Example id="correlation" />
