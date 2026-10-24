<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { ui, toggleTheme } from '$demo/theme.svelte';
  import { FRAMEWORKS, prefs, type Framework } from './prefs.svelte';
  import { shell } from './shell.svelte';

  const path = $derived(page.url.pathname.slice(base.length));
  const links: { title: string; href: string; on: (p: string) => boolean; ai?: boolean }[] = [
    { title: 'Docs', href: '/docs/', on: (p) => p.startsWith('/docs') && !/^\/docs\/(reference|ai)\//.test(p) },
    { title: 'Examples', href: '/examples/', on: (p) => p.startsWith('/examples') },
    { title: 'API', href: '/docs/reference/', on: (p) => p.startsWith('/docs/reference/') },
    { title: 'For AI agents', href: '/docs/ai/', on: (p) => p.startsWith('/docs/ai/'), ai: true },
  ];
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
</script>

<header class="top">
  <button class="menu" aria-label="Open navigation" aria-expanded={shell.drawer} onclick={() => (shell.drawer = !shell.drawer)}>
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
  </button>
  <a class="brand" href="{base}/" aria-label="bo-grid home">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="var(--accent)" />
      <path d="M2 9h20M2 15h20M9 9v13M15 9v13" stroke="var(--on-accent)" stroke-width="1.6" />
    </svg>
    <span class="name">bo-grid</span>
    <span class="ver">v{__BO_GRID_VERSION__}</span>
  </a>
  <nav class="links" aria-label="Site">
    {#each links as l (l.href)}
      <a href="{base}{l.href}" class:ai={l.ai} aria-current={l.on(path) ? 'page' : undefined}>
        {#if l.ai}<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z" fill="currentColor" /></svg>{/if}{l.title}
      </a>
    {/each}
  </nav>
  <button class="jump" onclick={() => (shell.jump = true)}>
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
    <span>Jump to…</span>
    <kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
  </button>
  <div class="tools">
    <label class="fw">
      <span class="sr">Code examples in</span>
      <select value={prefs.framework} onchange={(e) => prefs.set(e.currentTarget.value as Framework)}>
        {#each FRAMEWORKS as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
      </select>
    </label>
    <button class="icon" onclick={toggleTheme} aria-label={ui.theme === 'dark' ? 'Use the light theme' : 'Use the dark theme'}>
      {#if ui.theme === 'dark'}
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      {:else}
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
      {/if}
    </button>
    <a class="icon" href="https://github.com/bonguynvan/bo-grid" aria-label="bo-grid on GitHub" rel="external noopener">
      <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
    </a>
  </div>
</header>

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 18px;
    height: var(--top);
    padding: 0 20px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: saturate(140%) blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .menu {
    display: none;
    padding: 6px;
    color: var(--text-2);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
  }
  .name {
    font-family: var(--font-mono);
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }
  .ver {
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    border: 1px solid var(--line);
    border-radius: 999px;
  }
  .links {
    display: flex;
    gap: 4px;
    margin-left: 8px;
  }
  .links a {
    padding: 6px 10px;
    font-size: 14px;
    color: var(--text-2);
    border-radius: var(--radius-md);
  }
  .links a:hover {
    color: var(--text);
    background: var(--panel);
  }
  .links a.ai {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--accent);
  }
  .links a[aria-current='page'] {
    color: var(--text);
    box-shadow: inset 0 -2px 0 var(--accent);
    border-radius: 0;
  }
  .jump {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    min-width: 220px;
    padding: 6px 8px 6px 10px;
    font: inherit;
    font-size: 13px;
    color: var(--text-3);
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }
  .jump:hover {
    border-color: var(--line-strong);
    color: var(--text-2);
  }
  .jump kbd {
    margin-left: auto;
    padding: 0 5px;
    font-family: var(--font-mono);
    font-size: 11px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fw select {
    padding: 5px 8px;
    font: inherit;
    font-size: 13px;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
  }
  .icon {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--text-2);
    background: none;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .icon:hover {
    color: var(--text);
    background: var(--panel);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  @media (max-width: 899px) {
    .menu {
      display: inline-grid;
    }
    .links,
    .fw {
      display: none;
    }
    .jump {
      min-width: 0;
    }
    .jump span,
    .jump kbd {
      display: none;
    }
  }
</style>
