import { DOCS, toMarkdown } from '$lib/markdown';

// The introduction as Markdown; each other page is /docs/<slug>.md.
export const prerender = true;

export function GET(): Response {
  return new Response(toMarkdown(DOCS.get('/docs/')!), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
}
