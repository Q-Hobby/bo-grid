---
title: Localization
description: TODO
---

`labels` overrides any string the grid renders itself (menus, filter editor,
pager, aria labels); `locale` sets the default locale for the built-in `price`,
`date`, `currency` and `relative` formatting, the aggregation bar and the pager
row count. A column's own `locale` wins over the grid's.

```svelte
<Grid
  {rows}
  {columns}
  locale="vi-VN"
  labels={{
    autosize: 'Vừa nội dung',
    noRows: 'Không có dòng nào khớp',
    filterFor: (h) => `Lọc cột ${h}`,
    pageOf: (p, n, total) => `Trang ${p} / ${n} · ${total} dòng`,
  }}
/>
```

Pass only what you are changing — it is merged over the English defaults.
Interpolated entries are **functions**, not `{0}` placeholders, so a translation
can reorder the parts. Resolved per grid, so two grids on a page can use two
languages. `DEFAULT_LABELS` lists every key.
