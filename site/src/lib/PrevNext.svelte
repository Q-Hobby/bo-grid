<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { PAGES } from './nav';

  const at = $derived(PAGES.findIndex((p) => base + p.href === page.url.pathname));
  const prev = $derived(at > 0 ? PAGES[at - 1] : undefined);
  const next = $derived(at >= 0 && at < PAGES.length - 1 ? PAGES[at + 1] : undefined);
</script>

{#if prev || next}
  <nav class="pn" aria-label="Previous and next page">
    {#if prev}<a class="prev" href="{base}{prev.href}"><small>Previous</small>{prev.title}</a>{:else}<span></span>{/if}
    {#if next}<a class="next" href="{base}{next.href}"><small>Next</small>{next.title}</a>{/if}
  </nav>
{/if}

<style>
  .pn {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    max-width: var(--measure);
    margin-top: 3.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--line-soft);
  }
  a {
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 10px 14px;
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }
  a:hover {
    border-color: var(--accent);
  }
  .next {
    text-align: right;
  }
  small {
    font-family: var(--font-cond);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }
</style>
