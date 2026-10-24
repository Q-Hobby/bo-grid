---
title: Alerts
description: TODO
---

An alert that stays lit until someone acknowledges it: a rule on a row fires
when it turns true, and the row stays lit even if the price comes back.

```ts
import { createAlerts } from 'bo-grid/realtime';

let version = $state(0);
const alerts = createAlerts({
  key: (q) => q.symbol,
  rules: {
    above: (q) => q.alertAbove !== undefined && q.last >= q.alertAbove,
    below: (q) => q.alertBelow !== undefined && q.last <= q.alertBelow,
  },
  onChange: () => version++, // an alert fired, or was acknowledged
});
// On each update, with all rows or only the ones that changed:
for (const a of alerts.check(rows)) chime(a.key, a.rule);
```

```svelte
<script lang="ts">
  // A new function when an alert fires or is acknowledged, so the rows restyle.
  const rowClass = $derived.by(() => {
    void version;
    return (q) => (alerts.isLit(q) ? 'alert-lit' : undefined);
  });
</script>

<Grid {rows} {rowClass} hotkeys={{ a: ({ row }) => row && alerts.ack(row.symbol) }} />
```

- **Fires once per crossing.** A rule fires when it turns true; while it
  stays lit, the price can go back and forth without a second alert.
- **`ack(key, rule?)`** darkens a row's alerts (or one rule's). A rule still
  holding when acknowledged waits until it stops holding before it can fire
  again, so a price sitting past its level does not light up again at once.
- **`active()`** lists the lit alerts newest first, each with its row as last
  checked and when it fired: an alert panel. `size` counts them; `ackAll()`
  darkens them all.
- **The first check** fires for a rule already true; `fireOnFirst: false`
  waits for it to stop holding and turn true again.
- **Rows that leave:** `check(rows, { complete: true })` says the rows given
  are the whole list and forgets every key not among them, lit alerts
  included; `forget(key)` drops one, `clear()` all. Keys are unique within
  one `check`.
- **A level that moves** is just a rule that now reads differently: moved
  past the price, it fires; a lit alert stays lit until acknowledged, wherever
  the level goes. Acknowledge on edit if that is what your screen wants.
- **`onChange`** runs whenever the lit alerts change (a fire, an
  acknowledgement, a forget), so the rows restyle even with no data
  arriving. An alert's `row` is the row as last checked; a rule that throws
  stops the check after counting the alerts that fired before it.

The lit style is yours (`rowClass`, or `cellClass` on the price column). See
the crypto watchlist in the **FX & crypto** demo: a row lights when its price
reaches its level, and A acknowledges it.
