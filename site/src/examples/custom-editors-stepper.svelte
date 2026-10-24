<script lang="ts">
  import { untrack } from 'svelte';
  import type { CellEditorProps } from 'bo-grid';

  // A custom editor: step a quantity by a lot of 100 (buttons, or ↑ / ↓). Enter or OK saves;
  // Escape, or focus leaving the editor, cancels (the grid handles both).
  let { value, commit }: CellEditorProps = $props();
  let qty = $state(untrack(() => Number(value) || 0));

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') qty += 100;
    else if (e.key === 'ArrowDown') qty = Math.max(0, qty - 100);
    else if (e.key === 'Enter') commit(qty);
  }
</script>

<span style="display: inline-flex; gap: 4px; align-items: center">
  <!-- First in the editor, so it takes the focus when the editor opens. -->
  <span role="spinbutton" tabindex="0" aria-label="Quantity" aria-valuenow={qty} aria-valuemin={0} onkeydown={onKey} style="min-width: 5ch; text-align: right">{qty}</span>
  <button type="button" onclick={() => (qty = Math.max(0, qty - 100))} aria-label="100 less">−</button>
  <button type="button" onclick={() => (qty += 100)} aria-label="100 more">+</button>
  <button type="button" onclick={() => commit(qty)}>OK</button>
</span>
