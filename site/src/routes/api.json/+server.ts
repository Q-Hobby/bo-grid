import api from '$lib/generated/api.json';

// The API manifest (scripts/api-manifest.mjs): every <Grid> prop, column
// option and grid-handle method, with types, defaults and docs.
export const prerender = true;

export function GET(): Response {
  return new Response(JSON.stringify(api, null, 2), { headers: { 'content-type': 'application/json' } });
}
