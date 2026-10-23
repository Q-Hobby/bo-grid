// Market session state — ATO / continuous / lunch break / ATC / closed.
//
// A trading screen needs to show which phase the market is in (order entry
// rules differ per phase — ATO/ATC are call-auction, continuous is order-book
// matching) and often mutes/dims the grid outside continuous trading. This is a
// pure function of wall-clock time in the exchange's own time zone, evaluated
// with `Intl.DateTimeFormat` so it's correct regardless of the viewer's local
// time zone — a trader in New York must see Ho Chi Minh City's session, not
// their own.
import { dateFormat } from '../format/intl';

export type SessionState = 'pre-open' | 'ato' | 'continuous' | 'break' | 'atc' | 'closed';

/** One time-of-day window, half-open `[start, end)`, in 24h `HH:mm` wall-clock
    time. Windows should tile the full day (00:00 → 24:00) with no gaps — an
    uncovered gap falls through to `'closed'`. */
export interface SessionWindow {
  start: string;
  end: string;
  state: SessionState;
}

/**
 * HOSE's standard trading-day schedule (Indochina Time, no DST). Does **not**
 * account for holidays, half-days, or special sessions (IPO first day, etc.) —
 * pair with your own trading-calendar check for those; this covers the
 * ordinary weekday shape.
 */
export const VN_HOSE_SCHEDULE: SessionWindow[] = [
  { start: '00:00', end: '09:00', state: 'pre-open' },
  { start: '09:00', end: '09:15', state: 'ato' },
  { start: '09:15', end: '11:30', state: 'continuous' },
  { start: '11:30', end: '13:00', state: 'break' },
  { start: '13:00', end: '14:30', state: 'continuous' },
  { start: '14:30', end: '14:45', state: 'atc' },
  { start: '14:45', end: '24:00', state: 'closed' },
];

const LABELS: Record<SessionState, string> = {
  'pre-open': 'Pre-open',
  ato: 'ATO',
  continuous: 'Continuous',
  break: 'Break',
  atc: 'ATC',
  closed: 'Closed',
};

/** A short, display-ready label for a session state. */
export function sessionLabel(state: SessionState): string {
  return LABELS[state];
}

export interface SessionOptions {
  /** IANA zone the schedule's `HH:mm` values are wall-clock time in. Default
      `'Asia/Ho_Chi_Minh'` (matches `VN_HOSE_SCHEDULE`) — pass your own
      schedule's zone if it differs. */
  timeZone?: string;
  /** Report `'closed'` on Saturday/Sunday (in `timeZone`) regardless of the
      time-of-day window. Default `true`. */
  skipWeekends?: boolean;
}

/** Wall-clock time of `date` in `timeZone`: `HH:mm` and the short weekday
    ('Mon'…'Sun'). Shared with the FX helpers (fx.ts); not exported from the
    entry. */
export function wallClock(date: Date, timeZone: string): { hhmm: string; weekday: string } {
  const parts = dateFormat('en-US', `clock${timeZone}`, {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // Intl can format midnight as "24:00" with hour12:false in some engines —
  // normalize to "00:00" so it compares correctly against window boundaries.
  const hh = get('hour') === '24' ? '00' : get('hour');
  return { hhmm: `${hh}:${get('minute')}`, weekday: get('weekday') };
}

/** Which `SessionWindow` covers `date`, evaluated in `schedule`'s time zone
    (default `Asia/Ho_Chi_Minh`). Falls back to `'closed'` for a time no window
    covers, and (by default) for a weekend. */
export function sessionStateAt(date: Date, schedule: SessionWindow[], opts: SessionOptions = {}): SessionState {
  const timeZone = opts.timeZone ?? 'Asia/Ho_Chi_Minh';
  const skipWeekends = opts.skipWeekends ?? true;
  const { hhmm, weekday } = wallClock(date, timeZone);

  if (skipWeekends && (weekday === 'Sat' || weekday === 'Sun')) return 'closed';

  for (const w of schedule) {
    if (hhmm >= w.start && hhmm < w.end) return w.state;
  }
  return 'closed';
}
