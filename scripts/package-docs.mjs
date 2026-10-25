// Ships the docs inside the npm package, so a coding agent reading
// node_modules/bo-grid gets the docs of the installed version. Writes
// dist/docs/: every docs page as Markdown (the same text as the site's .md
// pages), the props reference, the API manifest and a README.md index. Links
// between pages point at the files next to them. Run after api-manifest.mjs.
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}dist/docs/`;

// The site's own loader reads the pages, the examples and the manifest, as
// it does for the site's .md routes. SvelteKit takes its root from the cwd,
// and its generated tsconfig must exist first (a fresh checkout has none).
process.chdir(`${root}site`);
execFileSync(process.execPath, [`${root}node_modules/@sveltejs/kit/svelte-kit.js`, 'sync'], { stdio: 'inherit' });
const server = await createServer({
  root: `${root}site`,
  configFile: `${root}site/vite.config.ts`,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
});

try {
  const md = await server.ssrLoadModule('/src/lib/markdown.ts');
  const { DOCS_NAV } = await server.ssrLoadModule('/src/lib/nav.ts');

  /** `/docs/` → `introduction.md`, `/docs/grouping/` → `grouping.md`. */
  const fileOf = (path) => (path === '/docs/' ? 'introduction.md' : path === md.REFERENCE.path ? 'reference.md' : `${/^\/docs\/([^/]+)\/$/.exec(path)?.[1]}.md`);
  const known = new Set([...md.DOCS.keys(), md.REFERENCE.path]);

  // A link to another docs page goes to its file; anything else stays online.
  const site = md.SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRe = new RegExp(`\\]\\(${site}(/docs/(?:[\\w-]+/)?)(#[^)\\s]*)?\\)`, 'g');
  const localLinks = (text) =>
    text
      .split(/(^```[\s\S]*?^```[^\n]*$)/m)
      .map((part, i) => (i % 2 ? part : part.replace(linkRe, (m, path, hash = '') => (known.has(path) ? `](./${fileOf(path)}${hash})` : m))))
      .join('');

  // The site's footer links the page online and llms.txt; here the index.
  const footer = (path) => `\n---\nOnline: ${md.SITE}${path} · All pages: [README.md](./README.md)\n`;

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  let pages = 0;
  for (const doc of md.DOCS.values()) {
    const text = md.toMarkdown(doc).replace(/\n---\nPage: [^\n]*\n$/, '');
    writeFileSync(out + fileOf(doc.path), localLinks(text) + footer(doc.path));
    pages++;
  }
  writeFileSync(out + 'reference.md', md.referenceMarkdown() + footer(md.REFERENCE.path));
  copyFileSync(`${root}site/src/lib/generated/api.json`, out + 'api.json');

  // The index: the facts to get right first, then every page in sidebar order.
  const sections = DOCS_NAV.map((g) => {
    const lines = g.items.flatMap((i) => {
      const doc = md.DOCS.get(i.href) ?? (i.href === md.REFERENCE.path ? md.REFERENCE : undefined);
      return doc ? [`- [${doc.title}](./${fileOf(i.href)}): ${doc.description}`] : [];
    });
    return lines.length ? `## ${g.title}\n\n${lines.join('\n')}` : '';
  }).filter(Boolean);
  const intro = `These are the docs of the installed version, one Markdown file per page. Live examples: ${md.SITE}/examples/`;
  const more = `## Also here\n\n- [api.json](./api.json): props, column options and API methods as JSON, generated from the types.`;
  writeFileSync(out + 'README.md', `${md.FACTS}\n\n${intro}\n\n${sections.join('\n\n')}\n\n${more}\n`);

  if (pages < 40) throw new Error(`package-docs: only ${pages} docs pages found; expected every page under site/src/routes/(docs)/docs/.`);
  console.log(`package-docs: ${pages} pages, the reference and api.json in dist/docs/`);
} finally {
  await server.close();
}
