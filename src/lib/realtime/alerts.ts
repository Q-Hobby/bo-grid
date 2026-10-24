// Alerts that stay lit until acknowledged: a rule on a row (a price at or
// past a level, a move too large) fires when it turns true and stays lit,
// even if the price comes back, until someone acknowledges it. Then it waits
// for the rule to stop holding before it can fire again, so a price sitting
// past its level does not light up again the moment it is acknowledged.
//
//   let version = $state(0);
//   const alerts = createAlerts({
//     key: (q) => q.symbol,
//     rules: { above: (q) => q.last >= q.alertAbove, below: (q) => q.last <= q.alertBelow },
//     onChange: () => version++,      // an alert fired or was acknowledged
//   });
//   // On each update (all rows, or just the ones that changed):
//   for (const a of alerts.check(rows)) chime(a);
//   // A new function when the lit alerts change, so the grid restyles:
//   const rowClass = $derived.by(() => {
//     void version;
//     return (q) => (alerts.isLit(q) ? 'alert-lit' : undefined);
//   });
//   <Grid {rows} {rowClass} hotkeys={{ a: ({ row }) => row && alerts.ack(row.symbol) }} />

export interface AlertsOptions<R, K> {
  /** The identity of a row (its symbol). Unique within one `check`. */
  key: (row: R) => K;
  /** Named rules on a row; each fires when it turns true. Read once, when
      the alerts are made. */
  rules: Readonly<Record<string, (row: R) => boolean>>;
  /** A rule already true the first time a row is checked: fire (the
      default), or wait for it to stop holding and turn true again. */
  fireOnFirst?: boolean;
  /** Called when the lit alerts change: one fired, or was acknowledged or
      forgotten. Restyle the rows here. */
  onChange?: () => void;
}

/** A lit alert. */
export interface Alert<R, K> {
  key: K;
  rule: string;
  /** The row as last checked (a snapshot: reading it again after later
      checks needs `active()` again). */
  row: R;
  /** When it fired (ms since the epoch). */
  at: number;
}

export interface CheckOptions {
  /** The rows given are the whole list: forget every key not among them,
      lit alerts included (their rows have left). */
  complete?: boolean;
}

export interface Alerts<R, K> {
  /** Checks the rows given (all of them, or the ones that changed) and
      returns the alerts that fired just now. A rule that throws stops the
      check there, after counting the alerts that fired before it. */
  check(rows: Iterable<R>, opts?: CheckOptions): Alert<R, K>[];
  /** The rules lit for a row, in the order the rules were given. */
  lit(row: R): string[];
  /** Whether a row has a lit alert (for `rule`, or any). */
  isLit(row: R, rule?: string): boolean;
  /** Acknowledges a row's lit alerts (or one rule's); how many went dark. */
  ack(key: K, rule?: string): number;
  /** Acknowledges every lit alert; how many went dark. */
  ackAll(): number;
  /** The lit alerts, newest first: an alert panel. */
  active(): Alert<R, K>[];
  /** Lit alerts. */
  readonly size: number;
  /** Bumps when the lit alerts change, as `onChange` is called. */
  readonly version: number;
  /** Drops what is known of a key: its row left for good. */
  forget(key: K): void;
  /** Drops everything. */
  clear(): void;
}

/** A rule that is not simply armed: lit, or acknowledged while it still
    holds (`row` undefined). */
interface Entry<R> {
  lit: boolean;
  /** Whether the rule held at the last check. */
  on: boolean;
  row: R | undefined;
  at: number;
  /** Order of firing, for alerts that fired in the same millisecond. */
  seq: number;
}

export function createAlerts<R, K>(opts: AlertsOptions<R, K>): Alerts<R, K> {
  const { key, fireOnFirst = true, onChange } = opts;
  const rules = { ...opts.rules };
  const names = Object.keys(rules);
  // Per key, the rules that are lit or held; a rule not here is armed.
  const state = new Map<K, Map<string, Entry<R>>>();
  // Keys checked before, when a rule true at the first check must wait.
  const seen = fireOnFirst ? null : new Set<K>();
  let size = 0;
  let version = 0;
  let seq = 0;

  const changed = (): void => {
    version++;
    onChange?.();
  };

  function darken(k: K, entries: Map<string, Entry<R>>, rule: string, e: Entry<R>): void {
    e.lit = false;
    e.row = undefined;
    size--;
    if (!e.on) entries.delete(rule);
    if (entries.size === 0) state.delete(k);
  }

  /** Drops a key; how many lit alerts went with it. */
  function drop(k: K): number {
    let n = 0;
    const entries = state.get(k);
    if (entries) {
      for (const e of entries.values()) if (e.lit) n++;
      state.delete(k);
      size -= n;
    }
    seen?.delete(k);
    return n;
  }

  return {
    check(rows, o) {
      const fired: Alert<R, K>[] = [];
      const now = Date.now();
      const here = o?.complete ? new Set<K>() : null;
      let gone = 0;
      try {
        for (const row of rows) {
          const k = key(row);
          here?.add(k);
          const first = seen !== null && !seen.has(k);
          let entries = state.get(k);
          for (const rule of names) {
            const on = rules[rule](row);
            const e = entries?.get(rule);
            if (e) {
              e.on = on;
              if (e.lit) e.row = row;
              else if (!on) entries!.delete(rule); // held, and no longer holds: armed
            } else if (on) {
              if (!entries) state.set(k, (entries = new Map()));
              if (first) entries.set(rule, { lit: false, on, row: undefined, at: now, seq: 0 });
              else {
                entries.set(rule, { lit: true, on, row, at: now, seq: ++seq });
                size++;
                fired.push({ key: k, rule, row, at: now });
              }
            }
          }
          if (entries && entries.size === 0) state.delete(k);
          if (first) seen!.add(k);
        }
        if (here) {
          for (const k of [...state.keys()]) if (!here.has(k)) gone += drop(k);
          if (seen) for (const k of [...seen]) if (!here.has(k)) seen.delete(k);
        }
      } finally {
        if (fired.length > 0 || gone > 0) changed();
      }
      return fired;
    },
    lit(row) {
      const entries = state.get(key(row));
      return entries ? names.filter((n) => entries.get(n)?.lit) : [];
    },
    isLit(row, rule) {
      const entries = state.get(key(row));
      if (!entries) return false;
      if (rule !== undefined) return entries.get(rule)?.lit === true;
      for (const e of entries.values()) if (e.lit) return true;
      return false;
    },
    ack(k, rule) {
      const entries = state.get(k);
      if (!entries) return 0;
      let n = 0;
      for (const [r, e] of [...entries]) {
        if (e.lit && (rule === undefined || r === rule)) {
          darken(k, entries, r, e);
          n++;
        }
      }
      if (n > 0) changed();
      return n;
    },
    ackAll() {
      let n = 0;
      for (const [k, entries] of [...state]) {
        for (const [r, e] of [...entries]) {
          if (e.lit) {
            darken(k, entries, r, e);
            n++;
          }
        }
      }
      if (n > 0) changed();
      return n;
    },
    active() {
      const lit: [Entry<R>, Alert<R, K>][] = [];
      for (const [k, entries] of state) {
        for (const [rule, e] of entries) if (e.lit) lit.push([e, { key: k, rule, row: e.row as R, at: e.at }]);
      }
      return lit.sort(([a], [b]) => b.at - a.at || b.seq - a.seq).map(([, alert]) => alert);
    },
    get size() {
      return size;
    },
    get version() {
      return version;
    },
    forget(k) {
      if (drop(k) > 0) changed();
    },
    clear() {
      const had = size;
      state.clear();
      seen?.clear();
      size = 0;
      if (had > 0) changed();
    },
  };
}
