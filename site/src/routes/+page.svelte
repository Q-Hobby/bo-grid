<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';

  // The live board, in the browser only: the page pre-renders without it.
  let Board = $state<Component | null>(null);
  let copied = $state(false);
  onMount(() => {
    // Links to the old one-page demo (#ex-priceboard, #priceboard) open the
    // example's own page.
    const id = location.hash.replace(/^#(ex-)?/, '');
    if (id) {
      void import('$demo/examples/catalog').then(({ CATALOG }) => {
        if (CATALOG.some((e) => e.id === id)) void goto(`${base}/examples/${id}/`, { replaceState: true });
      });
    }
    void import('$demo/HeroBoard.svelte').then((m) => (Board = m.default));
  });

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText('npm i bo-grid');
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  const figures = [
    { value: '~12 ms', label: 'a frame, 1,000 symbols at 30,000 ticks/s' },
    { value: '49 KB', label: 'gzip for the grid, no runtime dependencies' },
    { value: '1M rows', label: 'windowed from a source on demand' },
    { value: 'MIT', label: 'every feature, one package' },
  ];

  const features = [
    {
      title: 'Realtime that stays smooth',
      body: 'Plain rows patched in place repaint only the cells that changed. A coalescing tick stream hands the grid one batch a frame, and a busy feed can be read in a worker.',
      link: { href: '/examples/priceboard/', label: 'The price board, live' },
    },
    {
      title: 'A trading toolkit',
      body: 'Tick flashes, price-limit colours, a depth ladder with click-to-trade, order books from a depth feed, alerts that stay lit, FX pips and crypto prices.',
      link: { href: '/examples/ladder/', label: 'The price ladder' },
    },
    {
      title: 'A complete grid',
      body: 'Sorting, filtering, grouping, pivot, tree data, inline editing, clipboard, merged cells, pinned rows and columns, Excel and CSV export.',
      link: { href: '/examples/sheet/', label: 'The spreadsheet' },
    },
    {
      title: 'Any framework',
      body: 'Native to Svelte 5, with typed React and Vue components and a custom element for Angular and plain JavaScript. Server rendering is safe in each.',
      link: { href: '/docs/frameworks/', label: 'React, Vue & more' },
    },
  ];
</script>

<svelte:head>
  <title>bo-grid — the data grid for busy markets</title>
  <meta name="description" content="A fast, lightweight data grid for trading screens: realtime price boards, order books, ladders, grouping, pivot and tree data. Native to Svelte 5, with React and Vue components." />
</svelte:head>

<main class="home">
  <section class="hero">
    <div class="pitch">
      <p class="kicker">Svelte 5 · React · Vue · any framework</p>
      <h1>The data grid for busy markets.</h1>
      <p class="lead">A fast, lightweight grid for trading screens: price boards that tick tens of thousands of times a second, order books, ladders and blotters, with everything a data grid needs besides.</p>
      <div class="ctas">
        <a class="btn primary" href="{base}/docs/getting-started/">Get started</a>
        <a class="btn" href="{base}/examples/">Examples</a>
        <button class="install" onclick={copy} aria-label="Copy the install command">
          <span class="prompt">$</span> npm i bo-grid <span class="hint">{copied ? 'copied' : 'copy'}</span>
        </button>
      </div>
    </div>
    <div class="board">
      <div class="board-head"><span class="dot"></span>Live · a feed through createTickStream and patchRows</div>
      <div class="board-body">
        {#if Board}<Board />{:else}<div class="placeholder" aria-hidden="true"></div>{/if}
      </div>
    </div>
  </section>

  <section class="figures" aria-label="In figures">
    {#each figures as f (f.label)}
      <div class="fig"><strong>{f.value}</strong><span>{f.label}</span></div>
    {/each}
  </section>

  <section class="features">
    <h2>What is inside</h2>
    <div class="grid">
      {#each features as f (f.title)}
        <article>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
          <a href="{base}{f.link.href}">{f.link.label} →</a>
        </article>
      {/each}
    </div>
  </section>

  <footer class="foot">
    <span>bo-grid v{__BO_GRID_VERSION__} · MIT</span>
    <nav aria-label="Footer">
      <a href="{base}/docs/">Docs</a>
      <a href="{base}/examples/">Examples</a>
      <a href="{base}/api.html" rel="external">API</a>
      <a href="https://github.com/bonguynvan/bo-grid/blob/main/CHANGELOG.md" rel="external noopener">Changelog</a>
      <a href="https://www.npmjs.com/package/bo-grid" rel="external noopener">npm</a>
    </nav>
  </footer>
</main>

<style>
  .home {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px);
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: clamp(28px, 4vw, 56px);
    align-items: center;
    padding: clamp(40px, 7vw, 88px) 0 48px;
  }
  .kicker {
    margin: 0 0 14px;
    font-family: var(--font-cond);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h1 {
    margin: 0 0 18px;
    font-size: clamp(2.3rem, 4.6vw, 3.6rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
    font-weight: 600;
    color: var(--text);
  }
  .lead {
    margin: 0 0 28px;
    max-width: 34rem;
    font-size: 1.12rem;
    line-height: 1.6;
    color: var(--text-2);
  }
  .ctas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .btn {
    padding: 10px 18px;
    font-weight: 500;
    color: var(--text);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
  }
  .btn:hover {
    border-color: var(--accent);
  }
  .btn.primary {
    color: var(--on-accent);
    background: var(--accent);
    border-color: var(--accent);
  }
  .btn.primary:hover {
    filter: brightness(1.08);
  }
  .install {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    cursor: pointer;
  }
  .prompt {
    color: var(--text-3);
  }
  .hint {
    margin-left: 6px;
    font-size: 11px;
    color: var(--text-3);
  }
  .install:hover .hint {
    color: var(--accent);
  }
  .board {
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
  }
  .board-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  .dot {
    width: 7px;
    height: 7px;
    background: var(--up);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--up);
  }
  .board-body {
    padding: 12px;
    font-family: var(--font-mono);
  }
  .placeholder {
    height: 300px;
  }
  .figures {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .fig {
    display: grid;
    gap: 4px;
    padding: 22px 20px;
  }
  .fig + .fig {
    border-left: 1px solid var(--line-soft);
  }
  .fig strong {
    font-family: var(--font-mono);
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text);
  }
  .fig span {
    font-size: 13.5px;
    color: var(--text-3);
  }
  .features {
    padding: 64px 0 24px;
  }
  .features h2 {
    margin: 0 0 22px;
    font-family: var(--font-cond);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  article {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 24px 26px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }
  article h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text);
  }
  article p {
    margin: 0;
    line-height: 1.6;
    color: var(--text-2);
  }
  article a {
    margin-top: 4px;
    font-size: 14px;
    font-weight: 500;
    color: var(--accent);
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    padding: 40px 0 56px;
    font-size: 13.5px;
    color: var(--text-3);
  }
  .foot nav {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
  }
  .foot a:hover {
    color: var(--text);
  }
  @media (max-width: 959px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
    .figures {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .fig:nth-child(3) {
      border-left: 0;
    }
    .fig:nth-child(n + 3) {
      border-top: 1px solid var(--line-soft);
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
