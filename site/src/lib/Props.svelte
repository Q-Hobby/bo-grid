<script lang="ts">
  import api from './generated/api.json';

  // A reference table read from the API manifest (scripts/api-manifest.mjs),
  // so the docs never drift from the types. An unknown name fails the build.
  type Entry = { name: string; type?: string; signature?: string; required?: boolean; default?: string; example?: string; doc: string };

  let {
    of = 'grid',
    names,
    title,
    anchors = false,
  }: { of?: 'grid' | 'column' | 'api'; names: string[]; title?: string; anchors?: boolean } = $props();

  const pool: Entry[] = $derived(of === 'grid' ? api.grid.props : of === 'column' ? api.column.props : api.api.methods);
  const rows = $derived(
    names.map((n) => {
      const e = pool.find((p) => p.name === n);
      if (!e) throw new Error(`Props: "${n}" is not in the ${of} reference (scripts/api-manifest.mjs).`);
      return e;
    }),
  );
  const heading = $derived(title ?? (of === 'grid' ? 'Grid props' : of === 'column' ? 'Column options' : 'Grid API'));

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /** The TSDoc's inline Markdown: `code` and **bold**. */
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
</script>

<section class="props" aria-label={heading}>
  <header>
    <span>{heading}</span>
    <a href="https://github.com/bonguynvan/bo-grid/blob/main/scripts/api-manifest.mjs" target="_blank" rel="external noopener" title="Generated from the TypeScript sources; also at /api.json">from the types</a>
  </header>
  {#each rows as p (p.name)}
    <div class="row" id={anchors ? `${of}-${p.name}` : undefined}>
      <div class="sig">
        <code class="name">{p.name}{#if p.required}<span class="req" title="Required">*</span>{/if}</code>
        <code class="type">{p.signature ? p.signature.slice(p.name.length) : p.type}</code>
        {#if p.default}<span class="def">Default <code>{p.default}</code></span>{/if}
      </div>
      {#if p.doc}<p class="doc">{@html inline(p.doc)}</p>{/if}
      {#if p.example}
        <details class="ex">
          <summary>Example</summary>
          <pre><code>{p.example}</code></pre>
        </details>
      {/if}
    </div>
  {/each}
</section>

<style>
  .props {
    margin: 0 0 1.75rem;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 8px 14px;
    font-family: var(--font-cond);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
  }
  header a {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-3);
  }
  header a:hover {
    color: var(--accent);
  }
  .row {
    padding: 12px 14px;
    scroll-margin-top: calc(var(--top) + 72px);
  }
  .row:target {
    background: var(--accent-dim);
  }
  .row + .row {
    border-top: 1px solid var(--line-soft);
  }
  .sig {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .sig code {
    padding: 0;
    background: none;
    border: 0;
  }
  .name {
    font-weight: 600;
    color: var(--text);
  }
  .req {
    margin-left: 2px;
    color: var(--down);
  }
  .type {
    font-size: 12.5px;
    color: var(--accent);
    overflow-wrap: anywhere;
  }
  .def {
    margin-left: auto;
    font-size: 12.5px;
    color: var(--text-3);
  }
  .def code {
    color: var(--text-2);
  }
  .doc {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
  }
  .ex {
    margin-top: 6px;
  }
  .ex summary {
    width: max-content;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    cursor: pointer;
  }
  .ex summary:hover,
  .ex[open] summary {
    color: var(--accent);
  }
  .ex summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  .ex pre {
    margin: 6px 0 0;
    padding: 10px 12px;
    overflow-x: auto;
    font-size: 12.5px;
    line-height: 1.55;
    background: var(--panel-2);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-md);
  }
  .ex code {
    padding: 0;
    color: var(--text);
    white-space: pre;
    background: none;
    border: 0;
  }
</style>
