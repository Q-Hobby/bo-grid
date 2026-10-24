<script lang="ts">
  import { CATALOG } from '$demo/examples/catalog';
  import { EXAMPLE_NAV } from '$lib/nav';
  import Example from '$lib/Example.svelte';
  import PrevNext from '$lib/PrevNext.svelte';

  let { data } = $props();
  const ex = $derived(CATALOG.find((e) => e.id === data.id)!);
  const group = $derived(EXAMPLE_NAV.find((g) => g.items.some((i) => i.href === `/examples/${data.id}/`))?.title ?? 'Examples');
</script>

<svelte:head>
  <title>{ex.title} · Examples · bo-grid</title>
  <meta name="description" content={ex.blurb} />
</svelte:head>

<header class="prose head">
  <p class="kicker">Examples · {group}</p>
  <h1>{ex.title}</h1>
  <p class="lead">{ex.blurb}</p>
</header>
{#key ex.id}
  <Example id={ex.id} link={false} />
{/key}
<PrevNext />

<style>
  .head {
    max-width: 60rem;
  }
  .kicker {
    margin: 0 0 0.4rem;
    font-family: var(--font-cond);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .head .lead {
    margin-bottom: 1.5rem;
  }
</style>
