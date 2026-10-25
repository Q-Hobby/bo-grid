// Entry for the `bo-grid` custom element. Importing this module registers
// `<bo-grid>` with the browser (Svelte does the `customElements.define` when the
// component compiles with `<svelte:options customElement>`).
//
//   import 'bo-grid/element';
//   const el = document.querySelector('bo-grid');
//   el.config = { rows, columns, theme: 'dark' };
//
// Works in React, Vue, Angular and vanilla — see https://bonguynvan.github.io/bo-grid/docs/frameworks/
import BoGrid from './BoGrid.svelte';
import type { GridProps } from '../lib';

/** The `<bo-grid>` config object — every `<Grid>` prop. */
export type BoGridConfig = GridProps;

/** A `<bo-grid>` DOM element with a typed `config` property. */
export interface BoGridElement extends HTMLElement {
  config?: BoGridConfig;
}

/**
 * Create a `<bo-grid>` element with its `config` already set — the safe
 * create-before-attach pattern for React/Vue/vanilla:
 *
 *   const el = createBoGrid({ columns, rows, height: 520 });
 *   container.append(el);
 *   // later: el.config = { ...el.config, rows: next };
 */
export function createBoGrid(config?: BoGridConfig): BoGridElement {
  const el = document.createElement('bo-grid') as BoGridElement;
  if (config) el.config = config;
  return el;
}

// Reference the import so bundlers keep it (the side effect is registration).
export default BoGrid;
