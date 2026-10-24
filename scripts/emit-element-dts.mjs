// The web-component entry (src/wc/element.ts) is bundled by Vite, which doesn't
// emit type declarations. Hand-write dist/bo-grid.element.d.ts so consumers get
// a typed `config`, a `BoGridElement` interface and the `createBoGrid` helper —
// importing GridProps from the sibling dist/index.d.ts (svelte-package output).
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('dist/bo-grid.element.d.ts');
if (!existsSync(resolve('dist/index.d.ts'))) {
  console.error('emit-element-dts: dist/index.d.ts missing — run svelte-package first');
  process.exit(1);
}

const dts = `// Type declarations for the \`bo-grid/element\` entry (the <bo-grid> custom element).
import type { GridProps } from './index';

/** The <bo-grid> \`config\` object — every <Grid> prop. */
export type BoGridConfig = GridProps;

/** A <bo-grid> DOM element with a typed \`config\` property. */
export interface BoGridElement extends HTMLElement {
  config?: BoGridConfig;
}

/** Create a <bo-grid> element with its \`config\` already set (safe
 *  create-before-attach pattern for React/Vue/vanilla). */
export function createBoGrid(config?: BoGridConfig): BoGridElement;

declare const BoGrid: unknown;
export default BoGrid;
`;

writeFileSync(out, dts);

// The React and Vue wrappers (src/wc/react.ts, src/wc/vue.ts), bundled by the
// same Vite build.
const react = `// Type declarations for the \`bo-grid/react\` entry.
import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react';
import type { GridApi } from './index';
import type { BoGridConfig } from './bo-grid.element';

/** Every <Grid> prop, plus the wrapper div's \`className\` and \`style\`. */
export interface BoGridProps extends BoGridConfig {
  className?: string;
  style?: CSSProperties;
}

/** The grid as a React component; its ref is the grid's API once it is ready. */
export declare const BoGrid: ForwardRefExoticComponent<BoGridProps & RefAttributes<GridApi | null>>;
`;
writeFileSync(resolve('dist/bo-grid.react.d.ts'), react);

const vue = `// Type declarations for the \`bo-grid/vue\` entry.
import type { DefineComponent } from 'vue';
import type { GridApi } from './index';
import type { BoGridConfig } from './bo-grid.element';

/** The grid as a Vue component: every <Grid> prop as an attribute, every
 *  callback as an event (\`@cell-edit\` is \`onCellEdit\`); the template ref's
 *  \`api\` is the grid's API once it is ready. */
export declare const BoGrid: DefineComponent<BoGridConfig, { api: GridApi | null }>;
`;
writeFileSync(resolve('dist/bo-grid.vue.d.ts'), vue);
console.log('emit-element-dts: wrote dist/bo-grid.element.d.ts, bo-grid.react.d.ts, bo-grid.vue.d.ts');
