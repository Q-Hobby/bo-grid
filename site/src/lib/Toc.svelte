<script lang="ts">
  import { afterNavigate } from '$app/navigation';

  // "On this page": the h2 and h3 of the article, the one being read marked.
  let items = $state<{ id: string; text: string; level: number }[]>([]);
  let current = $state('');
  let observer: IntersectionObserver | undefined;

  function scan(): void {
    observer?.disconnect();
    const heads = [...document.querySelectorAll<HTMLElement>('.prose h2[id], .prose h3[id]')];
    items = heads.map((h) => ({ id: h.id, text: h.textContent ?? '', level: h.tagName === 'H3' ? 3 : 2 }));
    current = items[0]?.id ?? '';
    observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).map((e) => e.target.id);
        if (seen.length > 0) current = seen[0];
      },
      { rootMargin: '-64px 0px -70% 0px' },
    );
    heads.forEach((h) => observer!.observe(h));
  }

  afterNavigate(() => queueMicrotask(scan));
  $effect(() => () => observer?.disconnect());
</script>

{#if items.length > 1}
  <nav class="toc" aria-label="On this page">
    <h3>On this page</h3>
    <ul>
      {#each items as it (it.id)}
        <li class:sub={it.level === 3}><a href="#{it.id}" aria-current={current === it.id ? 'location' : undefined}>{it.text}</a></li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .toc {
    position: sticky;
    top: calc(var(--top) + 24px);
    max-height: calc(100vh - var(--top) - 48px);
    overflow-y: auto;
    padding-left: 14px;
    border-left: 1px solid var(--line-soft);
  }
  h3 {
    margin: 0 0 8px;
    font-family: var(--font-cond);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li.sub {
    padding-left: 12px;
  }
  a {
    display: block;
    padding: 3px 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-3);
  }
  a:hover {
    color: var(--text);
  }
  a[aria-current='location'] {
    color: var(--accent);
  }
</style>
