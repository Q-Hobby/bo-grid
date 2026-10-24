---
title: Accessibility
description: TODO
---

The grid follows the ARIA grid pattern. Because rows are virtualized, it exposes
the real dimensions and positions so assistive tech isn't misled:

- `role="grid"` (`treegrid` with tree data) with `aria-rowcount` /
  `aria-colcount` (full size, not the rendered window) and
  `aria-multiselectable`. It holds only rows; the toolbar, pager and menus sit
  beside it.
- `role="row"` + `aria-rowindex` on rows, `role="gridcell"` + `aria-colindex` +
  `aria-selected` on cells, `role="columnheader"` + `aria-sort` on headers.
- `aria-activedescendant` tracks the focused cell for screen readers.
- Sparkline cells carry a text `aria-label`; sticky/skeleton duplicates are
  `aria-hidden`; the aggregation bar is an `aria-live` status region.
- Fully keyboard-operable: one tab stop with arrow-key navigation, APG-pattern
  menus (focus moves in, arrow-navigable, returns focus on close), a keyboard path
  to filtering (column menu → **Filter…**), and visible `:focus-visible` rings on
  every reachable control. Respects `prefers-reduced-motion`.

bo-grid targets **WCAG 2.1 AA**. See **[ACCESSIBILITY.md](https://github.com/bonguynvan/bo-grid/blob/main/ACCESSIBILITY.md)** for
the full keyboard map, roles, measured contrast ratios, and conformance notes from
the audit.
