<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import FrameworkTabs from '$lib/FrameworkTabs.svelte';
  import { firstGrid } from '$lib/snippets';
  import CountUp from '$lib/home/CountUp.svelte';
  import Ticker from '$lib/home/Ticker.svelte';
  import { onScreen, reveal } from '$lib/home/reveal';

  // The live parts load in the browser only: the page pre-renders without
  // them and keeps its first paint light.
  let Board = $state<Component | null>(null);
  let Agent = $state<Component | null>(null);
  let Ladder = $state<Component | null>(null);
  let Types = $state<Component | null>(null);
  let Groups = $state<Component | null>(null);
  let copied = $state(false);
  let tilt = $state(1);
  let video = $state<HTMLVideoElement>();
  let reducedMotion = $state(false);

  // The tour plays muted while on screen; under reduced motion it waits for
  // the reader to press play.
  function tour(visible: boolean): void {
    if (!video || reducedMotion) return;
    if (visible) void video.play().catch(() => {});
    else video.pause();
  }

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Links to the old one-page demo (#ex-priceboard, #priceboard) open the
    // example's own page.
    const id = location.hash.replace(/^#(ex-)?/, '');
    if (id) {
      void import('$demo/examples/catalog').then(({ CATALOG }) => {
        if (CATALOG.some((e) => e.id === id)) void goto(`${base}/examples/${id}/`, { replaceState: true });
      });
    }
    void import('$lib/home/LiveBoard.svelte').then((m) => (Board = m.default));
    void import('$lib/home/AgentDemo.svelte').then((m) => (Agent = m.default));
    void import('$lib/home/MiniLadder.svelte').then((m) => (Ladder = m.default));
    void import('$lib/home/TypesGrid.svelte').then((m) => (Types = m.default));
    void import('$lib/home/GroupGrid.svelte').then((m) => (Groups = m.default));

    // The board leans back and straightens as the page scrolls.
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (tilt = Math.max(0, 1 - window.scrollY / 420)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  });

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText('npm i bo-grid');
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* clipboard blocked: the command is still selectable */
    }
  }

  const words = ['The', 'data', 'grid', 'for'];

  const agentLinks = [
    { title: 'Every page as Markdown', body: 'Each docs page has a .md twin and a Copy page button, ready to paste into an agent.', href: '/docs/getting-started.md', label: 'getting-started.md' },
    { title: 'llms.txt', body: 'An index of every page, led by the facts an agent must get right first: runes only, ids on rows, patchRows for live data.', href: '/llms.txt', label: '/llms.txt' },
    { title: 'api.json', body: 'Every prop, column option and API method with its type, default and docs, generated from the TypeScript types.', href: '/api.json', label: '/api.json' },
    { title: 'Types as docs', body: 'TSDoc on every prop ships in node_modules, so an agent reads the API of the version you installed.', href: '/docs/ai/', label: 'AI coding agents' },
  ];

  const features = [
    { title: 'Order books and ladders', body: 'A depth ladder with click-to-trade and keys for buy, sell and cancel. Order books from a depth feed, orders that linger after they fill, alerts that stay lit until acknowledged.', href: '/docs/depth-ladder/', link: 'Depth ladder', span: 'wide row', live: 'ladder' },
    { title: 'Realtime that stays smooth', body: 'Plain rows patched in place repaint only the cells that changed. A coalescing tick stream hands the grid one batch a frame; a busy feed can be read in a worker.', href: '/docs/realtime/', link: 'Live updates', span: 'wide', live: 'frame' },
    { title: 'Every column type', body: 'Prices, percents, volumes, dates, heatmaps, sparklines, progress, badges, tags, ratings, links and your own cells.', href: '/docs/column-types/', link: 'Column types', live: 'types' },
    { title: 'Group, pivot, tree', body: 'Nested groups with subtotals, pivot tables, tree data, master-detail, server-side groups and lazy trees.', href: '/docs/grouping/', link: 'Row grouping', live: 'groups' },
    { title: 'Edit like a sheet', body: 'Inline editing with validation, range selection, clipboard, fill handle, merged cells and Excel export.', href: '/docs/editing/', link: 'Inline editing' },
    { title: 'Keyboard first', body: 'A full keyboard model with grid and treegrid semantics, hotkeys you define, and a find bar.', href: '/docs/keyboard/', link: 'Keyboard & hotkeys' },
    { title: 'A million rows', body: 'A windowed source loads rows on demand and sorts and filters on the server; wide grids virtualize their columns too.', href: '/docs/server-data/', link: 'Server-side data' },
  ];

  // Measured frame costs for the 1,000-symbol price board (BENCHMARKS.md:
  // production build, Chrome, one frame's ticks rendered synchronously),
  // against the 16.7 ms a 60 Hz frame has.
  const BUDGET = 16.7;
  const frames = [
    { label: '10,000 ticks/s', p50: 1.9, p95: 4.8 },
    { label: '30,000 ticks/s', p50: 4.5, p95: 11 },
    { label: 'Scroll 3 rows a frame', p50: 2.5, p95: 5.7 },
  ];
</script>

<svelte:head>
  <title>bo-grid — the data grid for busy markets</title>
  <meta name="description" content="A fast, lightweight data grid for trading screens: realtime price boards, order books, ladders, grouping, pivot and tree data. Native to Svelte 5, with React and Vue components. Docs built for AI coding agents." />
</svelte:head>

<main class="home">
  <section class="hero">
    <div class="aurora" aria-hidden="true"></div>
    <div class="lines" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>

    <div class="pitch">
      <a class="pill" href="{base}/docs/worker-feed/"><span class="pill-tag">New in 2.8</span>Busy feeds, read in a worker <span aria-hidden="true">→</span></a>
      <h1>
        {#each words as w, i (i)}<span class="w" style="--i:{i}">{w}</span>{' '}{/each}<span class="w grad" style="--i:4">busy markets.</span>
      </h1>
      <p class="lead">A fast, lightweight grid for trading screens. Price boards that tick tens of thousands of times a second, order books, ladders and blotters, with everything a data grid needs besides. Documented for people, and for the AI agents that write code with them.</p>
      <div class="ctas">
        <a class="btn primary" href="{base}/docs/getting-started/">Get started <span aria-hidden="true">→</span></a>
        <a class="btn" href="{base}/examples/">See the examples</a>
        <button class="install" onclick={copy} aria-label="Copy the install command">
          <span class="prompt">$</span> npm i bo-grid <span class="hint">{copied ? 'copied' : 'copy'}</span>
        </button>
      </div>
      <p class="stack">Svelte 5 <i></i> React <i></i> Vue <i></i> any framework <i></i> MIT</p>
    </div>

    <div class="stage" style="--tilt:{tilt}">
      <div class="glow" aria-hidden="true"></div>
      <div class="board">
        <div class="board-head">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="live"><span class="dot" aria-hidden="true"></span>Live</span>
          <code>createTickStream → api.patchRows</code>
        </div>
        <div class="board-body">
          {#if Board}<Board />{:else}<div class="placeholder" aria-hidden="true"></div>{/if}
        </div>
      </div>
      <span class="callout c1" aria-hidden="true"><b>flash</b>: 'auto'</span>
      <span class="callout c2" aria-hidden="true">~4.5 ms a frame</span>
      <span class="callout c3" aria-hidden="true">30,000 ticks/s</span>
    </div>
  </section>

  <Ticker />

  <section class="figures" aria-label="In figures" use:reveal>
    <div class="fig"><strong>~<CountUp to={4.5} format={(n) => n.toFixed(1)} /> ms</strong><span>main-thread work a frame (median) for 1,000 symbols at 30,000 ticks a second</span></div>
    <div class="fig"><strong><CountUp to={46} /> KB</strong><span>gzip for the grid, with no runtime dependencies</span></div>
    <div class="fig"><strong><CountUp to={1} />M rows</strong><span>windowed from a source on demand, sorted and filtered there</span></div>
    <div class="fig"><strong><CountUp to={24} /></strong><span>live examples, each with its source a tab away</span></div>
  </section>

  <section class="tour" aria-labelledby="tour-h">
    <div class="sec-head" use:reveal>
      <p class="kicker">Thirty seconds</p>
      <h2 id="tour-h">See it move.</h2>
    </div>
    <div class="player" use:reveal use:onScreen={tour}>
      <video bind:this={video} muted loop playsinline preload="metadata" controls={reducedMotion} poster="{base}/media/tour-poster.jpg" aria-label="A 30-second tour of bo-grid: the live price board, order books and ladders, docs as Markdown for AI agents, and the frameworks it runs in" width="1600" height="900">
        <source src="{base}/media/tour.webm" type="video/webm" />
        <source src="{base}/media/tour.mp4" type="video/mp4" />
      </video>
    </div>
  </section>

  <section class="agents" aria-labelledby="agents-h">
    <div class="sec-head" use:reveal>
      <p class="kicker"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5 9.4 6.6 14.5 8 9.4 9.4 8 14.5 6.6 9.4 1.5 8 6.6 6.6Z" fill="currentColor" /></svg> Built for AI coding agents</p>
      <h2 id="agents-h">Docs an agent can read.<br /><span class="dim">Types it can trust.</span></h2>
      <p class="sec-lead">Agents don't remember libraries; they read them, and they get versions wrong. bo-grid puts what an agent needs where it looks: TSDoc in the installed types, every page as Markdown, an llms.txt index and a manifest generated from the types.</p>
    </div>
    <div class="agent-stage" use:reveal>
      {#if Agent}<Agent />{:else}<div class="placeholder tall" aria-hidden="true"></div>{/if}
      <p class="caption">A session played back. The files the agent reads are the real ones.</p>
    </div>
    <div class="agent-cards">
      {#each agentLinks as c, i (c.title)}
        <a class="agent-card" href="{base}{c.href}" rel={c.href.endsWith('/') ? undefined : 'external'} use:reveal style="--d:{i * 70}ms">
          <h3>{c.title}</h3>
          <p>{c.body}</p>
          <code>{c.label} →</code>
        </a>
      {/each}
    </div>
  </section>

  <section class="features" aria-labelledby="features-h">
    <div class="sec-head" use:reveal>
      <p class="kicker">What is inside</p>
      <h2 id="features-h">Everything a trading screen needs,<br /><span class="dim">in one MIT package.</span></h2>
    </div>
    <div class="bento">
      {#each features as f, i (f.title)}
        <article class="tile {f.span ?? ''}" use:reveal style="--d:{i * 60}ms">
          {#if f.live === 'ladder'}
            <div class="tile-live ladder">{#if Ladder}<Ladder />{:else}<div class="placeholder" aria-hidden="true"></div>{/if}</div>
          {:else if f.live === 'types' || f.live === 'groups'}
            {@const Live = f.live === 'types' ? Types : Groups}
            <div class="tile-live mini">{#if Live}<Live />{:else}<div class="placeholder mini" aria-hidden="true"></div>{/if}</div>
          {:else if f.live === 'frame'}
            <figure class="tile-live frame">
              <figcaption class="frame-head"><span>Frame cost, 1,000 symbols · <code>api.patchRows</code></span><span class="key"><i class="k50"></i>p50 <i class="k95"></i>p95</span></figcaption>
              {#each frames as f, j (f.label)}
                <div class="frow" style="--j:{j}">
                  <span class="flabel">{f.label}</span>
                  <span class="track" role="img" aria-label="{f.label}: {f.p50} ms median, {f.p95} ms at p95, of a {BUDGET} ms frame">
                    <span class="p95" style="--w:{(f.p95 / BUDGET) * 100}%"></span>
                    <span class="p50" style="--w:{(f.p50 / BUDGET) * 100}%"></span>
                  </span>
                  <span class="fval">{f.p50} / {f.p95} ms</span>
                </div>
              {/each}
              <div class="frame-foot"><span>0</span><span class="budget-label">16.7 ms · one frame at 60 Hz</span></div>
            </figure>
          {/if}
          <div class="tile-text">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <a href="{base}{f.href}">{f.link} →</a>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="start" aria-labelledby="start-h">
    <div class="sec-head" use:reveal>
      <p class="kicker">Start in a minute</p>
      <h2 id="start-h">Rows, columns, a height.<br /><span class="dim">That's a grid.</span></h2>
      <p class="sec-lead">A column's <code>type</code> picks how its values show, sort and filter. The tabs follow your framework, on every page of the docs.</p>
      <div class="ctas">
        <a class="btn primary" href="{base}/docs/getting-started/">Read the quick start <span aria-hidden="true">→</span></a>
        <a class="btn" href="{base}/docs/frameworks/">React, Vue & more</a>
      </div>
    </div>
    <div class="start-code" use:reveal><FrameworkTabs code={firstGrid} /></div>
  </section>

  <section class="cta" use:reveal>
    <div class="aurora small" aria-hidden="true"></div>
    <h2>Build the screen your desk needs.</h2>
    <p>Open source, MIT, every feature in one package.</p>
    <div class="ctas center">
      <a class="btn primary" href="{base}/docs/getting-started/">Get started <span aria-hidden="true">→</span></a>
      <a class="btn" href="https://github.com/bonguynvan/bo-grid" rel="external noopener">Star on GitHub</a>
    </div>
  </section>

  <footer class="foot">
    <div class="foot-brand">
      <strong>bo-grid</strong>
      <span>v{__BO_GRID_VERSION__} · MIT</span>
    </div>
    <nav aria-label="Docs">
      <h3>Docs</h3>
      <a href="{base}/docs/getting-started/">Quick start</a>
      <a href="{base}/docs/realtime/">Live updates</a>
      <a href="{base}/docs/trading/">Trading</a>
      <a href="{base}/docs/reference/">Props reference</a>
    </nav>
    <nav aria-label="Examples">
      <h3>Examples</h3>
      <a href="{base}/examples/priceboard/">Price board</a>
      <a href="{base}/examples/orderbook/">Order book</a>
      <a href="{base}/examples/ladder/">Price ladder</a>
      <a href="{base}/examples/">All examples</a>
    </nav>
    <nav aria-label="For agents">
      <h3>For agents</h3>
      <a href="{base}/docs/ai/">AI coding agents</a>
      <a href="{base}/llms.txt" rel="external">llms.txt</a>
      <a href="{base}/api.json" rel="external">api.json</a>
      <a href="{base}/llms-full.txt" rel="external">llms-full.txt</a>
    </nav>
    <nav aria-label="Project">
      <h3>Project</h3>
      <a href="https://github.com/bonguynvan/bo-grid" rel="external noopener">GitHub</a>
      <a href="https://www.npmjs.com/package/bo-grid" rel="external noopener">npm</a>
      <a href="https://github.com/bonguynvan/bo-grid/blob/main/CHANGELOG.md" rel="external noopener">Changelog</a>
      <a href="{base}/api.html" rel="external">All exports</a>
    </nav>
  </footer>
</main>

<style>
  .home {
    --wrap: 1240px;
    --grid-line: color-mix(in srgb, var(--text) 7%, transparent);
    overflow-x: clip;
  }
  section,
  .foot {
    position: relative;
    max-width: var(--wrap);
    margin: 0 auto;
    padding-inline: clamp(16px, 4vw, 40px);
  }

  /* ---- Hero ------------------------------------------------------------ */
  .hero {
    max-width: none;
    padding-top: clamp(48px, 8vw, 96px);
    padding-bottom: 72px;
    text-align: center;
    isolation: isolate;
  }
  .aurora {
    position: absolute;
    inset: -260px -10% auto;
    z-index: -2;
    height: 1000px;
    background:
      radial-gradient(38% 36% at 28% 36%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 70%),
      radial-gradient(30% 32% at 72% 28%, color-mix(in srgb, var(--up) 26%, transparent), transparent 70%),
      radial-gradient(34% 30% at 52% 64%, color-mix(in srgb, var(--info) 24%, transparent), transparent 72%);
    filter: blur(48px);
    opacity: 0.55;
    animation: drift 22s ease-in-out infinite alternate;
  }
  .aurora.small {
    inset: -40% -10%;
    height: auto;
    opacity: 0.4;
  }
  .lines {
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image:
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 20%, #000 30%, transparent 75%);
  }
  .grain {
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
    opacity: 0.07;
    mix-blend-mode: overlay;
    pointer-events: none;
  }
  .pitch {
    max-width: 880px;
    margin: 0 auto;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 26px;
    padding: 5px 14px 5px 5px;
    font-size: 13.5px;
    color: var(--text-2);
    background: color-mix(in srgb, var(--panel) 80%, transparent);
    border: 1px solid var(--line);
    border-radius: 999px;
    backdrop-filter: blur(6px);
    transition:
      border-color 0.2s ease,
      color 0.2s ease;
    animation: rise 0.7s ease both;
  }
  .pill:hover {
    color: var(--text);
    border-color: color-mix(in srgb, var(--accent) 60%, var(--line));
  }
  .pill-tag {
    padding: 2px 9px;
    font-family: var(--font-cond);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--on-accent);
    background: var(--accent);
    border-radius: 999px;
  }
  h1 {
    margin: 0 0 22px;
    font-size: clamp(2.6rem, 6.4vw, 5.2rem);
    line-height: 1;
    letter-spacing: -0.035em;
    font-weight: 600;
    color: var(--text);
  }
  .w {
    display: inline-block;
    animation: rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--i) * 70ms + 80ms);
  }
  .grad {
    padding-bottom: 0.08em;
    background: linear-gradient(100deg, var(--accent) 10%, color-mix(in srgb, var(--accent) 55%, var(--up)) 55%, var(--up) 95%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .lead {
    max-width: 44rem;
    margin: 0 auto 30px;
    font-size: clamp(1.02rem, 1.4vw, 1.17rem);
    line-height: 1.65;
    color: var(--text-2);
    animation: rise 0.8s 0.4s ease both;
  }
  .ctas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .hero .ctas,
  .ctas.center {
    justify-content: center;
  }
  .hero .ctas {
    animation: rise 0.8s 0.5s ease both;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 20px;
    font-weight: 500;
    color: var(--text);
    background: color-mix(in srgb, var(--panel) 70%, transparent);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    transition:
      border-color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  .btn:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .btn.primary {
    color: var(--on-accent);
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 8px 30px -8px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .btn.primary:hover {
    box-shadow: 0 12px 36px -8px color-mix(in srgb, var(--accent) 85%, transparent);
  }
  .install {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 15px;
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
    background: color-mix(in srgb, var(--cell) 80%, transparent);
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }
  .prompt,
  .hint {
    color: var(--text-3);
  }
  .hint {
    margin-left: 6px;
    font-size: 11px;
  }
  .install:hover .hint {
    color: var(--accent);
  }
  .stack {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 6px 14px;
    margin: 26px 0 0;
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text-3);
    animation: rise 0.8s 0.6s ease both;
  }
  .stack i {
    width: 3px;
    height: 3px;
    background: var(--line-strong);
    border-radius: 50%;
  }

  /* The board, leaning back until the page scrolls. */
  .stage {
    position: relative;
    max-width: 1080px;
    margin: 64px auto 0;
    perspective: 1800px;
    animation: rise 1s 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .glow {
    position: absolute;
    inset: 12% 8% -6%;
    z-index: -1;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 34%, transparent), transparent);
    filter: blur(40px);
  }
  .board {
    overflow: hidden;
    text-align: left;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--text) 8%, transparent) inset,
      0 50px 120px -40px rgb(0 0 0 / 0.75);
    transform: rotateX(calc(var(--tilt) * 14deg)) scale(calc(1 - var(--tilt) * 0.04));
    transform-origin: 50% 0;
    will-change: transform;
  }
  .board-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  .board-head code {
    margin-left: auto;
  }
  .dots {
    display: inline-flex;
    gap: 6px;
  }
  .dots i {
    width: 10px;
    height: 10px;
    background: var(--line-strong);
    border-radius: 50%;
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--up);
  }
  .dot {
    width: 7px;
    height: 7px;
    background: var(--up);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--up);
    animation: pulse 2s ease-in-out infinite;
  }
  .board-body {
    font-family: var(--font-mono);
  }
  .placeholder {
    height: 425px;
  }
  .placeholder.tall {
    height: 680px;
  }
  .callout {
    position: absolute;
    z-index: 2;
    padding: 7px 12px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text);
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: var(--shadow-pop);
    backdrop-filter: blur(8px);
    animation: bob 6s ease-in-out infinite;
  }
  .callout b {
    color: var(--accent);
    font-weight: 500;
  }
  .c1 {
    top: 30%;
    left: -150px;
  }
  .c2 {
    top: 10%;
    right: -132px;
    color: var(--up);
    animation-delay: -2s;
  }
  .c3 {
    bottom: 16%;
    right: -146px;
    animation-delay: -4s;
  }

  /* ---- Figures --------------------------------------------------------- */
  .figures {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-top: 56px;
  }
  .fig {
    display: grid;
    align-content: start;
    gap: 6px;
    padding: 8px 24px;
  }
  .fig + .fig {
    border-left: 1px solid var(--line);
  }
  .fig strong {
    font-family: var(--font-mono);
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .fig span {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-3);
  }

  /* ---- Section heads --------------------------------------------------- */
  .sec-head {
    max-width: 760px;
  }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 14px;
    font-family: var(--font-cond);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h2 {
    margin: 0 0 18px;
    font-size: clamp(2rem, 4vw, 3.1rem);
    line-height: 1.06;
    letter-spacing: -0.03em;
    font-weight: 600;
    color: var(--text);
  }
  .dim {
    color: var(--text-3);
  }
  .sec-lead {
    max-width: 40rem;
    margin: 0 0 28px;
    font-size: 1.08rem;
    line-height: 1.65;
    color: var(--text-2);
  }
  .sec-lead code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    color: var(--text);
  }

  /* ---- Tour video -------------------------------------------------------- */
  .tour {
    padding-top: 120px;
  }
  .player {
    position: relative;
    overflow: hidden;
    background: var(--cell);
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    box-shadow: 0 40px 100px -40px color-mix(in srgb, var(--accent) 40%, rgb(0 0 0 / 0.7));
  }
  .player video {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }

  /* ---- Agents ---------------------------------------------------------- */
  .agents {
    padding-top: 120px;
  }
  .agent-stage {
    margin-top: 12px;
  }
  .caption {
    margin: 12px 0 0;
    font-size: 13px;
    color: var(--text-3);
  }
  .agent-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 28px;
  }
  .agent-card {
    display: grid;
    align-content: start;
    gap: 8px;
    padding: 20px;
    background: color-mix(in srgb, var(--panel) 85%, transparent);
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .agent-card:hover {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
    transform: translateY(-3px);
    box-shadow: 0 18px 40px -24px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .agent-card h3,
  .tile h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
  }
  .agent-card p,
  .tile p {
    margin: 0;
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--text-2);
  }
  .agent-card code {
    margin-top: 6px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--accent);
  }

  /* ---- Features (bento) ------------------------------------------------ */
  .features {
    padding-top: 128px;
  }
  .bento {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: dense;
    gap: 14px;
  }
  .tile {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: space-between;
    gap: 18px;
    overflow: hidden;
    padding: 22px;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .tile:hover {
    border-color: var(--line-strong);
  }
  .tile.wide {
    grid-column: span 2;
  }
  .tile.row {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 28px;
  }
  .tile-text {
    display: grid;
    gap: 8px;
  }
  .tile-text a {
    margin-top: 4px;
    font-size: 14px;
    font-weight: 500;
    color: var(--accent);
  }
  .tile-live {
    margin: -6px -6px 0;
  }
  .tile-live.mini {
    margin: -6px -6px 0;
    font-family: var(--font-mono);
  }
  .placeholder.mini {
    height: 170px;
  }
  .tile-live.ladder {
    width: min(500px, 100%);
    margin: 0;
    overflow: hidden;
    font-family: var(--font-mono);
  }
  .frame {
    display: grid;
    gap: 14px;
    margin: -6px -6px 0;
    padding: 16px 16px 12px;
    background: var(--cell);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
  }
  .frame-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
  }
  .frame-head code {
    color: var(--accent);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .key i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .k50 {
    background: var(--up);
  }
  .k95 {
    margin-left: 6px;
    background: color-mix(in srgb, var(--up) 30%, transparent);
  }
  .frow {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr) 96px;
    align-items: center;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 12.5px;
  }
  .flabel {
    color: var(--text-2);
  }
  .fval {
    text-align: right;
    color: var(--text);
  }
  .track {
    position: relative;
    height: 22px;
    background: repeating-linear-gradient(90deg, transparent 0 calc(25% - 1px), var(--line-soft) calc(25% - 1px) 25%);
    border-right: 1px dashed color-mix(in srgb, var(--down) 70%, transparent);
    border-radius: 3px;
  }
  .track span {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--w);
    border-radius: 3px;
    transform-origin: left;
    animation: grow-x 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--j) * 90ms);
    animation-play-state: paused;
  }
  :global([data-in]) .track span {
    animation-play-state: running;
  }
  .p95 {
    background: color-mix(in srgb, var(--up) 30%, transparent);
  }
  .p50 {
    background: linear-gradient(90deg, color-mix(in srgb, var(--up) 55%, transparent), var(--up));
  }
  .frame-foot {
    display: flex;
    justify-content: space-between;
    margin-left: 162px;
    margin-right: 108px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }
  .budget-label {
    color: var(--down);
  }

  /* ---- Start ------------------------------------------------------------ */
  .start {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 48px;
    align-items: center;
    padding-top: 128px;
  }

  /* ---- Call to action --------------------------------------------------- */
  .cta {
    margin-top: 128px;
    padding-block: 80px;
    overflow: hidden;
    text-align: center;
    isolation: isolate;
    border: 1px solid var(--line);
    border-radius: 18px;
  }
  .cta .aurora {
    z-index: -1;
  }
  .cta p {
    margin: 0 0 26px;
    color: var(--text-2);
  }

  /* ---- Footer ----------------------------------------------------------- */
  .foot {
    display: grid;
    grid-template-columns: 1.4fr repeat(4, 1fr);
    gap: 24px;
    padding-block: 72px 64px;
    font-size: 14px;
  }
  .foot-brand {
    display: grid;
    align-content: start;
    gap: 6px;
    color: var(--text-3);
  }
  .foot-brand strong {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--text);
  }
  .foot nav {
    display: grid;
    align-content: start;
    gap: 9px;
  }
  .foot h3 {
    margin: 0 0 4px;
    font-family: var(--font-cond);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .foot a {
    color: var(--text-2);
  }
  .foot a:hover {
    color: var(--accent);
  }

  /* ---- Reveal on scroll -------------------------------------------------- */
  .sec-head,
  .agent-stage,
  .agent-card,
  .tile,
  .figures,
  .player,
  .start-code,
  .cta {
    transition:
      opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0ms),
      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0ms),
      border-color 0.2s ease,
      box-shadow 0.25s ease;
  }
  .sec-head:not([data-in]),
  .agent-stage:not([data-in]),
  .agent-card:not([data-in]),
  .tile:not([data-in]),
  .figures:not([data-in]),
  .player:not([data-in]),
  .start-code:not([data-in]),
  .cta:not([data-in]) {
    opacity: 0;
    transform: translateY(24px);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(18px);
    }
  }
  @keyframes drift {
    to {
      transform: translate3d(4%, 3%, 0) rotate(6deg) scale(1.08);
    }
  }
  @keyframes bob {
    50% {
      transform: translateY(-8px);
    }
  }
  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }
  @keyframes grow-x {
    from {
      transform: scaleX(0);
    }
  }

  @media (max-width: 1399px) {
    .callout {
      display: none;
    }
  }
  @media (max-width: 959px) {
    .figures {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      row-gap: 24px;
    }
    .fig:nth-child(3) {
      border-left: 0;
    }
    .agent-cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .bento {
      grid-template-columns: minmax(0, 1fr);
    }
    .tile.wide {
      grid-column: auto;
    }
    .tile.row {
      grid-template-columns: minmax(0, 1fr);
    }
    .start {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }
    .foot {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .foot-brand {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 599px) {
    .frow {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .frow .track {
      grid-column: 1 / -1;
      grid-row: 2;
    }
    .frame-foot {
      margin: 0;
    }
    .agent-cards {
      grid-template-columns: minmax(0, 1fr);
    }
    .board-head code {
      display: none;
    }
    .stage {
      margin-top: 40px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .aurora,
    .w,
    .pill,
    .lead,
    .hero .ctas,
    .stack,
    .stage,
    .callout,
    .dot,
    .track span {
      animation: none;
    }
    .board {
      transform: none;
    }
    .sec-head:not([data-in]),
    .agent-stage:not([data-in]),
    .agent-card:not([data-in]),
    .tile:not([data-in]),
    .figures:not([data-in]),
    .player:not([data-in]),
    .start-code:not([data-in]),
    .cta:not([data-in]) {
      opacity: 1;
      transform: none;
    }
  }
</style>
