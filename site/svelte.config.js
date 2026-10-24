// The docs site: a SvelteKit app, pre-rendered to static HTML for GitHub
// Pages. It imports the library from ../src/lib and the live examples from
// ../src/demo/examples, so an example has one source for the demo, the
// benchmarks and these pages.
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { escapeSvelte, mdsvex } from 'mdsvex';
import { fileURLToPath } from 'node:url';
import { highlightCode } from './src/lib/highlight-code.js';

const dev = process.argv.includes('dev');

/** The text of a hast node. @param {any} node @returns {string} */
const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

/** An id on every h2 and h3, so a section can be linked to without
    JavaScript (and the "On this page" list can find it). */
function headingIds() {
  /** @param {any} tree */
  return (tree) => {
    const seen = new Map();
    /** @param {any} node */
    const visit = (node) => {
      if (node.type === 'element' && (node.tagName === 'h2' || node.tagName === 'h3') && !node.properties?.id) {
        const base = textOf(node).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        node.properties = { ...node.properties, id: n ? `${base}-${n}` : base };
      }
      (node.children ?? []).forEach(visit);
    };
    visit(tree);
  };
}

/** @type {import('@sveltejs/kit').Config} */
export default {
  extensions: ['.svelte', '.md'],
  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: ['.md'],
      // Absolute: tools that run from another folder still find it.
      layout: { _: fileURLToPath(new URL('./src/lib/DocPage.svelte', import.meta.url)) },
      rehypePlugins: [headingIds],
      highlight: {
        highlighter: (code, lang) => `{@html \`${escapeSvelte(highlightCode(code, lang))}\`}`,
      },
    }),
  ],
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', strict: true }),
    // Served from https://bonguynvan.github.io/bo-grid/ (BASE_PATH='' for a root).
    // Absolute, so pre-rendered pages compare paths exactly as the browser does.
    paths: { base: process.env.BASE_PATH ?? (dev ? '' : '/bo-grid'), relative: false },
    // The demo's public files (favicons, llms-full.txt) are the site's too.
    files: { assets: '../public' },
    alias: {
      $demo: '../src/demo',
      $bo: '../src/lib',
      // The docs' own examples import the package by name, as an app does.
      'bo-grid': '../src/lib',
    },
    prerender: { entries: ['*'] },
  },
};
