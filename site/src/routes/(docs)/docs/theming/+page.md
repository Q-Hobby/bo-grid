---
title: Theming
description: Style the grid with a built-in preset, a token map of your own, or CSS variables, from colours to fonts, corner radius and density.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

The grid brings its own styles: there is no stylesheet to import. Its look is a set of tokens (colours, fonts, radius, padding), and the `theme` prop sets them from a built-in preset or a map of your own. Every token is also a `--bo-grid-*` CSS variable, so a page stylesheet can set them too.

Switch between compact, default and roomy: density and shape are tokens like the colours.

<Example name="theming" title="Density and shape tokens" />

## Presets

`theme` takes a name, `'dark'` (the default) or `'light'`, or a token map. Eight presets are exported as token maps:

| Export | Name in `themePresets` |
| --- | --- |
| `darkTheme` | `dark` |
| `lightTheme` | `light` |
| `highContrastDark` | `high-contrast-dark` |
| `highContrastLight` | `high-contrast-light` |
| `midnightTheme` | `midnight` |
| `terminalTheme` | `terminal` |
| `tradecanvasTheme` | `tradecanvas` |
| `tradecanvasLightTheme` | `tradecanvas-light` |

```svelte
<script lang="ts">
  import { Grid, themePresets, type ThemePreset } from 'bo-grid';
  let preset = $state<ThemePreset>('midnight');
</script>

<Grid {rows} {columns} height={480} theme={themePresets[preset]} />
```

`themePresets` maps each name to its tokens, for a theme picker; `ThemePreset` is the type of the names. The high-contrast presets are tuned well past the WCAG AA contrast ratios.

<Example id="themes" />

## Your own tokens

A token map sets only the tokens you give; the rest keep their defaults:

```svelte
<Grid {rows} {columns} height={480} theme={{ bg: '#0b1020', headerBg: '#0d1226', up: '#22d3ee', down: '#fb7185', selBorder: '#22d3ee' }} />
```

| Token | What it sets |
| --- | --- |
| `bg`, `headerBg` | Grid and header background |
| `rowA`, `rowB`, `rowHover` | Alternating row backgrounds and the hovered row |
| `colHover` | The column highlight under `columnHover` |
| `text`, `textDim`, `border` | Text, secondary text and lines |
| `up`, `down`, `amber` | Rises, falls and warnings (flashes, signed numbers, badges) |
| `selFill`, `selBorder` | The selection's fill and outline |
| `mono`, `sans`, `fontSize` | Number and text fonts, and the cell font size |
| `radius`, `cellPad`, `headerH` | Corner radius, horizontal cell padding, header height |
| `scheme` | `'light'` or `'dark'` for native controls (checkboxes, date pickers, scrollbars) |

Numbers use tabular figures, so digits line up down a column whatever the font.

## Density

Density is two settings: the `rowHeight` prop and the `cellPad` token (with `fontSize` to match):

```svelte
<!-- Compact -->
<Grid {rows} {columns} height={480} rowHeight={28} theme={{ fontSize: '12px', cellPad: '6px' }} />

<!-- Roomy and rounded -->
<Grid {rows} {columns} height={480} rowHeight={44} theme={{ radius: '16px', cellPad: '16px', fontSize: '14px' }} />
```

## CSS variables

Each token is a CSS custom property on the grid, so you can set them from a stylesheet on any ancestor instead of the prop:

```css
.my-app {
  --bo-grid-bg: #ffffff;
  --bo-grid-text: #1a1a1a;
  --bo-grid-up: #16a34a;
  --bo-grid-down: #dc2626;
  --bo-grid-scheme: light;
}
```

The variable names follow the tokens: `bg` is `--bo-grid-bg`, `headerBg` is `--bo-grid-header-bg`, `cellPad` is `--bo-grid-cell-pad`. A `theme` prop sets the same variables on the grid itself, so it wins over an ancestor's. `themeVars(theme)` turns a token map into the variable declarations, for a wrapper of your own.

The `--bo-grid-*` variables are inputs: they hold a value only where you or a `theme` set one. To use a theme colour inside the grid (a custom cell, a `cellClass` style), read the colour the grid resolved, the same name without `grid-`: `var(--bo-up)`, `var(--bo-down)`, `var(--bo-text)`, `var(--bo-text-dim)`, `var(--bo-amber)`. These always hold the current theme's colour.

Native controls inside the grid (checkboxes, date and number inputs, the search box, scrollbars) follow the theme through `color-scheme` and `accent-color`. A custom map is treated as dark unless it sets `scheme: 'light'`.

## Styling rows and cells

For styling that depends on the data, use a column's `cellClass` or the grid's `rowClass`; see [Row styles](../row-styles/) and [Conditional formatting](../conditional-formatting/).

## Reference

<Props names={['theme', 'rowHeight', 'columnHover']} />
