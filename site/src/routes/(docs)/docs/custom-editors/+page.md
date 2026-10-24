---
title: Custom editors
description: TODO
---

Give a column an **`editor`** component to replace the built-in input. It
receives `{ value, row, column, seed, commit, cancel }`, calls `commit(value)`
with any value (no parsing) or `cancel()`; Escape cancels and focus leaving the
editor cancels. With an editor, display widgets such as `rating` or `tags`
become editable:

```ts
import RatingEditor from './RatingEditor.svelte';
{ type: 'rating', key: 'rating', header: 'Rating', editable: true, editor: RatingEditor }
```

**`parse(raw, row)`** turns typed or pasted text into the stored value — it runs
for the built-in editor, paste and fill, ahead of the number/date coercion.
Return `undefined` (or `NaN`) to reject the input:

```ts
{ type: 'number', key: 'salary', header: 'Salary', editable: true,
  parse: (raw) => (/\d/.test(raw) ? Number(raw.replace(/[^\d.-]/g, '')) : undefined) }
```

`validate` then sees the parsed (or committed) value. **`defaultColumn`** applies
settings under every column — a column's own fields, and its registered
`cellType`, win:

```svelte
<Grid {rows} {columns} defaultColumn={{ resizable: false, tooltip: true }} />
```
