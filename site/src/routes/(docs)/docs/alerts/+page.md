---
title: Alerts
description: Price alerts that fire once per crossing and stay lit until someone acknowledges them, with createAlerts from bo-grid/realtime.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

An alert on a trading screen must not be missed. A price that touches its level and comes back has still crossed it, so a highlight that follows the current price is not enough. `createAlerts` from `bo-grid/realtime` keeps that state: named rules on a row fire when they turn true, and the row stays lit until someone acknowledges it, wherever the price goes next.

Each row below has a level above and below its price. When the last price crosses one, the row lights up and stays lit. Acknowledge one row with A, or all of them with the button.

<Example name="alerts" title="Alerts that stay lit" />

## Creating alerts

```ts
import { createAlerts } from 'bo-grid/realtime';

// Quote is your row type: { id, symbol, last, alertAbove?, alertBelow?, … }
let version = $state(0);
const alerts = createAlerts<Quote, string>({
  key: (q) => q.symbol,
  rules: {
    above: (q) => q.alertAbove !== undefined && q.last >= q.alertAbove,
    below: (q) => q.alertBelow !== undefined && q.last <= q.alertBelow,
  },
  onChange: () => version++, // an alert fired, or was acknowledged
});

// On each update, with all the quotes or only the ones that changed:
for (const a of alerts.check(quotes)) chime(a.key, a.rule);
```

`check` returns the alerts that fired just now, each `{ key, rule, row, at }`: play a sound, or show a toast. With plain rows patched through `api.patchRows`, call it right after the patch, when the rows hold the new values.

## Lighting the rows

The lit style is yours, through `rowClass` (or `cellClass` on the price column). Give the grid a new function whenever the lit alerts change, so the rows restyle even when no data arrives:

```svelte
<script lang="ts">
  const rowClass = $derived.by(() => {
    void version; // a new function when an alert fires or is acknowledged
    return (row: GridRow) => (alerts.isLit(row as Quote) ? 'alert-lit' : undefined);
  });
</script>

<Grid rows={quotes} {columns} {rowClass} hotkeys={{ a: ({ row }) => { if (row) alerts.ack(String(row.symbol)); } }} height={480} />
```

The grid hands callbacks a `GridRow`; the cast says it is one of your quotes.

`isLit(row, rule?)` asks about one rule or any; `lit(row)` lists a row's lit rules. A hotkey (see [Keyboard & hotkeys](../keyboard/)) acknowledges the focused row.

## How alerts behave

- **Once per crossing.** A rule fires when it turns true. While it stays lit, the price can go back and forth without a second alert.
- **Acknowledging.** `ack(key, rule?)` darkens a row's alerts, or one rule's, and returns how many went dark; `ackAll()` darkens them all. A rule still holding when acknowledged waits until it stops holding before it can fire again, so a price sitting past its level does not light up again at once.
- **An alert panel.** `active()` lists the lit alerts, newest first, each with its row as last checked and when it fired. `size` counts them.
- **The first check** fires for a rule that is already true. With `fireOnFirst: false`, it waits for the rule to stop holding and turn true again.
- **A level that moves** is a rule that now reads differently: moved past the price, it fires. A lit alert stays lit until acknowledged, wherever the level goes; acknowledge on edit if that is what your screen wants.
- **Rows that leave.** `check(rows, { complete: true })` says the rows given are the whole list and forgets every key not among them, lit alerts included. `forget(key)` drops one key, and `clear()` everything. Keys are unique within one `check`.
- **Errors.** A rule that throws stops the check there, after counting the alerts that fired before it.

`onChange` runs whenever the lit alerts change (a fire, an acknowledgement, a forget), and `version` bumps with it.

The crypto watchlist in the FX and crypto example lights a row when its price reaches its level; A acknowledges it:

<Example id="fxcrypto" />

## Reference

`createAlerts<R, K>(options)` returns an `Alerts<R, K>`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `key` | `(row: R) => K` | required | A row's identity (its symbol). |
| `rules` | `Record<string, (row: R) => boolean>` | required | Named rules; each fires when it turns true. Read once, when the alerts are made. |
| `fireOnFirst` | `boolean` | `true` | Whether a rule already true at a row's first check fires. |
| `onChange` | `() => void` | none | Runs when the lit alerts change. |

| Member | What it does |
| --- | --- |
| `check(rows, { complete? })` | Checks rows and returns the alerts that fired now. |
| `isLit(row, rule?)` | Whether a row has a lit alert (for `rule`, or any). |
| `lit(row)` | A row's lit rules, in the order the rules were given. |
| `ack(key, rule?)` | Acknowledges a row's alerts; returns how many went dark. |
| `ackAll()` | Acknowledges every alert. |
| `active()` | The lit alerts, newest first. |
| `size`, `version` | Lit alerts; a counter that bumps on every change. |
| `forget(key)`, `clear()` | Drops one key, or everything. |

<Props names={['rowClass', 'hotkeys']} />
