# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [Unreleased]

### Added

- **Error codes.** Every error bo-grid throws starts with a stable code,
  says what happened with the value it got, gives the fix and links to it:
  `BG2004: TradeTape: capacity must be a number of 1 or more, got 0. Fix:
  Pass how many trades to keep, e.g. new TradeTape(500). See
  …/docs/errors/#bg2004`. The code is also on the error as `error.code`,
  typed as the union `BoGridErrorCode` (exported with `BoGridError` from
  `bo-grid`, `bo-grid/realtime` and `bo-grid/trading`), so a test or an
  error reporter can match on it and a typo in a code is a type error. The
  error classes are unchanged, so existing `catch` blocks keep working. The
  new [Error codes](https://bonguynvan.github.io/bo-grid/docs/errors/) page
  lists all 17, and a test fails the build if the page, the type and the
  throw sites disagree. llms.txt and the AI guidance tell agents to apply
  the fix as written.
- `parseJSON` on text that is not JSON throws BG1103, a `SyntaxError` as
  before, now with the fix and link.
- **Defaults and examples in the types.** Every optional `<Grid>` prop and
  column option now states its default in an `@default` tag, and every one
  whose type is more than a plain value (a callback, an object, a union with
  one), plus every grid API method, has an `@example`, so an editor's hover
  and the `.d.ts` files in `node_modules` show both beside each declaration.
  The 18 type options that had no doc have one. `/api.json` reads the tags
  (`default`, and a new `example` field) instead of guessing defaults from
  the prose, the props tables on the docs site show each example under an
  "Example" toggle, and the Markdown pages and llms-full.txt include them.
  Generating the manifest fails when a doc, a default or an example is
  missing.
- **Every example compiles.** The Svelte, TypeScript and JavaScript code
  blocks of the docs site, README.md and docs/ai, the home page's framework
  samples, and every `@example` in the types (234 in all) are now
  type-checked against the library in CI, in strict TypeScript. The
  check found, and this release fixes, examples a reader would have copied
  into an error: 19 `<Grid>` tags without the required `height`; row values
  used as numbers without converting them (row fields are `unknown`); a
  `getRowId` returning an `unknown` symbol; `createAlerts`, `createLinger`,
  `createViewportSubscriptions` and `createTickStream` calls that could not
  infer their row type; snippets declared outside `<Grid>` (declared inside
  it, they get their types from the prop); string ids where `GridRow.id` is
  a number; a placeholder `[...]`; and a socket message read without
  `JSON.parse`.

### Changed

- `parseFraction` takes the same options as `fmtFraction`, so one options
  object serves a column's `format` and `parse` (`sub` and `separator` only
  shape the output; reading ignores them).

### Fixed

- Docs that read a theme colour as `var(--bo-grid-up)` inside a cell (the
  custom cells and row styles pages, the framework guide): that variable is
  an input, empty unless set, so under the default theme the colour was
  missing. They read the resolved `var(--bo-up)`, and the theming page says
  which to use.

## [2.10.0] — 2026-10-25

**Columns that stay put, and a keyboard that stays in the grid.** Resizing
a column now changes that column only, and every kind of row (group rows,
the sticky group header, header groups, pinned columns) lines up with the
columns in every layout. Editing keeps the keyboard in the grid, numbers
type as typed, and a sort keeps the focus on its row. Found by auditing the
grid's behaviour in real Chrome. A minor release: nothing was removed or
renamed, but some behaviours change on purpose: see Changed.

### Changed

- **Resizing a column changes that column only.** A drag on a header's
  edge (or an autosize) used to fix the dragged column and let the flex
  columns absorb the difference, so other columns moved and changed width
  under the pointer. Now every column keeps the width it has on screen,
  flex columns included, and the columns after the dragged one move along:
  the grid scrolls sideways when they outgrow it, and leaves space at the
  right when they shrink. Double-click a grip to give that column back its
  own width. A click on a grip without a drag changes nothing. Under
  `fitColumns`, the grid fits until the user sets a width. The held flex
  widths are saved with the dragged one (`persistKey`, `getState()`);
  `onColumnResize` still reports the dragged column only.
- **Number editors type as expected.** They were `<input type="number">`,
  which empties itself on a lone `-` or `.`; a blank (typed, or pasted) was
  written as 0. They are text inputs with a numeric keypad now, and a blank
  or a non-number is refused, typed, pasted or filled (a column `parse` still
  sees it first).
- **A sort keeps the focus and the range on their rows**, as the docs said;
  it cleared them. So do a filter and a collapse: a focus whose row leaves
  clears, and a focus on a group header follows that group. With a row
  `source`, whose rows reload, a new sort or filter still clears them.

### Added

- **Reset widths** in the column menu gives every column back its own width
  (the fit, under `fitColumns`). Translate it with `labels.resetWidths`.
- **F2** edits the focused cell.

### Fixed

- **Group rows line up with the columns** when the layout sets the widths
  (pinned columns, `fitColumns`, horizontal scroll, a resize): their cells
  were sized from the column definitions, so subtotals drifted from their
  columns, and a pinned column's group cell scrolled away. It now sticks.
- **Header groups span flex columns**: a band over a flex column grows with
  it in the default layout, instead of keeping the column's base width.
- **Sparklines fill their cell** and follow the column's width; they were
  always 104px, overflowing narrow columns and half-filling wide ones. Used on
  its own, `Sparkline` fills its container unless it is given a `width`.
- **Group rows with lead columns** (row selection, row numbers, detail) sat
  left of their columns, by the lead columns' width. The sticky group header
  at the top is opaque now, spans the whole row when scrolled sideways, and
  collapsing a group from it keeps that group in view.
- **Header rows stay in sync**: tabbing through header cells or filter-row
  inputs scrolled that row on its own, off its columns.
- **Right-pinned columns dock at the right edge** when the columns leave
  room, instead of trailing the last column.
- **Header-group bands stop at the pin boundary** and stick with pinned
  columns, instead of sliding over them when scrolled.
- **Flex widths no longer jump** when the layout switches to computed widths
  (a column is pinned, column virtualization): both share the room as CSS
  flex does.
- **A drop across the pin boundary is ignored**: it rewrote the saved column
  order without showing it.
- The detail panel and the "No rows" message stay in view when the grid
  scrolls sideways; a new page size keeps the first row on screen in view.
- **The keyboard stays in the grid through an edit.** Enter (save) and
  Escape (cancel) in an editor left the focus on the page, so the arrow keys
  stopped working; Tab threw it out of the grid. Each now gives the keyboard
  back to the grid, and Tab saves and moves to the next cell (Shift+Tab: the
  previous one), on to the next row at the end of one. Picking an option
  with the pointer in a dropdown editor saves at once (arrow keys wait for
  Enter).
- **A live update no longer overwrites an open editor**: the editor starts
  from the value as it was when it opened.
- **Group headers work from the keyboard**: the focus on a group header is
  announced and marked, Enter, Space and the arrows toggle it, and a click on
  one puts the focus there. Its toggle button left the tab order.
- **The last column clears the scrollbar** at full sideways scroll; its last
  10px stayed under the gutter (or under a right-pinned column).
- **Menus stay inside the window** (row, column and filter menus).
- **What the grid hands out can be cloned**: request params for a row source
  and the `onSortChange` / `onFilterChange` payloads are plain copies, not
  state proxies (which a worker or IndexedDB cannot take).
- **The filter row and the filter menu agree**: one filter per column (the
  last one set wins), and the funnel shows either. The filter row's
  placeholder is `labels.filterPlaceholder`.

## [2.9.0] — 2026-10-24

**New docs, and a search box that works with a server.** The docs are now
a site with a page per feature, each with a live example, its code and a
props table generated from the types, and every page is also published as
Markdown for AI coding agents. The quick-filter box now reaches a server
source. A minor release: nothing was removed or renamed.

### Added

- **Docs site** at [bonguynvan.github.io/bo-grid](https://bonguynvan.github.io/bo-grid/):
  47 topic pages (columns, rows, filtering, editing, grouping, realtime,
  trading, large data, styling, export) with live examples, a props
  reference generated from the types, search, and every example on a page
  of its own.
- **Docs for coding agents:** a `.md` twin of every page and a Copy page
  button; `llms.txt` and `llms-full.txt` generated from the pages;
  `/api.json`, every prop, column option and API method with its type,
  default and docs; an "AI coding agents" page; and current editor rules in
  `docs/ai`.
- **TSDoc on every `<Grid>` prop and column option**, including `rows`,
  `columns`, `cellTypes`, `filter`, `groupBy`, `aggregations`,
  `persistKey`, `header` and `maxWidth`, which had none. Editors and agents
  read it from the installed types.
- **`labels.quickFilterPlaceholder`**: the quick-filter box's placeholder,
  until now a fixed "Search…", can be translated.

### Fixed

- **The quick-filter box works with a server source.** With `source`, the
  text typed in the built-in search box (`quickFilter`) never reached
  `getRows`, so it filtered nothing. `RowSourceParams` now carries it as
  `quickFilter`, next to `filter` (the `filter` prop's text): a row should
  match both. `createArraySource` applies both. A source that builds its
  query from `filter` alone should read `quickFilter` too.

## [2.8.0] — 2026-10-24

**A busy feed off the main thread.** `serveFeed` and `connectFeed` read a
feed in a worker and hand the grid one batch a frame: at 30,000 messages a
second that took 3–6% of the main thread in headless Chrome, against
14–25% reading the socket on it, with the same latency. The price board
demo shows its frame time live. A minor release: nothing was removed or
renamed.

### Added

- **`serveFeed` and `connectFeed` (`bo-grid/realtime`): a busy feed read in
  a worker.** In the worker, the socket handler pushes into `serveFeed`,
  which coalesces per key; on the page, `connectFeed(worker, { apply })`
  takes one batch a frame over a `MessagePort` of its own and hands it to
  `apply` (`api.patchRows`). Every socket message is a task on the thread
  that receives it: at 30,000 messages a second that took 14–25% of the
  main thread in headless Chrome, 40–70% at 100,000, mostly the dispatch of
  each message, against 3–6% read in a worker, with the same latency
  (`pnpm bench:feed`, which measures the shipped helpers). The worker may
  set up its feed after an `await`; a patch that cannot be cloned is dropped
  and reported, and a worker that stops answering is asked again.

- **Price board demo: a live frame-cost readout.** With the feed running,
  the controls show the frame time, from the frame's start to a task after
  its paint (median and p95 over the last 120 frames, frames over the
  display's frame interval, and a bar per recent frame), measured the way
  the CI perf gate's live workloads measure it, so a visitor sees a figure
  comparable to what the gate checks.

## [2.7.0] — 2026-10-24

**React, Vue, and alerts that stay lit.** The grid ships as a React and a
Vue component (`bo-grid/react`, `bo-grid/vue`): typed props, the grid's
API on a ref, server rendering safe. `createAlerts` lights a row when a
rule turns true and keeps it lit until acknowledged. Fixes a bundler being
free to drop `import 'bo-grid/element'`. A minor release: nothing was
removed or renamed.

### Added

- **`createAlerts` (`bo-grid/realtime`): alerts that stay lit until
  acknowledged.** Named rules on a row (a price at or past a level) fire when
  they turn true and stay lit, even if the price comes back, until
  acknowledged; a rule still holding then waits until it stops before it can
  fire again. `check(rows)` returns the alerts that just fired (`complete:
  true` also forgets rows that left); `isLit(row)` feeds a `rowClass`;
  `ack(key)`, `ackAll()`, and `active()` newest first for a panel;
  `onChange` restyles the rows when the lit alerts change.
- **FX & crypto demo:** the crypto watchlist lights a row when its price
  reaches its alert level; A acknowledges the focused row.
- **`bo-grid/react` and `bo-grid/vue`: the grid as a React or Vue
  component.** React: every `<Grid>` prop as a prop, the grid's API on its
  `ref` (`<BoGrid ref={grid} rows={rows} columns={columns} />`). Vue: props as
  attributes (`:row-height` too), callbacks as events (`@cell-edit`), the API
  on the template ref's `api`. Both load the `<bo-grid>` element on the
  client, so server rendering (Next.js, Nuxt) is safe and hydrates
  cleanly; the React bundle carries `'use client'`. In Vue a bare boolean
  attribute is true and an event bound twice calls both listeners; the grid
  sees a new `rows` array, so replace it or patch through the API. About
  0.6 KB (React) and 0.9 KB (Vue) on top of the element; React and Vue are
  optional peers.

### Fixed

- **`import 'bo-grid/element'` could be dropped by a production bundler.**
  The package declared no side effects at all, so a bundler was free to
  leave out an import used only to register `<bo-grid>`. The element's files
  are now declared as having side effects.

## [2.6.0] — 2026-10-24

**Keys on the row you are looking at.** `hotkeys` binds keys for your app
on the focused row (B or S for a ticket, Delete to cancel). The focus, the
selection and an open editor now stay on their rows as a live list moves,
which fixes an edit being written to the wrong row when rows arrived above
it while it was open. A minor release: nothing was removed or renamed.

### Added

- **`hotkeys`: keys for your app, on the focused row.** `{ b: ({ row }) =>
  buy(row), 'Shift+C': cancelAll, 'Mod+K': openSearch }` runs before the
  grid's own keys, with the focused row and column; return `false` to leave
  a key to the grid. A binding is a key after any of `Shift+`, `Alt+`,
  `Ctrl+`, `Meta+` and `Mod+` (Ctrl or ⌘); a symbol is bound by the
  character it types. Not while a cell is edited or an input has the key,
  and a key a binding took runs once when held. The Orders & positions demo
  cancels the focused order with C.

### Changed

- **The focus, the selection and an open editor stay on their rows.** When
  rows are added, removed or reordered (a new `rows` array, an order
  arriving above the focused one), they move with their rows instead of
  staying at the same place while another row slides under them. A focused
  row that leaves clears the selection, as `liveSort` already did. In-memory
  rows; a server `source` places its own rows.

### Fixed

- **An edit open while rows arrived above it was written to the wrong row.**
  The editor committed to whatever row was at its place by then. An edit is
  now written to the row it was opened on, the editor moves with that row
  (keeping what was typed, also where the browser blurs a removed input),
  and an edit whose row has left closes unwritten. A late commit from an
  editor that had already closed or moved on is dropped.

## [2.5.0] — 2026-10-24

**Markets beyond the exchange board.** FX conventions (pip sizes, the quote
as a dealing screen shows it, the FX week and its trading centres), crypto
(a market that never closes, prices to significant digits), basis points
and fractional prices (32nds, in cash and futures styles, read back for
editing), and an order book kept from a depth feed (`createOrderBook`),
grouped into price buckets and shown stacked or side by side. Fixes
`roundToTick` on ticks such as 0.25, which `DepthLadder` steps its prices
with, and the `volume` format near a unit boundary. A minor release:
nothing was removed or renamed.

### Added

- **FX conventions (`bo-grid/trading`).** `fxPipSize` gives a pair's pip
  (0.01 for yen pairs, 0.0001 otherwise, however the pair is written and with
  a broker's suffix); a pip size stands in for a pair wherever one is taken.
  `fxQuoteParts` and `fxQuoteHtml` cut a quote the way a dealing screen shows
  it: the big figure small, the pips large, the pipette raised.
  `pipsBetween` measures a spread or a move in pips. `fxMarketOpen` reads the
  FX week (Sunday 17:00 to Friday 17:00, New York time) and `fxCentresOpen`
  names which of Sydney, Tokyo, London and New York are in business hours,
  summer time included.
- **Crypto conventions (`bo-grid/trading`).** `CRYPTO_SCHEDULE` is a
  session schedule that never closes, and `fmtSigPrice` shows a price to
  significant digits, for a watchlist that runs from 63,250 down to
  0.0000012 where no fixed decimal count suits every row.
- **FX & crypto demo**: a dealing-screen FX board with live spreads in pips
  and the open centres, beside a crypto watchlist on significant digits.
- **Basis points and fractional prices (`bo-grid/trading`).** `fmtBps`
  shows a fraction in basis points (`'12.5 bp'`, signed on request, for
  spreads and yield moves). `fmtFraction` writes a price as a whole number
  and parts, the way Treasuries are quoted (`'99-16+'`, with halves,
  quarters or eighths of a 32nd, or another denominator such as eighths for
  grains). `style: 'futures'` writes it as futures screens do (`"99'165"`).
  `parseFraction` reads either back, for a column's `parse`.
- **`createOrderBook` (`bo-grid/realtime`): an order book from a depth
  feed.** A snapshot, then the levels that change (size 0 removes one), as
  numbers or numeric strings. Updates older than the last sequence number
  are dropped, and with each update's first number (`from`) a missed one is
  reported as a gap. It reads back the best levels a side, merged into price
  buckets on request (0.1, 1, 10: bids rounded down, asks up), as stacked
  rows (asks above bids) or side-by-side rows, each with its depth from the
  spread. A level keeps its row id while it stays in the book, so a size
  column's `flash: 'auto'` flashes the levels that changed. On a
  5,000-level book a 40-level update takes about 5 µs near the spread.
- **Order book demo** rebuilt on it: a live depth feed, grouping, and
  stacked or side-by-side layouts.

### Fixed

- **`roundToTick` with a tick such as 0.25, 0.125 or 2.5.** It kept only as
  many decimals as the tick's size implied, so 5000.75 on a 0.25 tick came
  back as 5000.8. It now keeps every decimal the tick has. `DepthLadder`
  steps its prices with it, so a ladder on a quarter tick showed the same
  wrong prices.
- **`volume` columns near a unit boundary.** A volume that rounds up to the
  next unit now shows in it: 999,999 reads `1.00M`, not `1000.0K`. Negative
  volumes (a net flow) are abbreviated too (`-2.50M`, not `-2500000`), and
  volumes from a trillion up read `T` instead of thousands of `B`.

## [2.4.0] — 2026-10-24

**Built for the live desk.** A sorted, filtered view stays in order under a
live feed (`liveSort`), adds and removes follow a diff instead of a rebuild,
footer totals run by delta, and a 100,000-row blotter stays cheap. New for
trading screens: rows that go stale, a flash for new rows, a pause while the
pointer is over the rows, per-column update rates (`updateMs`), a depth
ladder (`bo-grid/ladder`), and blotter helpers for rows that linger and
positions from fills. A long session no longer keeps memory for every row it
drew. A minor release: nothing was removed or renamed.

### Added

- **`bo-grid/ladder`: `DepthLadder`, a price ladder (depth of market).** One
  row per price on the tick grid (a fixed tick, or a tick table such as
  HOSE's), with bid and ask sizes, their depth from the best price outward as
  bars, and your working orders beside each side. It follows the middle of
  the spread or the last trade, recentring only when the market leaves the
  middle half, and never moves under the pointer or the focus. The wheel
  pages through prices; Space follows again. A click or B / S / Delete asks to
  buy, sell or cancel at the row's price through `onAction`: order entry stays
  the app's. A separate entry, ~4 KB gzip on top of the grid.
- **`api.getFocusedCell()`**: the focused cell's row and column, for hotkeys
  that act on the row the user is on.
- **`createLinger` (`bo-grid/realtime`): rows that leave a list stay a
  moment.** It returns your rows plus the ones that left within `ms`, each
  right after the row it followed, and says which are on their way out, so a
  filled or cancelled order is seen going instead of vanishing.
- **`createPositions` and `unrealizedPnl` (`bo-grid/trading`): positions
  from fills, on average cost.** Each fill moves its symbol's quantity,
  average price and realized P&L (a fill through flat opens the rest on the
  other side; fees come off realized); `unrealizedPnl` marks the open
  position at a price, for a `value` column whose footer total follows the
  feed.
- **Orders & positions demo**: working orders with status chips, done orders
  lingering before they go, and positions with live P&L from the fills.
- **`liveSort`: the sort and filters follow a live feed.** When `api.patchRows`
  changes a field the grid sorts or filters by, the rows it changed are merged
  back into place at most every `liveSort` ms (`true`: 500). Only those rows
  are sorted: on 100,000 rows with 500 changed that takes ~5 ms, against ~21 ms
  for the full re-sort `api.refresh()` does, so a "top movers" board no longer
  needs a refresh timer. Rows that stop matching a filter leave, rows that
  start matching join, the focused cell stays on its row, and nothing moves
  while a cell is being edited.
- **`staleAfter`: rows whose feed went quiet dim.** A row that has had no
  news for this many ms fades (`--bo-stale-opacity`, 0.5) and comes back the
  moment it ticks. News is a `patchRows` that changed the row, or a new
  object for it in `rows`: a row that arrives, or a copy from an immutable
  update.
- **`flashNewRows`: a row that arrives flashes once** (a new order, a new
  fill), every cell, for 600 ms or the given ms. A copy of a row already
  there, the rows an empty grid gets (a load or a reload) and a wholesale
  replacement do not flash.
- **`pauseOnHover` (on by default): `liveSort` waits while a mouse or pen is
  over the rows**, so a row never moves just as it is clicked. The pause ends
  when the pointer leaves, the window loses focus or the tab is hidden; set
  `pauseOnHover={false}` for a wall screen nobody points at.
- **`updateMs`: a column repaints at most every so many ms.** Under
  `api.patchRows` each tick is still written into the row at once (sort,
  filters, totals and other columns see it), but the cell shows the latest
  value on its next beat, and the first change after a quiet spell at once.
  For values that change on every trade and are read at a glance: on the Price
  board, total volume and foreign buy and sell at 250 ms took 4–6% off the
  frame at 10,000 and 30,000 events/s, and the board demo now uses it.

### Performance

- **Prices and dates format ~40× faster per cell.** `fmtPrice`, `fmtDate`,
  `fmtCurrency`, relative times and `fmtTradingPrice` (bo-grid/trading)
  created a new `Intl` formatter on every call, through `toLocaleString`
  (~50 µs a price, ~110 µs a date); they now keep one per locale and option
  set (~1–2 µs). The output is the same. On a 100,000-row blotter where
  arriving orders shift every visible row, date formatting alone had cost
  ~5 ms a frame.
- **The row-id index rebuilds about 3× faster** when `rows` changes (a plain
  loop, `getRowId` read once).
- **Footer totals and data-bar ranges no longer rescan every row on every
  tick.** They are running totals: `patchRows` takes each changed row's values
  out before the write and puts them back after, and min and max keep a count
  of the rows that hold them, so a rescan happens only when the last of those
  moves inward. On a 100,000-row blotter with a totals row and a data bar, a
  frame of 200 fills went from ~6 ms to ~1 ms. Rows edited any other way
  (`$state` rows, `onCellEdit`), and computed columns that read reactive
  state, still rescan as before. A new view (new rows, sort, filter, a live
  re-sort) rescans once; sums use compensated addition and are rescanned
  after 50,000 updates, so rounding cannot build up. A computed column must
  depend only on its own row: one that reads other rows or the clock gets a
  fresh total on the next new view or `api.refresh()`.

- **Adding and removing rows no longer rebuilds everything.** When the app
  assigns a new `rows` array (`rows = [...rows, order]`,
  `rows = rows.filter(...)`), a one-pass diff finds the rows added and removed;
  the row index is updated in place instead of rebuilt and, with `liveSort`,
  the sorted view merges them in (with any queued live changes) and the
  totals carry over by the rows that left and joined, instead of a full
  re-sort and rescan. A reordered array, or more than an eighth of the rows
  changing, still rebuilds; so does a row repeated in the array. The diff
  compares row objects, not ids. On the 100,000-row Live blotter, a frame of
  200 fills with 5 orders in and 5 out went from ~32 ms to ~17 ms (from
  ~84 ms before this release).

### Fixed

- **Dragging a header moves the column you see when other columns are hidden
  or pinned.** The drop used positions among the columns on screen against an
  order that covers every column, so the wrong column moved: with one column
  hidden, dragging B onto C did nothing, and `onColumnReorder` reported an
  order the user never made.
- **`flashMotion: 'auto'` holds a burst of new rows.** A flash that lights
  whole rows (`flashNewRows`, `api.flashCells`) counted as one flash however
  many cells it lit, so a burst of new orders never reached the hold level and
  every cell kept fading. Each cell now counts, as each cell's own tick does.
  On the Live blotter (5 orders in per frame) the flashing cells switch to
  held tints within a few frames; a fading cell costs about 0.02 ms of every
  frame it fades through, a held one almost nothing.
- **A long session no longer keeps memory for every row it drew.** The
  records behind `patchRows` and `flashCells` kept a signal for each row and
  cell ever drawn, even after the row scrolled away or left `rows`: a blotter
  taking orders grew by about 0.5 KB per order, and scrolling once through
  100,000 rows kept about 37 MB. Once a few thousand different rows have been
  drawn, the records now start afresh (flashes still playing carry over), so
  that memory is returned.

## [2.3.0] — 2026-10-23

**A cheaper busy board.** `flashMotion: 'auto'` fades while the board is quiet
and holds once it gets busy, data bars repaint without layout, `vnBands` no
longer drops a tick on exact bands, and VN30 index futures get their own bands.
A minor release: nothing was removed or renamed, and `'fade'` stays the
default.

### Added

- **`flashMotion: 'auto'`.** Each flash decides as it starts: it fades while
  few cells flash at once and holds (as with `'hold'`) once more than ~120
  overlap, going back to fading below ~80. A quiet board keeps the fade; a busy
  one costs about what `'hold'` does. `'fade'` stays the default.
- **VN30 index futures in `bo-grid/trading`:** `vnFuturesBands(ref)` (±7% on a
  0.1-point step, ceiling rounded down and floor up), `VN_FUTURES_TICK` and
  `VN_FUTURES_BAND`.

### Fixed

- **`vnBands` no longer drops a tick on some exact bands.** A band that lands
  exactly on a tick could come out of the multiplication a hair below it
  (12,000 × 1.15 = 13,799.999…), and the ceiling then rounded down a whole tick:
  UPCOM reference 12,000 gave a ceiling of 13,700 instead of 13,800. 63
  reference prices between 1,000 and 300,000 VND were affected across the three
  exchanges. `roundToTick` now snaps a price within float noise of a whole tick
  before rounding.

### Performance

- **Data bars repaint instead of re-laying out.** A `dataBar` is drawn full
  width and scaled to its value (`transform: scaleX`), so a changing value only
  repaints the bar. ~15% less main-thread work in a bar-heavy benchmark. The
  bars look the same.

## [2.2.2] — 2026-10-20

### Fixed

- **The header keeps its height when the grid has a CSS height and the rows
  overflow.** With `height="100%"` (or any CSS length) and more rows than fit,
  the header row shrank to a few pixels and the rows drew over it; the spanning
  group row and the filter row did the same. The viewport's flex basis is its
  full content height, and the header rows clip their content, which let them
  shrink with it. They no longer shrink. A pixel `height` was not affected. The
  bug dates from 2.0.0.

## [2.2.1] — 2026-10-07

### Fixed

- **Group labels sit over their own columns when ungrouped columns come
  first.** The spanning header row gives each ungrouped column a blank slot
  of its width. Those slots carried the same scoped class as the grid's
  "No rows" overlay, which is absolutely positioned. The slots dropped out of
  the row, and every group label moved left by the width of the leading
  ungrouped columns. The slots now have their own class. The bug dates from
  column groups (0.1.0). Grids that group every column were not affected.

### Tests

- A new test scans every component for this kind of collision: a CSS rule
  whose class sits on two kinds of element, with nothing in the rule to tell
  them apart. Run on the code before each fix, it finds this bug and the
  column-hover header bug fixed just before 2.2.0.

## [2.2.0] — 2026-10-05

**Built for the busy board.** Flashes that cost a fraction of a fade
(`flashMotion: 'hold'`), on-demand flashes (`api.flashCells`), the size of a
move (`showChange`), streaming only the symbols on screen
(`onViewportChange`), users pinning the rows they watch (`rowPinning`), finding
a symbol with Ctrl/⌘+F (`findBar`), columns that scale with the grid
(`fitColumns`) and widen as their values grow (`autoWidth`), plus row numbers
and column hover. The grid's ARIA structure and colours now pass axe-core, and
component cells update in place.

### Upgrading from 2.1

No API was removed. Behaviour that changed:

- `role="grid"`, its focus, `aria-*` attributes and keys moved from the
  `.bo-grid` box to an inner element. Query `[role="grid"]` inside `.bo-grid`
  in tests that read those off the box.
- `bo-grid/trading`'s default tone colours (`defaultToneColors`) are the new
  dark palette, brighter than before. Pass `lightToneColors` on a light theme.
- Under `api.patchRows`, `component` cells and the `cell` snippet receive a
  fresh view of the row on each patch instead of being rebuilt. Read `row`
  reactively, not once at mount.
- Flex columns now honour `minWidth` / `maxWidth` in fit-to-width mode.
- A column's `align` now moves its cells and footer as well as its header.
  Drop an `align` you had set only for the header if the cells should stay
  where they were.

### Added

- **`autoWidth` column option** — the column widens when a value on screen
  no longer fits, such as a price gaining a digit or a running volume total.
  Without it, those values end in "…".
  - It is checked at most every 500 ms. The values are measured with a canvas,
    with no DOM reads, so the check never forces a layout.
  - It only grows, so values flickering wider and narrower don't make it jump.
    `maxWidth` caps it.
  - A width the user dragged or autosized takes over.
  - The Price board's "Tổng KL" column uses it. Live board A/B at 30,000
    events/s: 12.61 vs 12.46 ms per frame.

- **`fitColumns`** — every column scales with the grid, in proportion to its
  `width`. Before, only `flex` columns took up a change in width: a grid
  whose one flex column came first widened that column alone, while the
  rest slid right.
  - Each column's share is bounded by `minWidth` / `maxWidth`. Without a
    `minWidth`, the floor is 64 px, or the column's own width if smaller.
  - The grid scrolls sideways only once the floors no longer fit.
  - Widths are computed in whole pixels that add up to the viewport, so the
    header, header groups, body and footer line up in every mode, pinned
    columns included.
  - Dragging a column edge still follows the pointer. The columns before it
    keep their widths, and the ones after it share the difference.
  - The Sheet demo turns it on.

- **`findBar`** — Ctrl/⌘+F in the grid opens a find bar.
  - It matches the cells' displayed (formatted) text, ignoring case, and shows
    "3 of 12".
  - Enter / Shift+Enter step through the matches, focusing and scrolling to
    each. Escape closes the bar and returns focus to the grid.
  - `api.openFind(query?)` opens it from code.
  - Matches are scanned once per query and view, never per tick: ~15 ms
    across the Price board's 1,000 symbols × 24 columns. The scan covers
    in-memory rows, up to 10,000 matches.
  - Off by default, as it takes Ctrl+F from the browser while the grid has
    focus. The Price board demo turns it on.

- **`rowPinning`** — users pin rows above the scroll from the row menu
  (right-click: "Pin to top", then "Unpin"), for the symbols they watch on a
  long board.
  - A pinned row also stays in its place in the body, and keeps updating and
    flashing, `api.patchRows` included.
  - Pins are remembered with `persistKey` and carried by `getState()` /
    `applyState()` (an optional `pinnedRows` field).
  - `onRowPinChange(ids)` reports changes, and `api.pinRow(id, pinned?)` /
    `api.getPinnedRowIds()` do the same from code.
  - The Price board demo turns it on.

- **`rowNumbers`** — a leading row-number column, as in a spreadsheet.
  - Data rows are numbered 1, 2, 3… in view order, so the numbers follow sort
    and filter. Group headers get none.
  - The column is sized to the widest number and sticky when the grid scrolls
    sideways, alongside the expand and checkbox columns. It sits first, and
    those shift right.
  - Its cells are `role="rowheader"`, so screen readers announce the number
    with each row. The header is named by the new `rowNumber` label ("Row").
  - The Sheet demo turns it on.

- **`columnHover`** — highlights the column under the pointer, body and
  header, which helps on a wide board.
  - It is one overlay for the whole column, not a class on each of its cells,
    measured off the hovered cell. It fits flex, fixed, spanned and pinned
    columns: a pinned column's wash covers its pinned cells, and horizontal
    scrolling drops it.
  - Mouse and pen only.
  - The colour is the new theme token `colHover`, which defaults to the text
    colour at 6%.
  - The Price board demo turns it on.
  - Nothing runs per frame while the pointer is away.

- **`api.flashCells({ rows?, columns?, dir?, ms? })`** — flash cells on demand
  (a block trade, an order filling, an alert) with the tick animation, whether
  or not their values changed. Every rendered row and every column by default;
  `dir` tints like a rise or fall, `ms` overrides each column's `flashMs`.
  Only rows on screen flash; returns how many rows it flashed. A tick during
  the flash takes over with its own direction, a repeat call replays it.
  Value cells flash, including `text` columns, which now also show their own
  `flash` setting; cells that draw their own content do not. The Price board
  demo flashes the symbol of each block trade. No measurable cost on the live
  board when unused (traced A/B against the previous build, with and without
  motion).

- **`showChange` column option** — how far a value moved, not just which way:
  `▲0.15` beside the price in the up colour (`▼` down), held, then faded over a
  second, in the column's own format (`{ format, ms }` to customise). The delta
  gives way first in a narrow column, so the value is never cut for it, and it
  fades by animating text colour, so it adds no compositor layers. On the Price
  board, one such column measured the same as none; it is meant for one or two
  key columns, since all 13 flashing columns at 30,000 events/s more than
  doubled the main thread's work. The tick tracker now records each change's
  `delta`.

- **`onViewportChange` and `createViewportSubscriptions`** — stream only the
  symbols on screen. The grid reports the data rows in view (plus the small
  rendered buffer) whenever that set changes, never for a value-only tick;
  the `bo-grid/realtime` helper turns it into subscribe / unsubscribe calls,
  subscribing the first view at once and settling later changes for `delay` ms
  (default 150) so a fast scroll is one change. About a microsecond per
  update. The Price board demo shows how many of its symbols stream.

### Changed

- **`role="grid"` moved from the `.bo-grid` box to an inner element.**
  - The grid's focus, `aria-*` attributes and keyboard handling now live on
    `.bo-grid > [role="grid"]`, which holds only the header, filter row and
    rows.
  - The toolbar, aggregation bar, pager, menus and panels stay in the
    `.bo-grid` box beside it.
  - Styling hooks on `.bo-grid` are unchanged. A test that read `role`,
    `aria-label` or `aria-activedescendant` off `.bo-grid` itself should query
    `[role="grid"]` inside it.

- **The demo site and API page have a favicon**: the bo-grid mark (a grid with
  one flashing cell) on an ink tile, as SVG with a 32 px PNG fallback and an
  apple-touch-icon. Site-only; nothing is added to the npm package.

- **Every example on the demo site has a Preview / Code switch.** Code shows
  the example's own Svelte source, highlighted, with Copy and a GitHub link.
  The source loads on first open, so the page stays light, and the preview
  stays mounted (hidden), so a live board keeps running.

- **The README and demo site describe bo-grid on its own terms**, without
  comparisons to other grids; the full feature guide moved to
  [docs/guide.md](./docs/guide.md).

### Performance

- **`component` cells and the `cell` snippet update in place under
  `api.patchRows`.** They used to be rebuilt on every patch of their row.
  Each patch now hands them a fresh view of the row: a forwarding proxy, so
  no copy, with the same fields and a new identity. Their markup and
  `$derived` values re-run while their DOM, focus and local state survive.
  Price board with one component column, 30,000 events/s, motion allowed:
  ~18.9 → ~14.8 ms of main-thread work per frame (script 5.3 → 3.7 ms), and
  dropped frames in 3 s fell from ~20 to ~7. A component that read `row`
  once at mount should read it reactively.

- **`flashMotion: 'hold'` — flashes for busy boards at 3–4× less
  main-thread work.** The default `'fade'` is a CSS animation, restyled and
  repainted on every frame it runs; on a busy feed most visible cells are
  always mid-fade. A held flash is a static tint for the flash window. It is
  restyled and repainted when it starts and when the grid's clock drops it,
  and a repeat tick during the hold writes nothing. Price board, motion
  allowed, main thread per frame: ~30 → ~9 ms at 10,000 events/s and ~40 →
  ~12 ms at 30,000, with no dropped frames (within ~1 ms of no flash).
  Legacy `flash: true` keeps its fade, and reduced motion still shows no
  flash. The Price board demo holds by default and has a Flash switch.

### Fixed

- **A column's `align` sets its cells and footer, not just its header.**
  Cells followed the type alone, so a `custom` or `text` column with
  `align: 'right'` had a right-aligned title over left-aligned values (the VN
  board demo showed it). Header, cells, footer and `printTable` now agree:
  `align` when set, otherwise right for number types and left for the rest.
  It moves the side only. A text column set right keeps its text font.

- **Flex columns keep their `minWidth` and `maxWidth` in fit-to-width
  mode.** They were laid out with `min-width: 0` and no maximum, so a flex
  column could squeeze below its `minWidth` when other flex columns had more
  weight.

- **`bo-grid/trading`'s tone colours meet WCAG AA.** The single default
  palette sat between dark and light, failing on both: the ceiling tone was
  3.85:1 on dark themes, and yellow and cyan were near-unreadable on white.
  - It is now two palettes, `darkToneColors` and `lightToneColors`, each at
    4.5:1 or better on every surface of the grid's presets for its side.
  - `defaultToneColors` (what `toneColor` falls back to) is the dark one,
    matching the grid's default theme, so the defaults are brighter than
    before. Pass `lightToneColors` on a light theme.
  - The VN board demo follows the page theme.

- **Badges meet WCAG AA in every preset.** A badge's text was its tone
  colour on a pill tinted with the same tone, which went as low as 3.4:1
  (amber on the light preset).
  - The text is now the tone mixed 60 / 40 with the theme's text colour. That
    makes it darker on light themes and lighter on dark ones, while keeping
    its hue: 4.9:1 or better everywhere, checked per preset in `theme.test.ts`.
  - axe on the demo, both page themes: no colour-contrast violations left.

- **The focused cell scrolls into view sideways too.** Arrow keys, Home/End
  and the API's `focusCell` only scrolled vertically, so focus could move to a
  column off screen in a horizontally scrolling grid. The column is now
  brought clear of the pinned columns on either side.

- **Pinned rows sit above the body instead of on top of it.** The shared row
  rule positioned them absolutely, so the pinned area was 0 px tall: the first
  data row hid under the pinned rows, body text showed through their
  translucent background, and several pinned rows would overlap one another.
  They now stack in flow and the body starts below them; virtualization,
  keep-in-view and sticky group headers count the pinned area.

- **Pinned rows repaint under `api.patchRows`.** Their cells did not follow
  the per-row and per-field versions that patched rows repaint by.

- **The grid's ARIA structure passes axe-core.** Across every grid in the
  demo, 34 `aria-required-children`, 9 `aria-conditional-attr` and 1
  `aria-hidden-focus` violations went to none.
  - Every control in a row now sits in a `gridcell`: the expand and checkbox
    columns, the filter row's inputs, the footer's totals, and a group row's
    toggle and subtotals.
  - A grid with tree data is a `treegrid`, where `aria-level` and
    `aria-expanded` belong.
  - The sticky group header copied over the scroll keeps its toggle out of
    the tab order.

- **Space and Enter typed in the quick filter no longer tick or edit the
  focused row.** The toolbar was inside the element that handles the grid's
  keys, so its keystrokes reached the grid's shortcuts.

- **Group subtotals meet 4.5:1 contrast.** They had used the dim text colour
  (4.2:1 on the group row in the TradeCanvas theme).

- **Benchmarks of the live board were measured without flash animation.**
  Headless Chrome inherits the operating system's reduced-motion setting,
  and under it the grid plays no flash. BENCHMARKS.md's live-frame figures
  and its "flash style makes no difference" finding came from such runs.
  The section is re-measured with motion allowed and says how to check.

- **Flex columns no longer overflow in fixed-width mode.** With pinned
  columns, column virtualization or too little room, a flex column without a
  `width` started at a 160 px default and could only grow, so a narrow grid
  scrolled sideways for nothing (a 300 px watchlist with a pinned symbol
  column overflowed by 46 px). It now starts at its `minWidth` (64 without
  one) and grows to fill; the switch to horizontal scrolling uses the same
  base, so crossing it no longer makes columns jump. A grid whose columns
  truly do not fit still scrolls by exactly the missing width.

- **Column headers have an accessible name and a valid role.** Headers were
  `<button role="columnheader">` — a role a button may not take — and took
  their name from everything inside them, empty when the header text was.
  They are now focusable `role="columnheader"` elements named by the header
  text (the column key when empty), sorting on Enter or Space; the expand
  column's header is named by the new `detailColumn` label. axe-core: from
  199 `aria-allowed-role` and 1 `empty-table-header` violations on the demo's
  headers to none.

- **Enter / Space on a header only sorts**: the grid's own Enter / Space
  (edit the focused cell, tick the focused row) no longer runs for a key
  pressed on a header.

## [2.1.0] — 2026-10-03

### Added

- **`tradecanvasTheme` / `tradecanvasLightTheme` presets** (`themePresets`
  keys `tradecanvas` and `tradecanvas-light`): the palette TradeCanvas charts and
  TradingDek share — ink panes split by hairlines, one amber accent, up/down
  kept for prices — so a grid sits flush next to a chart. Every text colour
  passes WCAG AA on every row surface (tested).
- **Live frame benchmark** on the Price board demo,
  `window.__priceBoard.benchLive()`: the real feed in real time, timed through
  paint. BENCHMARKS.md records where a busy frame goes (script, paint, layout,
  layerize) and the paint experiments measured with it.

### Performance

- **Value-only cells no longer clip twice.** A cell that renders just its
  value span drops its own clip — the span already clips and ellipsizes inside
  the cell. Layerize is ~23–34% cheaper on a busy board and main-thread work
  ~15% lower at 10,000 events/s; output is identical. Cells with structured
  content keep their clip.

### Fixed

- **Right-pinned header cells line up with their column.** `position: sticky`
  resolves the right edge differently in the header rows (which carry scroll
  slack) and, in Chrome, counts a reserved but empty scrollbar gutter as sticky
  area, so right-pinned headers sat 22 px (32 px with hidden scrollbars) left
  of their body cells. The grid now measures where the last right-pinned header
  and body cells end and corrects their offsets to the body's content edge.

### Changed

- **The demo site uses the TradeCanvas / TradingDek design system**: IBM Plex
  type, the shared dark and light tokens (dark by default, the choice
  persists), every example grid on the matching preset, and one accent for
  actions instead of up/down colours on buttons.

## [2.0.0] — 2026-10-02

**bo-grid is now grid-only, and built for busy markets.** Standalone charting is
out of scope — use [TradeCanvas](https://github.com/bonguynvan/tradecanvas) for
charts. This release adds a realtime fast path and a round of measured
performance work on price-board workloads, new grid features
(merged cells, registered cell and filter types, custom editors, localization,
layout save/restore), alignment and layout fixes, and a new demo site.

### Breaking changes — upgrading from 1.x

- **`bo-grid/charts` is gone.** Import charts from
  [TradeCanvas](https://github.com/bonguynvan/tradecanvas) instead. The grid's
  own `sparkline` column type, `Sparkline` and `drawCandles` are unchanged.
- **`CellEditEvent.value` is `unknown`** (was `string | number`), and
  `validate(value, row)` receives `unknown`: custom editors and `parse` can
  commit any value. Built-in editors still produce numbers for numeric columns,
  epoch ms for `date` and strings otherwise — narrow before use.
- **`columnFilters` / `onFilterChange` carry `Record<string, AnyFilter>`** (was
  `ColumnFilter`), so registered filter kinds fit. Retype any state you keep.
- **Date filters and the date editor use the viewer's calendar day**, matching
  what the cell displays (they used the UTC day). `before` / `after` now
  exclude the chosen day.
- **Grids whose columns don't fit now scroll horizontally** instead of clipping
  the last columns, and fixed-width (pinned / virtualized) grids stretch `flex`
  columns to fill the viewport.

### Changed

- **New demo landing page — a trading broadsheet.** Newsprint paper and ink by
  default (a "terminal" palette behind the theme toggle), Fraunces + JetBrains
  Mono, a masthead with the live HOSE session, a ticker tape, a lead story whose
  figure is a live price board fed through `api.patchRows`, real benchmark
  figures, a table of the features included in the package, and numbered
  example contents.

### Removed

- **BREAKING: the `bo-grid/charts` entry** (`LineChart`, `BarChart`,
  `DonutChart`, `StackedBarChart`, `CandlestickChart`, `DepthChart`, `Legend`
  and the SVG geometry helpers) and the Dashboard demo. The grid's own
  `sparkline` column type, `Sparkline` and `drawCandles` are unchanged.

### Fixed

- **Flashing no longer rebuilds DOM.** Every tick used to destroy and recreate
  the flashing element to replay its animation; consecutive flashes now
  alternate between two identical keyframes on the same element (~20% less
  render time per frame on a busy board, and far fewer short-lived nodes).
- **Date filters and the date editor use the viewer's calendar day.** A `date`
  cell displays its value as a local day, but the filter matched — and the
  editor wrote — the UTC day, so east or west of UTC a cell showing the 15th
  could fail "on the 15th". Filter, editor and display now agree; `before` and
  `after` exclude the chosen day, `between` includes both ends.
- **Header and body columns line up exactly.** The body's vertical scrollbar
  no longer shifts the last column's header out of line: the body and every
  header row (header, header groups, filter row) reserve the same scrollbar
  gutter natively (`scrollbar-gutter: stable`). In horizontal-scroll mode the
  header now follows the body all the way to the right edge.
- **No gap on the right of fixed-width grids.** With pinned columns or column
  virtualization, `flex` columns now grow to fill the viewport, and rows reach
  the right edge even when every column has a fixed width.
- **Columns that do not fit are no longer clipped.** When fixed widths (plus
  a 64 px minimum per flex column) exceed the viewport, the grid switches to
  horizontal scrolling instead of cutting off the last columns.

### Added

- **Realtime fast path for busy markets: `api.patchRows`** — rows can be plain
  objects; `patchRows([[id, fields], …])` writes ticks in place and repaints only
  the rendered rows it changed, skipping the reactive-proxy cost on every write
  (~2.7× cheaper writes; on the Price board a 30,000 events/s frame is ~4.5 ms
  vs ~5.3 ms through `$state` rows, production build). Repaints are per field:
  only cells whose own field changed re-render, plus row-aware ones (renderers,
  computed columns, and `format`/`cellClass`/`tooltip` functions that declare
  the `row` parameter) — ~25% less render time and ~3× fewer over-budget frames
  at 30,000 events/s than per-row repaints. Feed it straight from
  `createTickStream({ apply: (b) => api.patchRows(b) })`.
- **`api.refresh()`** — re-run filter and sort against current values. Live
  values never re-sort the view on their own (that would sort on every tick);
  a "top movers" board calls this once a second. Sorting now reads each row's
  sort value once and sorts indices (`sortRows`, exported), with a cached
  collator for strings; items of rows that keep their position are reused. A
  re-sort frame on the Price board is ~35–40% cheaper.
- **Row recycling** — with uniform row heights the grid renders a fixed-length
  window and hands the row that scrolls out to the row that scrolls in, so its
  cells update in place instead of remounting; render items are also reused
  while their row is unchanged. Scrolling the Price board is 3.5–9× cheaper per
  frame (1 row/frame: 8.9 → 1.0 ms; 10 rows/frame: 28 → 8 ms).
- **`flashColor: false`** — flash only the background, keeping the column's own
  text colour (price-limit tones on VN boards).
- **Price board demo** — a full VN-style bảng giá (3 bid/ask levels, match,
  high/low, foreign flow) with a live feed up to 30,000 events/s and a built-in
  per-frame benchmark (`apply · render · layout`).
- **Custom cell editors, `parse` and `defaultColumn`** — an `editor` component
  replaces the built-in input (and makes display widgets like `rating`
  editable); `parse(raw, row)` turns typed or pasted text into the stored value
  for the built-in editor, paste and fill; `defaultColumn` applies settings
  under every column. `CellEditEvent.value` and `validate` now carry
  `unknown`. Exports `CellEditorProps`, `DefaultColumn`.
- **Custom filter types** — `<Grid filterTypes>` registers a filter kind with
  its own `test`, optional `isActive`, and an editor `component` drawn inside
  the standard filter menu (which keeps its title, Clear/Apply and Enter);
  columns opt in with `filter: 'name'`. Custom filters are plain objects with a
  `kind`, so they flow through `columnFilters`, `onFilterChange`, `getState()`,
  `RowSource` and `createArraySource({ filterTypes })`. An unregistered kind
  filters nothing. The `columnFilters` / `onFilterChange` types widen to
  `Record<string, AnyFilter>`. New demo: a workload-band filter on Team.
- **Registered cell types** — `<Grid cellTypes>` maps a name to column
  defaults (format, compare, align, filter, width, a Svelte `component`…) and an
  `extends` built-in type for sorting, filtering and export; columns opt in
  with `cellType: 'name'`. Any column can also take a Svelte `component`
  renderer directly. Exports `resolveColumns`, `CellTypeDef`, `CellTypeProps`,
  `BuiltinCellType`.
- **Merged cells** — `spanRows` merges a column's cell down over adjacent rows
  with equal values (or per a comparator), hierarchically left to right;
  `colSpan(row)` makes a cell cover several columns. Display-only: sort,
  filter, copy and export still see every row. Works with pinned columns,
  variable row heights and virtual scrolling. New **Blotter** demo. Exports
  `buildMergePlan`, `colSpanRow`, `MergePlan`.
- **`onReady(api)` grid handle** — `scrollToRow(key, align?)`,
  `focusCell(rowKey, columnKey)`, `getSelectedRows()`, `autosizeColumns(keys?)`,
  `exportCSV(filename?)`, and `getState()` / `applyState()` for saving and
  restoring the user's layout (order, widths, hidden columns, pins, sorts,
  filters). Saved layouts are reconciled against the current columns, so
  renamed, removed and added columns never apply a width to the wrong column.
  Exports `GridApi`, `GridState`, `ScrollAlign`, `reconcileState`,
  `GRID_STATE_VERSION`.
- **`labels` and `locale` props** — every string the grid renders itself
  (column menu, filter editor, pager, columns panel, aria labels) can be
  overridden per grid; `locale` drives built-in `price` / `date` / `currency` /
  `relative` formatting, the aggregation bar and the pager. `ColumnDef.locale`
  is now available on every column type. The loading text and footer
  "Total" label are localizable too. Exports `DEFAULT_LABELS`,
  `resolveLabels` and the `GridLabels` type.

## [1.4.0] — 2026-09-24

**The trading-desk wave.** Four roadmap phases (1.1–1.4), shipped together:
derived per-cell realtime flash + a tick/trade-stream pipeline
(`bo-grid/realtime`), APAC market-convention helpers (`bo-grid/trading`),
a centred price-ladder + time & sales tape, and candlestick + depth charts
(`bo-grid/charts`). All additive — no breaking API changes from 1.0.0. Every
addition follows the existing companion-package discipline: pure functions,
own size budget, zero changes to the grid core (still ~33 KB gzip).

### Added

- **AI-assistant discoverability** — `llms.txt` / `llms-full.txt` (served
  from the demo site) give an AI coding agent the real, current API surface
  instead of it guessing from training data; ready-to-copy Cursor/Windsurf
  rule and `CLAUDE.md` snippet files (`docs/ai/`) let a *consumer* project
  install the same guidance for every session. Docs-only — no npm package
  changes.
- **Derived per-cell tick flash** (`col.flash: 'auto' | 'change'`) — the grid now
  works out the flash itself: it remembers each cell's last value and flashes
  green on a rise, red on a fall. No `flashSeq`/`flashDir` bookkeeping in app
  code; just write the new value. The flash is **per cell**, so bid can flash
  green while ask flashes red in the same row on the same frame — the legacy
  `flash: true` mode flashes every such column in a row together, in one
  direction. `'change'` gives a neutral flash on any change, numeric or not.
  `col.flashMs` sets the duration (default 300).
  Flash state is keyed on (row id, column key) rather than held in the cell
  component, because the row loop is keyed by visual index and recycles mounted
  cells across rows while scrolling — so a cell now stays quiet on first paint
  and when it scrolls back into view, and only a real value change flashes.
- **`bo-grid/realtime`** — the tick pipeline between a market-data socket and the
  grid, as a separate entry on its own size budget (~1 KB gzip; nothing is added
  to the grid core). `createTickStream` coalesces raw messages per key with no
  reactive writes, then drains at most `cap` of them per animation frame, so a
  burst can't blow the frame budget — a sustained overload shows as a climbing
  `pending` depth rather than dropped frames. `TickBuffer` is the coalescing
  buffer alone; `createRowIndex` + `applyPatches` apply a frame's patches to rows
  in O(1), skipping unchanged fields so an idle-but-chatty feed neither
  re-renders nor flashes. Framework-agnostic — the frame scheduler is injectable,
  which is also how it's unit-tested without a browser.
- **Realtime benchmarks** (`pnpm bench`) — tick coalescing, keyed row writes and
  derived-flash observation, with regression ceilings like the other hot paths.
  The **Trading desk** demo now shows applied ticks/sec and queue depth beside
  the FPS meter.
- **`bo-grid/trading`** — market-convention helpers for APAC trading screens, as
  a separate entry on its own size budget (~1 KB gzip; nothing added to the
  grid core). Pure functions only — wire them into a column via the `cell`
  snippet or a JS `render(ctx)` hook you already have, no `ColumnDef` changes.
  - **Price-limit tone** (`resolveTone`, `toneColor`): classify a value against
    `{ ref, ceiling?, floor? }` → `'ceiling' | 'floor' | 'ref' | 'up' | 'down'`,
    the ceiling/floor/reference colour convention every VN/TH terminal uses
    (not just up/down) — `ceiling`/`floor` are optional, so it works for any
    market's limit-price rule, or none. `toneColor` maps a tone to a default
    purple/cyan/yellow/green/red palette, overridable per deployment.
  - **Vietnam bands** (`vnBands`, `vnTickSize`, `vnBandPercent`, `roundToTick`):
    HOSE's price-step schedule (10 → 50 → 100 VND by price) and HOSE/HNX/UPCOM's
    daily band widths (7%/10%/15%). `vnBands` rounds the ceiling down and the
    floor up to a tradable tick — re-rounding with the tick valid *at the
    rounded price itself* when the band crosses a tier boundary (10,000 /
    50,000 VND), so the result is always both within the true regulatory limit
    and a price its own tier would actually trade at.
  - **Tick-aware price formatting** (`fmtTradingPrice`, `decimalsForTick`):
    decimals derived from the instrument's tick — 0 for whole-VND, 4 for an FX
    pip, correctly down to an 8-decimal crypto tick — where the built-in
    `price` type's fixed 2 decimals is wrong.
  - **Session state** (`sessionStateAt`, `VN_HOSE_SCHEDULE`, `sessionLabel`):
    ATO/continuous/break/ATC/closed, evaluated via `Intl` in the exchange's own
    time zone, so it's correct for a viewer anywhere — not just one in Vietnam.
  - New **VN board** demo: price-limit tone, tick-aware formatting and the live
    session badge, composed with `bo-grid/realtime` for price motion.
- **`centeredWindow`** (`bo-grid/realtime`) — the windowing math for a
  centred/scroll-locked price ladder: the `[start, end)` slice of
  `visibleCount` contiguous levels centred on a given index, clamped to
  bounds. Feed `<Grid rows>` a different slice of the same levels array each
  tick instead of scrolling to a position — centring becomes array slicing.
  A non-finite/negative `visibleCount` or a non-finite `centerIndex` returns a
  safe empty/rounded result rather than propagating `NaN` or an inverted
  window. New **Price ladder** demo (120 levels, 16 visible, manual page +
  recenter) — the demo's smoke test reads a rendered cell's value to confirm
  paging/recentring actually moves the window, not just its lock-state UI.
- **`TradeTape`** (`bo-grid/realtime`) — a capped, append-only ring buffer for
  a time & sales feed: `push` is O(1) regardless of session length (a true
  ring buffer, not shift-and-truncate), `toArray()` gives a newest-first
  snapshot. The opposite discipline from `TickBuffer`: nothing coalesces,
  every trade shows. A non-positive capacity throws at construction instead
  of silently corrupting the ring's modulo arithmetic. New **Time & sales**
  demo.
- **Realtime benchmarks** — `TradeTape.push()`/`toArray()` added, with
  regression ceilings like the other hot paths (~88M trades/sec appended,
  measuring the ring buffer's own O(1) cost).
- **`CandlestickChart`** (`bo-grid/charts`) — OHLC candlesticks from the same
  `Candle` type as the grid's `sparkline` column: body open→close, wick
  high→low, coloured by direction (`upColor`/`downColor`, default
  `--boc-up`/`--boc-down`). Pure SVG geometry (`candleGeometry`) alongside
  the chart companion's other geometry helpers.
- **`DepthChart`** (`bo-grid/charts`) — order-book depth from raw per-level
  sizes ordered nearest-to-spread first (`depthBars` computes the cumulative
  sum — don't pre-sum it yourself). Bids fill outward left, asks outward
  right, sharing **one** vertical scale across both sides so a lopsided book
  doesn't let the thin side visually fill the chart. Charts budget
  recalibrated 3 → 4 KB. Dashboard demo gets an OHLC card and a depth card.

### Fixed

- **`pnpm package` no longer leaks `public/llms.txt`/`llms-full.txt` into the
  published npm tarball.** Adding `public/` for the demo site (served via the
  root Vite config) exposed that `vite.wc.config.ts` — which builds the
  `bo-grid/element` web component straight into `dist/`, the directory that
  ships to npm — inherits Vite's default `publicDir` and copies it into
  every build's `outDir` unless told not to. Both non-demo Vite configs
  (`vite.wc.config.ts`, `vite.lib.config.ts`) now set `publicDir: false`;
  caught before the first real publish by diffing the release dry-run's file
  list, not by intent — worth knowing if you add a `public/` directory to a
  Vite project with more than one build config targeting different outputs.

### Changed

- **`GridRow.flashSeq` / `flashDir` are now optional** — only the legacy
  `flash: true` mode needs them. Existing rows that set them keep working.
- **`FlashTracker` eviction is now true LRU** (least-recently-touched, not
  insertion order) — a cell that keeps ticking is no longer the first thing
  dropped once the tracker's 20k-cell cache fills on a long session.
- **`createTickStream` no longer lets a throwing `apply` corrupt the health
  counters** — a failed batch isn't counted in `applied`, and the error is
  reported via the new `onError` option (default: re-thrown asynchronously)
  instead of propagating into the scheduler.

- **docs** — added a "Related projects" cross-link to
  [TradeCanvas](https://github.com/bonguynvan/tradecanvas) (the sibling Svelte 5
  canvas charting library) in the README and demo footer; added `chart` /
  `trading-chart` keywords for npm discovery.

## [1.0.0] — 2026-06-30

**1.0 — stable API.** A full, free Svelte 5 data grid (virtual scroll, sort /
filter / group / pivot, trees, master-detail, server `RowSource`, spreadsheet
editing, CSV/Excel, conditional formatting, charts companion) plus a typed,
framework-agnostic `<bo-grid>` web component. This release rounds out the
adopter experience: rich cells from plain JS, styled tooltips, auto-fit sizing,
and controlled active-row / page-size. All changes are additive — no breaking
API changes from 0.25.

### Added

- **Auto-fit `height`** — `height` now accepts a CSS **string** (`'100%'`,
  `'80vh'`, …): it sizes the whole element and the scroll viewport auto-fits the
  space left after the header/pager/footer chrome (measured), instead of you
  hand-subtracting it. A **number** keeps the prior pixel-viewport behaviour.
- **`selectedRowId`** (`<Grid>`) — controlled active-row highlight (keyed by
  `getRowId`) for list-detail / master-detail, independent of the checkbox
  `rowSelection` and the cell range selection.
- **`pageSizeOptions`** (`<Grid>`) — a rows-per-page dropdown in the pager (e.g.
  `[25, 50, 100]`); picking one re-pages from page 0. `onPageSizeChange` reports it.
- **JS cell renderer** — a column's **`render(ctx)`** function is the
  framework-agnostic alternative to the `cell` snippet, for React/Vue/vanilla and
  the `<bo-grid>` web component. Return a DOM `Node` (appended as-is — safe) or an
  HTML string (innerHTML — sanitize untrusted data yourself). `ctx` is
  `{ value, row, column }`; display-only (sort/filter/tooltip/copy/export still
  use the value/`format`). New `CellRenderContext` type exported.
- **Styled floating tooltips**: a column's `tooltip` now renders a themed, instant
  hover bubble (replacing the native `title` — no OS delay, matches the grid
  theme, escapes cell clipping). `tooltip: true` shows the formatted value;
  `tooltip: (value, row) => string` returns custom text for any column type
  (including `custom`). Return `''` to suppress per cell. Opt-in per column, so a
  grid with no tooltips wires no hover handlers.
- **Typed `bo-grid/element`** — the web-component entry now ships TypeScript
  declarations: `BoGridConfig` (every `<Grid>` prop), a `BoGridElement` interface
  (typed `config`), and a **`createBoGrid(config)`** helper for the safe
  create-before-attach pattern. New `GridProps` type exported from the main entry.
  React/Vue/vanilla recipes in `docs/frameworks.md` updated to the typed surface.
- **Header tooltips** — `headerTooltip` (column) shows the styled bubble on the
  column header (describe the metric, units, caveats); `headerInfo: true` adds a
  small ⓘ cue. Reuses the same floating-tooltip rail.
- **`wrap`** (column): let long content wrap onto multiple lines instead of
  truncating with an ellipsis (pair with a taller `rowHeight`). Default off.
- **`cellSelection`** (`<Grid>`, default `true`): set `false` for a read-only /
  display grid — drops the range-selection highlight, focus ring and fill handle;
  clicks pass straight through to `onRowClick` / `onCellClick`.

### Fixed

- **`<bo-grid>` no longer crashes when `config` is set after the element attaches**
  (the React `ref` + `useEffect` pattern). `<Grid>` now defaults `rows`/`columns`
  to `[]`, so a config-less mount renders a blank grid and reacts when config
  arrives instead of throwing on `undefined.length`.
- Plain text/number cells now truncate with a real **ellipsis** when they overflow
  (a bare text node in the flex cell didn't honour `text-overflow`; values now
  render through a truncating span). Affects all simple value columns.

### Changed (demo)

- The **Team** example showcases the new tooltips (full name on the avatar, a
  computed status tooltip, header tooltips with ⓘ cues on Rate/Workload), an
  ellipsis-truncated Notes column, and a live cell-selection on/off toggle. The
  **Spreadsheet** example adds a `selectedRowId` active-row highlight and a pager
  page-size dropdown; the **vanilla** starter uses `createBoGrid` + a `render`
  cell.
- Library bundle budget raised 32 → 35 KB gzip for the 1.0 feature wave (core is
  ~32 KB).

## [0.25.0] — Unreleased

Theme: **smart import** — auto-detect pasted/loaded data. See [ROADMAP.md](./ROADMAP.md).

### Added

- **`parseRows(text, columns?)`**: detect the format — a JSON array, TSV, or CSV —
  and parse it into grid rows. Ideal for a paste handler where the source is
  unknown (`parseRows(e.clipboardData.getData('text'), columns)`): leading `[` →
  JSON (falls through to delimited if it isn't valid JSON), a tab in the first line
  → TSV, otherwise CSV. The **CSV import** demo gains an **Auto-detect** option.

### Changed (demo)

- The example gallery now renders **all grids on a single scrolling page** instead
  of one-at-a-time tabs. Each example lazy-mounts its grid as it scrolls into view
  (`IntersectionObserver`, so a 17-grid page doesn't boot 17 realtime timers at
  once), with a sticky side rail (scroll-spy) to jump between them. Library code
  is unchanged.

## [0.24.0] — Unreleased

Theme: **print / export view** — print or capture all rows (the live grid
virtualizes). See [ROADMAP.md](./ROADMAP.md).

### Added

- **`toHTMLTable(rows, columns)`**: render rows to a clean, semantic `<table>` HTML
  string — formatted via the column formatters, numeric columns right-aligned,
  sparkline/custom columns skipped, all values HTML-escaped. Renders **every** row,
  unlike the virtualized grid. Pure; embeddable.
- **`printTable(rows, columns, { title? })`**: open a print window with that table
  and trigger the print dialog (Save-as-PDF from there). Browser-only.
- `escapeHTML` helper exported. New **Print** demo (live grid + a full printable
  preview + a Print button).

## [0.23.0] — Unreleased

Theme: **TSV & JSON import** — round out the data I/O. See [ROADMAP.md](./ROADMAP.md).

### Added

- **`parseTSV(text, columns?)`**: TAB-separated import with the same header→column
  mapping and coercion as `parseCSV` — handy for spreadsheet/clipboard data
  (`Ctrl/⌘+C` copies the selection as TSV).
- **`rowsFromObjects(objects)`**: adapt plain objects (e.g. a JSON API response) to
  grid rows — stamps `id` (own `id` or index) + flash fields, keeping all fields.
- **`parseJSON(text)`**: parse a JSON array of objects into rows
  (`JSON.parse` + `rowsFromObjects`).
- The **CSV import** demo now switches between CSV / TSV / JSON.

### Internal

- The CSV/TSV parsers share one delimiter-aware core (`parseDelimited`).

## [0.22.0] — Unreleased

Theme: **CSV import** — round-trip the dependency-free CSV export. See
[ROADMAP.md](./ROADMAP.md).

### Added

- **`parseCSV(text, columns?)`**: parse CSV text into grid rows — the inverse of
  `toCSV`. Maps headers to columns (by `header` or `key`), coerces numeric columns
  to numbers and `date` columns to epoch ms, leaves blanks/unparseable values
  as-is, and stamps `id` + flash fields so rows are `GridRow`-ready. RFC4180-aware
  (quoted fields with embedded commas, doubled quotes, and newlines; CRLF or LF).
- **`parseCSVMatrix(text)`**: the low-level 2-D string parse, exported for custom
  mapping.
- New **CSV import** demo (a live parse ⇄ export round-trip).

## [0.21.0] — Unreleased

Theme: **framework-agnostic custom element** — use bo-grid in React, Vue, Angular
or vanilla. See [docs/frameworks.md](./docs/frameworks.md).

### Added

- **`bo-grid/element`** — a `<bo-grid>` custom element (Web Component). Import it
  (`import 'bo-grid/element'`) and drive the whole grid API through a single
  `config` property; styles inject automatically (light DOM, so `--bo-grid-*`
  variables still apply). Self-contained (Svelte bundled in, ~60 KB gzip).
  Integration recipes for React / Vue / Angular / vanilla in
  [docs/frameworks.md](./docs/frameworks.md).
- A `wc-smoke` gate registers `<bo-grid>` and asserts it renders + reacts to
  `config` updates.

### Notes

- The `cell` / `detail` snippets (custom cell rendering) are Svelte-only and can't
  cross the custom-element JS boundary — use built-in types, `format`, or computed
  `value`. Svelte users should import the component directly for full features +
  much smaller size.

## [0.20.0] — Unreleased

Theme: **server-side (lazy) grouping** — group totals up front, rows on expand.
See [ROADMAP.md](./ROADMAP.md).

### Added

- **Server-side grouping** (`lazyGroups` + `loadGroup`): pass top-level group
  summaries (`{ key, label?, count?, agg? }`) — the grid renders collapsed group
  headers with the server-provided count and preformatted aggregates, and loads
  each group's leaf rows on expand via `loadGroup(key)` (a loading row, then
  cached). For data grouped on the server / too large to fetch upfront. `LazyGroup`
  type exported. New **Server groups** demo (orders by region).
- Reuses the lazy-tree loading machinery; `buildLazyGroupRows` is pure and
  unit-tested. `GroupNode` gained an optional `aggText` (server aggregate strings).

## [0.19.0] — Unreleased

Theme: **more charts** — multi-series bars, a legend, and tooltips, all in the
`bo-grid/charts` companion (the grid core is untouched). See [ROADMAP.md](./ROADMAP.md).

### Added

- **`StackedBarChart`**: multi-series bars from `data: number[][]` (`data[series]
  [category]`) — stacked by default, or `grouped` for side-by-side. `seriesLabels`
  feed the hover tooltips.
- **`Legend`**: a small swatch+label list (`items`), palette-aware — for donut /
  stacked series.
- **Hover tooltips**: every `BarChart`, `StackedBarChart` and `DonutChart` element
  now carries an SVG `<title>` (the value, plus the series/slice label when set) —
  native, accessible, zero-JS.
- Exposed `stackedBars` / `groupedBars` geometry helpers and the `BarSeg` type.
- The **Dashboard** demo gains a stacked "Top regions · quarterly" card with a
  legend.

## [0.18.0] — Unreleased

Theme: **more theme presets** — polish. See [ROADMAP.md](./ROADMAP.md).

### Added

- **Four new built-in theme presets**: `highContrastDark` / `highContrastLight`
  (accessibility — strong borders + vivid status colours, well beyond AA),
  `midnightTheme` (deep navy/indigo dark) and `terminalTheme` (green-on-black
  retro). Plus `themePresets` (a name→preset map) and a `ThemePreset` type for
  building a theme picker. Pass any preset to the `theme` prop. New **Themes**
  demo (a live preset switcher).

## [0.17.0] — Unreleased

Theme: **server-side / lazy tree loading** — load tree children on expand. See
[ROADMAP.md](./ROADMAP.md).

### Added

- **Async tree children** (`loadChildren`): load a node's children on first expand
  (server-backed hierarchies — file trees, org charts, category trees too large to
  ship upfront). Returns a promise; the grid shows a loading row, then caches the
  result. Pair with **`hasChildren`** (a cheap predicate) so the expand chevron
  shows without loading. Sync `getChildren` is unchanged and still supported.
- New **Lazy tree** demo (a file tree that loads folders on demand).

### Notes

- `loadChildren` is in-memory-roots mode (like `getChildren`); a failed load
  collapses the node so it can be retried. The loading row is an `aria-live`
  region. Tree flattening (`buildTreeRows`) is still pure and unit-tested.

## [0.16.0] — Unreleased

Theme: **scale — column (horizontal) virtualization** for very wide grids. See
[ROADMAP.md](./ROADMAP.md).

### Added

- **Column virtualization** (`virtualizeColumns`): for wide grids (100+ columns),
  render only the columns within the horizontal scroll window (+ overscan). A
  60-column grid then costs about the same as a handful of columns. Off-window runs
  collapse into a single spacer so widths and positions stay exact; **pinned
  columns always render**. Opt-in; forces fixed-width horizontal scroll (the same
  layout pinning already uses). New **Wide** demo (60+ columns + pinned label).
- The windowing math is a pure, unit-tested module (`colvirt.ts`).

### Changed

- **Library size budget recalibrated 28 → 32 KB** (gzip, eager core). The analytics
  + scale wave (conditional formatting, computed columns, more rich types, column
  virtualization) grew the always-loaded core to ~28 KB. The charts companion keeps its own 8 KB
  budget; heavy menu UI stays lazy and excluded.

## [0.15.0] — Unreleased

Theme: **accessibility (WCAG 2.1 AA audit)** — trust & polish. See
[ACCESSIBILITY.md](./ACCESSIBILITY.md).

### Added

- **Keyboard-navigable menus** (APG menu pattern): the row/column menus now move
  focus into the menu on open, navigate with <kbd>↑ ↓ Home End</kbd>, activate with
  <kbd>Enter</kbd>, close on <kbd>Esc</kbd>/<kbd>Tab</kbd>, and **return focus** to
  the opener.
- **Keyboard path to filtering**: a **Filter…** item in the column menu
  (<kbd>Alt</kbd>+<kbd>↓</kbd>) opens the filter menu without the mouse.
- **ACCESSIBILITY.md** — documents roles, the keyboard model, focus handling,
  measured contrast ratios, and motion/status-message conformance.

### Fixed

- **Visible focus indicators** (WCAG 2.4.7) on every keyboard-reachable control —
  headers, menu items, pager, filter & columns panels, tree/expand toggles, links,
  the quick-filter box and the column tool toggle (plus the demo's tabs and theme
  toggle). Native controls keep their themed platform rings.

### Notes

- Verified: ARIA grid/treegrid semantics, `aria-sort`, `aria-activedescendant`,
  reduced-motion guards (flash/spinner/shimmer), `aria-live` loading, and AA
  contrast on both presets — all already in place; no token changes were needed.

## [0.14.0] — Unreleased

Theme: **`bo-grid/charts` companion** — tiny dashboard charts, kept out of the
grid core. See [ROADMAP.md](./ROADMAP.md).

### Added

- **`bo-grid/charts` subpath** — an optional, dependency-free SVG chart set for
  dashboards: `LineChart` (with optional `area`), `BarChart` (signed, zero-axis)
  and `DonutChart` (pie when `thickness >= size/2`). Themeable via `color`/`colors`
  props or `--boc-*` CSS vars. Imported separately
  (`import { LineChart } from 'bo-grid/charts'`) so it adds **nothing** to the grid
  core — the companion is ~2 KB gzip on its own budget.
- Exposed the SVG geometry helpers (`linePoints`, `linePath`, `areaPath`,
  `barRects`, `donutArcs`, `extent`) and `CHART_PALETTE` for building custom charts.
- New **Dashboard** demo: KPI cards (standalone charts) and **charts inside grid
  cells** (a `LineChart` in each row's custom Trend column).

### Internal

- `size:lib` now measures the charts companion under its own budget (8 KB); the
  grid core budget (28 KB) is unaffected since charts are a separate entry.

## [0.13.0] — Unreleased

Theme: **more rich cell types** — `link`, `relative` (relative time) and
`currency`. See [ROADMAP.md](./ROADMAP.md).

### Added

- **`link` columns** (`type: 'link'`): render the value as an anchor. `href(row)`
  builds the target (defaults to the value); `newTab` opens in a new tab (with
  `rel="noopener noreferrer"`). URLs are sanitized — `javascript:`/`data:`/
  `vbscript:` are blocked and render as plain text (`safeHref`).
- **`relative` columns** (`type: 'relative'`): format an epoch-ms value as human
  relative time (`3 hours ago`, `in 2 days`). New `relativeTime(ms, now?)`
  formatter (exported).
- **`currency` columns** (`type: 'currency'`): localized currency via
  `Intl.NumberFormat` (`currency` ISO code, `locale`, `decimals`); falls back to a
  fixed-decimal number for an unknown code. New `fmtCurrency` formatter (exported).
- The **Team** demo now shows all three (email link, last-active relative time,
  hourly rate currency) with the Member column pinned.

## [0.12.0] — Unreleased

Theme: **computed columns** — derive a column from the whole row (KPIs, ratios,
deltas) for dashboards & analytics. See [ROADMAP.md](./ROADMAP.md).

### Added

- **Computed columns** (`col.value: (row) => …`): a column's value is derived from
  the whole row instead of read from `row[key]`. The derived value flows through
  **display, sort, filter (incl. quick filter + set filter), group/footer
  aggregation, conditional formatting, export, copy and the cell-click payload** —
  everywhere a real column does. `key` still identifies the column (sort/filter
  key) but need not be a real field. Computed columns aren't editable (no field to
  write back). In-memory mode (a server source owns its own derivations). The
  **Portfolio** demo adds a derived **Cost Basis** column (shares × avg cost).

## [0.11.0] — Unreleased

Theme: **colour scales** — completes the conditional-formatting trio (data bars +
icon sets + colour scales). See [ROADMAP.md](./ROADMAP.md).

### Added

- **Colour scales** (`col.colorScale`): tint a numeric column's cell backgrounds
  across its value range — a soft, themed heat ramp. Auto-ranges over the current
  view (or set `min`/`max`); pass `mid` (e.g. `mid: 0`) for a 3-stop diverging
  scale (down → neutral → up). `colors` overrides the stops (`[low, high]` or
  `[low, mid, high]`). Translucent by default so row striping shows through and
  text stays readable; works on any numeric column (unlike the fixed `heatmap`
  type, which it complements). Exported `ColorScaleConfig`. The **Portfolio** demo
  now uses an auto-ranged diverging scale on P&L %.

### Changed

- Data-bar `min`/`max` resolution moved into the (now shared) range pipeline —
  identical behaviour, but data bars and colour scales now share one per-column
  data-extent pass. Pinned cells with a heat/scale tint now layer it over the row
  colour so they stay opaque during horizontal scroll (also fixes pinned heatmap
  cells).

## [0.10.0] — Unreleased

Theme: **conditional formatting** — the analytics & reporting layer (see
[ROADMAP.md](./ROADMAP.md)).

### Added

- **Data bars** (`col.dataBar`): an in-cell horizontal bar painted behind the
  value, scaled across the column's range. The range auto-computes over the
  current view, or set `min`/`max` (`min: 0` gives absolute proportional bars).
  Bars diverge left/right around a zero baseline when the range spans negatives;
  `color`/`negative` override the default up/down theme colours.
- **Icon sets** (`col.icons`): show an icon beside the value, chosen by the
  highest threshold `at` that is ≤ the value (e.g. `▲`/`▼` by sign, or a 3-band
  scale). Each rule takes a semantic `tone` (`up`/`down`/`amber`/`info`/`neutral`)
  for its colour.
- Both are themed, work with flashing/live cells, and add nothing to the core for
  grids that don't use them. The **Portfolio** demo shows data bars on Mkt Value
  and diverging bars + sign icons on P&L.

## [0.9.0] — Unreleased

Theme: **rich cell types** — for any business domain (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Rich built-in column types** beyond fintech numbers: `progress` (in-cell bar,
  `min`/`max`), `rating` (stars, `max`), `tags` (chips from a `string[]` or
  comma-separated string), `badge` (status pill coloured via a `tones` map),
  `boolean` (✓/✕ with optional `trueLabel`/`falseLabel`), and `avatar` (initials +
  name, optional `sub`). All themed from the design tokens; copy/export render
  sensible text. Makes bo-grid a fit for CRM, project, admin and content apps —
  not just trading. New **Team** demo showcases them.

## [0.8.0] — Unreleased

Theme: **design tokens & polish** (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Deep theming tokens**: shape and density are themeable too — `radius`,
  `fontSize` and `cellPad` (`--bo-grid-radius` / `--bo-grid-font-size` /
  `--bo-grid-cell-pad`), alongside the existing colour/typography tokens. Compact,
  roomy, rounded or branded looks are a small token map (or a few CSS vars) away.
- **Themed scrollbars**: thin, theme-coloured scrollbars in the grid viewport
  (Firefox `scrollbar-*` + Chromium/Safari `::-webkit-scrollbar`).

### Fixed

- **Sparkline now follows the theme**: candle colours read the grid's up/down
  tokens, and the hover tooltip uses the themed surface (was a hardcoded black
  background — dark text on black, unreadable on light themes).

## [0.7.0] — Unreleased

Theme: **column sizing & keyboard polish** (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Autosize column to content**: the column menu's **Autosize** action fits a
  column to its content (a fast character-count heuristic; respects
  `minWidth`/`maxWidth` and persists like a manual resize).
- **Keyboard access to the column menu**: <kbd>Alt</kbd>+<kbd>↓</kbd> opens the
  column menu at the focused column (previously mouse-only via the ⋮ trigger).
- **Themed form controls**: checkboxes, date pickers, number spinners, search
  inputs and scrollbars now follow the grid theme (via `color-scheme` +
  `accent-color`), so they no longer render with light browser defaults on a dark
  grid. A custom theme can set `scheme: 'light' | 'dark'`.

## [0.6.0] — Unreleased

Theme: **controlled & server-side filtering** (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Controlled filtering**: a `columnFilters` prop + `onFilterChange` callback let
  you own the filter state (persist it, set initial filters, sync to the URL) —
  mirrors controlled `sort`. `ColumnFilter` / `FilterKind` / op types are exported.
- **Server-side filtering**: `RowSourceParams` gains `columnFilters`, so the header
  filter menu works in source mode — text/number/date filters delegate to the
  `RowSource` (set filters need in-memory data). `createArraySource` applies them.

## [0.5.0] — Unreleased

Theme: **spreadsheet power** (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Fill handle**: with `fillHandle`, the selection shows an Excel-style square at
  its bottom-right corner — drag it to copy the selected value(s) across the
  extended range (down/right). Editable columns only; multi-cell selections tile.
- **Undo / redo**: <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> / <kbd>Ctrl/⌘</kbd>+<kbd>Y</kbd>
  (or <kbd>Shift</kbd>+<kbd>Z</kbd>) for edits, paste and fill. History is keyed
  by row reference so it survives sort/filter; a paste or fill is one step.
- **Typed inline editors**: editable `number`/`price`/`percent`/`volume` columns
  edit with a numeric input, and `date` columns with a native date picker
  (`date` columns are now editable). Other columns keep the text input.

## [0.4.0] — Unreleased

Theme: **column management & discoverability** (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Column header menu**: `columnMenu` adds a ⋮ trigger to each header with
  Sort ascending / descending / Clear, **Pin left / Pin right / Unpin**, and
  **Hide column**. Runtime-hidden columns compose (union) with the controlled
  `hiddenColumns`, persist via `persistKey`, and report through
  `onColumnVisibilityChange`; runtime pins layer over static `col.pinned` and
  also persist.
- **Columns tool panel**: `columnsPanel` adds a "Columns" button that opens a
  searchable checklist to toggle column visibility (and **restore** columns
  hidden via the menu — Show all). Lazy-loaded.

## [0.3.0] — Unreleased

Theme: **filtering & discoverability** (see [ROADMAP.md](./ROADMAP.md)).

### Added

- **Header filter menu**: `filterMenu` adds a funnel to each filterable column;
  clicking it opens a menu whose control matches the column type — text
  (contains / equals / starts / ends), number (`=, ≠, <, ≤, >, ≥, between`), or
  date (before / after / on / between). Override or disable per column with
  `col.filter` (`'text'|'number'|'date'|'set'|false`). The menu UI is
  **lazy-loaded** on first open, so the core bundle is unaffected until used.
- **Set filter**: `col.filter: 'set'` gives a column a searchable checkbox list
  of its distinct values (All / None), filtering to the checked ones.
- **Quick filter**: a built-in `quickFilter` search box above the grid that
  matches across all columns (a batteries-included alternative to the `filter`
  prop).

### Internal

- Structured per-column filter model (`filtering.ts`): typed `ColumnFilter`
  (text/number/date operators + a set filter) with pure, unit-tested matching.
  The grid's filtering runs through it; the existing `filterRow` is migrated onto
  it with no behavior change.

## [0.2.0] — 2026-06-06

A large batch of additive, backward-compatible features on top of the initial
`0.1.0` release. No breaking changes — everything new is opt-in.

### Added

- **Multi-column sort**: Shift-click headers to add secondary sort keys; each
  sorted header shows its position. `compareBySorts` applies keys in order.
- **Controlled sort**: optional `sort` + `onSortChange` to own the sort order
  (persist it, set an initial sort, sync to the URL); uncontrolled otherwise.
- **Per-column filters**: `filterRow` adds a filter input under each column;
  rows must match every non-empty column filter (AND).
- **Column resize**: drag a header's right-edge grip to resize (double-click to
  reset); on by default, opt out with `resizable={false}` (grid) or
  `resizable: false` (column). Widths persist via `persistKey`.
- **Resize clamps**: per-column `minWidth`/`maxWidth` bound drag-resizing.
- **Column show/hide**: controlled `hiddenColumns` (column keys) — drive your own
  column-picker UI.
- **Column header groups**: a column `group` label renders consecutive columns
  under a spanning parent header (best with fixed-width columns).
- **Layout callbacks**: `onColumnReorder(keys)` and `onColumnResize(key, width)`
  report header drag-reorder / resize so apps can persist layout server-side.
- **Row selection**: `rowSelection` adds a leading checkbox column (header
  select-all), keyed by `getRowId` (default `row.id`; override for string/
  composite keys) so it survives sort/filter; `onRowSelectionChange` reports ids.
  Press <kbd>Space</kbd> to toggle the focused row from the keyboard.
- **Row reorder**: `onRowReorder(from, to)` enables drag-to-reorder via a
  first-column handle (flat, unsorted, in-memory lists).
- **Pagination**: `pageSize` switches to a paged view with a pager (first/prev/
  next/last) instead of one long scroll; rows still virtualize within a page.
  Optionally controlled via `page` + `onPageChange` (URL-synced paging).
- **Keyboard navigation**: <kbd>Home</kbd>/<kbd>End</kbd> (row, or whole grid
  with Ctrl/⌘) and <kbd>PageUp</kbd>/<kbd>PageDown</kbd>, with Shift to extend.
- **Clipboard paste**: **Ctrl/⌘+V** pastes a TSV block into editable cells from
  the selection's top-left (single value fills the selection; blocks clamp to
  bounds); values run through the same validation as inline editing.
- **Type-to-edit**: pressing a printable key on a focused editable cell opens the
  editor seeded with that character (Excel-style), no double-click needed.
- **Edit validation**: a column `validate(value, row)` rejects invalid edits
  (inline edit or paste), keeping the old value.
- **Select editor**: a column `options` makes an editable column edit via a
  `<select>` dropdown (enum/status columns).
- **Master-detail**: a `detail` snippet renders an expandable panel under each
  row (leading expand toggle, `detailHeight`); virtualized with the height model.
- **Tree data**: `getChildren` renders hierarchical rows — `rows` become roots,
  with an indented first column and per-node expand chevrons. Keyboard-accessible
  (→ expand, ← collapse) with `aria-level` / `aria-expanded` treegrid semantics.
- **Totals footer**: `footer` pins a totals row — each column with a `groupAgg`
  aggregates all (filtered) rows, sticky to the viewport bottom.
- **Pinned top rows**: `pinnedRows` keeps rows stuck to the top, always visible
  above the scroll (a benchmark, a summary, "your position").
- **Pin right**: `pinned: 'right'` keeps a column pinned to the right edge during
  horizontal scroll (in addition to `true`/`'left'`).
- **Custom formatter**: a column `format(value, row)` overrides the built-in type
  formatter for display, tooltip, copy and formatted export.
- **Custom sort comparator**: a column `compare(a, b)` sorts by custom logic
  (enum priority, natural sort) instead of the default value comparison.
- **Per-column class hooks**: `cellClass` (static or `(value, row)` conditional)
  and `headerClass` for styling individual columns via `:global`.
- **Per-row styling**: `rowClass(row)` returns CSS class(es) per data row.
- **Row & cell clicks**: `onRowClick(row, event)` (click or Enter) and
  `onCellClick({ row, column, value }, event)`.
- **Row context menu**: `rowMenu(row)` returns right-click menu items (each with
  a `label` + `onSelect`); closes on select, outside-click, or Esc. Keyboard-
  accessible — the <kbd>ContextMenu</kbd> key (or <kbd>Shift</kbd>+<kbd>F10</kbd>)
  opens it at the focused cell.
- **Cell tooltips**: a column `tooltip` sets a native `title` (full value) on
  each cell — handy when content truncates.
- **Custom empty state**: `emptyMessage` sets the text shown when no rows match.
- **Loading overlay**: a `loading` prop shows a spinner overlay for
  consumer-driven async work (in-memory mode).
- **Accessible name**: an optional `ariaLabel` sets the grid's accessible name.
- **SSR / SvelteKit-safe**: `<Grid>` server-renders without touching browser
  globals; `sideEffects: false` for tree-shaking. A `pnpm ssr` gate (in CI and
  the release) server-renders the grid to guard against regressions.

### Internal

- Release gates now run `check` → `test` → `ssr` → `package` → `smoke` → `size`
  → `size:lib`. Added direct unit tests for the public formatters and
  `heatColor`; nine-example demo gallery with code-split lazy loading.

## [0.1.0] — 2026-06-06

First public release — a tiny, fast Svelte 5 data grid for fintech UIs.

### Added

- **Grid** component: config-driven columns, fixed-height virtual scrolling
  (smooth at 1,000+ rows).
- **Column types**: `text`, `price`, `percent`, `volume`, `number`, `date`,
  `heatmap`, `sparkline`.
- **Sparklines**: HiDPI canvas candlesticks with hover tooltips and a11y labels;
  `Sparkline` component + `drawCandles` / `setupHiDpiCanvas` primitives.
- **Realtime**: per-cell amber flash on value change, designed for batched
  websocket-style updates without re-rendering the table.
- **Sort & filter**: header-click sort (asc → desc → off) and a controlled
  `filter` prop; both are snapshot operations so a live feed never reshuffles.
- **Selection & aggregation**: drag / Shift-click rectangular selection, keyboard
  navigation (arrows, Shift+arrows, Ctrl/⌘+A, Ctrl/⌘+C as TSV, Esc), and a live
  Sum/Avg/Count/Min/Max footer over the numeric cells in the range.
- **Grouping**: single + nested `groupBy`, collapsible groups, sticky group
  headers, and live per-group subtotals (column `groupAgg`).
- **Server-side data**: `RowSource` interface + `createArraySource` adapter for
  windowed/paginated datasets larger than memory, with skeleton loading rows.
- **Export**: dependency-free CSV (`toCSV` / `exportCSV`) and Excel
  (`exportXLSX`, SheetJS via dynamic import — optional `xlsx` peer).
- **Column reorder**: drag headers to reorder, with optional `persistKey`
  localStorage persistence.
- **Pinned columns**: `pinned: true`/`'left'` keeps a column visible during
  horizontal scroll, pinned to the left edge (opt-in; fit-to-width otherwise).
- **Inline editing**: `editable: true` columns edit on double-click / Enter and
  report committed values via `onCellEdit`.
- **Row height**: `rowHeight` as a number (density) or a function (variable
  per-row heights, virtualized with prefix sums + binary search).
- **Theming**: `theme` prop accepts `'dark'`/`'light'` presets or a custom token
  map; `darkTheme`/`lightTheme`/`GridTheme` exported. Dark-first, self-contained
  CSS variables (`--bo-grid-*`), no CSS import required.
- **Accessibility**: full ARIA grid semantics — `aria-rowcount`/`aria-colcount`,
  per-row/cell `aria-rowindex`/`aria-colindex`, `aria-activedescendant`,
  `aria-multiselectable`, and `aria-hidden` virtualization duplicates.
- **Custom cells**: `type: 'custom'` columns rendered by a `cell` snippet
  receiving `{ row, column, value }`.
- **Pivot tables**: `pivot(rows, config)` transforms flat rows into pivot
  rows + dynamic columns (row fields × a column field, aggregated measure, with
  totals) — feed the result straight to `<Grid>`.
- **Release tooling**: `pnpm release` / `pnpm release:dry` run all gates then
  publish.

[0.25.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.25.0
[0.24.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.24.0
[0.23.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.23.0
[0.22.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.22.0
[0.21.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.21.0
[2.8.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.8.0
[2.7.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.7.0
[2.6.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.6.0
[2.5.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.5.0
[2.4.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.4.0
[2.3.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.3.0
[2.2.2]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.2.2
[2.2.1]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.2.1
[2.2.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v2.2.0
[0.20.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.20.0
[0.19.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.19.0
[0.18.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.18.0
[0.17.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.17.0
[0.16.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.16.0
[0.15.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.15.0
[0.14.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.14.0
[0.13.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.13.0
[0.12.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.12.0
[0.11.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.11.0
[0.10.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.10.0
[0.9.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.9.0
[0.8.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.8.0
[0.7.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.7.0
[0.6.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.6.0
[0.5.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.5.0
[0.4.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.4.0
[0.3.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.3.0
[0.2.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.2.0
[0.1.0]: https://github.com/bonguynvan/bo-grid/releases/tag/v0.1.0
