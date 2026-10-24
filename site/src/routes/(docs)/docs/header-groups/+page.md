---
title: Header groups
description: Put a spanning parent header over related columns, such as Bid, Ask and Match on a price board.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A header group is a second header row that spans related columns, so a reader sees which columns belong together: Bid price and volume, Ask price and volume, the match price and change. Columns in a group keep their own headers, sorting and resizing.

Bid, Ask and Match each span the columns under them; sort or resize any column as usual:

<Example name="header-groups" title="Bid, Ask and Match groups" />

## Grouping columns

Give columns a `group` label. Consecutive columns with the same label render under one spanning header:

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'symbol', header: 'Symbol', width: 90 },
  { type: 'price', key: 'bid', header: 'Price', width: 90, group: 'Bid' },
  { type: 'volume', key: 'bidVol', header: 'Vol', width: 90, group: 'Bid' },
  { type: 'price', key: 'ask', header: 'Price', width: 90, group: 'Ask' },
  { type: 'volume', key: 'askVol', header: 'Vol', width: 90, group: 'Ask' },
];
```

- Only consecutive columns join a group. The same label further along starts a new span, so if users can move columns, a group can split in two.
- Columns without a `group` have an empty cell above them.
- A group keeps the width of its columns as they resize, flex columns included.

## Reference

<Props of="column" names={['group']} />
