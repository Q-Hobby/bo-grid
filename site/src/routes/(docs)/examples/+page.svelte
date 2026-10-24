<script lang="ts">
  import { base } from '$app/paths';
  import { CATALOG } from '$demo/examples/catalog';
  import { EXAMPLE_NAV } from '$lib/nav';

  const blurb = new Map(CATALOG.map((e) => [`/examples/${e.id}/`, e.blurb]));
</script>

<svelte:head>
  <title>Examples · bo-grid</title>
  <meta name="description" content="Live bo-grid examples: price boards, order books, ladders, blotters, big data, trees, editing and themes, each with its source." />
</svelte:head>

<header class="prose">
  <h1>Examples</h1>
  <p class="lead">Every example runs live in the page, with its source a tab away. They are the same files the benchmarks and tests run.</p>
</header>

{#each EXAMPLE_NAV as group (group.title)}
  <section>
    <h2>{group.title}</h2>
    <div class="cards">
      {#each group.items as item (item.href)}
        <a class="card" href="{base}{item.href}">
          <span class="title">{item.title}</span>
          <span class="blurb">{blurb.get(item.href)}</span>
          <span class="go" aria-hidden="true">→</span>
        </a>
      {/each}
    </div>
  </section>
{/each}

<style>
  section {
    margin-top: 2.25rem;
  }
  h2 {
    margin: 0 0 0.9rem;
    font-family: var(--font-cond);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }
  .card {
    position: relative;
    display: grid;
    align-content: start;
    gap: 6px;
    padding: 16px 18px 18px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    transition:
      border-color 0.12s ease,
      transform 0.12s ease;
  }
  .card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .title {
    font-weight: 600;
    color: var(--text);
  }
  .blurb {
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text-2);
  }
  .go {
    position: absolute;
    top: 14px;
    right: 16px;
    color: var(--text-3);
  }
  .card:hover .go {
    color: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
    .card:hover {
      transform: none;
    }
  }
</style>
