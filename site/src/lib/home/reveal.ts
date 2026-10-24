// Scroll reveal: the node gets `data-in` once a sixth of it is on screen,
// and CSS animates it in. Without IntersectionObserver it shows at once.
export function reveal(node: HTMLElement): { destroy(): void } {
  if (typeof IntersectionObserver === 'undefined') {
    node.dataset.in = '';
    return { destroy() {} };
  }
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      node.dataset.in = '';
      io.disconnect();
    },
    { threshold: 0.16 },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}

/** Calls `onChange` as the node enters and leaves the screen. */
export function onScreen(node: HTMLElement, onChange: (visible: boolean) => void): { destroy(): void } {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true);
    return { destroy() {} };
  }
  const io = new IntersectionObserver(([entry]) => onChange(!!entry?.isIntersecting), { rootMargin: '120px 0px' });
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
