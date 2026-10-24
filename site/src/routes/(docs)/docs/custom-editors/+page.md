---
title: Custom editors
description: Replace a column's editor with your own component, parse typed or pasted text into values, and share settings across columns.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

The built-in editors cover text, numbers, dates and dropdowns. When a column needs something else (a stepper, a star picker, a tag list), give it an `editor` component. When the editor is fine but the text needs reading (a currency sign, thousands separators), give it a `parse` function.

Double-click **Qty** for a stepper editor (↑ and ↓ step by 100, Enter saves), or type `$1,250.50` into **Price**: `parse` turns it into 1250.5.

<Example name="custom-editors" title="A custom editor and a parser" />

## An editor component

A column's `editor` replaces the built-in input. It receives `value`, `row`, `column`, `seed` (the key that started type-to-edit, or `null`) and two callbacks: `commit(value)` saves any value as it is (no parsing) and `cancel()` closes without saving. <kbd>Escape</kbd> cancels, and so does focus leaving the editor; the grid focuses the editor's first focusable element when it opens.

```svelte
<!-- Stepper.svelte -->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { CellEditorProps } from 'bo-grid';

  let { value, commit }: CellEditorProps = $props();
  let qty = $state(untrack(() => Number(value) || 0));
</script>

<span role="spinbutton" tabindex="0" aria-label="Quantity" aria-valuenow={qty}
  onkeydown={(e) => {
    if (e.key === 'ArrowUp') qty += 100;
    else if (e.key === 'ArrowDown') qty = Math.max(0, qty - 100);
    else if (e.key === 'Enter') commit(qty);
  }}>{qty}</span>
<button type="button" onclick={() => commit(qty)}>OK</button>
```

```ts
import Stepper from './Stepper.svelte';

{ type: 'number', key: 'qty', header: 'Qty', editable: true, editor: Stepper }
```

The committed value still goes through the column's `validate`, then to `onCellEdit`. An editor also makes a display widget editable: `rating`, `tags`, `badge` and the other display types are read-only until they have one.

```ts
import RatingEditor from './RatingEditor.svelte';

{ type: 'rating', key: 'rating', header: 'Rating', editable: true, editor: RatingEditor }
```

The spreadsheet example has a full star-picker editor: [Spreadsheet](../../examples/sheet/).

## Parsing typed and pasted text

`parse(raw, row)` turns text into the stored value. It runs for the built-in editor, paste and the fill handle, in place of the built-in number and date conversion. Return `undefined` (or `NaN`) to refuse the input:

```ts
{
  type: 'price', key: 'price', header: 'Price', editable: true,
  parse: (raw) => (/\d/.test(raw) ? Number(raw.replace(/[^\d.-]/g, '')) : undefined),
}
```

`validate` then sees the parsed value.

## Settings shared by every column

`defaultColumn` applies settings under every column. A column's own fields win, and so does a registered `cellType`:

```svelte
<Grid {rows} {columns} height={480} defaultColumn={{ resizable: false, tooltip: true }} />
```

To reuse a whole column recipe (format, editor, filter, width) under a name, register it with `cellTypes`; see [Column types](../column-types/).

## Reference

<Props of="column" names={['editor', 'parse', 'validate', 'editable', 'options']} />

<Props names={['defaultColumn', 'cellTypes', 'onCellEdit']} />
