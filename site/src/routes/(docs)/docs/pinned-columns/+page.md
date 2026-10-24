---
title: Pinned columns
description: TODO
---

Set `pinned: true` (or `'left'`) on a column to keep it visible while the rest
scroll horizontally; `pinned: 'right'` sticks it to the right edge (e.g. an
actions or total column). Opt-in: with no pinned columns the grid stays
fit-to-width (no horizontal scroll).

```ts
const columns = [
  { type: 'text',  key: 'symbol', header: 'Symbol', width: 132, pinned: true },
  { type: 'price', key: 'price',  header: 'Price',  width: 88,  pinned: true },
  // …wider columns scroll under the pinned ones…
  { type: 'number', key: 'pnl',   header: 'P&L',    width: 96,  pinned: 'right' },
];
```
