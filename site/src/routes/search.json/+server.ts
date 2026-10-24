import { searchIndex } from '$lib/markdown';

// The search palette's index: pages, their sections and every prop. Fetched
// the first time the palette opens.
export const prerender = true;

export function GET(): Response {
  return new Response(JSON.stringify(searchIndex()), { headers: { 'content-type': 'application/json' } });
}
