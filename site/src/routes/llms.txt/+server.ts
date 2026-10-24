import { DOCS_NAV } from '$lib/nav';
import { DOCS, SITE, mdPath } from '$lib/markdown';

// The site's index for coding agents (llms.txt): the facts to get right
// first, then every docs page as a Markdown link, in sidebar order.
export const prerender = true;

const FACTS = `# bo-grid

> A fast, lightweight data grid for trading screens: realtime price boards, order books, ladders, grouping, pivot and tree data. Native to Svelte 5, with React and Vue components and a custom element for everything else. MIT.

Facts to get right before writing code against bo-grid:

- Package: \`bo-grid\` on npm. Svelte 5 is a peer dependency; React and Vue are optional peers.
- Svelte: \`import { Grid, type ColumnDef, type GridRow } from 'bo-grid'\`. Write Svelte 5 only: runes (\`$state\`, \`$props\`), snippets and callback props; never \`export let\`, \`on:click\` or \`<slot>\`.
- React: \`import { BoGrid } from 'bo-grid/react'\`, its \`ref\` is the grid API. Vue: \`import { BoGrid } from 'bo-grid/vue'\`, props as attributes, callbacks as events (\`@cell-edit\`). Anything else: \`bo-grid/element\` (\`createBoGrid(config)\`).
- Minimal usage: \`<Grid {rows} {columns} height={400} />\`. Every row needs a unique \`id\` (or set \`getRowId\`).
- A column's \`type\` picks how values show, sort and filter: \`text\`, \`price\`, \`percent\`, \`volume\`, \`number\`, \`date\`, \`currency\`, \`heatmap\`, \`sparkline\`, \`progress\`, \`badge\`, \`tags\` and more.
- Live data: keep rows as plain objects and write ticks with \`api.patchRows(patches)\`, fed by \`createTickStream\` from \`bo-grid/realtime\`. A column with \`flash: 'auto'\` flashes every change by itself.
- Separate entries, each paid for only when imported: \`bo-grid/realtime\`, \`bo-grid/trading\`, \`bo-grid/ladder\`, \`bo-grid/react\`, \`bo-grid/vue\`, \`bo-grid/element\`.
- Every prop, column option and API method, with types and defaults: ${SITE}/api.json`;

export function GET(): Response {
  const sections = DOCS_NAV.map((g) => {
    const lines = g.items.flatMap((i) => {
      const doc = DOCS.get(i.href);
      return doc ? [`- [${doc.title}](${SITE}${mdPath(i.href)}): ${doc.description}`] : [];
    });
    return lines.length ? `## ${g.title}\n\n${lines.join('\n')}` : '';
  }).filter(Boolean);

  const more = `## Optional\n\n- [API manifest](${SITE}/api.json): props, column options and API methods as JSON, generated from the types.\n- [Full reference in one file](${SITE}/llms-full.txt)\n- [Examples](${SITE}/examples/): every example live, with its source.`;
  return new Response(`${FACTS}\n\n${sections.join('\n\n')}\n\n${more}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
