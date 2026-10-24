import { DOCS_NAV } from '$lib/nav';
import { DOCS, FACTS, SITE, mdPath } from '$lib/markdown';

// The site's index for coding agents (llms.txt): the facts to get right
// first, then every docs page as a Markdown link, in sidebar order.
export const prerender = true;

export function GET(): Response {
  const sections = DOCS_NAV.map((g) => {
    const lines = g.items.flatMap((i) => {
      const doc = DOCS.get(i.href);
      return doc ? [`- [${doc.title}](${SITE}${mdPath(i.href)}): ${doc.description}`] : [];
    });
    return lines.length ? `## ${g.title}\n\n${lines.join('\n')}` : '';
  }).filter(Boolean);

  const more = `## Optional\n\n- [API manifest](${SITE}/api.json): props, column options and API methods as JSON, generated from the types.\n- [Full reference in one file](${SITE}/llms-full.txt)\n- [Examples](${SITE}/examples/): every example live, with its source.`;
  return new Response(`${FACTS}\n\n${sections.join('\n\n')}\n\n${more}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
