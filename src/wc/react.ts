// React wrapper for bo-grid (`bo-grid/react`): every <Grid> prop as a React
// prop, and the grid's API through a ref.
//
//   import { BoGrid } from 'bo-grid/react';
//   const grid = useRef<GridApi>(null);
//   <BoGrid ref={grid} rows={rows} columns={columns} height={520} onCellEdit={save} />
//   grid.current?.patchRows([[id, { last }]]); // a live feed, with no re-render
//
// It renders the <bo-grid> custom element, loaded on the client so server
// rendering is safe, inside a div that takes `className` and `style`, and
// sets the element's `config` from the props on each render. The build adds
// 'use client' to the bundle, for frameworks with server components.
import { createElement, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { GridApi } from '../lib/grid/api';
import type { BoGridConfig, BoGridElement } from './element';

/** Every <Grid> prop, plus the wrapper div's `className` and `style`. */
export interface BoGridProps extends BoGridConfig {
  className?: string;
  style?: CSSProperties;
}

const defined = (): boolean => typeof customElements !== 'undefined' && customElements.get('bo-grid') !== undefined;
// useLayoutEffect warns when rendered on a server, where nothing runs anyway.
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The grid as a React component; its ref is the grid's API once it is ready. */
export const BoGrid = forwardRef<GridApi | null, BoGridProps>(function BoGrid({ className, style, onReady, ...config }, ref) {
  const host = useRef<BoGridElement | null>(null);
  // Not ready on the first render, even with the element already defined, so
  // it matches what a server rendered and hydrates cleanly; ready before the
  // first paint when it is.
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<unknown>(null);
  const [api, setApi] = useState<GridApi | null>(null);
  // The latest onReady, for the one call the grid makes.
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const handleReady = useRef((a: GridApi) => {
    setApi(a);
    readyCallback.current?.(a);
  }).current;

  useImperativeHandle(ref, () => api as GridApi, [api]);

  useClientLayoutEffect(() => {
    if (defined()) return void setReady(true);
    let live = true;
    import('./element').then(
      () => live && setReady(true),
      (e: unknown) => live && setFailed(e ?? new Error('bo-grid: loading the element failed')),
    );
    return () => {
      live = false;
    };
  }, []);

  useClientLayoutEffect(() => {
    if (host.current) host.current.config = { ...config, onReady: handleReady };
  });

  if (failed) throw failed;
  const placeholder = !ready && typeof config.height === 'number' ? { height: config.height } : undefined;
  return createElement(
    'div',
    { className, style: { ...placeholder, ...style } },
    ready ? createElement('bo-grid', { ref: host, style: { display: 'block' } }) : null,
  );
});
