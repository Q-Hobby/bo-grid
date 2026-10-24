<script lang="ts">
  // Floating action menu (row context menu + column header menu). Presentation +
  // its own keyboard semantics (APG menu pattern): focus moves into the menu on
  // open, Arrow/Home/End move between items, Enter/Space activate, Esc/Tab close.
  // The parent owns open/close state and positions it via x/y; it stays
  // inside the window (fitView).
  import { fitView } from './fit-view';

  let {
    x,
    y,
    items,
    onClose,
  }: {
    x: number;
    y: number;
    items: Array<{ label: string; onSelect: () => void }>;
    onClose: () => void;
  } = $props();

  let menuEl: HTMLDivElement;

  const buttons = (): HTMLButtonElement[] =>
    menuEl ? [...menuEl.querySelectorAll<HTMLButtonElement>('.rowmenu-item')] : [];

  function focusAt(i: number): void {
    const b = buttons();
    if (b.length === 0) return;
    b[((i % b.length) + b.length) % b.length].focus();
  }

  // Move focus into the menu on open; restore it to the opener on close.
  $effect(() => {
    const opener = document.activeElement as HTMLElement | null;
    focusAt(0);
    return () => opener?.focus?.();
  });

  function onKeydown(e: KeyboardEvent): void {
    const b = buttons();
    const i = b.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        focusAt(i + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        focusAt(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        e.stopPropagation();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        e.stopPropagation();
        focusAt(b.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
      case 'Tab':
        onClose(); // close and let focus return to the opener
        break;
    }
  }
</script>

<div
  class="rowmenu"
  role="menu"
  tabindex="-1"
  bind:this={menuEl}
  use:fitView={{ x, y }}
  onpointerdown={(e) => e.stopPropagation()}
  onkeydown={onKeydown}
>
  {#each items as item (item.label)}
    <button
      class="rowmenu-item"
      type="button"
      role="menuitem"
      onclick={() => {
        item.onSelect();
        onClose();
      }}
    >
      {item.label}
    </button>
  {/each}
</div>

<style>
  .rowmenu {
    position: fixed;
    /* Never taller than the window: it scrolls instead. */
    max-height: calc(100vh - 8px);
    overflow: auto;
    z-index: 20;
    min-width: 150px;
    padding: 4px;
    background: var(--bo-header-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }
  .rowmenu-item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    font: inherit;
    font-size: 12px;
    text-align: left;
    color: var(--bo-text);
    background: transparent;
    border: 0;
    border-radius: 5px;
    cursor: pointer;
  }
  .rowmenu-item:hover {
    background: var(--bo-row-hover);
  }
  /* Visible keyboard focus (WCAG 2.4.7) — the menu is arrow-navigable. */
  .rowmenu-item:focus-visible {
    background: var(--bo-row-hover);
    outline: 2px solid var(--bo-sel-border);
    outline-offset: -2px;
  }
</style>
