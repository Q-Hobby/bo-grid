---
title: Conditional formatting
description: Paint data bars, icons and colour scales into numeric cells from the values themselves, with no custom cell code.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Conditional formatting draws a cue into a numeric cell from its value: a bar behind it, an icon beside it, or a background tint. It answers "which rows stand out?" at a glance, and needs no custom cell. All three work on any numeric column and can be combined.

Sort by Volume and watch the bars line up; the icons and the tint follow the Chg % values:

<Example name="conditional-formatting" title="Icons, a colour scale and data bars" />

## Data bars

`dataBar` paints a horizontal bar behind the value, scaled across the column's range.

- The range is computed over the rows in view, unless you give `min` and `max`. `min: 0` gives bars proportional to the value.
- When the range spans negative values, bars grow left and right from a zero line.
- `color` and `negative` override the default up and down colours.

```ts
{ type: 'volume', key: 'volume', header: 'Volume', dataBar: { min: 0 } }
{ type: 'number', key: 'pnl', header: 'P&L', decimals: 0, dataBar: {} } // diverging around zero
```

## Icons

`icons` shows an icon beside the value. Each rule has a threshold `at`, an `icon` and a `tone` (`up`, `down`, `amber`, `info` or `neutral`) for its colour. The rule with the highest `at` that is not above the value wins:

```ts
{
  type: 'percent',
  key: 'change',
  header: 'Chg %',
  icons: [
    { at: -Infinity, icon: '▼', tone: 'down' },
    { at: -0.25, icon: '●', tone: 'neutral' },
    { at: 0.25, icon: '▲', tone: 'up' },
  ],
}
```

## Colour scales

`colorScale` tints the cell background across the column's range: a soft ramp in the theme's colours.

- It is computed over the rows in view, unless you give `min` and `max`.
- `mid` makes a three-stop scale that diverges at that value, such as `mid: 0` for gains and losses.
- `colors` sets the stops: `[low, high]`, or `[low, mid, high]` with `mid`.

```ts
{ type: 'number', key: 'pnlPct', header: 'P&L %', decimals: 1, colorScale: { mid: 0 } }
```

The `heatmap` column type is the fixed alternative: a ramp between a `min` and a `max` you set, with the value written on top.

## With live data and server data

The cues follow the values, so they update with a live feed and work alongside [cell flashing](../flashing/). Automatic ranges are computed over the rows in memory; with a server [data source](../server-data/), which only holds one window of rows at a time, give explicit `min` and `max`.

## In the gallery

A correlation matrix drawn as a heat map, with a pinned label column:

<Example id="correlation" />

## Reference

<Props of="column" names={['dataBar', 'icons', 'colorScale', 'cellClass']} />
