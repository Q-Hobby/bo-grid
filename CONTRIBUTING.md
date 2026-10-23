# Contributing to bo-grid

Thanks for helping. Bug reports, fixes, docs and features are all welcome.
This page covers how to set up, what a change must pass, and how we measure
performance, which is this project's first priority.

## Setup

```sh
pnpm install
pnpm dev          # demo / playground at http://localhost:5180
```

The demo (`src/demo`) is the playground: a gallery of grids on one page, each
mounting as you scroll to it. The library lives in `src/lib`: the grid in
`src/lib/grid`, plus the `realtime` and `trading` subpaths.

## Before you open a pull request

Run the checks CI runs:

```sh
pnpm check            # svelte-check: 0 errors, 0 warnings
pnpm test             # unit and component tests (Vitest)
pnpm test:coverage    # the same, with a coverage summary
pnpm smoke            # builds the demo and drives it headlessly
pnpm smoke:wc         # the <bo-grid> custom element
pnpm ssr              # server-renders <Grid> (SvelteKit safety)
pnpm size && pnpm size:lib   # bundle-size reports
pnpm check:examples   # the framework starters in examples/
pnpm bench:browser    # frame cost in headless Chrome (needs Chrome installed)
```

- **Tests come first.** Write a failing test, then make it pass.
  - Pure logic goes in a `*.test.ts` next to it.
  - Grid behaviour goes in a component test, `*.svelte.test.ts` with
    `// @vitest-environment jsdom`. These mount a real `<Grid>` through
    `src/lib/grid/test-fixtures/mount-grid.ts`.
- **Add a CHANGELOG entry** under `## [Unreleased]`, in the section it belongs
  to (Added, Changed, Performance or Fixed). Say what changed and why it
  matters to a user.
- **Update the docs** a change touches: the [guide](./docs/guide.md), the API
  page (`api.html`) and `public/llms-full.txt`.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `perf:`, `docs:`, `test:`, `chore:`).

## Performance claims are measured

A change on the hot path (cell rendering, flashes, scrolling, `patchRows`)
needs numbers, not intuition:

- **CI compares every pull request with its base.** The `perf` workflow builds
  the demo twice and runs `scripts/bench-browser.mjs --base <build> --head
  <build>` in headless Chrome. It fails when a deterministic (`sync`) workload
  is more than 10% and 0.2 ms per frame slower, and warns when a live one is
  more than 25% slower. The table is in the job summary. A pull request that
  changes a benchmarked demo (`PriceBoard.svelte`, `LiveBlotter.svelte`: the
  bench hooks) is reported but not gated, since base and head would run different workloads: compare those by
  hand. Run the same comparison locally before
  pushing a hot-path change: build `main` and your branch with
  `vite build --base=./ --outDir <dir>` and pass both directories.
- For a deeper look, `window.__priceBoard.benchLive({ seconds, eventsPerSec })`
  runs the real feed in the demo, and `bench-browser.mjs --trace` records a
  trace beside each run.
- **Emulate `prefers-reduced-motion: no-preference`.** Headless Chrome inherits
  the operating system's setting, and under reduced motion the grid plays no
  flash animation, which hides most of a live board's cost.
- Report the median and spread over several rounds, and rerun if the
  direction flips.
- [BENCHMARKS.md](./BENCHMARKS.md) shows the method and the current numbers.

## Accessibility

New UI needs labelled controls and keyboard access. Inside the grid, every
control in a row sits in a cell (`gridcell`, `columnheader` or `rowheader`).
[ACCESSIBILITY.md](./ACCESSIBILITY.md) describes the model. axe-core on the demo
should stay clean.

## Reporting bugs and asking for features

Open an [issue](https://github.com/bonguynvan/bo-grid/issues/new/choose). A
small reproduction helps most: a column config and a few rows, or a link to a
fork of one of the [examples](./examples/).

## Code of conduct

Everyone taking part is expected to follow the
[code of conduct](./CODE_OF_CONDUCT.md).
