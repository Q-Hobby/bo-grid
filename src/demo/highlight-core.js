// A small syntax highlighter for the demo's "Code" view and the docs site: enough colour to read
// a Svelte example (script, markup and style) without shipping a full grammar.
// One left-to-right pass; comments and strings are matched first, so nothing
// inside them is mistaken for a keyword or a tag. Output is escaped HTML.
// Plain JS, so the docs site's svelte.config.js can use it at build time.

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'of', 'in', 'while', 'new', 'type',
  'interface', 'extends', 'as', 'async', 'await', 'true', 'false', 'null',
  'undefined', 'typeof', 'void', 'class', 'this', 'break', 'continue', 'try',
  'catch', 'finally', 'throw', 'switch', 'case',
]);

const TOKEN = new RegExp(
  [
    String.raw`(?<c><!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*)`,
    String.raw`(?<s>'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|\x60(?:\\.|[^\x60\\])*\x60)`,
    String.raw`(?<b>\{[#:\/@][a-z]+\}?)`,
    String.raw`(?<t><\/?[A-Za-z][\w.:-]*)`,
    String.raw`(?<r>\$[a-z]+(?:\.[a-z]+)?\b)`,
    String.raw`(?<w>[A-Za-z_]\w*)`,
    String.raw`(?<n>\b\d[\d_]*(?:\.\d+)?\b)`,
  ].join('|'),
  'g',
);

/** @param {string} s */
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** @param {string} cls @param {string} text */
const span = (cls, text) => `<span class="${cls}">${esc(text)}</span>`;

/** Highlight Svelte / TypeScript source as escaped HTML with token spans:
    c comment, s string, b Svelte block, t tag, r rune, k keyword, n number. */
/** @param {string} src @returns {string} */
export function highlight(src) {
  let out = '';
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    out += esc(src.slice(last, at));
    const g = m.groups ?? {};
    const text = m[0];
    if (g.c) out += span('c', text);
    else if (g.s) out += span('s', text);
    else if (g.b) out += span('b', text);
    else if (g.t) out += span('t', text);
    else if (g.r) out += span('r', text);
    else if (g.w) out += KEYWORDS.has(text) ? span('k', text) : esc(text);
    else if (g.n) out += span('n', text);
    else out += esc(text);
    last = at + text.length;
  }
  return out + esc(src.slice(last));
}
