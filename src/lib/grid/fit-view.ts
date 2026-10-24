// Keeping a floating box (a menu) inside the window: it opens at (x, y) when
// it fits, moves left to stay on screen, and opens upward when there is no
// room below.

export interface FitBox {
  x: number;
  y: number;
}

/** Where a box of `w` x `h` opened at (x, y) goes so it stays inside a `vw` x
    `vh` window, `margin` px from its edges. Upward means above `y`. */
export function fitInView(x: number, y: number, w: number, h: number, vw: number, vh: number, margin = 4): FitBox {
  const left = Math.max(margin, Math.min(x, vw - w - margin));
  const fitsBelow = y + h + margin <= vh;
  const top = fitsBelow ? y : Math.max(margin, Math.min(y - h, vh - h - margin));
  return { x: left, y: top };
}

/** A Svelte action: positions a fixed element at (x, y), kept inside the
    window once its size is known, and again whenever its size changes (a
    menu that grows as its contents load). */
export function fitView(node: HTMLElement, at: FitBox): { update(next: FitBox): void; destroy(): void } {
  let current = at;
  const place = () => {
    const r = node.getBoundingClientRect();
    const fit = fitInView(current.x, current.y, r.width, r.height, window.innerWidth, window.innerHeight);
    node.style.left = `${fit.x}px`;
    node.style.top = `${fit.y}px`;
  };
  place();
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
  ro?.observe(node);
  return {
    update(next) {
      current = next;
      place();
    },
    destroy: () => ro?.disconnect(),
  };
}
