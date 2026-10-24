import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boError, type BoGridErrorCode } from './errors';
import { compileHotkeys } from './grid/hotkeys';
import { parseJSON } from './grid/export';
import { setupHiDpiCanvas } from './sparkline/sparkline-render';
import { serveFeed } from './realtime/worker-feed';
import { createOrderBook } from './realtime/book';
import { createLinger } from './realtime/linger';
import { TradeTape } from './realtime/tape';
import { createPositions, type PositionFill } from './trading/positions';

const LIB = dirname(fileURLToPath(import.meta.url));
const PAGE = join(LIB, '../../site/src/routes/(docs)/docs/errors/+page.md');

describe('boError', () => {
  it('says the code, what happened, the fix and where to read more', () => {
    const e = boError(RangeError, 'BG2004', 'TradeTape: capacity must be a number of 1 or more, got 0.', 'Pass how many trades to keep.');
    expect(e).toBeInstanceOf(RangeError);
    expect(e.code).toBe('BG2004');
    expect(e.message).toBe(
      'BG2004: TradeTape: capacity must be a number of 1 or more, got 0. Fix: Pass how many trades to keep. See https://bonguynvan.github.io/bo-grid/docs/errors/#bg2004',
    );
  });
});

const fill = (f: Partial<PositionFill>) => () => createPositions().fill({ symbol: 'VNM', side: 'buy', qty: 100, price: 68.5, ...f });
const noContext = { style: {}, getContext: () => null } as unknown as HTMLCanvasElement;

// One way to trigger each code, with the class it keeps from before codes.
const CASES: [BoGridErrorCode, new (...a: never[]) => Error, () => unknown][] = [
  ['BG1001', Error, () => compileHotkeys({ 'Ctrl+': 0 })],
  ['BG1002', Error, () => compileHotkeys({ 'Ctl+B': 0 })],
  ['BG1003', Error, () => compileHotkeys({ 'Shift+1': 0 })],
  ['BG1004', Error, () => compileHotkeys({ 'Mod+K': 0, 'Ctrl+K': 1 })],
  ['BG1101', Error, () => parseJSON('{"id":1}')],
  ['BG1103', SyntaxError, () => parseJSON('id,sym')],
  ['BG1201', Error, () => setupHiDpiCanvas(noContext, 40, 20)],
  ['BG2001', Error, () => {
    const scope = new EventTarget();
    serveFeed({ scope });
    serveFeed({ scope });
  }],
  ['BG2002', RangeError, () => createOrderBook({ maxLevels: 2.5 })],
  ['BG2003', RangeError, () => createLinger({ ms: -1, key: (r: { id: number }) => r.id })],
  ['BG2004', RangeError, () => new TradeTape(0)],
  ['BG3001', TypeError, fill({ symbol: '' })],
  ['BG3002', TypeError, fill({ side: 'BUY' as 'buy' })],
  ['BG3003', RangeError, fill({ qty: -100 })],
  ['BG3004', RangeError, fill({ price: Number.NaN })],
  ['BG3005', RangeError, fill({ fee: Number.NaN })],
];

describe('the errors bo-grid throws', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('xlsx');
  });

  it.each(CASES)('%s carries its code, a fix and its link', (code, Kind, run) => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    let thrown: unknown;
    try {
      run();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Kind);
    expect((thrown as { code?: string }).code).toBe(code);
    expect((thrown as Error).message).toMatch(new RegExp(`^${code}: .+ Fix: .+ See https://\\S+#${code.toLowerCase()}$`));
  });

  it('BG1102 when the optional xlsx peer is missing', async () => {
    vi.resetModules();
    vi.doMock('xlsx', () => {
      throw new Error('Cannot find package xlsx');
    });
    const { exportXLSX } = await import('./grid/export-xlsx');
    await expect(exportXLSX('out.xlsx', [], [])).rejects.toMatchObject({ code: 'BG1102' });
  });
});

// The union of codes, the throw sites and the docs page all list the same
// codes, so neither the types nor the page can drift from what is thrown.
describe('the error codes page', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return files(p);
      return /\.(ts|svelte)$/.test(f) && !/\.test\./.test(f) && f !== 'errors.ts' ? [p] : [];
    });
  const sources = files(LIB).map((f) => readFileSync(f, 'utf8'));
  const sites = sources.flatMap((s) => [...s.matchAll(/boError\(\s*\w+\s*,\s*['"`](BG\d{4})['"`]/g)].map((m) => m[1]));
  const thrown = new Set(sites);
  const union = readFileSync(join(LIB, 'errors.ts'), 'utf8').match(/export type BoGridErrorCode =([^;]*);/)?.[1] ?? '';
  const typed = new Set([...union.matchAll(/'(BG\d{4})'/g)].map((m) => m[1]));
  const documented = new Set([...readFileSync(PAGE, 'utf8').matchAll(/^### (BG\d{4})$/gm)].map((m) => m[1]));
  const sorted = (s: Iterable<string>) => [...s].sort();

  it('reads every throw site: each boError call names its code inline', () => {
    const calls = sources.reduce((n, s) => n + (s.match(/boError\(/g)?.length ?? 0), 0);
    expect(sites.length).toBe(calls);
    expect(sites.length).toBeGreaterThan(0);
  });

  it('throws only coded errors', () => {
    expect(sources.filter((s) => /throw new \w*Error\(/.test(s))).toEqual([]);
  });

  it('uses each code at one place only', () => {
    expect(sites.length).toBe(thrown.size);
  });

  it('documents exactly the codes the library throws', () => {
    expect(sorted(documented)).toEqual(sorted(thrown));
  });

  it('types exactly the codes the library throws', () => {
    expect(sorted(typed)).toEqual(sorted(thrown));
  });

  it('tests every code', () => {
    expect(sorted([...CASES.map(([code]) => code), 'BG1102'])).toEqual(sorted(thrown));
  });
});
