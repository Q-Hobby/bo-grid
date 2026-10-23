// Intl formatters cost tens of microseconds to create and about a microsecond
// to use. `toLocaleString(locale, options)` creates one on every call, which
// on a grid means every cell render; these keep one per locale and option set
// instead. The output is the same: toLocaleString is defined as formatting
// with Intl.NumberFormat / Intl.DateTimeFormat for those locales and options.
// Callers pass `key`, a short stable name for their options, so a lookup
// never serialises the options object.

type Formatter = Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat;
const cache = new Map<string, Formatter>();

function cached<F extends Formatter>(key: string, locale: string | undefined, make: () => F): F {
  const k = `${locale ?? ''}\u0001${key}`;
  let f = cache.get(k) as F | undefined;
  if (!f) cache.set(k, (f = make()));
  return f;
}

export function numberFormat(locale: string | undefined, key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  return cached(`n${key}`, locale, () => new Intl.NumberFormat(locale, opts));
}

export function dateFormat(locale: string | undefined, key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(`d${key}`, locale, () => new Intl.DateTimeFormat(locale, opts));
}

export function relativeFormat(locale: string | undefined): Intl.RelativeTimeFormat {
  return cached('r', locale, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
}
