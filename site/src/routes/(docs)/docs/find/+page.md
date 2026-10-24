---
title: Find in grid
description: TODO
---

`findBar` turns on Ctrl/⌘+F inside the grid. A small find bar opens over the
top-right corner; it is off by default, since it takes Ctrl+F from the browser
while the grid has focus.
- It matches what the cells display (their formatted text), ignoring case,
  and shows "3 of 12".
- Enter and Shift+Enter step through the matches, and each match is focused
  and scrolled into view. Escape closes the bar and returns focus to the grid.
- `api.openFind(query?)` opens it from your own search button.

```svelte
<Grid {rows} {columns} findBar />
```

Matches are found once per query and view, not on every tick, so on a live
board the values can move after the bar has found them. It searches
in-memory rows (not a `source`), up to 10,000 matches.
