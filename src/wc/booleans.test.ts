import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOLEAN_PROPS } from './booleans';

describe('BOOLEAN_PROPS', () => {
  it('lists every <Grid> prop that takes a boolean, and nothing else', () => {
    const props = readFileSync(new URL('../lib/grid/props.ts', import.meta.url), 'utf8');
    const found = new Set<string>();
    for (const m of props.matchAll(/^\s+(\w+)\?:\s*([^;]+);/gm)) {
      const type = m[2];
      // A boolean, alone or in a union, but not a function returning one.
      if (/\bboolean\b/.test(type) && !type.includes('=>')) found.add(m[1]);
    }
    expect([...found].sort()).toEqual([...BOOLEAN_PROPS].sort());
  });
});
