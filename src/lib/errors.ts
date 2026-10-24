// Errors as prompts: every error bo-grid throws carries a stable code, says
// what happened (with the value it got), gives the exact fix, and links to
// that code's entry in the docs, so a person or a coding agent can act on it
// without reading the source. Codes never change meaning; the docs page lists
// them all (site: /docs/errors/, checked against this source by a test).

/** Every code bo-grid throws. Each has an entry at /docs/errors/, and a code never changes meaning. */
export type BoGridErrorCode =
  // grid: hotkeys
  | 'BG1001'
  | 'BG1002'
  | 'BG1003'
  | 'BG1004'
  // grid: export and import
  | 'BG1101'
  | 'BG1102'
  | 'BG1103'
  // grid: sparklines
  | 'BG1201'
  // bo-grid/realtime
  | 'BG2001'
  | 'BG2002'
  | 'BG2003'
  | 'BG2004'
  // bo-grid/trading
  | 'BG3001'
  | 'BG3002'
  | 'BG3003'
  | 'BG3004'
  | 'BG3005';

/** An error bo-grid threw: still an `Error`, `TypeError`, `RangeError` or `SyntaxError`, with a stable `code`. */
export type BoGridError<E extends Error = Error> = E & { readonly code: BoGridErrorCode };

const DOCS = 'https://bonguynvan.github.io/bo-grid/docs/errors/';

/**
 * Build an error of `Kind` (Error, TypeError, RangeError, SyntaxError) whose
 * message reads `BG2004: <what> Fix: <fix> See <docs>#bg2004`, with `code` set.
 *
 * @example
 * throw boError(RangeError, 'BG2004', `TradeTape: capacity must be a number of 1 or more, got ${n}.`, 'Pass how many trades to keep, e.g. new TradeTape(500).');
 */
export function boError<E extends Error>(
  Kind: new (message: string) => E,
  code: BoGridErrorCode,
  what: string,
  fix: string,
): BoGridError<E> {
  return Object.assign(new Kind(`${code}: ${what} Fix: ${fix} See ${DOCS}#${code.toLowerCase()}`), { code });
}
