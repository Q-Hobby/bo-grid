<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import Sidebar from '$lib/Sidebar.svelte';
  import Toc from '$lib/Toc.svelte';

  let { children } = $props();
  // Examples take the full width: no "On this page" column beside a grid.
  const wide = $derived(page.url.pathname.startsWith(`${base}/examples`));
</script>

<div class="shell" class:wide>
  <Sidebar />
  <main class="main" id="main">
    {@render children()}
  </main>
  {#if !wide}
    <aside class="rail">
      <Toc />
    </aside>
  {/if}
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--side) minmax(0, 1fr) var(--toc);
    max-width: 1480px;
    margin: 0 auto;
  }
  .shell.wide {
    grid-template-columns: var(--side) minmax(0, 1fr);
  }
  .main {
    min-width: 0;
    padding: 40px clamp(20px, 4vw, 56px) 96px;
  }
  .rail {
    padding: 0 20px 0 0;
  }
  @media (max-width: 1279px) {
    .shell {
      grid-template-columns: var(--side) minmax(0, 1fr);
    }
    .rail {
      display: none;
    }
  }
  @media (max-width: 899px) {
    .shell,
    .shell.wide {
      grid-template-columns: minmax(0, 1fr);
    }
    .main {
      padding: 28px 16px 72px;
    }
  }
</style>
