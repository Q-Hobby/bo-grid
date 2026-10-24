---
title: Pagination
description: TODO
---

Prefer pages over one long scroll? Set `pageSize` (> 0) for a paged view with a
first/prev/next/last pager; rows still virtualize within each page. Add
`pageSizeOptions` for a **rows-per-page dropdown** in the pager (observe changes
via `onPageSizeChange`). In-memory mode.

```svelte
<Grid {rows} {columns} height={640} pageSize={25} pageSizeOptions={[25, 50, 100]} />
```
