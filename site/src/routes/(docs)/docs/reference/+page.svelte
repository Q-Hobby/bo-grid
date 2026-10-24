<script lang="ts">
  import api from '$lib/generated/api.json';
  import DocPage from '$lib/DocPage.svelte';
  import Props from '$lib/Props.svelte';

  // Every prop, column option and API method, read from the types through
  // the API manifest; the filter narrows all four lists at once.
  let q = $state('');
  const match = (p: { name: string; doc: string }) => {
    const t = q.trim().toLowerCase();
    return !t || p.name.toLowerCase().includes(t) || p.doc.toLowerCase().includes(t);
  };
  const grid = $derived(api.grid.props.filter(match).map((p) => p.name));
  const column = $derived(api.column.props.filter(match).map((p) => p.name));
  const methods = $derived(api.api.methods.filter(match).map((p) => p.name));
  const total = $derived(grid.length + column.length + methods.length);
</script>

<DocPage title="Props reference" description="Every Grid prop, column option and grid API method, generated from the TypeScript types. The same data is at /api.json for tools and coding agents.">
  <label class="filter">
    <span class="sr">Filter the reference</span>
    <input type="search" placeholder="Filter: a name or a word, e.g. flash, width, export" bind:value={q} />
    <span class="count">{total} entries</span>
  </label>

  <h2 id="grid-props">Grid props</h2>
  <p>Set on <code>&lt;Grid&gt;</code> (or <code>BoGrid</code> in React and Vue). Required props are starred.</p>
  {#if grid.length}<Props of="grid" names={grid} anchors />{:else}<p class="none">No grid prop matches.</p>{/if}

  <h2 id="column-options">Column options</h2>
  <p>Fields of a column definition (<code>ColumnDef</code>), shared by every column type.</p>
  {#if column.length}<Props of="column" names={column} anchors />{:else}<p class="none">No column option matches.</p>{/if}

  <h2 id="column-types">Column types</h2>
  <p>A column's <code>type</code>, and the options each type adds.</p>
  <table>
    <thead><tr><th>type</th><th>Options it adds</th></tr></thead>
    <tbody>
      {#each api.column.types as t (t.type)}
        <tr>
          <td><code>{t.type}</code></td>
          <td>{#each t.options as o, i (o.name)}{i ? ', ' : ''}<code title={o.doc}>{o.name}{o.required ? '' : '?'}: {o.type}</code>{:else}<span class="none">none</span>{/each}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2 id="grid-api">Grid API</h2>
  <p>Methods of the grid handle, from <code>bind:api</code>, <code>onReady</code>, or a React or Vue ref.</p>
  {#if methods.length}<Props of="api" names={methods} anchors />{:else}<p class="none">No API method matches.</p>{/if}
</DocPage>

<style>
  .filter {
    position: sticky;
    top: calc(var(--top) + 8px);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 1.5rem;
    padding: 6px 6px 6px 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 6px 0;
    font: inherit;
    color: var(--text);
    background: none;
    border: 0;
    outline: none;
  }
  .count {
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
  }
  .none {
    color: var(--text-3);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
