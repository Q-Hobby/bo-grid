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
          <span class="thumb">
            <img src="{base}/media/examples/{item.href.split('/')[2]}.webp" alt="" width="640" height="397" loading="lazy" decoding="async" />
          </span>
          <span class="text">
            <span class="title">{item.title}</span>
            <span class="blurb">{blurb.get(item.href)}</span>
          </span>
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
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .card {
    position: relative;
    display: grid;
    align-content: start;
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    transition:
      border-color 0.15s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  .card:hover {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--line));
    transform: translateY(-3px);
    box-shadow: 0 20px 44px -26px color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .thumb {
    display: block;
    aspect-ratio: 640 / 397;
    overflow: hidden;
    background: var(--cell);
    border-bottom: 1px solid var(--line);
  }
  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top left;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .card:hover .thumb img {
    transform: scale(1.04);
  }
  .text {
    display: grid;
    gap: 6px;
    padding: 14px 16px 16px;
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
    right: 14px;
    bottom: 14px;
    color: var(--text-3);
  }
  .card:hover .go {
    color: var(--accent);
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
    .card:hover,
    .card:hover .thumb img {
      transform: none;
    }
  }
</style>
