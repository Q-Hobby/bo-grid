<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { CATALOG } from '$demo/examples/catalog';
  import { DOCS_NAV, EXAMPLE_NAV } from './nav';
  import { shell } from './shell.svelte';

  // Every page, and every example by its title and its description.
  const blurbs = new Map(CATALOG.map((e) => [`/examples/${e.id}/`, e.blurb]));
  const entries = [...DOCS_NAV, ...EXAMPLE_NAV].flatMap((g) =>
    g.items.map((i) => ({ ...i, group: g.title, blurb: blurbs.get(i.href) ?? '' })),
  );

  let query = $state('');
  let at = $state(0);
  let input = $state<HTMLInputElement>();
  const found = $derived.by(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((e) => words.every((w) => `${e.title} ${e.group} ${e.blurb}`.toLowerCase().includes(w))).slice(0, 12);
  });

  $effect(() => {
    if (shell.jump) {
      query = '';
      at = 0;
      queueMicrotask(() => input?.focus());
    }
  });
  $effect(() => {
    void query;
    at = 0;
  });

  function open(e: (typeof entries)[number]): void {
    shell.jump = false;
    if (e.external) window.open(e.href, '_blank', 'noopener');
    else if (e.reload) location.href = base + e.href;
    else void goto(base + e.href);
  }

  function onkey(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      shell.jump = !shell.jump;
    } else if (shell.jump && e.key === 'Escape') shell.jump = false;
  }

  function onlist(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') at = Math.min(found.length - 1, at + 1);
    else if (e.key === 'ArrowUp') at = Math.max(0, at - 1);
    else if (e.key === 'Enter' && found[at]) open(found[at]);
    else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if shell.jump}
  <div class="scrim" role="presentation" onclick={() => (shell.jump = false)}></div>
  <div class="palette" role="dialog" aria-modal="true" aria-label="Jump to a page">
    <input bind:this={input} bind:value={query} onkeydown={onlist} placeholder="Jump to a page or an example…" aria-label="Page or example" role="combobox" aria-expanded="true" aria-controls="jump-list" aria-activedescendant={found[at] ? `jump-${at}` : undefined} />
    <ul id="jump-list" role="listbox">
      {#each found as e, i (e.href)}
        <li id="jump-{i}" role="option" aria-selected={i === at}>
          <button onclick={() => open(e)} onmouseenter={() => (at = i)}>
            <span class="title">{e.title}{#if e.external}<span class="ext">↗</span>{/if}</span>
            <span class="group">{e.group}</span>
            {#if e.blurb}<span class="blurb">{e.blurb}</span>{/if}
          </button>
        </li>
      {:else}
        <li class="none">Nothing matches “{query}”.</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(0 0 0 / 0.5);
  }
  .palette {
    position: fixed;
    top: 12vh;
    left: 50%;
    z-index: 61;
    width: min(620px, calc(100vw - 32px));
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
    transform: translateX(-50%);
  }
  input {
    width: 100%;
    box-sizing: border-box;
    padding: 14px 16px;
    font: inherit;
    font-size: 15px;
    color: var(--text);
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--line);
    outline: none;
  }
  ul {
    max-height: 55vh;
    margin: 0;
    padding: 6px;
    overflow-y: auto;
    list-style: none;
  }
  button {
    display: grid;
    grid-template-columns: 1fr auto;
    width: 100%;
    gap: 2px 12px;
    padding: 8px 10px;
    font: inherit;
    text-align: left;
    color: var(--text-2);
    background: none;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  [aria-selected='true'] button {
    color: var(--text);
    background: var(--accent-dim);
  }
  .title {
    font-weight: 500;
  }
  .group {
    font-family: var(--font-cond);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .blurb {
    grid-column: 1 / -1;
    font-size: 12.5px;
    color: var(--text-3);
  }
  .ext {
    margin-left: 6px;
    font-size: 11px;
    color: var(--text-3);
  }
  .none {
    padding: 14px 10px;
    color: var(--text-3);
  }
</style>
