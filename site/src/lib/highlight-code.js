// Code blocks for the docs: the demo's highlighter (Svelte / TypeScript) in a
// <pre>, used at build time for the pages' fenced code and at run time for
// the examples' sources and the framework tabs.
import { highlight } from '../../../src/demo/highlight-core.js';

/** @param {string} s */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Languages shown as plain text: no keywords to colour. */
const PLAIN = /^(sh|bash|shell|console|text|txt)$/;

/**
 * A fenced block as HTML.
 * @param {string} code
 * @param {string | undefined | null} lang
 * @returns {string}
 */
export function highlightCode(code, lang) {
  const body = !lang || PLAIN.test(lang) ? esc(code) : highlight(code);
  return `<pre class="code" data-lang="${lang ? esc(lang) : ''}"><code>${body}</code></pre>`;
}
