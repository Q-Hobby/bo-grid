---
title: AI coding agents
description: Give a coding agent what it needs to write correct bo-grid code first time, with every page as Markdown, an index in llms.txt, an API manifest generated from the types, and rules for your AGENTS.md.
---

A coding agent works differently from a person reading the docs. It may remember an older version of a library, or a similar one; it cannot see what the grid looks like; and it learns by running code, failing and fixing. So what helps it most is accurate text it can fetch, types it can check against, and complete examples it can copy. bo-grid publishes all three, generated from the same sources as these pages.

| What | Where | Use it for |
| --- | --- | --- |
| Index of the docs | [`/llms.txt`](../../llms.txt) | The facts to get right first, and a link to every page as Markdown |
| Any page as Markdown | add `.md` to its URL: [`/docs/grouping.md`](../grouping.md) | Feeding one topic to an agent |
| Copy page | the button at the top of every docs page | Pasting a page into a chat |
| API manifest | [`/api.json`](../../api.json) | Every prop, column option and API method, with types, defaults and docs |
| Full reference | [`/llms-full.txt`](../../llms-full.txt) | The whole API in one file |
| Types | `node_modules/bo-grid/dist/**/*.d.ts` | The API of the exact version installed |

## Every page as Markdown

Each docs page has a plain Markdown twin at the same URL with `.md` in place of the trailing slash: `/docs/row-selection/` is also `/docs/row-selection.md`. The twin is generated from the page's source when the site is built, and it is self-contained:

- Props tables become lists of each prop with its type, default and description.
- Small examples are inlined as complete Svelte files, imports included.
- Gallery examples become links to their live page and source.

The **Copy page** button at the top of every page copies that Markdown, ready to paste into an agent. Each page also declares it in its HTML head (`<link rel="alternate" type="text/markdown">`), so a tool that reads the page can find it.

## llms.txt

[`/llms.txt`](../../llms.txt) is the entry point for an agent that fetches URLs. It opens with the facts most often gotten wrong, such as which import a feature comes from and the Svelte 5 syntax to use, then lists every docs page, in sidebar order, as a Markdown link with a one-line summary. It is generated from the sidebar at build time, so it lists exactly the pages that exist.

## The API as data: api.json

[`/api.json`](../../api.json) describes every `<Grid>` prop, every column option (shared ones, and the options each column type adds), and every grid API method. It is generated from the TypeScript sources and their doc comments, so it matches the release the site was built from:

```json
{
  "package": "bo-grid",
  "grid": {
    "props": [
      {
        "name": "rowHeight",
        "type": "number | ((row: GridRow, index: number) => number)",
        "required": false,
        "doc": "Row height in px (uniform), or a function for variable heights (in-memory mode only).",
        "default": "36",
        "example": "<Grid {rows} {columns} height={480} rowHeight={(row) => (row.note ? 56 : 36)} />"
      }
    ]
  }
}
```

Every optional prop and option states its `default`, and every one whose type is more than a plain value has an `example`, as does every API method. The build fails when one is missing, so the file is complete for each release. The props tables in these docs, such as the one on the [Props reference](../reference/), are drawn from the same file. A docs page that names a prop which does not exist fails the site's build, so the docs cannot describe an API the types don't have.

## Types are the first docs

An agent working in your project can read the package's type definitions in `node_modules`, and those always match the installed version, whatever the agent remembers. bo-grid's types are written to be read:

- `ColumnDef` is a union on `type`, so an option on the wrong column type (`decimals` on a `badge`, say) is a type error, not a silent no-op.
- Props, column options and API methods carry doc comments with `@default` and `@example` tags, the same text as in `api.json`. An editor shows them on hover, and an agent reading the `.d.ts` files finds a default and a working example beside each declaration.
- Values are narrow where they can be: `flash` is `boolean | 'auto' | 'up-down' | 'change'`, not `string`.

So the most useful habit to give an agent is to run the type check after each change (`svelte-check` in a Svelte project, `tsc` elsewhere) and fix what it reports.

## Errors that say the fix

When the grid is used wrongly at run time, the error it throws is written for whoever reads it next, person or agent. It starts with a stable code, says what happened with the value the grid got, and ends with the fix and a link:

```text
BG3003: createPositions: a fill's qty must be a number above 0, got -100. Fix: Pass the filled quantity as a positive number; the side says which way (side: 'sell', not a negative qty). See https://bonguynvan.github.io/bo-grid/docs/errors/#bg3003
```

An agent can apply the fix without reading the library's source, and a test or an error reporter can match on `error.code`. Every code is on the [Error codes](../errors/) page, which a test keeps in step with the source.

## Add bo-grid to your AGENTS.md

Most coding agents read a project instruction file: `AGENTS.md`, `CLAUDE.md`, or a rules file. Paste this section into yours so every session starts from the right API:

```md
## bo-grid (data grid)

This project uses `bo-grid`. Before writing grid code, read
https://bonguynvan.github.io/bo-grid/llms.txt and the page for the feature
(each docs page has a Markdown twin: add `.md` to its URL). Every prop, column
option and API method, with types and defaults, is in
https://bonguynvan.github.io/bo-grid/api.json. Never invent a prop: if it is
not in api.json or the types in node_modules/bo-grid, it does not exist.

- Svelte 5 only: runes (`$state`, `$derived`, `$props`), snippets and
  callback props. Never `export let`, `on:click` or `<slot>`.
- Imports: `Grid` and types from `bo-grid`; feeds from `bo-grid/realtime`;
  market helpers from `bo-grid/trading`; `DepthLadder` from `bo-grid/ladder`;
  React `BoGrid` from `bo-grid/react`; Vue `BoGrid` from `bo-grid/vue`;
  the custom element from `bo-grid/element`.
- Minimal grid: `<Grid {rows} {columns} height={400} />`. Every row needs a
  unique `id`, or pass `getRowId`.
- Live prices: a column with `flash: 'auto'` flashes changes by itself. Write
  ticks with `api.patchRows(patches)` (the API comes from `onReady`), fed by
  `createTickStream`. Don't write `flashSeq` or `flashDir` bookkeeping.
- To add, remove or reorder rows, assign a new array; `patchRows` only
  changes fields of rows that exist.
- Outside Svelte there are no snippets: draw custom cells with a column's
  `render(ctx)` function.
- After editing, run the type check (`svelte-check` or `tsc`) and fix errors.
- A runtime error that starts with a `BG` code ends with `Fix:`; apply it as
  written.
```

The repository's [`docs/ai`](https://github.com/bonguynvan/bo-grid/tree/main/docs/ai) folder has the same guidance as a [Cursor rule](https://github.com/bonguynvan/bo-grid/blob/main/docs/ai/cursor-rules.mdc) (save it as `.cursor/rules/bo-grid.mdc`) and a longer [CLAUDE.md section](https://github.com/bonguynvan/bo-grid/blob/main/docs/ai/claude-md-snippet.md).

## Examples are complete files

Every example on this site is a whole Svelte file, and its **Code** tab shows exactly the file that runs. The small examples in these pages import from `bo-grid` just as your app does, with no site-only helpers, so an agent can copy one, run it, and change it. The [Examples](../../examples/) gallery has larger, realistic screens (a price board, an order book, a blotter), each on its own page with its source.

The code blocks in these pages, and the `@example` of every prop and API method, are type-checked against the library on every change, in strict TypeScript. An excerpt is checked the way you would read it: with the imports it leaves out and the app around it (your rows, your socket) filled in with real types. So what you copy compiles, and it shows the habits strict TypeScript asks for: row values are `unknown` until you convert them (`Number(row.last)`), and a helper such as `createAlerts<Quote, string>` is told your row type.

## Prompts that work

Point the agent at the docs first, and name the feature's page when you know it:

- "Read https://bonguynvan.github.io/bo-grid/llms.txt. Then build a watchlist with bo-grid: symbol, price with `flash: 'auto'`, change % and volume, fed from the WebSocket in `src/lib/feed.ts`."
- "Using https://bonguynvan.github.io/bo-grid/docs/grouping.md, group the orders grid by account and show the summed quantity on each group row."
- "Check every prop in `OrdersGrid.svelte` against https://bonguynvan.github.io/bo-grid/api.json and fix any that don't exist."
