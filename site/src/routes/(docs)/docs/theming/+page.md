---
title: Theming
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Dark-first and self-contained — no CSS import required. Use the `theme` prop with
a built-in preset or a custom token map:

```svelte
<Grid {rows} {columns} theme="light" height={640} />
<Grid {rows} {columns} theme={{ bg: '#0b1020', up: '#22d3ee' }} height={640} />
```

Eight built-in presets are exported (`GridTheme`): `darkTheme`, `lightTheme`,
`highContrastDark`, `highContrastLight`, `midnightTheme`, `terminalTheme`, and
`tradecanvasTheme` / `tradecanvasLightTheme` (the palette TradeCanvas charts and
TradingDek share, so a grid sits flush next to a chart) — plus a
`themePresets` name→preset map (and a `ThemePreset` type) for a theme picker:

```svelte
<script>
  import { Grid, themePresets, type ThemePreset } from 'bo-grid';
  let preset: ThemePreset = 'midnight';
</script>
<Grid {rows} {columns} theme={themePresets[preset]} height={640} />
```

Or set any `--bo-grid-*` custom property on an ancestor — the prop is just a
convenience over these:

```css
.my-app {
  --bo-grid-bg: #fff;
  --bo-grid-text: #1a1a1a;
  --bo-grid-up: #16a34a;
  --bo-grid-down: #dc2626;
}
```

Native form controls (checkboxes, date pickers, number spinners, search inputs,
scrollbars) follow the theme automatically via `color-scheme` + `accent-color`.
A custom theme defaults to dark; set `scheme: 'light'` (or `--bo-grid-scheme:
light`) for a light one.

**Tokens** cover colour, typography (`mono`/`sans`/`fontSize`), shape (`radius`),
and density (`cellPad`, plus the `rowHeight` prop) — so the whole look is yours.
Numeric columns use tabular figures so digits line up. A few looks:

```svelte
<!-- Compact / dense -->
<Grid {rows} {columns} rowHeight={28}
  theme={{ fontSize: '12px', cellPad: '6px' }} height={640} />

<!-- Roomy & rounded -->
<Grid {rows} {columns} rowHeight={44}
  theme={{ radius: '16px', cellPad: '16px', fontSize: '14px' }} height={640} />

<!-- Branded -->
<Grid {rows} {columns}
  theme={{ bg: '#0b1020', headerBg: '#0d1226', up: '#22d3ee', down: '#fb7185',
           selBorder: '#22d3ee', radius: '12px' }} height={640} />
```

## Live example

<Example id="themes" />
