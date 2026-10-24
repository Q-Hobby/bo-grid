// Every docs page as plain Markdown, for coding agents and "Copy page": the
// page's source with its components turned into text. Examples from the docs
// inline their source; props tables become lists read from the API manifest.
import api from './generated/api.json';
import * as snippets from './snippets';
import { DOCS_NAV } from './nav';

export const SITE = 'https://bonguynvan.github.io/bo-grid';
const REPO = 'https://github.com/bonguynvan/bo-grid/blob/main';

/** What llms.txt and llms-full.txt lead with: the facts to get right first. */
export const FACTS = `# bo-grid

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

const sources = import.meta.glob<string>('/src/routes/**/+page.md', { query: '?raw', import: 'default', eager: true });
const examples = import.meta.glob<string>(['/src/examples/*.svelte', '/src/examples/*.ts'], { query: '?raw', import: 'default', eager: true });

export interface DocSource {
  /** The page's path under the site, e.g. `/docs/grouping/`. */
  path: string;
  title: string;
  description: string;
  body: string;
}

function parse(path: string, raw: string): DocSource {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const meta = Object.fromEntries(
    (fm?.[1] ?? '').split('\n').flatMap((l) => {
      const m = /^(\w+):\s*(.*)$/.exec(l);
      return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
    }),
  );
  return { path, title: meta.title ?? '', description: meta.description ?? '', body: raw.slice(fm?.[0].length ?? 0) };
}

/** The docs pages' sources, by path. */
export const DOCS: Map<string, DocSource> = new Map(
  Object.entries(sources).flatMap(([file, raw]) => {
    const m = /\/src\/routes\/\(docs\)(\/docs\/(?:.+\/)?)\+page\.md$/.exec(file);
    return m ? [[m[1], parse(m[1], raw)]] : [];
  }),
);

/** `/docs/grouping/` → `/docs/grouping.md`; `/docs/` → `/docs.md`. */
export const mdPath = (path: string): string => `${path.replace(/\/$/, '')}.md`;

/** The props reference: a generated page (no +page.md), listed with the rest. */
export const REFERENCE = {
  path: '/docs/reference/',
  title: 'Props reference',
  description: 'Every Grid prop, column option and grid API method, generated from the TypeScript types.',
};

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? new RegExp(`\\b${name}=\\{['"]([^'"]*)['"]\\}`).exec(tag)?.[1];

function propsList(tag: string): string {
  const of = (attr(tag, 'of') ?? 'grid') as 'grid' | 'column' | 'api';
  const names = [...(/names=\{\[([^\]]*)\]\}/.exec(tag)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const pool: { name: string; type?: string; signature?: string; default?: string; doc: string }[] =
    of === 'grid' ? api.grid.props : of === 'column' ? api.column.props : api.api.methods;
  return names
    .map((n) => {
      const p = pool.find((e) => e.name === n);
      if (!p) return `- \`${n}\``;
      const head = p.signature ? `\`${p.signature}\`` : `\`${p.name}\`: \`${p.type}\``;
      return `- ${head}${p.default ? ` (default \`${p.default}\`)` : ''}${p.doc ? ` — ${p.doc}` : ''}`;
    })
    .join('\n');
}

/** The local modules an example imports (`./data`, `./feed`), and theirs. */
function helpersOf(src: string, seen: Set<string>): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/from '\.\/([\w-]+)(?:\.ts)?'/g)) {
    const file = `/src/examples/${m[1]}.ts`;
    const code = examples[file];
    if (!code || seen.has(file)) continue;
    seen.add(file);
    out.push(`${m[1]}.ts:\n\n\`\`\`ts\n${code.trim()}\n\`\`\``, ...helpersOf(code, seen));
  }
  return out;
}

function exampleText(tag: string): string {
  const id = attr(tag, 'id');
  if (id) return `Live example: ${SITE}/examples/${id}/ (source: ${REPO}/src/demo/examples/)`;
  const name = attr(tag, 'name') ?? '';
  const src = examples[`/src/examples/${name}.svelte`];
  const title = attr(tag, 'title') ?? name;
  if (!src) return `Example: ${title}`;
  // The helpers it imports come along, so the example runs as copied.
  return [`Example: ${title} (${name}.svelte)\n\n\`\`\`svelte\n${src.trim()}\n\`\`\``, ...helpersOf(src, new Set())].join('\n\n');
}

function frameworkText(tag: string): string {
  const key = /code=\{(\w+)\}/.exec(tag)?.[1];
  const code = key ? (snippets as Record<string, Record<string, string>>)[key] : undefined;
  if (!code) return '';
  const lang: Record<string, string> = { svelte: 'svelte', react: 'tsx', vue: 'vue', js: 'js' };
  return Object.entries(code)
    .map(([fw, c]) => `${fw === 'js' ? 'JavaScript' : fw[0].toUpperCase() + fw.slice(1)}:\n\n\`\`\`${lang[fw]}\n${c}\n\`\`\``)
    .join('\n\n');
}

/** A docs page as self-contained Markdown. */
export function toMarkdown(doc: DocSource): string {
  // Code fences pass through untouched (their <script> blocks, components and
  // links are examples); everything else has its components turned into text.
  const prose = (text: string) =>
    text
      .replace(/<Props\b[^>]*\/>/g, propsList)
      .replace(/<Example\b[^>]*\/>/g, exampleText)
      .replace(/<FrameworkTabs\b[^>]*\/>/g, frameworkText)
      // Relative links resolve against the page, as they do on the site.
      .replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_, url: string) => `](${new URL(url, SITE + doc.path).href})`);
  const body = doc.body
    // The page's own <script> (its imports) leads the body; only it goes.
    .replace(/^\s*<script\b[^>]*>[\s\S]*?<\/script>\s*/, '')
    .split(/(^```[\s\S]*?^```[^\n]*$)/m)
    .map((part, i) => (i % 2 ? part : prose(part)))
    .join('')
    .trim();
  return `# ${doc.title}\n\n> ${doc.description}\n\n${body}\n\n---\nPage: ${SITE}${doc.path} · All pages: ${SITE}/llms.txt\n`;
}

/** The docs in sidebar order, for llms.txt. */
export function docsInOrder(): DocSource[] {
  return DOCS_NAV.flatMap((g) => g.items.flatMap((i) => DOCS.get(i.href) ?? []));
}

/** The whole API manifest as Markdown: the reference page's .md. */
export function referenceMarkdown(): string {
  const list = (items: { name: string; type?: string; signature?: string; default?: string; doc: string }[]) =>
    items
      .map((p) => `- ${p.signature ? `\`${p.signature}\`` : `\`${p.name}\`: \`${p.type}\``}${p.default ? ` (default \`${p.default}\`)` : ''}${p.doc ? ` — ${p.doc}` : ''}`)
      .join('\n');
  const types = api.column.types.map((t) => `- \`${t.type}\`${t.options.length ? `: ${t.options.map((o) => `\`${o.name}\``).join(', ')}` : ''}`).join('\n');
  return `# Props reference\n\n> Every Grid prop, column option and grid API method, generated from the TypeScript types (bo-grid ${api.version}). As JSON: ${SITE}/api.json\n\n## Grid props\n\n${list(api.grid.props)}\n\n## Column options\n\n${list(api.column.props)}\n\n## Column types\n\n${types}\n\n## Grid API\n\n${list(api.api.methods)}\n`;
}

export interface SearchEntry {
  title: string;
  /** Base-relative path, with a #fragment for a section. */
  href: string;
  group: string;
  text: string;
}

/** A heading's id, as the site's rehype plugin (svelte.config.js) makes it. */
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
const plain = (s: string) => s.replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '').trim();

/** Every docs page and section, and every prop, for the search palette. */
export function searchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const g of DOCS_NAV) {
    for (const item of g.items) {
      const doc = DOCS.get(item.href);
      if (item.href === REFERENCE.path) out.push({ title: REFERENCE.title, href: item.href, group: g.title, text: REFERENCE.description });
      if (!doc) continue;
      out.push({ title: doc.title, href: item.href, group: g.title, text: doc.description });
      const seen = new Map<string, number>();
      let fence = false;
      for (const line of doc.body.split('\n')) {
        if (line.startsWith('```')) fence = !fence;
        const m = fence ? null : /^#{2,3} (.+)$/.exec(line);
        if (!m) continue;
        const text = plain(m[1]);
        const base = slugify(text);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        out.push({ title: text, href: `${item.href}#${n ? `${base}-${n}` : base}`, group: doc.title, text: '' });
      }
    }
  }
  const props = (of: string, list: { name: string; doc: string }[]) =>
    list.map((p) => ({ title: p.name, href: `/docs/reference/#${of}-${p.name}`, group: `Props · ${of}`, text: p.doc.slice(0, 140) }));
  return [...out, ...props('grid', api.grid.props), ...props('column', api.column.props), ...props('api', api.api.methods)];
}
