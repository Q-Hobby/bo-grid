<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { DOCS_NAV, EXAMPLE_NAV, type NavGroup, type NavItem } from './nav';
  import { shell } from './shell.svelte';

  const current = (item: NavItem) => !item.external && !item.reload && page.url.pathname === base + item.href;
  // The examples' groups on an example page, the docs' elsewhere.
  const onExamples = $derived(page.url.pathname.startsWith(`${base}/examples`));
  const groups = $derived(onExamples ? EXAMPLE_NAV : DOCS_NAV);

  // A docs group opens when it holds the current page; the reader can open
  // or close any other. The examples' groups are short: always open.
  const toggled = new SvelteSet<string>();
  const holdsCurrent = (g: NavGroup) => g.items.some(current);
  const isOpen = (g: NavGroup) => onExamples || g.title === 'Get started' || holdsCurrent(g) !== toggled.has(g.title);
  function toggle(g: NavGroup): void {
    if (toggled.has(g.title)) toggled.delete(g.title);
    else toggled.add(g.title);
  }
</script>

<nav class="side" class:open={shell.drawer} aria-label={onExamples ? 'Examples' : 'Documentation'}>
  {#if onExamples}
    <a class="back" href="{base}/docs/">← Documentation</a>
  {/if}
  {#each groups as group (group.title)}
    {@const open = isOpen(group)}
    <section class:current={holdsCurrent(group)}>
      <h3>
        <button aria-expanded={open} onclick={() => toggle(group)} disabled={onExamples || group.title === 'Get started'}>
          <svg class="chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m4 2.5 3.5 3.5L4 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {group.title}
        </button>
      </h3>
      {#if open}
        <ul>
          {#each group.items as item (item.href)}
            <li>
              {#if item.external}
                <a href={item.href} target="_blank" rel="external noopener">{item.title}<span class="ext" aria-hidden="true">↗</span></a>
              {:else if item.reload}
                <a href="{base}{item.href}" rel="external">{item.title}</a>
              {:else}
                <a href="{base}{item.href}" aria-current={current(item) ? 'page' : undefined} onclick={() => (shell.drawer = false)}>{item.title}</a>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/each}
  {#if !onExamples}
    <a class="back" href="{base}/examples/">Every example →</a>
  {/if}
</nav>
{#if shell.drawer}
  <button class="scrim" aria-label="Close navigation" onclick={() => (shell.drawer = false)}></button>
{/if}

<style>
  .side {
    position: sticky;
    top: var(--top);
    height: calc(100vh - var(--top));
    overflow-y: auto;
    padding: 18px 14px 48px 18px;
    border-right: 1px solid var(--line-soft);
    scrollbar-width: thin;
  }
  section + section {
    margin-top: 4px;
  }
  h3 {
    margin: 0;
  }
  h3 button {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 7px 10px 7px 6px;
    font-family: var(--font-cond);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-3);
    background: none;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  h3 button:hover:not(:disabled) {
    color: var(--text);
  }
  h3 button:disabled {
    cursor: default;
  }
  section.current h3 button {
    color: var(--text-2);
  }
  .chev {
    flex: none;
    transition: transform 0.15s ease;
  }
  h3 button[aria-expanded='true'] .chev {
    transform: rotate(90deg);
  }
  h3 button:disabled .chev {
    visibility: hidden;
  }
  .back {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--text-3);
  }
  .back:last-child {
    margin: 16px 0 0;
  }
  ul {
    margin: 0 0 8px;
    padding: 0 0 0 14px;
    list-style: none;
  }
  a {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    font-size: 14px;
    color: var(--text-2);
    border-left: 2px solid transparent;
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }
  a:hover {
    color: var(--text);
    background: var(--panel);
  }
  a[aria-current='page'] {
    color: var(--text);
    font-weight: 500;
    background: var(--accent-dim);
    border-left-color: var(--accent);
  }
  .ext {
    font-size: 11px;
    color: var(--text-3);
  }
  .scrim {
    display: none;
  }
  @media (max-width: 899px) {
    .side {
      position: fixed;
      left: 0;
      z-index: 45;
      width: min(300px, 85vw);
      background: var(--surface);
      border-right: 1px solid var(--line);
      transform: translateX(-100%);
      transition: transform 0.18s ease;
    }
    .side.open {
      transform: none;
    }
    .scrim {
      position: fixed;
      inset: var(--top) 0 0;
      z-index: 44;
      display: block;
      background: rgb(0 0 0 / 0.45);
      border: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .side {
      transition: none;
    }
  }
</style>
