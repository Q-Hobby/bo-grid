---
title: Master-detail
description: TODO
---

Pass a `detail` snippet to render an expandable panel under each row — the grid
adds a leading expand toggle and virtualizes the expanded heights (`detailHeight`,
default 160). In-memory mode:

```svelte
<Grid {rows} {columns} height={640} detailHeight={120} detail={rowDetail} />

{#snippet rowDetail({ row })}
  <div class="detail">…anything about {row.name}…</div>
{/snippet}
```
