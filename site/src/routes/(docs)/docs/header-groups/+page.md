---
title: Header groups
description: TODO
---

Give columns a `group` label to render a spanning parent header over consecutive
columns that share it (works best with fixed-width columns):

```ts
const columns = [
  { type: 'text',  key: 'symbol', header: 'Symbol', width: 120, group: 'Holding' },
  { type: 'number', key: 'shares', header: 'Shares', width: 90,  group: 'Holding' },
  { type: 'price', key: 'last',   header: 'Last',   width: 90,  group: 'Pricing' },
];
```
