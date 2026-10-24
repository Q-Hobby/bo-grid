import { error } from '@sveltejs/kit';
import { CATALOG } from '$demo/examples/catalog';
import type { EntryGenerator, PageLoad } from './$types';

// A page for every example, pre-rendered at /examples/<id>/.
export const entries: EntryGenerator = () => CATALOG.map((e) => ({ id: e.id }));

export const load: PageLoad = ({ params }) => {
  if (!CATALOG.some((e) => e.id === params.id)) error(404, `There is no example called "${params.id}".`);
  return { id: params.id };
};
