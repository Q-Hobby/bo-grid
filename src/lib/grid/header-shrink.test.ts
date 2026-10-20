/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import source from './Grid.svelte?raw';

// jsdom has no layout, so this reads the rule instead of measuring. With a CSS
// height and rows that overflow, the viewport's flex basis is its full content
// height. The header rows clip (overflow: hidden), which drops their minimum
// height to 0, so without flex-shrink: 0 they shrank with the viewport to ~3px
// and the rows drew over them.

const style = source.slice(source.indexOf('<style>'));

/** The declarations of every rule whose selector list includes `selector`. */
function declarations(selector: string): string {
  const out: string[] = [];
  for (const m of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim());
    if (selectors.includes(selector)) out.push(m[2]);
  }
  return out.join(';');
}

describe('header rows with a CSS height', () => {
  it.each(['.head', '.head-groups', '.filter-row'])('%s does not shrink', (selector) => {
    expect(declarations(selector)).toMatch(/flex-shrink:\s*0/);
  });
});
