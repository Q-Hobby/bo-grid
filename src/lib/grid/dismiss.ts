/** Closes a floating panel (row or column menu, filter menu, columns panel)
    on a pointer press anywhere, on Escape, or when the window loses focus, and
    returns the cleanup, for an $effect to return. A panel keeps presses inside
    it from closing it by stopping their propagation. */
export function dismissOnOutside(close: () => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  window.addEventListener('pointerdown', close);
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', close);
  return () => {
    window.removeEventListener('pointerdown', close);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', close);
  };
}
