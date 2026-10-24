import { error } from '@sveltejs/kit';
import { DOCS, referenceMarkdown, toMarkdown } from '$lib/markdown';
import type { EntryGenerator, RequestHandler } from './$types';

// Every docs page as plain Markdown, for coding agents and "Copy page".
export const prerender = true;

export const entries: EntryGenerator = () => [
  { slug: 'reference' },
  ...[...DOCS.keys()].flatMap((p) => /^\/docs\/([^/]+)\/$/.exec(p)?.slice(1, 2) ?? []).map((slug) => ({ slug })),
];

export const GET: RequestHandler = ({ params }) => {
  const md = { headers: { 'content-type': 'text/markdown; charset=utf-8' } };
  if (params.slug === 'reference') return new Response(referenceMarkdown(), md);
  const doc = DOCS.get(`/docs/${params.slug}/`);
  if (!doc) error(404, `No docs page "${params.slug}".`);
  return new Response(toMarkdown(doc), md);
};
