// Writes every code example in the docs as a file svelte-check can type-check
// (run by `pnpm site:check`, so CI fails on an example that does not compile):
// the ```svelte, ```ts and ```js blocks of the docs site's pages, README.md
// and docs/**/*.md; the per-framework samples in site/src/lib/snippets.ts;
// and the `@example` of every prop, column option and API method (api.json).
//
// A block is checked as written, read the way a reader reads an excerpt:
// - names bo-grid exports are imported for it when it uses them without an
//   import (`Grid`, `ColumnDef`, `createTickStream`…);
// - names it uses without declaring them (`rows`, `api`, `buy`…) are typed
//   once in site/src/lib/code-prelude.ts, and declared with that type. Names
//   that are usually a callback's parameter (`row`, `value`, `id`…) are
//   declared only for a block with no callback of its own, so a renamed
//   parameter still fails;
// - a block of bare object literals is a list of column definitions;
// - imports of the reader's own files (`./StatusPill.svelte`, `./feed`) are
//   stand-ins typed `any`, unless the prelude types the name, and SvelteKit's
//   `./$types` are its general `Load` / `ServerLoad` types.
// Every fence names its language. tsx, vue and the non-code languages are
// not checked; any other language fails, so a new one needs a decision here.
// A block that cannot be checked (another framework's code) is marked
// ```ts nocheck.
//
//   node scripts/docs-code.mjs   (writes site/src/lib/generated/code/)
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const OUT = 'site/src/lib/generated/code';
const SITE_DOCS = 'site/src/routes/(docs)';
/** Markdown in the repository that readers copy from (GitHub, npm). */
const REPO_DOCS = ['README.md', 'docs'];
/** The one-file guides that predate the docs site, not checked yet: they
    repeat the site's pages and are due to be replaced by them. */
const UNCHECKED_DOCS = new Set(['docs/guide.md', 'docs/frameworks.md', 'docs/sveltekit.md']);
const CHECKED = new Set(['svelte', 'ts', 'js']);
const NOT_CHECKED = new Set(['tsx', 'vue', 'html', 'css', 'sh', 'bash', 'json', 'md', 'text']);

const PRELUDE = readFileSync('site/src/lib/code-prelude.ts', 'utf8');
/** The names code-prelude.ts types, from its `Free` interface. */
const FREE = new Set([...(/export interface Free \{([\s\S]*?)\n\}/.exec(PRELUDE)?.[1] ?? '').matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]));
/** Prelude names that are usually a callback's parameter. */
const LOCAL = new Set(['row', 'value', 'index', 'id', 'next', 'price']);
/** The app types code-prelude.ts exports (`Quote`, `Trade`…), imported where an example names one. */
const APP_TYPES = [...PRELUDE.matchAll(/^export (?:interface|type) (\w+)/gm)].map((m) => m[1]).filter((n) => n !== 'Free');
/** SvelteKit's generated `./$types`, as the general types they specialise. */
const KIT_TYPES = { PageLoad: 'Load', LayoutLoad: 'Load', PageServerLoad: 'ServerLoad', LayoutServerLoad: 'ServerLoad', Actions: 'Actions' };

/** What each entry exports: name → { from, type }. The first entry to export a name wins. */
const ENTRIES = {
  'bo-grid': 'src/lib/index.ts',
  'bo-grid/realtime': 'src/lib/realtime/index.ts',
  'bo-grid/trading': 'src/lib/trading/index.ts',
  'bo-grid/ladder': 'src/lib/ladder/index.ts',
};
const LIB = new Map();
for (const [from, file] of Object.entries(ENTRIES)) {
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g))
    for (const part of m[2].split(',')) {
      const p = part.trim();
      if (!p) continue;
      const type = !!m[1] || p.startsWith('type ');
      const name = p.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (!LIB.has(name)) LIB.set(name, { from, type });
    }
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(function|const|let|class|type|interface|enum)\s+(\w+)/g))
    if (!LIB.has(m[2])) LIB.set(m[2], { from, type: m[1] === 'type' || m[1] === 'interface' });
}

/** The code without its comments (a `//` inside a string, as in a URL, stays). */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|(^|[^:'"`\\])\/\/[^\n]*/g, (_, before) => before ?? '');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A use of the name itself: not a property (`x.name`), but a spread (`...name`) is.
const uses = (code, name) => new RegExp(`(?<![\\w$])(?<!(?:^|[^.])\\.)${escape(name)}(?![\\w$])`).test(code);

/** Names the code declares or imports itself, at any depth (over-counting is safe). */
function declared(raw) {
  const code = stripComments(raw);
  const names = new Set();
  for (const m of code.matchAll(/\b(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g))
    for (const part of m[1].split(',')) {
      const name = part.split(/[:=]/).pop()?.trim().replace(/^\.\.\./, '');
      if (name) names.add(name);
    }
  for (const m of code.matchAll(/^\s*import\s+(?:type\s+)?([^;'"]*?)\s+from\s+['"][^'"]+['"]/gm))
    for (const part of m[1].replace(/[{}]/g, ',').split(',')) {
      const name = part.trim().replace(/^type\s+/, '').replace(/^\*\s+as\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  for (const m of code.matchAll(/\{#snippet\s+(\w+)/g)) names.add(m[1]);
  return names;
}

/** Take the code's imports of the reader's own files out; return the code and the names they bound. */
function ownImports(code) {
  const stubs = [];
  // One import statement: what it binds may span lines, but holds no quote or `;`.
  const rest = code.replace(/^[ \t]*import\s+(type\s+)?([^;'"]*?)\s+from\s+['"](\.[^'"]*)['"];?[ \t]*$/gm, (_, type, what, path) => {
    const kit = path === './$types';
    const def = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(what.trim());
    if (def) stubs.push({ name: def[1], type: !!type });
    for (const part of (/\{([^}]*)\}/.exec(what)?.[1] ?? '').split(',')) {
      const p = part.trim();
      if (!p) continue;
      const name = p.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      stubs.push({ name, type: !!type || p.startsWith('type ') || kit, kit: kit && KIT_TYPES[name] });
    }
    return '';
  });
  return { code: rest, stubs };
}

/** What a file must declare before the example: library imports, prelude names and types, stand-ins. */
function needs(code, stubs = []) {
  const own = declared(code);
  for (const s of stubs) own.delete(s.name);
  const callbacks = /=>|\{#snippet/.test(code);
  const lib = [...LIB].filter(([name]) => !own.has(name) && uses(code, name));
  const stubbed = (n) => stubs.some((s) => s.name === n);
  const free = [...FREE].filter((n) => !own.has(n) && !LIB.has(n) && !(callbacks && LOCAL.has(n)) && uses(code, n) && !stubbed(n));
  const types = APP_TYPES.filter((n) => !own.has(n) && !LIB.has(n) && uses(code, n) && !stubbed(n));
  return { lib, free, types, stubs };
}

/** The declaration of a stand-in for the reader's own import. */
function stubDecl(s, ts) {
  if (s.kit) return `type ${s.name} = import('@sveltejs/kit').${s.kit};`;
  if (s.type) return `type ${s.name} = any;`;
  if (FREE.has(s.name)) return ts ? `declare let ${s.name}: import('$lib/code-prelude').Free['${s.name}'];` : `let ${s.name}: import('$lib/code-prelude').Free['${s.name}'] = undefined as never;`;
  return ts ? `declare let ${s.name}: any;` : `const ${s.name}: any = undefined;`;
}

function libImports({ lib }, { types = true } = {}) {
  const by = new Map();
  for (const [name, { from, type }] of lib) {
    if (type && !types) continue;
    by.set(from, [...(by.get(from) ?? []), type ? `type ${name}` : name]);
  }
  return [...by].map(([from, names]) => `import { ${names.join(', ')} } from '${from}';`);
}

/** The top-level object literals in `code`, or null when it is not only objects (and comments). */
function bareObjects(code) {
  const objs = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (/\s|,|;/.test(c)) i++;
    else if (code.startsWith('//', i)) i = code.indexOf('\n', i) < 0 ? n : code.indexOf('\n', i);
    else if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      if (end < 0) return null;
      i = end + 2;
    } else if (c === '{') {
      const end = matchBrace(code, i);
      if (end < 0) return null;
      objs.push(code.slice(i, end + 1));
      i = end + 1;
    } else return null;
  }
  return objs.length ? objs : null;
}

/** Index of the `}` that closes the `{` at `start`, skipping strings, templates and comments; -1 if none. */
function matchBrace(code, start) {
  const stack = [];
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    const top = stack[stack.length - 1];
    if (top === '`') {
      if (c === '\\') i++;
      else if (c === '`') stack.pop();
      else if (c === '$' && code[i + 1] === '{') (stack.push('${'), i++);
      continue;
    }
    if (c === "'" || c === '"') {
      for (i++; i < code.length && code[i] !== c; i++) if (code[i] === '\\') i++;
    } else if (c === '`') stack.push('`');
    else if (code.startsWith('//', i)) {
      i = code.indexOf('\n', i);
      if (i < 0) return -1;
    } else if (code.startsWith('/*', i)) {
      i = code.indexOf('*/', i + 2) + 1;
      if (i < 1) return -1;
    } else if (c === '{') stack.push('{');
    else if (c === '}') {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

function tsFile(origin, raw, { wrap = false, js = false } = {}) {
  const { code: body0, stubs } = ownImports(raw);
  const objects = bareObjects(body0.replace(/^\s*import[^\n]*\n/gm, ''));
  const imports = [...body0.matchAll(/^\s*import[^\n]*\n/gm)].map((m) => m[0].trim());
  const column = (o, k) => (js ? `/** @type {import('bo-grid').ColumnDef} */\nexport const column${k} = ${o};` : `export const column${k}: ColumnDef = ${o};`);
  const body = objects ? `${imports.join('\n')}\n${objects.map(column).join('\n')}` : body0;
  const need = needs(objects ? `${body}\nColumnDef` : body, stubs);
  const decl = js
    ? [
        ...need.free.map((n) => `/** @type {import('$lib/code-prelude').Free['${n}']} */\nlet ${n} = /** @type {any} */ (undefined);`),
        ...need.stubs.map((s) => `/** @type {any} */\nlet ${s.name} = undefined;`),
      ]
    : [
        need.free.length || need.types.length ? `import type { ${['Free', ...need.types].join(', ')} } from '$lib/code-prelude';` : '',
        ...need.free.map((n) => `declare let ${n}: Free['${n}'];`),
        ...need.stubs.map((s) => stubDecl(s, true)),
      ];
  const main = wrap ? `export async function example() {\n${body}\n}` : body;
  return `// ${origin}\n${[...libImports(need, { types: !js }), ...decl].filter(Boolean).join('\n')}\n${main}\nexport {};\n`;
}

function svelteFile(origin, raw) {
  const { code, stubs } = ownImports(raw);
  const need = needs(code, stubs);
  // In markup, free names arrive as props, so an example may assign them. A
  // whole component (its own <script>) gets plain variables: there they stand
  // for the app's imports, read once.
  const script = /<script\b[^>]*>/.exec(code);
  const free = !need.free.length
    ? []
    : script
      ? need.free.map((n) => `let ${n}: Free['${n}'] = undefined as never;`)
      : [`let { ${need.free.join(', ')} }: Pick<Free, ${need.free.map((n) => `'${n}'`).join(' | ')}> = $props();`];
  const lines = [
    ...libImports(need),
    need.free.length || need.types.length ? `import type { ${['Free', ...need.types].join(', ')} } from '$lib/code-prelude';` : '',
    ...free,
    ...need.stubs.map((s) => stubDecl(s, false)),
  ]
    .filter(Boolean)
    .map((l) => `  ${l}`);
  if (!script) return `<script lang="ts">\n${lines.join('\n')}\n</script>\n\n<!-- ${origin} -->\n${code}\n`;
  if (!lines.length) return `<!-- ${origin} -->\n${code}\n`;
  const at = script.index + script[0].length;
  return `<!-- ${origin} -->\n${code.slice(0, at)}\n${lines.join('\n')}\n${code.slice(at)}\n`;
}

/** The fenced blocks of a Markdown file: { lang, meta, code, line }. */
function fences(src) {
  const out = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const open = /^(`{3,}|~{3,})\s*(\S*)\s*(.*)$/.exec(lines[i]);
    if (!open) continue;
    const close = new RegExp(`^${open[1][0] === '`' ? '`' : '~'}{${open[1].length},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !close.test(lines[j])) j++;
    out.push({ lang: open[2], meta: open[3], code: lines.slice(i + 1, j).join('\n') + '\n', line: i + 1 });
    i = j;
  }
  return out;
}

const files = new Map();
const add = (name, text) => {
  if (files.has(name)) throw new Error(`docs-code: two examples map to ${name}`);
  files.set(name, text);
};
const problems = [];
let blocks = 0;
let skipped = 0;

function checkMarkdown(file, prefix) {
  const src = readFileSync(file, 'utf8');
  let n = 0;
  for (const { lang, meta, code, line } of fences(src)) {
    const origin = `${relative('.', file).replace(/\\/g, '/')}:${line}`;
    if (!CHECKED.has(lang)) {
      if (!NOT_CHECKED.has(lang)) problems.push(`${origin}: a code block in ${lang ? `\`${lang}\`` : 'no language'} (name one; add it to CHECKED or NOT_CHECKED in scripts/docs-code.mjs)`);
      continue;
    }
    n++;
    if (/^nocheck\b/.test(meta)) {
      skipped++;
      continue;
    }
    blocks++;
    const name = `${prefix}-${n}`;
    if (lang === 'svelte') add(`${name}.svelte`, svelteFile(origin, code));
    else add(`${name}.${lang}`, tsFile(origin, code, { js: lang === 'js' }));
  }
}

const markdown = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? markdown(p) : f.endsWith('.md') ? [p] : [];
  });

// The docs site's pages.
for (const page of markdown(SITE_DOCS).filter((p) => p.endsWith('+page.md')).sort()) {
  const slug = relative(SITE_DOCS, page).replace(/[\\/]?\+page\.md$/, '').replace(/^docs[\\/]?/, '').replace(/[\\/]/g, '-') || 'index';
  checkMarkdown(page, `docs-${slug}`);
}
// README.md and docs/**/*.md.
for (const file of REPO_DOCS.flatMap((p) => (statSync(p).isDirectory() ? markdown(p) : [p])).sort()) {
  if (UNCHECKED_DOCS.has(file.replace(/\\/g, '/'))) continue;
  checkMarkdown(file, `md-${file.replace(/\.md$/, '').replace(/[^\w]+/g, '-').toLowerCase()}`);
}

// The per-framework samples (FrameworkTabs on the home page and the guides):
// their Svelte and plain JavaScript versions.
const snippetsSrc = ts.transpileModule(readFileSync('site/src/lib/snippets.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const snippets = await import(`data:text/javascript;base64,${Buffer.from(snippetsSrc).toString('base64')}`);
let samples = 0;
for (const [key, byFramework] of Object.entries(snippets)) {
  if (!byFramework || typeof byFramework !== 'object') continue;
  for (const [fw, code] of Object.entries(byFramework)) {
    if (typeof code !== 'string' || !['svelte', 'js'].includes(fw)) continue;
    samples++;
    const origin = `site/src/lib/snippets.ts: ${key}.${fw}`;
    if (fw === 'svelte') add(`snippet-${key}.svelte`, svelteFile(origin, code));
    else add(`snippet-${key}.js`, tsFile(origin, code, { js: true }));
  }
}

// The @example of every prop, column option and API method.
const api = JSON.parse(readFileSync('site/src/lib/generated/api.json', 'utf8'));
const where = 'src/lib/grid';
let tags = 0;
const example = (name, origin, ex, kind) => {
  tags++;
  if (ex.trimStart().startsWith('<')) add(`${name}.svelte`, svelteFile(origin, ex));
  // A prop's script example (`let rows = $state(…)`) is a component's script.
  else if (kind === 'grid') add(`${name}.svelte`, svelteFile(origin, `<script lang="ts">\n${ex}\n</script>`));
  else if (kind === 'column') add(`${name}.ts`, tsFile(origin, ex));
  else add(`${name}.ts`, tsFile(origin, ex, { wrap: true }));
};
for (const p of api.grid.props.filter((p) => p.example)) example(`prop-${p.name}`, `${where}/props.ts: ${p.name}`, p.example, 'grid');
for (const p of api.column.props.filter((p) => p.example)) example(`column-${p.name}`, `${where}/column.ts: ${p.name}`, p.example, 'column');
for (const t of api.column.types)
  for (const o of t.options.filter((o) => o.example)) example(`column-${t.type}-${o.name}`.replace(/[()]/g, ''), `${where}/column.ts: ${t.type}.${o.name}`, o.example, 'column');
for (const m of api.api.methods.filter((m) => m.example)) example(`api-${m.name}`, `${where}/api.ts: ${m.name}`, m.example, 'api');

if (problems.length) {
  console.error(`docs-code: ${problems.length} code block(s) to sort out:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [name, text] of files) writeFileSync(join(OUT, name), text);
console.log(
  `docs-code: ${blocks} code blocks${skipped ? ` (${skipped} marked nocheck)` : ''}, ${samples} framework samples and ${tags} @examples → ${OUT}\n` +
    `  (an error in ${OUT}/ is in an example: the file's first line names the page and line, or the prop, it came from)\n` +
    `  not checked yet: ${[...UNCHECKED_DOCS].join(', ')}`,
);
