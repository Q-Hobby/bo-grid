<script lang="ts">
  import { EXAMPLES } from './examples/registry';
  import ExampleSection from './ExampleSection.svelte';
  import HeroBoard from './HeroBoard.svelte';
  import { ui, toggleTheme } from './theme.svelte';
  import { sessionStateAt, sessionLabel, VN_HOSE_SCHEDULE } from '../lib/trading';

  // The landing page, in the TradeCanvas / TradingDek "terminal" system: sharp
  // panes split by 1px lines, mono figures, one amber accent, up/down kept for
  // prices. The hero figure is a live board; every example follows.
  let activeId = $state(EXAMPLES[0].id);

  // One toggle drives the page chrome (a class on <html>) and every grid.
  $effect(() => {
    const light = ui.theme === 'light';
    document.documentElement.classList.toggle('light', light);
    document.documentElement.classList.toggle('dark', !light);
  });

  // Scroll-spy: highlight the example nearest the top in the contents rail.
  $effect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = [...document.querySelectorAll<HTMLElement>('section.lp-ex')];
    if (sections.length === 0) return;
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) activeId = e.target.id.replace(/^ex-/, '');
        }
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    sections.forEach((s) => spy.observe(s));
    return () => spy.disconnect();
  });

  const REPO = 'https://github.com/bonguynvan/bo-grid';
  const DOCS = 'https://bonguynvan.github.io/bo-grid/docs';
  const NPM = 'https://www.npmjs.com/package/bo-grid';
  const TRADECANVAS = 'https://bonguynvan.github.io/tradecanvas/';

  // The live HOSE session, evaluated in Vietnam time.
  let now = $state(new Date());
  $effect(() => {
    const h = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(h);
  });
  const session = $derived(sessionLabel(sessionStateAt(now, VN_HOSE_SCHEDULE)));

  const TAPE: Array<[string, string, number]> = [
    ['VNM', '68.90', 0.4], ['FPT', '130.80', -1.2], ['HPG', '27.45', 0.3], ['VCB', '91.00', 0],
    ['MWG', '52.10', 0.7], ['SSI', '33.10', -0.35], ['VIC', '44.85', 0.65], ['GAS', '71.20', -0.6],
    ['MSN', '63.90', 0.7], ['VPB', '19.55', -0.1], ['SHS', '15.10', 0.3], ['PVS', '33.60', 0],
  ];

  // What ships in the one MIT package, and where to find it.
  const LISTINGS: Array<[string, string]> = [
    ['Row grouping & aggregation', 'groupBy'],
    ['Pivot tables', 'pivot()'],
    ['Tree data', 'getChildren'],
    ['Master / detail', 'detail'],
    ['Range selection & fill handle', 'fillHandle'],
    ['Clipboard copy & paste', 'Ctrl+C / Ctrl+V'],
    ['Set filter', "filter: 'set'"],
    ['Columns tool panel', 'columnsPanel'],
    ['Context menu', 'rowMenu'],
    ['Server-side rows', 'source'],
    ['Excel export', 'exportXLSX()'],
    ['Sparklines', "type: 'sparkline'"],
  ];

  // From BENCHMARKS.md and the size report — the grid's own work, not paint.
  const FIGURES: Array<[string, string]> = [
    ['30,000', 'ticks a second, coalesced to one update a frame'],
    ['~1 ms', 'grid work per scroll step through 1,000 symbols'],
    ['46 KB', 'gzip core, Svelte external, no runtime dependencies'],
    ['$0', 'MIT licence, every feature included'],
  ];

  const INSTALL: Array<[string, string]> = [
    ['npm', 'npm i bo-grid'],
    ['pnpm', 'pnpm add bo-grid'],
    ['yarn', 'yarn add bo-grid'],
    ['bun', 'bun add bo-grid'],
  ];
  let pm = $state(0);
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout>;
  function copyInstall() {
    navigator.clipboard?.writeText(INSTALL[pm][1]);
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1500);
  }
  const num = (i: number) => String(i + 1).padStart(2, '0');
</script>

<header class="lp-bar">
  <a class="lp-brand" href="#top" aria-label="bo-grid, back to top">
    <svg class="lp-mark" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1.75" y="1.75" width="16.5" height="16.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M1.75 7h16.5M1.75 12.5h16.5M7.5 7v11.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <rect class="lp-mark-cell" x="8.25" y="7.75" width="9.25" height="4" />
    </svg>
    <span class="lp-brand-name">bo-grid</span>
    <span class="lp-chip">v{__BO_GRID_VERSION__}</span>
  </a>
  <nav class="lp-nav" aria-label="Site">
    <a href="#examples">Examples</a>
    <a href="./api.html">API</a>
    <a href="{REPO}/blob/main/BENCHMARKS.md">Benchmarks</a>
    <a href="{DOCS}/frameworks/">Frameworks</a>
  </nav>
  <div class="lp-bar-end">
    <span class="lp-session" title="Ho Chi Minh Stock Exchange session, Vietnam time"><i aria-hidden="true"></i>HOSE · {session}</span>
    <a class="lp-btn lp-btn-sm" href={REPO} target="_blank" rel="noreferrer">GitHub</a>
    <button class="lp-btn lp-btn-sm lp-theme" type="button" onclick={toggleTheme} aria-label="Switch to {ui.theme === 'dark' ? 'light' : 'dark'} theme">
      {ui.theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  </div>
</header>

<main id="top">
  <section class="lp-hero" aria-labelledby="hero-h">
    <div class="lp-hero-copy">
      <p class="lp-eyebrow">Svelte 5 data grid · MIT</p>
      <h1 id="hero-h" class="lp-wordmark">The data grid<span>for busy markets.</span></h1>
      <p class="lp-deck">
        Built for price boards: tens of thousands of ticks a second coalesced into one update a frame, a
        thousand symbols scrolled in millisecond steps, and grouping, pivot, tree data and the rest in the
        same MIT package.
      </p>
      <div class="lp-install">
        <div class="lp-install-tabs" role="tablist" aria-label="Package manager">
          {#each INSTALL as [name], i (name)}
            <button type="button" role="tab" aria-selected={pm === i} class:on={pm === i} onclick={() => (pm = i)}>{name}</button>
          {/each}
        </div>
        <button type="button" class="lp-install-cmd" class:copied onclick={copyInstall} aria-label="Copy install command">
          <span class="lp-prompt" aria-hidden="true">$</span>
          <code>{INSTALL[pm][1]}</code>
          <span class="lp-copy">{copied ? 'COPIED' : 'COPY'}</span>
        </button>
      </div>
      <div class="lp-cta">
        <a class="lp-btn lp-btn-primary" href="#examples">Live examples</a>
        <a class="lp-btn" href="./api.html">API reference</a>
        <a class="lp-btn" href={NPM} target="_blank" rel="noreferrer">npm ↗</a>
      </div>
    </div>
    <figure class="lp-fig">
      <div class="lp-pane-head">
        <span class="lp-label">Price board · HOSE</span>
        <span class="lp-live"><i aria-hidden="true"></i>Live</span>
        <span class="lp-chip">Sample</span>
      </div>
      <HeroBoard />
      <figcaption>Plain rows fed through <code>api.patchRows</code>; ticks coalesce per frame and only changed cells repaint.</figcaption>
    </figure>
  </section>

  <div class="lp-tape" aria-hidden="true">
    <div class="lp-tape-track">
      {#each [...TAPE, ...TAPE] as [sym, px, chg], i (i)}
        <span class="lp-tick">
          <b>{sym}</b>{px}
          <em class:up={chg > 0} class:down={chg < 0}>{chg > 0 ? '▲' : chg < 0 ? '▼' : '■'} {Math.abs(chg).toFixed(2)}</em>
        </span>
      {/each}
    </div>
  </div>

  <section class="lp-figures" aria-label="Key figures">
    <dl>
      {#each FIGURES as [value, label] (value)}
        <div><dt>{value}</dt><dd>{label}</dd></div>
      {/each}
    </dl>
  </section>

  <section class="lp-listing" aria-labelledby="listing-h">
    <header>
      <p class="lp-eyebrow">In the box</p>
      <h2 id="listing-h">Everything in one package.</h2>
      <p class="lp-sub">Each feature below ships with the grid, under the MIT licence: one install, no add-ons, no licence key.</p>
    </header>
    <ul class="lp-list">
      <li class="lp-list-head" aria-hidden="true"><span>Feature</span><span>Where</span></li>
      {#each LISTINGS as [f, api] (f)}
        <li><span>{f}</span><code class="lp-api">{api}</code></li>
      {/each}
    </ul>
  </section>

  <section class="lp-examples" id="examples" aria-labelledby="examples-h">
    <header class="lp-sec-head">
      <p class="lp-eyebrow">Live examples</p>
      <h2 id="examples-h">{EXAMPLES.length} boards, one page.</h2>
      <p class="lp-sub">Each mounts as you reach it. Scroll, or jump from the contents.</p>
    </header>
    <div class="lp-gallery">
      <nav class="lp-toc" aria-label="Jump to example">
        <p class="lp-label">Contents</p>
        <ol>
          {#each EXAMPLES as ex, i (ex.id)}
            <li>
              <a href={`#ex-${ex.id}`} class:on={ex.id === activeId} aria-current={ex.id === activeId}>
                <span>{num(i)}</span>{ex.title}
              </a>
            </li>
          {/each}
        </ol>
      </nav>
      <div class="lp-ex-list">
        {#each EXAMPLES as ex, i (ex.id)}
          <ExampleSection {ex} n={i + 1} eager={i === 0} />
        {/each}
      </div>
    </div>
  </section>
</main>

<footer class="lp-foot">
  <div class="lp-foot-cols">
    <div class="lp-foot-brand">
      <p class="lp-brand-name">bo-grid</p>
      <p>A free Svelte&nbsp;5 data grid for trading screens. Pairs with TradeCanvas for charts.</p>
    </div>
    <nav aria-label="Documentation">
      <p class="lp-label">Docs</p>
      <a href="./api.html">API reference</a>
      <a href="{REPO}/blob/main/BENCHMARKS.md">Benchmarks</a>
      <a href="{DOCS}/frameworks/">Frameworks</a>
      <a href="{DOCS}/sveltekit/">SvelteKit guide</a>
    </nav>
    <nav aria-label="Elsewhere">
      <p class="lp-label">Elsewhere</p>
      <a href={NPM} target="_blank" rel="noreferrer">npm</a>
      <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
      <a href={TRADECANVAS} target="_blank" rel="noreferrer">TradeCanvas charts ↗</a>
      <a href="https://github.com/sponsors/bonguynvan" target="_blank" rel="noreferrer">Sponsor ↗</a>
    </nav>
  </div>
  <p class="lp-foot-base"><span>MIT licence · © 2026</span><span>Set in IBM Plex</span></p>
</footer>

<style>
  /* ---- shared ---- */
  a {
    color: inherit;
    text-decoration: none;
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .lp-eyebrow {
    margin: 0 0 14px;
    font-family: var(--font-cond);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .lp-label {
    margin: 0;
    font-family: var(--font-cond);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .lp-chip {
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    line-height: 16px;
    color: var(--text-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  .lp-sub {
    margin: 0;
    max-width: 46ch;
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-2);
  }
  .lp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    padding: 0 16px;
    font: 500 13px var(--font-sans);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      transform 120ms ease;
  }
  .lp-btn:hover {
    background: var(--panel-2);
    border-color: var(--text-3);
  }
  .lp-btn:active {
    transform: translateY(1px);
  }
  .lp-btn-sm {
    height: 28px;
    padding: 0 10px;
    font-size: 12px;
  }
  .lp-btn-primary {
    font-weight: 600;
    color: var(--on-accent);
    background: var(--accent);
    border-color: var(--accent);
  }
  .lp-btn-primary:hover {
    background: color-mix(in srgb, var(--accent) 86%, var(--text));
    border-color: transparent;
  }

  /* ---- top bar ---- */
  .lp-bar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 24px;
    height: 48px;
    padding: 0 var(--gutter);
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(12px) saturate(140%);
    border-bottom: 1px solid var(--line);
  }
  .lp-brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
  }
  .lp-mark {
    width: 20px;
    height: 20px;
    color: var(--text);
  }
  .lp-mark-cell {
    fill: var(--accent);
  }
  .lp-brand-name {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .lp-nav {
    display: flex;
    gap: 2px;
  }
  .lp-nav a {
    padding: 5px 10px;
    font-size: 13px;
    color: var(--text-2);
    border-radius: var(--radius-sm);
    transition:
      color 120ms ease,
      background-color 120ms ease;
  }
  .lp-nav a:hover {
    color: var(--text);
    background: var(--panel-2);
  }
  .lp-bar-end {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .lp-session,
  .lp-live {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-2);
  }
  .lp-session {
    margin-right: 6px;
  }
  .lp-session i,
  .lp-live i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--up);
    box-shadow: 0 0 0 3px var(--up-dim);
    animation: lp-pulse 1.6s ease-in-out infinite;
  }
  @keyframes lp-pulse {
    50% {
      opacity: 0.35;
    }
  }

  /* ---- hero ---- */
  .lp-hero {
    display: grid;
    grid-template-columns: minmax(0, 6fr) minmax(0, 5fr);
    gap: clamp(32px, 4vw, 64px);
    align-items: center;
    padding: clamp(40px, 6vw, 88px) var(--gutter) clamp(40px, 5vw, 72px);
    border-bottom: 1px solid var(--line);
  }
  .lp-wordmark {
    margin: 0 0 22px;
    font-family: var(--font-cond);
    font-size: clamp(2.8rem, 6.2vw, 5.4rem);
    font-weight: 700;
    line-height: 0.94;
    letter-spacing: -0.012em;
    text-transform: uppercase;
    text-wrap: balance;
  }
  .lp-wordmark span {
    display: block;
    color: var(--accent);
  }
  .lp-deck {
    max-width: 36em;
    margin: 0 0 28px;
    font-size: clamp(15px, 1.1vw, 17px);
    line-height: 1.6;
    color: var(--text-2);
  }
  .lp-install {
    display: inline-flex;
    flex-direction: column;
    max-width: 100%;
    margin-bottom: 18px;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .lp-install-tabs {
    display: flex;
    border-bottom: 1px solid var(--line);
  }
  .lp-install-tabs button {
    padding: 5px 12px;
    font: 500 11px var(--font-mono);
    color: var(--text-3);
    background: transparent;
    border: 0;
    border-right: 1px solid var(--line);
    cursor: pointer;
  }
  .lp-install-tabs button:hover {
    color: var(--text);
  }
  .lp-install-tabs button.on {
    color: var(--accent);
    background: var(--accent-dim);
  }
  .lp-install-cmd {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 320px;
    height: 42px;
    padding: 0 14px;
    font: 400 14px var(--font-mono);
    color: var(--text);
    text-align: left;
    background: transparent;
    border: 0;
    cursor: pointer;
  }
  .lp-install-tabs button:focus-visible,
  .lp-install-cmd:focus-visible {
    outline-offset: -2px;
  }
  .lp-prompt {
    color: var(--accent);
  }
  .lp-copy {
    margin-left: auto;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--text-3);
  }
  .lp-install-cmd:hover .lp-copy {
    color: var(--text);
  }
  .lp-install-cmd.copied .lp-copy {
    color: var(--up);
  }
  .lp-cta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* hero figure: a pane with a header strip, like a desk pane */
  .lp-fig {
    margin: 0;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
    overflow: hidden;
  }
  .lp-pane-head {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 32px;
    padding: 0 12px;
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  .lp-pane-head .lp-live {
    margin-left: auto;
    color: var(--up);
  }
  .lp-fig :global(.bo-grid) {
    border: 0;
    border-radius: 0;
  }
  .lp-fig figcaption {
    padding: 9px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-3);
    border-top: 1px solid var(--line);
  }
  .lp-fig code {
    color: var(--text-2);
  }

  /* ---- ticker tape ---- */
  .lp-tape {
    overflow: hidden;
    background: var(--cell);
    border-bottom: 1px solid var(--line);
  }
  .lp-tape-track {
    display: flex;
    width: max-content;
    animation: lp-tape 52s linear infinite;
  }
  .lp-tape:hover .lp-tape-track {
    animation-play-state: paused;
  }
  @keyframes lp-tape {
    to {
      transform: translateX(-50%);
    }
  }
  .lp-tick {
    display: inline-flex;
    gap: 8px;
    padding: 8px 20px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-2);
    border-right: 1px solid var(--line);
    white-space: nowrap;
  }
  .lp-tick b {
    font-weight: 600;
    color: var(--text);
  }
  .lp-tick em {
    font-style: normal;
    color: var(--accent);
  }
  .lp-tick em.up {
    color: var(--up);
  }
  .lp-tick em.down {
    color: var(--down);
  }

  /* ---- figures: one row of cells split by hairlines ---- */
  .lp-figures dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    margin: 0;
    background: var(--line);
    border-bottom: 1px solid var(--line);
  }
  .lp-figures div {
    padding: 26px var(--gutter-in);
    background: var(--surface);
  }
  .lp-figures dt {
    font-family: var(--font-mono);
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  .lp-figures dd {
    margin: 6px 0 0;
    max-width: 26ch;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-3);
  }

  /* ---- listings ---- */
  .lp-listing {
    display: grid;
    grid-template-columns: minmax(0, 4fr) minmax(0, 7fr);
    gap: clamp(28px, 4vw, 64px);
    padding: clamp(44px, 6vw, 80px) var(--gutter);
    border-bottom: 1px solid var(--line);
  }
  .lp-listing h2,
  .lp-sec-head h2 {
    margin: 0 0 14px;
    font-family: var(--font-cond);
    font-size: clamp(2rem, 3.6vw, 3rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  .lp-list {
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .lp-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 36px;
    padding: 0 14px;
    font-size: 14px;
    border-top: 1px solid var(--line-soft);
  }
  .lp-list li:hover {
    background: var(--panel-2);
  }
  .lp-list .lp-list-head {
    min-height: 30px;
    font-family: var(--font-cond);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    background: var(--panel-2);
    border-top: 0;
  }
  .lp-api {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    white-space: nowrap;
  }

  /* ---- examples ---- */
  .lp-examples {
    padding: clamp(44px, 6vw, 80px) var(--gutter) 88px;
  }
  .lp-sec-head {
    margin-bottom: 36px;
  }
  .lp-gallery {
    display: grid;
    grid-template-columns: 208px minmax(0, 1fr);
    gap: clamp(24px, 3vw, 48px);
    align-items: start;
  }
  .lp-toc {
    position: sticky;
    top: 64px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
  }
  .lp-toc .lp-label {
    margin-bottom: 10px;
  }
  .lp-toc ol {
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--line);
  }
  .lp-toc a {
    display: flex;
    gap: 10px;
    margin-left: -1px;
    padding: 5px 10px;
    font-size: 13px;
    color: var(--text-2);
    border-left: 2px solid transparent;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }
  .lp-toc a span {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    padding-top: 2px;
  }
  .lp-toc a:hover {
    color: var(--text);
    border-left-color: var(--line-strong);
  }
  .lp-toc a.on {
    color: var(--text);
    font-weight: 500;
    border-left-color: var(--accent);
  }
  .lp-toc a.on span {
    color: var(--accent);
  }
  .lp-ex-list {
    display: flex;
    flex-direction: column;
    gap: 56px;
    min-width: 0;
  }

  /* ---- footer ---- */
  .lp-foot {
    margin-top: auto;
    border-top: 1px solid var(--line);
  }
  .lp-foot-cols {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    padding: 40px var(--gutter) 32px;
  }
  .lp-foot-brand p {
    margin: 0 0 8px;
    max-width: 34ch;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-3);
  }
  .lp-foot-brand .lp-brand-name {
    color: var(--text);
  }
  .lp-foot nav {
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 13px;
  }
  .lp-foot nav .lp-label {
    margin-bottom: 4px;
  }
  .lp-foot nav a {
    width: fit-content;
    color: var(--text-2);
  }
  .lp-foot nav a:hover {
    color: var(--text);
  }
  .lp-foot-base {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    padding: 14px var(--gutter) 24px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    border-top: 1px solid var(--line-soft);
  }

  /* ---- responsive ---- */
  @media (max-width: 1080px) {
    .lp-session {
      display: none;
    }
  }
  @media (max-width: 960px) {
    .lp-hero,
    .lp-listing,
    .lp-gallery {
      grid-template-columns: minmax(0, 1fr);
    }
    .lp-toc {
      display: none;
    }
  }
  @media (max-width: 720px) {
    .lp-nav {
      display: none;
    }
    .lp-figures dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .lp-foot-cols {
      grid-template-columns: minmax(0, 1fr);
    }
    .lp-install,
    .lp-install-cmd {
      width: 100%;
      min-width: 0;
    }
    .lp-list li {
      grid-template-columns: minmax(0, 1fr) 84px 52px;
      gap: 8px;
      padding: 0 10px;
      font-size: 13px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lp-tape-track,
    .lp-session i,
    .lp-live i {
      animation: none;
    }
    .lp-btn {
      transition: none;
    }
  }
</style>
