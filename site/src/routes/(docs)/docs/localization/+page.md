---
title: Localization
description: Translate every string the grid shows and format numbers and dates for a locale, per grid.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Two props localize a grid. `locale` picks how numbers, prices and dates are formatted. `labels` replaces the text the grid writes itself: menu items, filter operators, the pager, the empty message and the names read out by screen readers. Both apply per grid, so two grids on one page can use two languages.

A grid in Vietnamese: `vi-VN` number formatting, translated pager and filter menu. Open a column's funnel, or page through the rows.

<Example name="localization" title="Vietnamese labels and formats" />

## Formats

`locale` is a BCP 47 tag (`'vi-VN'`, `'de-DE'`, `'ja-JP'`). It sets the default for the built-in `price`, `date`, `currency` and `relative` formatting, the selection's totals bar and the pager's row count. A column's own `locale` wins over the grid's:

```svelte
<Grid {rows} {columns} height={480} locale="vi-VN" />
```

```ts
{ type: 'currency', key: 'cost', header: 'Cost', currency: 'JPY', locale: 'ja-JP' }
```

Without `locale`, columns format in `en-US` and the grid's own counts use the browser's locale.

## Labels

Pass only the strings you change; they are merged over the English defaults:

```svelte
<Grid
  {rows}
  {columns}
  height={480}
  labels={{
    autosize: 'Vừa nội dung',
    noRows: 'Không có dòng nào khớp',
    filterFor: (h) => `Lọc cột ${h}`,
    pageOf: (p, n, total, locale) => `Trang ${p} / ${n} · ${total.toLocaleString(locale)} dòng`,
  }}
/>
```

Labels with values in them are functions rather than strings with placeholders, so a translation can put the parts in any order. `DEFAULT_LABELS` holds every key with its English text, a good starting point for a full translation, and the `GridLabels` type lists them for your editor:

```ts
import { DEFAULT_LABELS, type GridLabels } from 'bo-grid';

export const vi: Partial<GridLabels> = {
  apply: 'Áp dụng',
  clear: 'Xóa',
  // …
};
```

Accessible names are labels too (`selectRow`, `columnMenu`, `resizeColumn`, `rowNumber` and others), so a translated grid also speaks the reader's language to a screen reader.

## Reference

<Props names={['locale', 'labels', 'emptyMessage']} />

<Props of="column" names={['locale']} />
