import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAlerts } from './alerts';

interface Quote {
  sym: string;
  last: number;
}
const q = (sym: string, last: number): Quote => ({ sym, last });
const rules = { above: (r: Quote) => r.last >= 100, below: (r: Quote) => r.last <= 50 };

afterEach(() => vi.useRealTimers());

describe('createAlerts', () => {
  it('fires when a rule turns true, and stays lit until acknowledged', () => {
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules });
    expect(alerts.check([q('A', 90)])).toEqual([]);
    const fired = alerts.check([q('A', 101)]);
    expect(fired.map((a) => [a.key, a.rule, a.row.last])).toEqual([['A', 'above', 101]]);
    // Back under the level, and over it again: still the one alert, still lit.
    expect(alerts.check([q('A', 95)])).toEqual([]);
    expect(alerts.check([q('A', 102)])).toEqual([]);
    expect(alerts.lit(q('A', 0))).toEqual(['above']);
    expect(alerts.size).toBe(1);
  });

  it('keeps an alert acknowledged while its rule holds, and fires again once it has not', () => {
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules });
    alerts.check([q('A', 101)]);
    expect(alerts.ack('A')).toBe(1);
    expect(alerts.isLit(q('A', 0))).toBe(false);
    // Still over: no new alert for the same crossing.
    expect(alerts.check([q('A', 105)])).toEqual([]);
    // Under, then over again: a new crossing, a new alert.
    alerts.check([q('A', 99)]);
    expect(alerts.check([q('A', 100)]).map((a) => a.rule)).toEqual(['above']);
    // Acknowledged while the rule no longer holds: armed at once.
    alerts.check([q('A', 98)]);
    alerts.ack('A');
    expect(alerts.check([q('A', 100)]).map((a) => a.rule)).toEqual(['above']);
  });

  it('fires for a rule already true at the first check, unless told to wait for it to turn true', () => {
    const now = createAlerts<Quote, string>({ key: (r) => r.sym, rules });
    expect(now.check([q('A', 120)]).map((a) => a.rule)).toEqual(['above']);
    const wait = createAlerts<Quote, string>({ key: (r) => r.sym, rules, fireOnFirst: false });
    expect(wait.check([q('A', 120)])).toEqual([]);
    expect(wait.check([q('A', 120)])).toEqual([]);
    wait.check([q('A', 80)]);
    expect(wait.check([q('A', 100)]).map((a) => a.rule)).toEqual(['above']);
    // A key first seen later waits too.
    expect(wait.check([q('B', 10)])).toEqual([]);
  });

  it('keeps each rule apart, and acknowledges one rule or all of a row', () => {
    const swing = { ...rules, moved: (r: Quote) => Math.abs(r.last - 75) > 20 };
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules: swing });
    alerts.check([q('A', 120)]);
    expect(alerts.lit(q('A', 0))).toEqual(['above', 'moved']);
    expect(alerts.isLit(q('A', 0), 'moved')).toBe(true);
    expect(alerts.ack('A', 'moved')).toBe(1);
    expect(alerts.lit(q('A', 0))).toEqual(['above']);
    expect(alerts.ack('A', 'below')).toBe(0);
    expect(alerts.ack('A')).toBe(1);
    expect(alerts.size).toBe(0);
  });

  it('lists lit alerts newest first, with each row as last checked', () => {
    vi.useFakeTimers({ now: 1000 });
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules });
    alerts.check([q('A', 100), q('B', 40)]);
    vi.advanceTimersByTime(500);
    alerts.check([q('C', 30), q('A', 110)]);
    // B fired after A in the same check, so it is the newer of the two.
    expect(alerts.active().map((a) => [a.key, a.rule, a.at, a.row.last])).toEqual([
      ['C', 'below', 1500, 30],
      ['B', 'below', 1000, 40],
      ['A', 'above', 1000, 110],
    ]);
    expect(alerts.ackAll()).toBe(3);
    expect(alerts.active()).toEqual([]);
  });

  it('checks the rows it is given only, so an update can pass just the rows that changed', () => {
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules });
    alerts.check([q('A', 101), q('B', 60)]);
    alerts.check([q('B', 45)]);
    expect(alerts.isLit(q('A', 0))).toBe(true);
    expect(alerts.isLit(q('B', 0))).toBe(true);
  });

  it('counts a version on each alert fired or acknowledged, for a row class to follow', () => {
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules });
    const v0 = alerts.version;
    alerts.check([q('A', 90)]);
    expect(alerts.version).toBe(v0);
    alerts.check([q('A', 100)]);
    const v1 = alerts.version;
    expect(v1).toBeGreaterThan(v0);
    alerts.check([q('A', 101)]);
    expect(alerts.version).toBe(v1);
    alerts.ack('A');
    expect(alerts.version).toBeGreaterThan(v1);
    expect(alerts.ack('A')).toBe(0);
  });

  it('calls onChange when the lit alerts change, and only then', () => {
    const onChange = vi.fn();
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules, onChange });
    alerts.check([q('A', 90)]);
    expect(onChange).not.toHaveBeenCalled();
    alerts.check([q('A', 100), q('B', 40)]);
    expect(onChange).toHaveBeenCalledTimes(1);
    alerts.ack('A');
    alerts.ack('A'); // nothing lit there any more
    expect(onChange).toHaveBeenCalledTimes(2);
    alerts.forget('A'); // only an acknowledged rule left: nothing visible changes
    expect(onChange).toHaveBeenCalledTimes(2);
    alerts.ackAll();
    expect(onChange).toHaveBeenCalledTimes(3);
    alerts.clear(); // already dark
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('keeps the alerts that fired before a rule threw, and tells onChange', () => {
    const onChange = vi.fn();
    const alerts = createAlerts<Quote, string>({
      key: (r) => r.sym,
      rules: {
        above: (r) => r.last >= 100,
        broken: (r) => {
          if (r.sym === 'B') throw new Error('bad row');
          return false;
        },
      },
      onChange,
    });
    expect(() => alerts.check([q('A', 120), q('B', 120)])).toThrow('bad row');
    // A, and B's first rule, fired before B's second rule threw.
    expect(alerts.isLit(q('A', 0))).toBe(true);
    expect(alerts.isLit(q('B', 0), 'above')).toBe(true);
    expect(alerts.size).toBe(2);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forgets the keys missing from a complete check', () => {
    const onChange = vi.fn();
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules, onChange });
    alerts.check([q('A', 120), q('B', 40)]);
    alerts.check([q('B', 41)], { complete: true });
    expect(alerts.isLit(q('A', 0))).toBe(false);
    expect(alerts.size).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    // Without fireOnFirst, a key that left is new again when it returns.
    const wait = createAlerts<Quote, string>({ key: (r) => r.sym, rules, fireOnFirst: false });
    wait.check([q('A', 80)]);
    wait.check([], { complete: true });
    expect(wait.check([q('A', 120)])).toEqual([]);
  });

  it('reads the rules once, when made', () => {
    const table: Record<string, (r: Quote) => boolean> = { above: (r) => r.last >= 100 };
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules: table });
    delete table.above;
    table.other = () => true;
    expect(alerts.check([q('A', 120)]).map((a) => a.rule)).toEqual(['above']);
  });

  it('forgets a key, or everything', () => {
    const alerts = createAlerts<Quote, string>({ key: (r) => r.sym, rules, fireOnFirst: false });
    alerts.check([q('A', 80)]);
    alerts.check([q('A', 100), q('B', 80)]);
    alerts.check([q('B', 40)]);
    alerts.forget('A');
    expect(alerts.isLit(q('A', 0))).toBe(false);
    expect(alerts.size).toBe(1);
    // Forgotten: seen afresh, so it waits for a crossing again.
    expect(alerts.check([q('A', 120)])).toEqual([]);
    alerts.clear();
    expect(alerts.size).toBe(0);
    expect(alerts.check([q('B', 40)])).toEqual([]);
  });
});
