// The live examples a docs page can embed: the demo gallery's (by id) and
// the docs' own small ones in site/src/examples (by name). Both load lazily,
// with their source, so a page pays only for the examples it shows.
import type { Component } from 'svelte';
import { CATALOG } from '$demo/examples/catalog';
import { loadSource } from '$demo/sources';

export interface LiveExample {
  /** The page path of a gallery example; docs examples have none. */
  page?: string;
  title: string;
  /** The file shown in the frame's bar. */
  file: string;
  /** The source on GitHub. */
  github: string;
  load: () => Promise<{ default: Component }>;
  source: () => Promise<string>;
}

const REPO = 'https://github.com/bonguynvan/bo-grid/blob/main';
const modules = import.meta.glob<{ default: Component }>('../examples/*.svelte');
const sources = import.meta.glob<string>('../examples/*.svelte', { query: '?raw', import: 'default' });

/** A gallery example (src/demo/examples) by its id. */
export function galleryExample(id: string): LiveExample {
  const ex = CATALOG.find((e) => e.id === id);
  if (!ex?.load) throw new Error(`No gallery example "${id}". Known: ${CATALOG.map((e) => e.id).join(', ')}`);
  return {
    page: `/examples/${ex.id}/`,
    title: ex.title,
    file: `${ex.file}.svelte`,
    github: `${REPO}/src/demo/examples/${ex.file}.svelte`,
    load: ex.load,
    source: () => loadSource(ex.file),
  };
}

/** A docs example (site/src/examples/<name>.svelte) by its file name. */
export function docsExample(name: string, title = name): LiveExample {
  const key = `../examples/${name}.svelte`;
  const load = modules[key];
  const source = sources[key];
  if (!load || !source) throw new Error(`No docs example "${name}" in site/src/examples.`);
  return { title, file: `${name}.svelte`, github: `${REPO}/site/src/examples/${name}.svelte`, load, source };
}
