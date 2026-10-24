<script>
  // The layout of every Markdown page (mdsvex): its front matter sets the
  // title and the description, and the article gets the prose styles. The
  // page's Markdown (for agents) is a click away: copied, or opened.
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { groupOf } from './nav';
  import PrevNext from './PrevNext.svelte';

  /** @type {{ title?: string; description?: string; children?: import('svelte').Snippet }} */
  let { title = '', description = '', children } = $props();

  const path = $derived(page.url.pathname.slice(base.length));
  const group = $derived(groupOf(path)?.title);
  const md = $derived(`${base}${path.replace(/\/$/, '')}.md`);
  /** @type {'idle' | 'copied' | 'failed'} */
  let copyState = $state('idle');

  async function copyPage() {
    try {
      const res = await fetch(md);
      if (!res.ok) throw new Error(String(res.status));
      await navigator.clipboard.writeText(await res.text());
      copyState = 'copied';
    } catch {
      copyState = 'failed';
    }
    setTimeout(() => (copyState = 'idle'), 1800);
  }
</script>

<svelte:head>
  <title>{title ? `${title} · bo-grid` : 'bo-grid'}</title>
  {#if description}<meta name="description" content={description} />{/if}
  <link rel="alternate" type="text/markdown" href={md} title="This page as Markdown" />
</svelte:head>

<article class="prose">
  <div class="page-head">
    {#if group}<p class="kicker">{group}</p>{/if}
    <div class="page-actions" aria-label="This page for AI agents">
      <button onclick={copyPage} title="Copy this page as Markdown, ready to paste into an AI agent">
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Could not copy' : 'Copy page'}
      </button>
      <a href={md} rel="external" title="This page as plain Markdown">.md</a>
    </div>
  </div>
  {#if title}<h1>{title}</h1>{/if}
  {#if description}<p class="lead">{description}</p>{/if}
  {@render children?.()}
</article>
<PrevNext />

<style>
  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
    margin-bottom: 0.5rem;
  }
  .kicker {
    margin: 0;
    font-family: var(--font-cond);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .page-actions {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
  .page-actions button,
  .page-actions a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font: inherit;
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--text-2);
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .page-actions a {
    font-family: var(--font-mono);
  }
  .page-actions button:hover,
  .page-actions a:hover {
    color: var(--accent);
    border-color: var(--line-strong);
  }
</style>
