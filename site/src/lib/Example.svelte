<script lang="ts">
  import type { Component } from 'svelte';
  import { base } from '$app/paths';
  import { themeVars } from 'bo-grid';
  import { ui } from '$demo/theme.svelte';
  import { docsExample, galleryExample } from './examples';
  import { highlightCode } from './highlight-code.js';

  // A live example in a frame: Preview runs it, Code shows its source. `id`
  // names a gallery example, `name` a docs example in site/src/examples. It
  // mounts only in the browser, so pages pre-render without running demos,
  // and only while it is near the screen: a live feed scrolled far away stops
  // (it starts again, fresh, on the way back).
  // The frame carries the site's grid theme as CSS variables: an example that
  // sets no theme follows the light / dark switch with no code for it.
  let {
    id,
    name,
    title,
    link = true,
    minHeight,
  }: { id?: string; name?: string; title?: string; link?: boolean; minHeight?: number } = $props();

  const ex = $derived(id ? galleryExample(id) : docsExample(name ?? '', title));

  let view = $state<'preview' | 'code'>('preview');
  let Live = $state<Component | null>(null);
  let failed = $state(false);
  let code = $state<string | null>(null);
  let copied = $state(false);

  let frame = $state<HTMLElement>();
  let near = $state(false);
  // The height it had while running, kept while it is away, so the page
  // does not jump when it stops.
  let held = $state(0);
  $effect(() => {
    if (!frame) return;
    const el = frame;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting && near) held = el.querySelector('.preview')?.clientHeight ?? 0;
        near = entry.isIntersecting;
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  });
  $effect(() => {
    if (!near || Live || failed) return;
    ex.load().then(
      (m) => (Live = m.default),
      () => (failed = true),
    );
  });

  async function showCode(): Promise<void> {
    view = 'code';
    code ??= await ex.source().catch(() => '// The source could not be loaded.');
  }

  async function copy(): Promise<void> {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<figure class="ex" bind:this={frame}>
  <div class="bar">
    <div class="tabs" role="tablist" aria-label="{ex.title}: views">
      <button role="tab" aria-selected={view === 'preview'} onclick={() => (view = 'preview')}>Preview</button>
      <button role="tab" aria-selected={view === 'code'} onclick={showCode}>Code</button>
    </div>
    <span class="file">{ex.file}</span>
    {#if view === 'code'}
      <button class="act" onclick={copy} disabled={!code}>{copied ? 'Copied' : 'Copy'}</button>
    {/if}
    {#if link && ex.page}<a class="act" href="{base}{ex.page}">Open</a>{/if}
    <a class="act" href={ex.github} target="_blank" rel="external noopener">GitHub ↗</a>
  </div>
  <div class="preview" hidden={view !== 'preview'} data-ex={id ?? name} style="{themeVars(ui.grid)}{minHeight || held ? `min-height:${Math.max(minHeight ?? 0, held)}px` : ''}">
    {#if Live && near}
      <Live />
    {:else if failed}
      <p class="msg">The example could not be loaded.</p>
    {:else}
      <div class="loading" aria-label="Loading the example">
        {#each { length: 6 } as _, i (i)}<span></span>{/each}
      </div>
    {/if}
  </div>
  {#if view === 'code'}
    <div class="source">
      {#if code}{@html highlightCode(code, 'svelte')}{:else}<p class="msg">Loading the source…</p>{/if}
    </div>
  {/if}
</figure>

<style>
  .ex {
    margin: 0 0 2rem;
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px 0 6px;
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  .tabs {
    display: flex;
  }
  .tabs button {
    padding: 10px 12px;
    font: inherit;
    font-size: 13px;
    color: var(--text-3);
    background: none;
    border: 0;
    box-shadow: inset 0 -2px 0 transparent;
    cursor: pointer;
  }
  .tabs button:hover {
    color: var(--text);
  }
  .tabs button[aria-selected='true'] {
    color: var(--text);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  .file {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
  }
  .act {
    padding: 4px 8px;
    font: inherit;
    font-size: 12.5px;
    color: var(--text-2);
    background: none;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .act:hover {
    color: var(--accent);
    border-color: var(--line-strong);
  }
  .preview {
    padding: 16px;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .source :global(pre.code) {
    max-height: 640px;
    margin: 0;
    border: 0;
    border-radius: 0;
  }
  .msg {
    margin: 0;
    padding: 16px;
    color: var(--text-3);
  }
  .loading {
    display: grid;
    gap: 8px;
  }
  .loading span {
    height: 28px;
    background: linear-gradient(90deg, var(--panel-2), var(--line-soft), var(--panel-2));
    background-size: 200% 100%;
    border-radius: var(--radius-sm);
    animation: shimmer 1.4s ease-in-out infinite;
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .loading span {
      animation: none;
    }
  }
</style>
