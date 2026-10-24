// Smoke-test the framework-agnostic custom element: register <bo-grid> from the
// built bundle, set its `config`, and assert it renders real rows in light DOM.
// This is what a React/Vue/Angular/vanilla consumer relies on.
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.customElements = window.customElements;
globalThis.HTMLElement = window.HTMLElement;
for (const k of Object.getOwnPropertyNames(window)) {
  if (k in globalThis) continue;
  try {
    globalThis[k] = window[k];
  } catch {}
}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
window.HTMLCanvasElement.prototype.getContext = () => ({
  setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
  stroke() {}, fillRect() {}, save() {}, restore() {},
  set strokeStyle(_v) {}, set fillStyle(_v) {}, set lineWidth(_v) {},
});

function fail(msg) {
  console.error(`✗ wc-smoke: ${msg}`);
  process.exit(1);
}
process.on('unhandledRejection', (e) => fail(`unhandled rejection: ${e?.stack || e}`));

const entry = resolve('dist/bo-grid.element.js');
if (!existsSync(entry)) fail('dist/bo-grid.element.js not found — run the WC build first');

const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const smokeColumns = [
  { type: 'text', key: 'sym', header: 'Symbol' },
  { type: 'price', key: 'px', header: 'Price' },
];
const smokeRows = (n) => Array.from({ length: n }, (_, id) => ({ id, sym: `R${id}`, px: id + 0.25 }));

// ---- bo-grid/react ---------------------------------------------------------
// Mounted before anything registered <bo-grid>: the wrapper loads the element
// itself, then renders it, sets its config from the props, and hands out the
// grid's API through its ref.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { BoGrid: ReactGrid } = await import(pathToFileURL(resolve('dist/bo-grid.react.js')).href);
if (window.customElements.get('bo-grid')) fail('<bo-grid> was registered before the React wrapper loaded it');
const reactHost = document.createElement('div');
document.body.appendChild(reactHost);
const reactRoot = createRoot(reactHost);
const reactRef = React.createRef();
const renderReact = (rows) =>
  React.act(async () => {
    reactRoot.render(React.createElement(ReactGrid, { ref: reactRef, rows, columns: smokeColumns, height: 300, className: 'react-grid' }));
  });
await renderReact(smokeRows(12));
for (let i = 0; i < 60 && !reactHost.querySelector('.bo-grid .row'); i++) await React.act(() => settle(20));
const reactRows = reactHost.querySelectorAll('.bo-grid .row').length;
if (reactRows === 0) fail('bo-grid/react rendered no rows');
if (!reactHost.querySelector('div.react-grid > bo-grid')) fail('bo-grid/react did not put <bo-grid> in a div with its className');
if (typeof reactRef.current?.patchRows !== 'function') fail('bo-grid/react ref is not the grid API');
await renderReact(smokeRows(4));
await React.act(() => settle(60));
const reactRows2 = reactHost.querySelectorAll('.bo-grid .row').length;
if (reactRows2 !== 4) fail(`bo-grid/react did not follow new rows (got ${reactRows2}, want 4)`);
reactRef.current.patchRows([[0, { sym: 'PATCHED' }]]);
await React.act(() => settle(60));
if (!/PATCHED/.test(reactHost.textContent ?? '')) fail('bo-grid/react ref patchRows did not reach the cells');
await React.act(async () => reactRoot.unmount());
if (!readFileSync(resolve('dist/bo-grid.react.js'), 'utf8').startsWith('"use client"')) fail("dist/bo-grid.react.js does not start with 'use client'");

// Hydrating server HTML with <bo-grid> already defined: the first client
// render must match the server's (the wrapper div), then the grid appears.
const { renderToString: reactToString } = await import('react-dom/server');
const { hydrateRoot } = await import('react-dom/client');
let hydratedReady = 0;
const hydrationErrors = [];
const hydrated = () =>
  React.createElement(ReactGrid, { rows: smokeRows(6), columns: smokeColumns, height: 240, className: 'hydrated', onReady: () => hydratedReady++ });
const hydrateHost = document.createElement('div');
hydrateHost.innerHTML = reactToString(hydrated());
document.body.appendChild(hydrateHost);
let hydratedRoot;
await React.act(async () => {
  hydratedRoot = hydrateRoot(hydrateHost, hydrated(), { onRecoverableError: (e) => hydrationErrors.push(e) });
});
await React.act(() => settle(60));
if (hydrationErrors.length > 0) fail(`bo-grid/react did not hydrate cleanly: ${hydrationErrors[0]}`);
const hydratedRows = hydrateHost.querySelectorAll('.bo-grid .row').length;
if (hydratedRows === 0) fail('bo-grid/react rendered no rows after hydrating');
if (hydratedReady !== 1) fail(`bo-grid/react onReady ran ${hydratedReady} times, want 1`);
await React.act(async () => hydratedRoot.unmount());

let createBoGrid;
try {
  ({ createBoGrid } = await import(pathToFileURL(entry).href)); // registers <bo-grid>
} catch (e) {
  fail(`importing the element bundle threw: ${e?.stack || e}`);
}

if (!window.customElements.get('bo-grid')) fail('<bo-grid> was not registered with customElements');
if (typeof createBoGrid !== 'function') fail('the element bundle does not export createBoGrid()');

const el = document.createElement('bo-grid');
// Attach FIRST, set `config` LATER — the React `ref` + `useEffect` pattern.
// The grid must render a blank grid (defaulted empty rows/columns) instead of
// crashing on `undefined.length` when connectedCallback runs pre-config.
document.body.appendChild(el);
await new Promise((r) => setTimeout(r, 120)); // let the initial (config-less) render flush
if (!el.querySelector('.bo-grid')) fail('config-less <bo-grid> did not render a (blank) grid after attach');
if (el.querySelectorAll('.bo-grid .row').length !== 0) fail('config-less <bo-grid> unexpectedly rendered rows');

// Now drive it through the `config` property (arrays/functions can't be
// attributes) — exactly how a framework consumer does after mount. Includes a
// JS `render` column (the framework-agnostic custom-cell hook).
el.config = {
  height: 300,
  columns: [
    { type: 'text', key: 'sym', header: 'Symbol' },
    { type: 'price', key: 'px', header: 'Price' },
    { type: 'number', key: 'qty', header: 'Qty', decimals: 0 },
    {
      type: 'custom',
      key: 'dot',
      header: 'Live',
      render: ({ row }) => {
        const b = document.createElement('span');
        b.className = 'js-dot';
        b.textContent = row.qty > 50 ? '● hot' : '○ cold';
        return b;
      },
    },
  ],
  rows: Array.from({ length: 20 }, (_, id) => ({ id, flashSeq: 0, flashDir: 'up', sym: `S${id}`, px: id + 0.5, qty: id * 10 })),
};

await new Promise((r) => setTimeout(r, 200));

const rows = el.querySelectorAll('.bo-grid .row').length;
const headers = el.querySelectorAll('.bo-grid .head .h').length;
if (headers < 4) fail(`custom element rendered no headers (got ${headers})`);
if (rows === 0) fail('custom element rendered no rows');
// JS render hook: the custom column mounted real DOM nodes from plain JS.
const dots = el.querySelectorAll('.bo-grid .js-dot').length;
if (dots === 0) fail('JS render() hook produced no cell nodes in the web component');

// Reactive update through the property: replace the rows, expect the DOM to follow.
el.config = { ...el.config, rows: el.config.rows.slice(0, 5) };
await new Promise((r) => setTimeout(r, 120));
const rows2 = el.querySelectorAll('.bo-grid .row').length;
if (!(rows2 > 0 && rows2 <= rows)) fail(`custom element did not react to a config update (${rows} → ${rows2})`);

// createBoGrid() convenience: element with config preset, then attached.
const made = createBoGrid({ height: 200, columns: el.config.columns, rows: el.config.rows.slice(0, 3) });
if (made.tagName.toLowerCase() !== 'bo-grid') fail('createBoGrid did not return a <bo-grid> element');
document.body.appendChild(made);
await new Promise((r) => setTimeout(r, 120));
const made3 = made.querySelectorAll('.bo-grid .row').length;
if (made3 !== 3) fail(`createBoGrid preset config did not render (got ${made3} rows, want 3)`);

// ---- bo-grid/vue -------------------------------------------------------------
// Attributes are the grid's props (kebab case too), events its callbacks, and
// the template ref's `api` the grid's API.
const { createApp, h, ref: vueRef, nextTick } = await import('vue');
const { BoGrid: VueGrid } = await import(pathToFileURL(resolve('dist/bo-grid.vue.js')).href);
const vueRows = vueRef(smokeRows(8));
const vueGrid = vueRef();
let vueReady = 0;
let vueReady2 = 0;
const vueEdits = [];
const editableColumns = [{ ...smokeColumns[0], editable: true }, smokeColumns[1]];
const vueApp = createApp({
  render: () =>
    h(VueGrid, {
      ref: vueGrid,
      rows: vueRows.value,
      columns: editableColumns,
      height: 300,
      'row-height': 30,
      'row-numbers': '', // a bare boolean attribute
      class: 'vue-grid',
      // The same event bound twice arrives as an array.
      onReady: [() => vueReady++, () => vueReady2++],
      onCellEdit: [(e) => vueEdits.push(`a:${e.value}`), (e) => vueEdits.push(`b:${e.value}`)],
    }),
});
const vueHost = document.createElement('div');
document.body.appendChild(vueHost);
vueApp.mount(vueHost);
for (let i = 0; i < 60 && !vueHost.querySelector('.bo-grid .row'); i++) await settle(20);
const vueRowCount = vueHost.querySelectorAll('.bo-grid .row').length;
if (vueRowCount === 0) fail('bo-grid/vue rendered no rows');
if (!vueHost.querySelector('div.vue-grid > bo-grid')) fail('bo-grid/vue did not put <bo-grid> in a div with its class');
const vueRowHeight = vueHost.querySelector('.bo-grid .row')?.style.height;
if (vueRowHeight !== '30px') fail(`bo-grid/vue did not pass row-height as rowHeight (row height ${vueRowHeight})`);
if (vueReady !== 1 || vueReady2 !== 1) fail(`bo-grid/vue did not call both @ready listeners once (${vueReady}, ${vueReady2})`);
if (typeof vueGrid.value?.api?.patchRows !== 'function') fail('bo-grid/vue template ref has no grid api');
if (!vueHost.querySelector('.bo-grid .numcell')) fail('bo-grid/vue did not read a bare row-numbers attribute as true');
// An edit through the grid reaches both @cell-edit listeners.
vueGrid.value.api.focusCell(1, 'sym');
await settle(20);
vueHost.querySelector('[role=grid]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
await settle(20);
const vueEditor = vueHost.querySelector('input.bo-edit');
if (!vueEditor) fail('bo-grid/vue: Enter did not open the editor');
vueEditor.value = 'EDITED';
vueEditor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
await settle(20);
if (vueEdits.join(',') !== 'a:EDITED,b:EDITED') fail(`bo-grid/vue @cell-edit listeners got ${JSON.stringify(vueEdits)}`);
vueRows.value = smokeRows(3);
await nextTick();
await settle(60);
const vueRowCount2 = vueHost.querySelectorAll('.bo-grid .row').length;
if (vueRowCount2 !== 3) fail(`bo-grid/vue did not follow new rows (got ${vueRowCount2}, want 3)`);
vueApp.unmount();

// Hydrating server HTML with <bo-grid> already defined: no mismatch.
const { createSSRApp } = await import('vue');
const { renderToString: vueToString } = await import('vue/server-renderer');
const ssrVue = () => createSSRApp({ render: () => h(VueGrid, { rows: smokeRows(4), columns: smokeColumns, height: 200, class: 'vue-hydrated' }) });
const vueSsrHost = document.createElement('div');
vueSsrHost.innerHTML = await vueToString(ssrVue());
document.body.appendChild(vueSsrHost);
const vueWarnings = [];
const vueHydrated = ssrVue();
vueHydrated.config.warnHandler = (msg) => vueWarnings.push(msg);
vueHydrated.mount(vueSsrHost);
for (let i = 0; i < 60 && !vueSsrHost.querySelector('.bo-grid .row'); i++) await settle(20);
const hydrationWarning = vueWarnings.find((w) => /hydrat|mismatch/i.test(w));
if (hydrationWarning) fail(`bo-grid/vue did not hydrate cleanly: ${hydrationWarning}`);
if (!vueSsrHost.querySelector('.bo-grid .row')) fail('bo-grid/vue rendered no rows after hydrating');
vueHydrated.unmount();

console.log(`✓ wc-smoke: <bo-grid> registered + createBoGrid(); config-after-attach safe (blank→${rows} rows / ${headers} headers); ${dots} JS render() nodes; reactive update ok (${rows}→${rows2}); createBoGrid preset ${made3} rows; bo-grid/react loads the element, ${reactRows}→${reactRows2} rows, ref api + patchRows, 'use client', hydrates cleanly (${hydratedRows} rows); bo-grid/vue ${vueRowCount}→${vueRowCount2} rows, kebab + bare boolean attrs, doubled @ready/@cell-edit, ref api, hydrates cleanly`);
process.exit(0);
