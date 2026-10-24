<script lang="ts">
  import { FRAMEWORKS, prefs, type Framework } from './prefs.svelte';
  import { highlightCode } from './highlight-code.js';

  // The same snippet in each framework; the tab shown is the reader's
  // framework, chosen once in the top bar or here, for every page.
  let { code, lang = {} }: { code: Partial<Record<Framework, string>>; lang?: Partial<Record<Framework, string>> } = $props();

  const tabs = $derived(FRAMEWORKS.filter((f) => code[f.id] !== undefined));
  const shown = $derived(tabs.some((t) => t.id === prefs.framework) ? prefs.framework : (tabs[0]?.id ?? 'svelte'));
  const fallback: Record<Framework, string> = { svelte: 'svelte', react: 'tsx', vue: 'vue', js: 'js' };
</script>

<div class="fwt">
  <div class="tabs" role="tablist" aria-label="Framework">
    {#each tabs as t (t.id)}
      <button role="tab" aria-selected={shown === t.id} onclick={() => prefs.set(t.id)}>{t.label}</button>
    {/each}
  </div>
  {@html highlightCode(code[shown] ?? '', lang[shown] ?? fallback[shown])}
</div>

<style>
  .fwt {
    margin: 0 0 1.25rem;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }
  .tabs {
    display: flex;
    gap: 2px;
    padding: 0 6px;
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  button {
    padding: 8px 11px;
    font: inherit;
    font-size: 13px;
    color: var(--text-3);
    background: none;
    border: 0;
    box-shadow: inset 0 -2px 0 transparent;
    cursor: pointer;
  }
  button:hover {
    color: var(--text);
  }
  button[aria-selected='true'] {
    color: var(--text);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  .fwt :global(pre.code) {
    margin: 0;
    border: 0;
    border-radius: 0;
  }
</style>
