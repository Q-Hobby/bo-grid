<script lang="ts">
  import type { FilterEditorProps } from 'bo-grid';
  import { MOVES, type Move, type MoveFilter } from './custom-filters-move';

  // The middle of the filter menu: the grid draws the title, Clear and Apply.
  let { filter, onChange }: FilterEditorProps<MoveFilter> = $props();

  const picked = $derived(new Set<Move>(filter?.moves ?? []));
  function toggle(id: Move) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next.size ? { kind: 'move', moves: MOVES.map((m) => m.id).filter((m) => next.has(m)) } : null);
  }
</script>

<div role="group" aria-label="Move" style="display: grid; gap: 6px; padding: 2px 0 4px">
  {#each MOVES as m (m.id)}
    <label style="display: flex; gap: 6px; align-items: center">
      <input type="checkbox" checked={picked.has(m.id)} onchange={() => toggle(m.id)} />
      {m.label}
    </label>
  {/each}
</div>
