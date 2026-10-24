// The site's navigation: the sidebar, the quick-jump palette, previous / next
// and the generated llms.txt all read it.
import { CATALOG } from '$demo/examples/catalog';

export interface NavItem {
  title: string;
  /** A site path (base-relative), or an absolute URL for an outside page. */
  href: string;
  /** Another site: opens in a new tab. */
  external?: boolean;
  /** A file on this site outside the app (api.html): a full page load. */
  reload?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const doc = (title: string, slug: string): NavItem => ({ title, href: slug ? `/docs/${slug}/` : '/docs/' });

/** The docs, by topic: one page per feature, each with its live examples. */
export const DOCS_NAV: NavGroup[] = [
  {
    title: 'Get started',
    items: [
      doc('Introduction', ''),
      doc('Quick start', 'getting-started'),
      doc('React, Vue & more', 'frameworks'),
      doc('SvelteKit & SSR', 'sveltekit'),
      doc('AI coding agents', 'ai'),
    ],
  },
  {
    title: 'Columns',
    items: [
      doc('Column definitions', 'columns'),
      doc('Column types', 'column-types'),
      doc('Custom cells', 'custom-cells'),
      doc('Conditional formatting', 'conditional-formatting'),
      doc('Computed columns', 'computed-columns'),
      doc('Column sizing', 'column-sizing'),
      doc('Moving & hiding', 'column-moving'),
      doc('Pinned columns', 'pinned-columns'),
      doc('Header groups', 'header-groups'),
    ],
  },
  {
    title: 'Rows',
    items: [
      doc('Row height & grid size', 'row-height'),
      doc('Row selection', 'row-selection'),
      doc('Row numbers', 'row-numbers'),
      doc('Row styles', 'row-styles'),
      doc('Row reordering', 'row-reordering'),
      doc('Pinned rows', 'pinned-rows'),
      doc('Merged cells', 'merged-cells'),
      doc('Master-detail', 'master-detail'),
      doc('Pagination', 'pagination'),
    ],
  },
  {
    title: 'Sorting & filtering',
    items: [doc('Sorting & filtering', 'sorting-filtering'), doc('Custom filters', 'custom-filters'), doc('Find in grid', 'find')],
  },
  {
    title: 'Editing & selection',
    items: [
      doc('Inline editing', 'editing'),
      doc('Custom editors', 'custom-editors'),
      doc('Cell selection & clipboard', 'selection'),
      doc('Keyboard & hotkeys', 'keyboard'),
    ],
  },
  {
    title: 'Grouping & pivot',
    items: [doc('Row grouping', 'grouping'), doc('Server-side grouping', 'server-grouping'), doc('Tree data', 'tree-data'), doc('Pivot tables', 'pivot')],
  },
  {
    title: 'Realtime',
    items: [
      doc('Live updates', 'realtime'),
      doc('Cell flashing', 'flashing'),
      doc('Tick streams', 'tick-stream'),
      doc('Worker feeds', 'worker-feed'),
      doc('Viewport streaming', 'viewport-streaming'),
    ],
  },
  {
    title: 'Trading',
    items: [
      doc('Market conventions', 'trading'),
      doc('Order book', 'order-book'),
      doc('Depth ladder', 'depth-ladder'),
      doc('Orders & positions', 'orders-positions'),
      doc('Alerts', 'alerts'),
    ],
  },
  {
    title: 'Large data',
    items: [doc('Server-side data', 'server-data'), doc('Wide grids', 'wide-grids')],
  },
  {
    title: 'Styling',
    items: [doc('Theming', 'theming'), doc('Localization', 'localization'), doc('Accessibility', 'accessibility')],
  },
  {
    title: 'Export & API',
    items: [doc('Export & import', 'export'), doc('Grid API', 'grid-api'), doc('Props reference', 'reference'), { title: 'All exports', href: '/api.html', reload: true }],
  },
];

/** Examples by kind; each example id appears once. */
const EXAMPLE_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Trading', ids: ['trading', 'priceboard', 'vnboard', 'fxcrypto', 'orderbook', 'ladder', 'orders', 'timesales', 'blotter', 'liveblotter'] },
  { title: 'Data', ids: ['portfolio', 'correlation', 'leaderboard', 'team', 'wide', 'bigdata'] },
  { title: 'Editing & workflow', ids: ['sheet', 'tasks', 'csv', 'print'] },
  { title: 'Trees & server data', ids: ['tree', 'lazytree', 'servergroups'] },
  { title: 'Styling', ids: ['themes'] },
];

const byId = new Map(CATALOG.map((e) => [e.id, e]));

export const EXAMPLE_NAV: NavGroup[] = EXAMPLE_GROUPS.map((g) => ({
  title: g.title,
  items: g.ids.flatMap((id) => {
    const ex = byId.get(id);
    return ex ? [{ title: ex.title, href: `/examples/${id}/` }] : [];
  }),
}));

// An example missing from the groups still gets a page and a link.
const grouped = new Set(EXAMPLE_GROUPS.flatMap((g) => g.ids));
const ungrouped = CATALOG.filter((e) => !grouped.has(e.id));
if (ungrouped.length > 0) EXAMPLE_NAV.push({ title: 'More', items: ungrouped.map((e) => ({ title: e.title, href: `/examples/${e.id}/` })) });

/** The docs group a path belongs to, for the page's kicker. */
export function groupOf(path: string): NavGroup | undefined {
  return [...DOCS_NAV, ...EXAMPLE_NAV].find((g) => g.items.some((i) => i.href === path));
}

/** Every page with a place in a sidebar, in order, for previous / next. */
export const PAGES: NavItem[] = [...DOCS_NAV, ...EXAMPLE_NAV].flatMap((g) => g.items).filter((i) => !i.external && !i.reload);
