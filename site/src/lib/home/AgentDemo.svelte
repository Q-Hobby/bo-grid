<script lang="ts">
  import { untrack } from 'svelte';
  import { Grid, type ColumnDef, type GridApi, type GridRow } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { ui } from '$demo/theme.svelte';
  import { highlightCode } from '../highlight-code.js';
  import { marketRows, rand, tick, type MarketRow } from './market';
  import { onScreen } from './reveal';

  // An agent's session, played back: the prompt, the files it reads (the real
  // ones: the types in node_modules, llms.txt, a page's Markdown, api.json),
  // the page it writes, and that page running. It plays while on screen and
  // shows the end state at once under reduced motion.
  const PROMPT = 'Add a live price board with flashing prices to my SvelteKit app.';
  const READS = [
    { verb: 'read', what: 'node_modules/bo-grid/dist/index.d.ts', note: 'typed props and TSDoc, for the installed version' },
    { verb: 'fetch', what: 'bo-grid/llms.txt', note: 'Svelte 5 runes only · rows need an id · patchRows for live data' },
    { verb: 'fetch', what: 'bo-grid/docs/tick-stream.md', note: 'createTickStream hands the grid one batch a frame' },
    { verb: 'fetch', what: 'bo-grid/api.json', note: "flash: 'auto' · onReady gives the GridApi" },
  ];
  const CODE = `<script lang="ts">
  import { Grid, type ColumnDef, type GridApi } from 'bo-grid';
  import { createTickStream } from 'bo-grid/realtime';
  import { quotes, feed } from '$lib/market';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'sym', header: 'Symbol', sub: 'name' },
    { type: 'price', key: 'last', header: 'Last', flash: 'auto' },
    { type: 'percent', key: 'pct', header: 'Chg %' },
    { type: 'volume', key: 'vol', header: 'Volume' },
  ];
  // Plain rows: the grid writes each tick in place.
  const rows = $state.raw(quotes());

  let api: GridApi | undefined;
  const stream = createTickStream({ apply: (b) => api?.patchRows(b) });
  $effect(() => {
    stream.start();
    return feed.subscribe((t) => stream.push(t.id, t));
  });
</${'script'}>

<Grid {rows} {columns} height={300} onReady={(a) => (api = a)} />`;
  const LINES = CODE.split('\n');

  let typed = $state(0);
  let reads = $state(0);
  let lines = $state(0);
  let done = $state(false);
  let visible = $state(false);

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  function finish(): void {
    typed = PROMPT.length;
    reads = READS.length;
    lines = LINES.length;
    done = true;
  }

  $effect(() => {
    if (!visible) return;
    if (reduced) return finish();
    let alive = true;
    // The playback reads and writes its own counters: untracked, so only
    // `visible` re-runs this effect.
    untrack(async () => {
      while (alive) {
        typed = reads = lines = 0;
        done = false;
        for (; typed < PROMPT.length && alive; typed++) await wait(26);
        await wait(380);
        for (; reads < READS.length && alive; reads++) await wait(620);
        await wait(300);
        for (; lines < LINES.length && alive; lines++) await wait(70);
        if (!alive) return;
        done = true;
        await wait(11000);
      }
    });
    return () => {
      alive = false;
      finish();
    };
  });

  const code = $derived(highlightCode(LINES.slice(0, lines).join('\n') || ' ', 'svelte'));
  // The editor follows the code as it streams in.
  let codeEl = $state<HTMLElement>();
  $effect(() => {
    void code;
    const pre = codeEl?.querySelector('pre');
    if (pre) pre.scrollTop = pre.scrollHeight;
  });

  // The page the agent wrote, running: the same four columns.
  const rows = $state.raw<MarketRow[]>(marketRows().slice(0, 7));
  const columns: ColumnDef[] = [
    { type: 'text', key: 'sym', header: 'Symbol', sub: 'name', flex: 1.2, width: 120 },
    { type: 'price', key: 'last', header: 'Last', flex: 1, width: 90, flash: 'auto' },
    { type: 'percent', key: 'pct', header: 'Chg %', flex: 1, width: 80 },
    { type: 'volume', key: 'vol', header: 'Volume', flex: 1, width: 90 },
  ];
  let api: GridApi | null = null;
  const stream = createTickStream<number, Partial<MarketRow>>({ apply: (b) => api?.patchRows(b) });
  $effect(() => {
    if (!done || !visible) return;
    stream.start();
    const h = setInterval(() => {
      const row = rows[Math.floor(rand() * rows.length)];
      stream.push(row.id, tick(row));
    }, 90);
    return () => {
      clearInterval(h);
      stream.stop();
    };
  });
</script>

<div class="agent" use:onScreen={(v) => (visible = v)}>
  <div class="win">
    <div class="pane term" aria-label="The agent's session">
      <div class="bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>agent</div>
      <div class="body">
        <p class="prompt"><span class="you">you</span>{PROMPT.slice(0, typed)}<span class="caret" class:off={typed >= PROMPT.length}></span></p>
        <ul class="reads">
          {#each READS.slice(0, reads) as r (r.what)}
            <li>
              <span class="ok" aria-hidden="true">✓</span>
              <span class="verb">{r.verb}</span>
              <code>{r.what}</code>
              <span class="note">{r.note}</span>
            </li>
          {/each}
        </ul>
        {#if done}
          <p class="wrote"><span class="ok" aria-hidden="true">✓</span> Wrote <code>src/routes/board/+page.svelte</code></p>
        {/if}
      </div>
    </div>
    <div class="pane editor" aria-label="The page the agent writes">
      <div class="bar"><span class="file">src/routes/board/+page.svelte</span></div>
      <div class="code" bind:this={codeEl}>{@html code}</div>
    </div>
  </div>
  <div class="result" class:show={done}>
    <div class="result-bar"><span class="live" aria-hidden="true"></span>localhost:5173/board</div>
    <Grid rows={rows as unknown as GridRow[]} {columns} height={252} rowHeight={34} theme={ui.grid} cellSelection={false} ariaLabel="The board the agent wrote, running" onReady={(a) => (api = a)} />
  </div>
</div>

<style>
  .agent {
    display: grid;
    gap: 14px;
  }
  .win {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    overflow: hidden;
    background: var(--cell);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.6);
  }
  .pane + .pane {
    border-left: 1px solid var(--line);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  .dots {
    display: inline-flex;
    gap: 6px;
  }
  .dots i {
    width: 9px;
    height: 9px;
    background: var(--line-strong);
    border-radius: 50%;
  }
  .body {
    min-height: 330px;
    padding: 16px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.6;
  }
  .prompt {
    margin: 0 0 14px;
    color: var(--text);
  }
  .you {
    margin-right: 10px;
    padding: 1px 6px;
    font-size: 11px;
    color: var(--on-accent);
    background: var(--accent);
    border-radius: 3px;
  }
  .caret {
    display: inline-block;
    width: 7px;
    height: 1.05em;
    margin-left: 2px;
    vertical-align: -2px;
    background: var(--accent);
    animation: blink 1s steps(1) infinite;
  }
  .caret.off {
    display: none;
  }
  .reads {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .reads li {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    column-gap: 8px;
    animation: rise 0.35s ease both;
  }
  .reads code,
  .wrote code {
    color: var(--text);
    overflow-wrap: anywhere;
  }
  .note {
    grid-column: 3;
    color: var(--text-3);
  }
  .verb {
    color: var(--info);
  }
  .ok {
    color: var(--up);
  }
  .wrote {
    margin: 14px 0 0;
    color: var(--text-2);
    animation: rise 0.35s ease both;
  }
  .editor .code :global(pre.code) {
    height: 366px;
    margin: 0;
    font-size: 12px;
    background: transparent;
    border: 0;
    border-radius: 0;
  }
  .result {
    overflow: hidden;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    opacity: 0.25;
    filter: saturate(0.2);
    transform: translateY(8px);
    transition:
      opacity 0.6s ease,
      transform 0.6s ease,
      filter 0.6s ease;
  }
  .result.show {
    opacity: 1;
    filter: none;
    transform: none;
  }
  .result-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  .live {
    width: 7px;
    height: 7px;
    background: var(--up);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--up);
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @media (max-width: 899px) {
    .win {
      grid-template-columns: minmax(0, 1fr);
    }
    .pane + .pane {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .body {
      min-height: 0;
    }
    .editor .code :global(pre.code) {
      height: 300px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .caret,
    .reads li,
    .wrote {
      animation: none;
    }
    .result {
      transition: none;
    }
  }
</style>
