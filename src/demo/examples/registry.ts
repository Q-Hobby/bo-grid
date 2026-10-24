import TradingDesk from './TradingDesk.svelte';
import { CATALOG } from './catalog';

export type { Example } from './catalog';

// Only the default example ships in the demo's entry chunk; the rest are
// code-split and fetched on demand. CSS is merged into one file
// (build.cssCodeSplit: false) so the lazy JS chunks have no stylesheet to preload.
export const EXAMPLES = CATALOG.map((e) => (e.id === 'trading' ? { ...e, component: TradingDesk } : e));
