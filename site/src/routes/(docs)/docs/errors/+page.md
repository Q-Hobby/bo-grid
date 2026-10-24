---
title: Error codes
description: Every error bo-grid throws has a stable code, says what went wrong with the value it got, gives the exact fix, and links here.
---

An error from bo-grid reads like this:

```text
BG2004: TradeTape: capacity must be a number of 1 or more, got 0. Fix: Pass how many trades to keep, e.g. new TradeTape(500). See https://bonguynvan.github.io/bo-grid/docs/errors/#bg2004
```

- **The code** (`BG2004`) never changes meaning, so you can search for it, test for it, and match it in error reporting. It is also on the error as `error.code`.
- **The message** says what happened, with the value the grid got.
- **The fix** says exactly what to change.
- **The link** opens the code's entry on this page.

The error is still an `Error`, `TypeError`, `RangeError` or `SyntaxError`, so existing `catch` blocks keep working. Its type is exported as `BoGridError`:

```ts
import type { BoGridError } from 'bo-grid';
import { createPositions, type PositionFill } from 'bo-grid/trading';

const positions = createPositions();

function record(fill: PositionFill) {
  try {
    positions.fill(fill);
  } catch (e) {
    if ((e as BoGridError).code === 'BG3003') showQtyHint();
    else throw e;
  }
}
```

A coding agent that hits one of these errors can follow the fix as written, without reading the library's source.

## Grid

### BG1001

**`hotkeys`: a binding has no key**, as in `'Ctrl+'`. End the binding with a key: `'Ctrl+B'`, `'Delete'` or `'+'`. See [Keyboard & hotkeys](../keyboard/).

### BG1002

**`hotkeys`: an unknown modifier**, as in `'Ctl+B'`. Use `Shift`, `Alt`, `Ctrl`, `Meta` or `Mod` (Ctrl or ⌘, whichever is pressed), joined with `+`.

### BG1003

**`hotkeys`: a Shift binding that cannot fire**, as in `'Shift+1'`. A key event reports the character Shift types, not the key under it, so bind that character: `'!'` for Shift+1, `'?'` for Shift+/.

### BG1004

**`hotkeys`: a key bound twice**, as in `{ b: …, B: … }`, or `Mod+K` next to `Ctrl+K` (`Mod+K` binds both Ctrl+K and Meta+K). Give each key one binding.

### BG1101

**`parseJSON`: the text is not a JSON array of objects.** Pass text like `[{"id":1,"sym":"AAA"}]`; wrap a single object in `[ ]`. See [Export & import](../export/).

### BG1102

**`exportXLSX`: the optional peer dependency `xlsx` is not installed.** Install it next to bo-grid: `npm i xlsx`. The core never loads it until you export.

### BG1103

**`parseJSON`: the text is not valid JSON.** The message includes the parser's reason. Pass the JSON text as received; for CSV or TSV text use `parseCSV` or `parseTSV`, or `parseRows` to detect the format. A `SyntaxError`, as before.

### BG1201

**Sparkline: no 2d canvas context.** Sparklines draw on a canvas, which a test environment such as jsdom does not have. Draw them in a browser; in tests, stub `HTMLCanvasElement.prototype.getContext`.

## Realtime

### BG2001

**`serveFeed`: a feed with that name already runs in this worker.** Give each feed in a worker its own `name`, or close the first one. See [Worker feeds](../worker-feed/).

### BG2002

**`createOrderBook`: `maxLevels` is not a whole number above 0.** Pass a whole number, such as `maxLevels: 20`, or leave it out to keep every level. See [Order book](../order-book/).

### BG2003

**`createLinger`: `ms` is not a finite number of 0 or more.** Pass how long a row lingers, in milliseconds, such as `ms: 3000` (`0` removes it at once). See [Orders & positions](../orders-positions/).

### BG2004

**`TradeTape`: the capacity is below 1 or not a finite number.** Pass how many trades to keep, such as `new TradeTape(500)`; a fraction is rounded down. See [Depth ladder](../depth-ladder/).

## Trading

### BG3001

**`createPositions`: a fill's `symbol` is empty or not a string.** Pass the instrument's symbol: `{ symbol: 'VNM', side: 'buy', qty: 100, price: 68.5 }`. See [Orders & positions](../orders-positions/).

### BG3002

**`createPositions`: a fill's `side` is not `'buy'` or `'sell'`.** Pass `side: 'buy'` or `side: 'sell'`, in lower case.

### BG3003

**`createPositions`: a fill's `qty` is not a number above 0.** Pass the filled quantity as a positive number; the side says which way (`side: 'sell'`, not a negative `qty`).

### BG3004

**`createPositions`: a fill's `price` is not a finite number.** Pass the price as a number, such as `price: 68.5`; parse strings first.

### BG3005

**`createPositions`: a fill's `fee` is not a finite number.** Pass the fee as a number, such as `fee: 1.2`, or leave it out.
