---
title: Pagination
description: Show rows a page at a time with a pager and an optional rows-per-page choice, instead of one long scroll.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

The grid scrolls through any number of rows without paging, since only the rows on screen are drawn. When pages suit the task better, such as a report someone works through or a page number to refer to, `pageSize` shows rows a page at a time with a pager.

Move through the 120 rows with the pager, or pick another page size; sorting and filtering apply to all rows, not just the page:

<Example name="pagination" title="A paged grid" />

## Turning it on

```svelte
<Grid {rows} {columns} pageSize={25} pageSizeOptions={[25, 50, 100]} height={640} />
```

- `pageSize` above 0 shows a pager with first, previous, next and last buttons. Rows still virtualize within a page.
- `pageSizeOptions` adds a rows-per-page choice to the pager. Picking one goes back to the first page, and `onPageSizeChange` reports the new size.
- Pages apply to rows in memory; a server [data source](../server-data/) already loads rows a window at a time as the user scrolls.

## Controlling the page

The current page is the grid's own by default. To drive it, for example from the URL, pass `page` (0-based) and update it from `onPageChange`:

```svelte
<script lang="ts">
  let page = $state(0);
</script>

<Grid {rows} {columns} pageSize={25} {page} onPageChange={(p) => (page = p)} height={480} />
```

The page size works the same way: it changes on its own from the dropdown, unless you also drive `pageSize` and update it from `onPageSizeChange`.

## Reference

<Props names={['pageSize', 'pageSizeOptions', 'onPageSizeChange', 'page', 'onPageChange']} />
