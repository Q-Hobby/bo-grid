# Benchmarks

bo-grid is built around two claims: **tiny** and **fast**. Both are measurable,
and both are enforced or reproducible from this repo — no hand-waving.

## Bundle size

What a consumer actually ships (gzipped, Svelte treated as a peer dependency and
excluded — you already ship the Svelte runtime):

| Asset | gzip |
| --- | --- |
| `Grid` alone (`import { Grid }`, the rest tree-shaken) | **~46 KB** |
| `bo-grid` JS, the whole public API | **~50 KB** |
| `bo-grid` CSS | **~5 KB** |
| `bo-grid/realtime` (optional) | **~2 KB** |
| `bo-grid/trading` (optional) | **~1.5 KB** |

A few notes:

- The number is the **whole public API** measured eagerly. A consumer who imports
  only what they use (e.g. `import { Grid }`) tree-shakes the rest — the package is
  `sideEffects: false` — so the IO/print helpers don't ship unless imported.
- The **realtime tick pipeline** (`bo-grid/realtime`) and the **trading
  conventions** helpers (`bo-grid/trading`) are separate entries; none adds anything to the grid
  unless you import it.
- **Excel export** is a **dynamic import** of the optional `xlsx` peer — it never
  lands in the core bundle unless you call `exportXLSX`.
- The heavy menu UI (filter menu, columns panel) lazy-loads on first use and is
  excluded from the core number above.

`pnpm size:lib` reports these numbers in CI on every run, so a change that
moves them is visible in review; it fails only on an accidental blow-up (a
dependency bundled into an entry by mistake), not on feature growth.

```sh
pnpm size:lib   # measures the published library bundle
```


## Browser: a busy price board

The **Price board** demo is a VN-style bảng giá — 1,000 symbols, 24 columns
(three bid/ask levels, match, high/low, foreign flow), every changed cell
flashing, prices coloured by ceiling/floor/reference, ~30 rows on screen. Its
**Benchmark** button (or `window.__priceBoard.bench()` / `.benchScroll()`) runs
deterministic frames, each rendered synchronously: apply the frame's ticks,
`flushSync()`, then force style + layout. Paint and compositing are excluded.

Production build, Chrome on a Windows desktop:

| Workload | Frame p50 | p95 | Frames over 16.7 ms |
| --- | --- | --- | --- |
| 10,000 events/s, `patchRows` | ~1.9 ms | ~4.8 ms | 0 / 200 |
| 30,000 events/s, `patchRows` | ~4.5 ms | ~11 ms | 1 / 200 |
| 30,000 events/s, `$state` rows | ~5.3 ms | ~12 ms | 4 / 200 |
| Scroll 1 row / frame | ~1.0 ms | ~1.9 ms | 0 / 120 |
| Scroll 3 rows / frame | ~2.5 ms | ~5.7 ms | 0 / 120 |
| Scroll 10 rows / frame | ~8 ms | ~17 ms | 6 / 120 |

Board height scales the tick cost with the rows on screen (one session, so
comparable with each other but not with the table above):

| Rows on screen | 10,000 events/s p50 | 30,000 events/s p50 |
| --- | --- | --- |
| 31 (620 px) | ~3 ms | ~8 ms |
| 52 (1,400 px) | ~5 ms | ~14 ms |
| 80 (2,400 px) | ~7.6 ms | ~22 ms |

A sorted "top movers" board re-sorted with `api.refresh()` once a second pays
one heavier frame per refresh (in a slower session: ~42 ms at 1,000–1,600
symbols, down from ~65–70 ms before sort keys were read once per row), with
ordinary frames unchanged at a few ms.

Where a refresh frame goes (~18–24 ms in a later session): sorting is ~0.3 ms
at 1,600 rows (0.2 ms at 1,000, 1.1 ms at 5,000), about 1% of the frame. The
rest is the rows that moved: each on-screen slot now shows a different row,
so its cells re-render. That rules out a delta sort, which re-inserts only the
changed rows: the most it could save is the 0.3 ms.

Giving each row a stable DOM slot was built and measured. A row kept its slot
across a re-sort, and 20–29 of the 31 on-screen rows survive one.
- With rows kept in visual DOM order, the node moves and per-cell updates cost
  as much as the repaint they saved.
- Rendering rows in slot order instead cut the refresh frame by 12–28%. It
  made scrolling ~20% slower and decoupled DOM order from screen order, which
  matters to screen readers.

Not adopted.

At 30,000 events/s a frame applies ~500 coalesced ticks. The split is roughly
0.6 ms writing rows (`patchRows`; 1.6 ms through `$state` proxies), 2 ms for
Svelte to update the cells, and 1.8 ms of browser style + layout. Rows off screen
cost nothing beyond the write. Numbers move with the machine — compare runs on
the same machine, in the same session.

### Live frames: where the time goes

The synchronous benches above stop at layout. `window.__priceBoard.benchLive()`
runs the real pipeline in real time — the feed, the coalescing tick stream,
running flash animations — and times each frame from its start to a task posted
after it rendered, so paint is included. It needs a visible tab (hidden tabs get
no animation frames); a traced headless Chrome run gives the same numbers plus a
main-thread breakdown.

Headless Chrome on an Intel UHD laptop GPU, the 620 px board on screen with
the rest of the page hidden, motion allowed (`prefers-reduced-motion:
no-preference` emulated — see below); each figure is the median of 10
interleaved, traced rounds. Renderer main thread per frame, for the two
`flashMotion` settings:

| Step | 10k events/s, fade | 10k, hold | 30k events/s, fade | 30k, hold |
| --- | --- | --- | --- | --- |
| Script (tick stream, `patchRows`, Svelte) | ~2.7 ms | ~1.6 ms | ~4.9 ms | ~3.1 ms |
| Paint (recording the changed cells) | ~9.7 ms | ~2.6 ms | ~10.9 ms | ~3.3 ms |
| Layout + style + pre-paint | ~10.6 ms | ~1.9 ms | ~15.4 ms | ~2.8 ms |
| Layerize (grouping paint into layers) | ~1.3 ms | ~0.9 ms | ~1.0 ms | ~0.9 ms |
| **All main-thread tasks** | **~30 ms** | **~9.4 ms** | **~40 ms** | **~12.3 ms** |
| Frames dropped in a 3 s run | ~10 | 0 | ~5 | 0 |

With held flashes both rates fit a 16.7 ms frame with room to spare. With
fading flashes the board is over budget at either rate. With reduced motion
there is no flash animation at all: ~8.2 and ~11 ms.

**Measure with motion allowed.** Headless Chrome inherits the operating
system's reduced-motion setting, and under reduced motion the grid plays no
flash animation. An earlier version of this page was measured that way. It
reported ~6 / ~11.4 ms and concluded that the flash style made no difference;
both figures describe a board with no flash animation running. Emulate
`prefers-reduced-motion: no-preference` (puppeteer:
`page.emulateMediaFeatures`) and check `matchMedia` in the page.

What changed it, and what did not:

- **Held flashes (`flashMotion: 'hold'`): 3–4× less main-thread work.** A CSS
  animation is restyled and repainted on every frame it runs. On a busy board
  most visible flashing cells are mid-fade at any moment, which costs ~8–12 ms
  of style and ~10 ms of paint per frame. A held tint is a static background:
  restyled and repainted when it starts and when the grid's clock drops it,
  and a repeat tick during the hold changes nothing. It lands within ~1 ms of
  no flash at all (30k events/s: ~13.7 vs ~12.7 ms in a paired run).
  Approaches that did not get there:
  - Stepped timing (`steps(1, end)`, tint on then off): ~6% cheaper. Chrome
    still services a running animation every frame, even when its value
    holds.
  - Holding the tint in the animation's delay phase
    (`animation-fill-mode: backwards`): ~27–36% cheaper. Paint halves, but
    restarting an animation on every tick still restyles.

- **`flashMotion: 'auto'`: a fade when quiet, about hold's cost when busy.**
  Each flash decides as it starts, from how many flashes started within the
  last flash window. In one session (medians of 3 interleaved rounds, all
  main-thread work per frame):

  | events/s | fade | auto | hold |
  | --- | --- | --- | --- |
  | 1,000 | ~4.3 ms | ~5.0 ms (fades) | ~3.9 ms |
  | 4,000 | ~15 ms | ~8.5 ms | ~6.5 ms |
  | 10,000 | ~68 ms | ~8.5 ms | ~10 ms |
  | 30,000 | ~59 ms | ~9.4 ms | ~10.5 ms |

  That session ran slower than the table above (fade at 10,000 events/s was
  ~15 ms in another), so compare within a row. A fading cell costs about
  0.02 ms of every frame it fades through; `'auto'` holds once ~120 overlap.
- **Data bars scaled instead of sized: ~15% cheaper.** A bar drawn full width
  and scaled (`transform: scaleX`) only repaints when its value changes; a
  changing `width` also lays it out. On a 240-cell test page updating 40 or
  240 bars a frame: ~2.9 → ~2.5 ms and ~4.6 → ~3.9 ms. Adopted.
- **Flashes through `element.animate()`: no gain.** A `background-color`
  animation runs on the main thread whether CSS or the Web Animations API
  starts it; only `transform`, `opacity` and `filter` can run off it. Against
  the CSS fade: ~15.7 vs ~15.5 ms at 10,000 events/s and ~20 vs ~26 ms at
  30,000, with more frames dropped — still 2–3× what `'hold'` costs (~5.5 and
  ~9.2 ms). Not adopted.
- **CSS containment on rows or cells: slower.** `contain: layout style` on rows
  or `contain: layout paint style` on cells, with held flashes: ~5.5 → ~7.6 /
  ~8.1 ms at 10,000 events/s and ~9.2 → ~12.9 / ~11.6 ms at 30,000. Not
  adopted.
- **Rows moved by `transform` instead of `top`: no difference.** Scrolling 3
  rows a frame: ~5.9 vs ~5.5 ms; 10 rows a frame: ~8.9 vs ~9.0 ms (traced,
  paint included). Not adopted.

The entries below were measured before the harness emulated motion, so the
fade was off in them. Their comparisons hold for the work around the flash:

- **Value-only cells drop their own clip.** A cell that renders nothing but its
  value span used to clip twice — the cell and the span. The span already
  clips and ellipsizes inside the cell, so the cell's clip was redundant;
  without it, Layerize fell from ~0.98 to ~0.65 ms at 10,000 events/s and from
  ~1.05 to ~0.81 ms at 30,000, and all main-thread work by ~15% at 10,000.
  Output is identical (no value spills its cell; long values still end in …).
  Cells with structured content (badges, links, sparklines, renderers, editors)
  keep their clip.
- **An opacity overlay instead of the background fade: ~9× slower** (73–82 ms
  a frame, 36–39 ms of it in Layerize). Every animating cell becomes a
  compositor layer.
- **Pinned columns cost a layer per row, and that is fine.** 31 of the board's
  38 compositor layers are its pinned cells: each sticky cell has its own
  scroll-dependent position. Moving every row's pinned cells into one sticky
  rail per side was built and measured: layers fell to 8 and the compositor
  thread got ~0.1 ms cheaper, but the main thread got ~5% slower at 30,000
  events/s (each row paints a second element), and the row's cells would no
  longer share one DOM row. Not adopted.
- Removing `position: relative` from cells made paint slower (it lets Chrome
  reuse an unchanged cell's paint), so that stays.

### In CI: every pull request against its base

The `perf` workflow builds the demo from the pull request and from its base,
then runs `scripts/bench-browser.mjs` on both in headless Chrome. Each round
runs every workload on the two builds back to back, in alternating order, and
the change is the median of the per-round ratios, so a slow moment on the
runner cancels out.

| Workload | What runs | Gate |
| --- | --- | --- |
| sync: board 10k and 30k ev/s | 240 seeded frames, each rendered synchronously, then style and layout forced | fails above +10% and +0.2 ms |
| sync: scroll 3 rows/frame | 120 scroll steps, each rendered synchronously | fails above +10% and +0.2 ms |
| live: board 10k hold, 30k auto, 10k fade | the real feed for 3 s, flashes and paint included | warns above +25% |
| sync: blotter 100k, 200 fills | the Live blotter: 100,000 orders, 200 fills a frame through `patchRows` | fails above +10% and +0.2 ms |
| sync: blotter 100k, fills + 5 in, 5 out | the same, plus 5 orders arriving and 5 leaving a frame as a new `rows` array | fails above +10% and +0.2 ms |

Each run reports its median frame, so a GC pause does not move it. Pages are
cross-origin isolated, which gives fine-grained timers (0.01 ms instead of
0.1 ms steps), and web fonts are blocked so both builds lay out alike. A pull
request that changes the board's bench hooks is reported but not gated. On a GitHub runner, two copies of the
same build measured within 2% (sync) and 8% (live) of each other. The table is
in the job summary of every run.

## Hot paths

The reason scrolling stays smooth whether you have 1,000 rows or 1,000,000 is
**virtualization**: only on-screen rows render, and the grid finds the first
visible row and positions any row in **O(1)** (uniform height) or **O(log n)**
(variable height, via prefix sums + binary search). Row count barely affects the
per-frame cost.

`pnpm bench` measures these directly. Representative run (Node, single thread,
deterministic inputs — absolute numbers vary by machine, the orders of magnitude
don't):

| Operation | Scale | Time |
| --- | --- | --- |
| Build variable-height model | 1,000,000 rows → prefix sums | ~3 ms |
| `indexAt()` lookups (variable, binary search) | 1,000,000 lookups | ~79 ms (**~79 ns each**) |
| `indexAt()` lookups (uniform, O(1)) | 1,000,000 lookups | ~3 ms |
| `aggregate()` (sum/avg/count/min/max) | 1,000,000 numbers | ~9 ms |
| Multi-key sort (`compareBySorts`) | 100,000 rows × 2 keys | ~52 ms |
| Live sort: full re-sort (`sortRows`, what `api.refresh()` does) | 100,000 rows, 500 changed | ~21 ms |
| Live sort: merge the changed rows (`mergeChanged`, what `liveSort` does) | 100,000 rows, 500 changed | ~5 ms |
| `buildTreeRows()` (pre-order DFS) | 61,000 nodes | ~5 ms |
| `TickBuffer.push()` (coalesce) | 1,000,000 ticks → 5,000 symbols | ~54 ms |
| `applyPatches()` (keyed row writes) | 200 frames × 5,000 rows | ~42 ms |
| `FlashTracker.observe()` (derived flash) | 1,000,000 cell observations | ~52 ms |
| `TradeTape.push()` (time & sales) | 1,000,000 trades → 500-cap ring buffer | ~9 ms |
| `TradeTape.toArray()` (tape snapshot) | 10,000 snapshots of a full 500-trade tape | ~14 ms |

The headline: **~79 ns to locate the first visible row at any scroll position in
a million-row variable-height dataset.** A 60 fps frame budget is 16.7 ms, so that
lookup is roughly 0.0005% of a frame — virtualization cost is effectively free,
and it's flat as the dataset grows.

For realtime, the headline is **~18M ticks/sec ingested and coalesced**, and
**~0.21 ms to apply a 5,000-row frame**. That's the point of the two-stage
pipeline: a million raw messages collapse into 5,000 pending writes, so the frame
pays for what changed, not for what arrived. The default `cap` of 400 rows per
frame keeps a burst well inside the 16.7 ms budget. Derived per-cell flash costs
~52 ns per rendered cell per update — it runs on every visible cell, so it has to
be, and is, negligible. `TradeTape` appends at **~88M trades/sec** (a true ring
buffer — O(1) regardless of how long the session runs) and snapshots a full
500-trade tape in ~1.4 µs, call it once per render rather than per trade.

```sh
pnpm bench   # runs the hot-path benchmarks above
```

### What this does and doesn't measure

These isolate the grid's **core algorithms** — the work bo-grid does on every
scroll/sort/group/tick, independent of your app. They are not a full in-browser
frame-rate benchmark: real scroll FPS also depends on your cell renderers, the
browser, and the device. The realtime rows measure the pipeline's own cost
(coalescing and keyed writes), not the framework's rendering of the cells those
writes dirty — for that, see the live meters below.

The point is that bo-grid's own overhead stays negligible as the dataset and the
tick rate scale, which is the prerequisite for smoothness. To see live
in-browser FPS, run the demo (`pnpm dev`) and open the **Big data** example
(1,000,000 synthetic rows) — it has an on-screen FPS meter. The **Trading desk**
example adds the realtime numbers next to it: frames per second, cell updates
applied per second, and the queue depth waiting for a frame. Turn the feed on and
watch all three at once — that's the measurement that matters for a live board,
on your hardware.

## Reproduce everything

```sh
pnpm install
pnpm bench          # hot-path timings
pnpm bench:browser  # frame cost of the Price board in headless Chrome
pnpm size:lib       # bundle size report
pnpm dev            # demo with the 1M-row Big data example + FPS meter
```

Live frames: open the demo, scroll to the Price board, and run
`await __priceBoard.benchLive({ seconds: 3, eventsPerSec: 30000 })` in the
console (`__priceBoard.setFlashMotion('fade' | 'hold')` switches the flash).
If your OS asks for reduced motion, that run has no flash animation. Check
`matchMedia('(prefers-reduced-motion: reduce)').matches` first; in DevTools,
Rendering → "Emulate CSS media feature prefers-reduced-motion" overrides it.
