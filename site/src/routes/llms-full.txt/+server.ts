import { FACTS, docsInOrder, referenceMarkdown, toMarkdown } from '$lib/markdown';

// Everything in one file, to paste into a chat: the facts, every docs page
// in sidebar order (examples inlined) and the full props reference.
export const prerender = true;

export function GET(): Response {
  const pages = docsInOrder().map(toMarkdown);
  return new Response([FACTS, ...pages, referenceMarkdown()].join('\n\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
