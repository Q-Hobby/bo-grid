// Headless mount smoke-test: build the demo, mount it in jsdom (with a canvas
// stub), and assert that real rows render. Catches the class of runtime bug —
// reactive loops, mount throws, blank pages — that a build + type-check cannot.
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.customElements = window.customElements;
for (const k of Object.getOwnPropertyNames(window)) {
  if (k in globalThis) continue;
  try {
    globalThis[k] = window[k];
  } catch {}
}
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// Svelte's bind:clientWidth (used by column virtualization) needs ResizeObserver;
// jsdom has none. A no-op keeps mount from throwing — clientWidth stays 0, so
// virtualization falls back to rendering all columns (the math is unit-tested).
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// IntersectionObserver: the demo now stacks every example on one page and
// lazy-mounts each grid when it scrolls into view. jsdom has no IO (and no
// layout to drive it), so stub one that records observers but never auto-fires;
// the test mounts a section deterministically with show(id), which invokes the
// matching observer's callback. (The page's scroll-spy IOs are recorded too but
// never targeted by show(), so they stay inert.)
const ioRegistry = [];
globalThis.IntersectionObserver = window.IntersectionObserver = class {
  constructor(cb) {
    this.cb = cb;
    this.els = new Set();
    ioRegistry.push(this);
  }
  observe(el) { this.els.add(el); }
  unobserve(el) { this.els.delete(el); }
  takeRecords() { return []; }
  disconnect() {
    this.els.clear();
    const i = ioRegistry.indexOf(this);
    if (i >= 0) ioRegistry.splice(i, 1);
  }
};
globalThis.__fireIO = (target) => {
  if (!target) return;
  for (const io of [...ioRegistry]) {
    if (io.els.has(target)) io.cb([{ isIntersecting: true, target, intersectionRatio: 1 }], io);
  }
};
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
window.devicePixelRatio = 2;
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
// jsdom has no 2D canvas; stub the methods the sparkline uses.
window.HTMLCanvasElement.prototype.getContext = () => ({
  setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
  stroke() {}, fillRect() {}, save() {}, restore() {},
  set strokeStyle(_v) {}, set fillStyle(_v) {}, set lineWidth(_v) {},
});

// jsdom has no clipboard; stub read/write so copy/paste can be exercised.
// The bundle's bare `navigator` resolves to Node's global navigator (no
// clipboard), so stub it on every navigator the code might reach.
let clipboardText = '';
const clipboardStub = {
  writeText: async (t) => { clipboardText = String(t); },
  readText: async () => clipboardText,
};
for (const nav of [window.navigator, globalThis.navigator]) {
  if (!nav) continue;
  try {
    Object.defineProperty(nav, 'clipboard', { configurable: true, value: clipboardStub });
  } catch {}
}

function fail(msg) {
  console.error(`✗ smoke: ${msg}`);
  process.exit(1);
}

process.on('unhandledRejection', (e) => fail(`unhandled rejection: ${e?.message || e}`));

// The entry is whatever index.html loads — not the first .js on disk: shared
// lazy chunks (e.g. a helper split out between two examples) sort before it.
const entrySrc = /src="\.\/assets\/([^"]+\.js)"/.exec(readFileSync('demo-dist/index.html', 'utf8'))?.[1];
const bundle = entrySrc ?? readdirSync('demo-dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
if (!bundle) fail('no built bundle in demo-dist/assets — run the demo build first');
const url = pathToFileURL(resolve('demo-dist/assets', bundle)).href;

try {
  await import(url);
} catch (e) {
  fail(`mount threw: ${e?.stack || e}`);
}
await new Promise((r) => setTimeout(r, 600));

// Landing hero: Fig. 1 is a live mini board. Check it rendered, then take it out
// of the page so every assertion below still finds the Trading desk grid first.
{
  const heroGrid = document.querySelector('.lp-fig .bo-grid');
  if (!heroGrid) fail('landing: hero board (Fig. 1) did not render');
  if (heroGrid.querySelectorAll('.row').length === 0) fail('landing: hero board rendered no rows');
  if (!/VNM|FPT|HPG/.test(heroGrid.textContent || '')) fail('landing: hero board is missing its symbols');
  if (!document.querySelector('.lp-wordmark')) fail('landing: masthead wordmark missing');
  if (document.querySelectorAll('.lp-list li').length < 10) fail('landing: listings table missing');
  document.querySelector('.lp-fig')?.remove();
}

// Value-only cells drop their own clip (the value span clips itself); cells with
// structured content keep it.
{
  const plain = [...document.querySelectorAll('.c.plain')];
  if (plain.length === 0) fail('no value-only (.c.plain) cells rendered');
  const wrong = plain.find((c) => c.querySelector('canvas, strong, .bo-badge, .bo-render, .bo-cf-val') || !c.querySelector('.bo-cell-text'));
  if (wrong) fail(`a structured cell was marked plain: ${wrong.className}`);
}

const rowCount = document.querySelectorAll('.row').length;
const hasHeader = !!document.querySelector('.bo-grid .head');
const canvases = document.querySelectorAll('canvas').length;

if (!hasHeader) fail('grid header did not render');
if (rowCount === 0) fail('no rows rendered (blank grid)');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { button: 0, bubbles: true }));

// Custom cell renderer (snippet): the Signal column renders a pill.
if (!document.querySelector('.signal')) fail('custom cell snippet did not render');

// Multi-column sort: a plain header click sorts by one column; Shift-click adds
// a secondary key. Both sorted headers then show an order badge.
const headers = [...document.querySelectorAll('.bo-grid .head .h')];
const clickHdr = (i, shift) =>
  headers[i].dispatchEvent(new window.MouseEvent('click', { button: 0, shiftKey: !!shift, bubbles: true }));
// Use columns with unique keys (price, volume); the demo reuses 'changePct'
// across the percent/heatmap/Signal columns.
clickHdr(1, false); // price — primary, ascending
clickHdr(5, true); // volume — secondary, ascending (additive)
await wait(20);
const sortBadges = document.querySelectorAll('.bo-grid .head .ind .ord').length;
const ascHeaders = headers.filter((h) => h.getAttribute('aria-sort') === 'ascending').length;
if (sortBadges !== 2) fail(`multi-sort should show 2 order badges (got ${sortBadges})`);
if (ascHeaders < 2) fail(`multi-sort should mark 2 headers ascending (got ${ascHeaders})`);
// Reset to unsorted (sole asc → desc → off) so later assertions see natural order.
clickHdr(1, false);
clickHdr(1, false);
clickHdr(1, false);
await wait(20);
if (document.querySelectorAll('.bo-grid .head .ind').length !== 0) fail('sort did not reset to unsorted');

// Inline editing (Phase 5): double-click the editable Target cell, type a value,
// press Enter, and assert it commits.
const TARGET_COL = 6;
const firstRow = document.querySelectorAll('.row')[0];
firstRow
  .querySelectorAll('.c')
  [TARGET_COL].dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
await wait(40);
const editInput = firstRow.querySelector('input.bo-edit');
if (!editInput) fail('inline-edit input did not appear on double-click');
editInput.value = '999.99';
editInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(40);
const editedText = document.querySelectorAll('.row')[0].querySelectorAll('.c')[TARGET_COL].textContent.trim();
if (editedText !== '999.99') fail(`inline edit did not commit (cell shows "${editedText}")`);

// Edit validation: the Target column rejects negatives — an invalid edit keeps
// the previous value.
document.querySelectorAll('.row')[0].querySelectorAll('.c')[TARGET_COL]
  .dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
await wait(40);
const badInput = document.querySelectorAll('.row')[0].querySelector('input.bo-edit');
badInput.value = '-5';
badInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(40);
const afterBad = document.querySelectorAll('.row')[0].querySelectorAll('.c')[TARGET_COL].textContent.trim();
if (afterBad !== '999.99') fail(`validate should reject the negative edit (cell shows "${afterBad}")`);

// Clipboard paste (Phase 5): select the Target cell on row 1, put a value on the
// clipboard, press Ctrl+V, and assert it commits through the same edit path.
const gridForPaste = document.querySelector('.bo-grid .gridmain');
const pasteRow = document.querySelectorAll('.row')[1];
pasteRow.querySelectorAll('.c')[TARGET_COL].dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
window.dispatchEvent(new window.Event('pointerup'));
clipboardText = '123.45';
gridForPaste.dispatchEvent(
  new window.KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }),
);
await wait(60);
const pastedText = document.querySelectorAll('.row')[1].querySelectorAll('.c')[TARGET_COL].textContent.trim();
if (pastedText !== '123.45') fail(`clipboard paste did not commit (cell shows "${pastedText}")`);

// Type-to-edit (Excel-style): focus an editable cell, press a printable key, and
// the editor opens seeded with that character — no double-click needed.
document.querySelectorAll('.row')[3].querySelectorAll('.c')[TARGET_COL].dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
window.dispatchEvent(new window.Event('pointerup'));
await wait(20);
document.querySelector('.bo-grid .gridmain').dispatchEvent(
  new window.KeyboardEvent('keydown', { key: '8', bubbles: true }),
);
await wait(40);
const t2eInput = document.querySelector('input.bo-edit');
if (!t2eInput) fail('type-to-edit did not open an editor on a printable key');
if (t2eInput.value !== '8') fail(`type-to-edit did not seed the editor (got "${t2eInput.value}")`);
t2eInput.value = '42.50';
t2eInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(40);
const t2eText = document.querySelectorAll('.row')[3].querySelectorAll('.c')[TARGET_COL].textContent.trim();
if (t2eText !== '42.50') fail(`type-to-edit did not commit (cell shows "${t2eText}")`);

// Column resize (Phase 5): drag the Price header's grip and assert the header
// switches to an explicit pixel width. jsdom reports a 0px rect, so the dragged
// delta becomes the new width directly.
const RESIZE_COL = 1;
const resizeHead = document.querySelectorAll('.h')[RESIZE_COL];
const grip = resizeHead.querySelector('.grip');
if (!grip) fail('resize grip did not render on header');
const widthBefore = resizeHead.getAttribute('style') || '';
grip.dispatchEvent(new window.MouseEvent('pointerdown', { button: 0, clientX: 0, bubbles: true }));
window.dispatchEvent(new window.MouseEvent('pointermove', { clientX: 150, bubbles: true }));
window.dispatchEvent(new window.MouseEvent('pointerup', { clientX: 150, bubbles: true }));
await wait(40);
const widthAfter = document.querySelectorAll('.h')[RESIZE_COL].getAttribute('style') || '';
if (!/150px/.test(widthAfter)) {
  fail(`column resize did not apply a 150px width (before="${widthBefore}" after="${widthAfter}")`);
}
// onColumnResize callback fired (the demo records it in the toolbar).
if (!document.querySelector('.resize-info')) fail('onColumnResize callback did not fire');
// Double-click the grip clears the override back to the default width.
document.querySelectorAll('.h')[RESIZE_COL]
  .querySelector('.grip')
  .dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
await wait(40);
const widthReset = document.querySelectorAll('.h')[RESIZE_COL].getAttribute('style') || '';
if (/150px/.test(widthReset)) fail(`double-click did not reset the column width (style="${widthReset}")`);

// Variable row height (Phase 5): switch to 'Vary' and assert rendered rows have
// differing heights, then restore 'Compact' for the remaining assertions.
const varyBtn = [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Vary');
if (!varyBtn) fail('row-height control not found in demo');
click(varyBtn);
await wait(40);
const rowHeights = [...document.querySelectorAll('.row')].slice(0, 6).map((r) =>
  parseInt(r.style.height, 10),
);
if (new Set(rowHeights).size < 2) fail(`variable row heights did not apply (${rowHeights.join(',')})`);
click([...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === 'Compact'));
await wait(40);

// Accessibility: grid exposes true dimensions despite virtualization, and
// rows/cells carry 1-based aria indices.
const gridEl = document.querySelector('.bo-grid .gridmain');
if (gridEl.getAttribute('aria-rowcount') !== '1001') {
  fail(`aria-rowcount should be 1001 (got ${gridEl.getAttribute('aria-rowcount')})`);
}
if (gridEl.getAttribute('aria-colcount') !== '9') {
  fail(`aria-colcount should be 9 (got ${gridEl.getAttribute('aria-colcount')})`);
}
const ariaRow = document.querySelector('.row[aria-rowindex]');
if (!ariaRow || !ariaRow.querySelector('.c[aria-colindex]')) {
  fail('rows/cells missing aria-rowindex/aria-colindex');
}
if (document.querySelector('.bo-grid .gridmain')?.getAttribute('aria-label') !== 'Market watchlist') {
  fail('grid ariaLabel not applied');
}

// Global theme toggle (nav): flips the whole page (a `light` class on <html>)
// and every grid to the light preset, then restores dark.
const themeBtn = document.querySelector('.lp-theme');
if (!themeBtn) fail('global theme toggle not found in the nav');
// Start from the dark (terminal) theme whatever the page default is.
if (document.documentElement.classList.contains('light')) {
  click(themeBtn);
  await wait(40);
}
click(themeBtn);
await wait(40);
if (!document.documentElement.classList.contains('light')) {
  fail('theme toggle did not put the page into light mode');
}
const gridStyle = document.querySelector('.bo-grid.grid')?.getAttribute('style') || '';
if (!/--bo-grid-bg:\s*#fff/i.test(gridStyle)) {
  fail(`light theme did not reach the grid (style="${gridStyle.slice(0, 60)}…")`);
}
// Native controls follow the theme: the light preset sets color-scheme: light.
if (!/--bo-grid-scheme:\s*light/i.test(gridStyle)) {
  fail('light theme did not set color-scheme for native controls');
}
click(themeBtn);
await wait(40);
if (document.documentElement.classList.contains('light')) fail('theme toggle did not restore dark mode');

// Simulate a drag-selection down the Price column and assert the highlight +
// live aggregation bar appear (Phase 2). Catches selection wiring regressions.
const rowEls = document.querySelectorAll('.row');
const cellOf = (rowEl, c) => rowEl.querySelectorAll('.c')[c];
const PRICE_COL = 1;
cellOf(rowEls[0], PRICE_COL).dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
cellOf(rowEls[3], PRICE_COL).dispatchEvent(new window.MouseEvent('pointerenter', { bubbles: true }));
window.dispatchEvent(new window.Event('pointerup'));
await new Promise((r) => setTimeout(r, 50));

const selCount = document.querySelectorAll('.c.sel').length;
const hasAgg = !!document.querySelector('.agg');
if (selCount < 2) fail(`drag-selection produced ${selCount} highlighted cells (expected ≥2)`);
if (!hasAgg) fail('aggregation bar did not appear for a multi-cell selection');

// a11y: the focus cell is exposed to AT via aria-activedescendant.
const adesc = document.querySelector('.bo-grid .gridmain').getAttribute('aria-activedescendant');
if (!adesc || !document.getElementById(adesc)) {
  fail(`aria-activedescendant not set to a live focus cell (${adesc})`);
}

// Keyboard navigation: Home/End move within the row; Ctrl+Home jumps to the
// first cell. The focus is read back off aria-activedescendant.
const gridK = document.querySelector('.bo-grid .gridmain');
const pressKey = (k, opts = {}) =>
  gridK.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }));
pressKey('Home');
await wait(20);
if (!/-c0$/.test(gridK.getAttribute('aria-activedescendant') || '')) {
  fail(`Home should move focus to column 0 (got ${gridK.getAttribute('aria-activedescendant')})`);
}
pressKey('End');
await wait(20);
if (!/-c8$/.test(gridK.getAttribute('aria-activedescendant') || '')) {
  fail(`End should move focus to the last column (got ${gridK.getAttribute('aria-activedescendant')})`);
}
pressKey('Home', { ctrlKey: true });
await wait(20);
if (gridK.getAttribute('aria-activedescendant') !== `${gridK.id}-r0-c0`) {
  fail(`Ctrl+Home should jump to the first cell (got ${gridK.getAttribute('aria-activedescendant')})`);
}

// Loading overlay: the Reload button flips `loading` for ~800ms.
const reloadBtn = [...document.querySelectorAll('button')].find((b) => /Reload/.test(b.textContent || ''));
if (!reloadBtn) fail('reload control not found in demo');
click(reloadBtn);
await wait(20);
if (!document.querySelector('.bo-grid .loading-overlay')) fail('loading overlay did not show');
await wait(850); // let it clear before the remaining interactions

// Grouping (Phase 3): switch the demo to group-by-sector, assert group-header
// rows render, then collapse one group and assert the scroll height shrinks.
const sectorBtn = [...document.querySelectorAll('.seg button')].find(
  (b) => b.textContent.trim() === 'Sector',
);
if (!sectorBtn) fail('group-by control not found in demo');
click(sectorBtn);
await wait(60);

const groupHeaders = document.querySelectorAll('.group').length;
if (groupHeaders === 0) fail('grouping produced no group-header rows');

const hasSticky = !!document.querySelector('.sticky .group');
if (!hasSticky) fail('sticky group header did not render');

const spacer = document.querySelector('.spacer');
const heightBefore = parseInt(spacer.style.height, 10);
click(document.querySelector('.group .toggle'));
await wait(60);
const heightAfter = parseInt(spacer.style.height, 10);
if (!(heightAfter < heightBefore)) {
  fail(`collapsing a group did not shrink scroll height (${heightBefore} → ${heightAfter})`);
}

// Server-side data source (Phase 4): switch to the async windowed source and
// assert it loads real rows (skeletons → data) after the simulated latency.
const serverBtn = [...document.querySelectorAll('.seg button')].find(
  (b) => b.textContent.trim() === 'Server',
);
if (!serverBtn) fail('data-mode control not found in demo');
click(serverBtn);
await wait(700); // simulated source latency is ~220ms

const dataRows = document.querySelectorAll('.row:not(.skeleton)').length;
const serverHeight = parseInt(document.querySelector('.spacer').style.height, 10);
if (dataRows === 0) fail('server-mode source did not load any data rows');
if (!(serverHeight > 0)) fail('server-mode total/scroll height not set from source');

// Pinned columns (Phase 4): toggle pinning and assert sticky-positioned headers.
const pinBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pin L');
if (!pinBtn) fail('pin control not found in demo');
click(pinBtn);
await wait(80);
const stickyHeaders = [...document.querySelectorAll('.h')].filter((h) =>
  /position:\s*sticky/.test(h.getAttribute('style') || ''),
).length;
if (stickyHeaders === 0) fail('pinning did not produce sticky columns');
// Right-pinned column: the Target header sticks to the right edge.
const rightPinned = [...document.querySelectorAll('.h')].filter((h) =>
  /right:\s*0px/.test(h.getAttribute('style') || ''),
).length;
if (rightPinned === 0) fail('right-pinning did not produce a right-sticky column');

// Pivot (Phase 5): toggle pivot and assert the columns become the pivot output.
const pivotBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Pivot');
if (!pivotBtn) fail('pivot control not found in demo');
click(pivotBtn);
await wait(60);
const pivotHeaders = [...document.querySelectorAll('.h .label')].map((n) => n.textContent.trim());
if (!pivotHeaders.includes('Total') || !pivotHeaders.includes('sector')) {
  fail(`pivot did not produce expected columns (got ${pivotHeaders.join(',')})`);
}

// Examples gallery: every example now renders stacked on one page, each grid
// lazy-mounting when scrolled into view. The assertions below use page-global
// `.bo-grid` selectors, so solo(id) detaches the previously-exercised section —
// keeping exactly one example grid in the DOM at a time (the invariant the old
// tab UI gave us) — then fires that section's IntersectionObserver to mount it.
// (The eager "Trading desk", exercised above, is the first to be detached.)
const waitFor = async (selector, label) => {
  for (let i = 0; i < 80; i++) {
    if (document.querySelectorAll(selector).length > 0) return;
    await wait(25);
  }
  fail(`${label} (selector "${selector}" never appeared)`);
};
let lastSection = document.getElementById('ex-trading');
const solo = async (id, marker, label) => {
  if (lastSection) lastSection.remove();
  const sec = document.getElementById(`ex-${id}`);
  if (!sec) fail(`example section #ex-${id} not found`);
  lastSection = sec;
  globalThis.__fireIO(sec.querySelector(`[data-ex="${id}"]`));
  if (marker) await waitFor(marker, label || `${id} example did not mount`);
  return sec;
};

await solo('portfolio', '.bo-grid .row', 'Portfolio example rendered no rows');
await waitFor('.bo-grid .group', 'Portfolio example did not group by sector');
const portfolioRows = document.querySelectorAll('.bo-grid .row').length;
const portfolioGroups = document.querySelectorAll('.bo-grid .group').length;
// Conditional formatting: Mkt Value draws data bars (v0.10); P&L shows ▲/▼ icons
// (v0.10); P&L % cells get a colour-scale tint (v0.11, a color-mix background).
const cfBars = document.querySelectorAll('.bo-grid .bo-databar').length;
const cfIcons = document.querySelectorAll('.bo-grid .bo-cf-icon').length;
const cfScale = document.querySelectorAll('.bo-grid .c[style*="color-mix"]').length;
if (cfBars === 0) fail('conditional formatting: data bars did not render on the Portfolio grid');
if (cfIcons === 0) fail('conditional formatting: icon set did not render on the Portfolio grid');
if (cfScale === 0) fail('conditional formatting: colour scale did not tint any cells');
// Computed column (v0.12): Cost Basis has no backing field — value(row) derives it.
// If cellValue weren't wired through, its cells would be blank.
const pfHeads = [...document.querySelectorAll('.bo-grid .head .h')];
const costHead = pfHeads.find((h) => h.querySelector('.label')?.textContent?.trim() === 'Cost Basis');
if (!costHead) fail('computed column: Cost Basis header did not render');
const costIdx = pfHeads.indexOf(costHead);
const costCell = document.querySelector('.bo-grid .row')?.querySelectorAll('.c')[costIdx];
if (!costCell || !/\d/.test(costCell.textContent || '')) {
  fail(`computed column: Cost Basis cell rendered no derived value (got "${costCell?.textContent}")`);
}
// onRowClick: clicking a position row surfaces it in the toolbar.
click(document.querySelector('.bo-grid .row'));
await wait(20);
if (!document.querySelector('.picked')) fail('onRowClick did not surface the clicked position');
// Controlled sort: a header click drives the example's external sort state.
click(document.querySelectorAll('.bo-grid .head .h')[1]);
await wait(20);
if (!document.querySelector('.pill.clear')) fail('controlled sort (onSortChange) did not surface');
click(document.querySelector('.pill.clear'));
await wait(20);
if (document.querySelector('.pill.clear')) fail('clearing controlled sort did not take effect');
// Footer totals row: a pinned row aggregating the columns with groupAgg.
const footerEl = document.querySelector('.bo-grid .footer');
if (!footerEl) fail('footer totals row did not render');
if (!/\d/.test(footerEl.textContent || '')) fail('footer totals row showed no aggregated values');
// Column header groups: a spanning row above the column headers.
const hgroups = [...document.querySelectorAll('.bo-grid .head-groups .hg')].filter(
  (h) => (h.textContent || '').trim().length > 0,
);
if (hgroups.length === 0) fail('column header groups did not render');
// Right-click row menu: contextmenu on a row opens a floating menu of actions.
document.querySelector('.bo-grid .row').dispatchEvent(
  new window.MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 80 }),
);
await wait(20);
const rowmenu = document.querySelector('.rowmenu');
if (!rowmenu || rowmenu.querySelectorAll('.rowmenu-item').length === 0) fail('row context menu did not open');
rowmenu.querySelector('.rowmenu-item').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
if (document.querySelector('.rowmenu')) fail('row menu did not close after selecting an item');
// Keyboard access to the row menu: focus a cell, then the ContextMenu key opens
// the same floating menu (Shift+F10 also works); Esc closes it.
document.querySelector('.bo-grid .c').dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
window.dispatchEvent(new window.Event('pointerup'));
await wait(20);
document.querySelector('.bo-grid .gridmain').dispatchEvent(
  new window.KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true }),
);
await wait(20);
const kbMenu = document.querySelector('.rowmenu');
if (!kbMenu || kbMenu.querySelectorAll('.rowmenu-item').length === 0)
  fail('ContextMenu key did not open the row menu from the keyboard');
// a11y (v0.15): opening via keyboard moves focus into the menu (APG menu pattern).
if (!document.activeElement?.classList?.contains('rowmenu-item'))
  fail('keyboard-opened menu did not move focus to its first item');
// ArrowDown navigates between items (dispatched on the focused item → bubbles to menu).
const kbFirst = document.activeElement;
kbFirst.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
await wait(10);
if (document.activeElement === kbFirst || !document.activeElement?.classList?.contains('rowmenu-item'))
  fail('ArrowDown did not move focus within the keyboard menu');
document.querySelector('.bo-grid .gridmain').dispatchEvent(
  new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
);
await wait(20);
if (document.querySelector('.rowmenu')) fail('Esc did not close the keyboard-opened row menu');
// Header filter menu (v0.3, lazy-loaded): open a numeric column's funnel, apply
// an impossible filter (→ no rows), then reopen and clear it (→ rows restored).
const sharesFunnel = () =>
  [...document.querySelectorAll('.bo-grid .head .h')]
    .find((h) => h.querySelector('.label')?.textContent?.trim() === 'Shares')
    ?.querySelector('.funnel');
const beforeFilter = document.querySelectorAll('.bo-grid .row').length;
if (!sharesFunnel()) fail('filter menu: funnel did not render on the Shares header');
sharesFunnel().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-filtermenu', 'header filter menu did not open (lazy chunk)');
const fmInput = document.querySelector('.bo-filtermenu .bo-fm-in');
fmInput.value = '999999999999';
fmInput.dispatchEvent(new window.Event('input', { bubbles: true }));
document
  .querySelector('.bo-filtermenu .bo-fm-apply')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
if (document.querySelectorAll('.bo-grid .row').length !== 0)
  fail('filter menu: applying an impossible filter did not exclude all rows');
sharesFunnel().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-filtermenu', 'header filter menu did not reopen');
[...document.querySelectorAll('.bo-filtermenu .bo-fm-btn')]
  .find((b) => b.textContent.trim() === 'Clear')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
if (document.querySelectorAll('.bo-grid .row').length !== beforeFilter)
  fail('filter menu: clearing the filter did not restore the rows');
// Set filter (checkbox value list): open the Exch funnel, exclude every value
// via "None" (→ no rows), then reopen and clear (→ rows restored).
const exchFunnel = () =>
  [...document.querySelectorAll('.bo-grid .head .h')]
    .find((h) => h.querySelector('.label')?.textContent?.trim() === 'Exch')
    ?.querySelector('.funnel');
if (!exchFunnel()) fail('set filter: funnel did not render on the Exch header');
exchFunnel().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-filtermenu .bo-fm-list', 'set-filter checklist did not render');
if (document.querySelectorAll('.bo-filtermenu .bo-fm-opt input[type=checkbox]').length === 0)
  fail('set filter: no value checkboxes rendered');
[...document.querySelectorAll('.bo-filtermenu .bo-fm-link')]
  .find((b) => b.textContent.trim() === 'None')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
document
  .querySelector('.bo-filtermenu .bo-fm-apply')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
if (document.querySelectorAll('.bo-grid .row').length !== 0)
  fail('set filter: excluding every value did not empty the grid');
exchFunnel().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-filtermenu', 'set-filter menu did not reopen');
[...document.querySelectorAll('.bo-filtermenu .bo-fm-btn')]
  .find((b) => b.textContent.trim() === 'Clear')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
if (document.querySelectorAll('.bo-grid .row').length !== beforeFilter)
  fail('set filter: clearing did not restore the rows');
// Column header menu (⋮): open the Last column's menu and hide it at runtime.
const headBefore = document.querySelectorAll('.bo-grid .head .h').length;
const lastMenuBtn = [...document.querySelectorAll('.bo-grid .head .h')]
  .find((h) => h.querySelector('.label')?.textContent?.trim() === 'Last')
  ?.querySelector('.hmenu');
if (!lastMenuBtn) fail('column menu: ⋮ trigger did not render on the Last header');
lastMenuBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
const colMenu = document.querySelector('.rowmenu');
if (!colMenu) fail('column menu did not open');
// a11y (v0.15): the column menu carries a keyboard path to filtering (the header
// funnel is pointer-only by APG grid design).
if (![...colMenu.querySelectorAll('.rowmenu-item')].some((b) => b.textContent.trim() === 'Filter…'))
  fail('column menu: keyboard "Filter…" item did not render on a filterable column');
[...colMenu.querySelectorAll('.rowmenu-item')]
  .find((b) => b.textContent.trim() === 'Hide column')
  ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
if ([...document.querySelectorAll('.bo-grid .head .h')].some((h) => h.querySelector('.label')?.textContent?.trim() === 'Last'))
  fail('column menu: Hide did not remove the Last column');
if (document.querySelectorAll('.bo-grid .head .h').length !== headBefore - 1)
  fail('column menu: hiding a column did not reduce the header count by one');
// Runtime pin (column menu): pin a column left → it moves toward the front;
// unpin → it moves back (observable via header order, no real layout needed).
const headLabels = () =>
  [...document.querySelectorAll('.bo-grid .head .h')].map((h) => h.querySelector('.label')?.textContent?.trim());
const pnlMenuBtn = () =>
  [...document.querySelectorAll('.bo-grid .head .h')]
    .find((h) => h.querySelector('.label')?.textContent?.trim() === 'P&L $')
    ?.querySelector('.hmenu');
const clickMenuItem = (label) =>
  [...document.querySelectorAll('.rowmenu .rowmenu-item')]
    .find((b) => b.textContent.trim() === label)
    ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const pnlBefore = headLabels().indexOf('P&L $');
if (pnlBefore < 0) fail('pin: P&L $ column not found');
pnlMenuBtn().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
clickMenuItem('Pin left');
await wait(20);
const pnlPinned = headLabels().indexOf('P&L $');
if (!(pnlPinned < pnlBefore)) fail(`pin: Pin left did not move the column forward (${pnlBefore}→${pnlPinned})`);
pnlMenuBtn().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
clickMenuItem('Unpin');
await wait(20);
if (!(headLabels().indexOf('P&L $') > pnlPinned)) fail('pin: Unpin did not move the column back');
// Columns tool panel (lazy): open it, restore the column hidden earlier via the
// menu (Show all), then hide a column by unchecking its box.
document
  .querySelector('.bo-grid .bo-cols-toggle')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-toolpanel', 'columns tool panel did not open (lazy chunk)');
if (document.querySelectorAll('.bo-toolpanel .bo-tp-opt input[type=checkbox]').length === 0)
  fail('tool panel: no column checkboxes rendered');
[...document.querySelectorAll('.bo-toolpanel .bo-tp-link')]
  .find((b) => b.textContent.trim() === 'Show all')
  ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
if (!headLabels().includes('Last')) fail('tool panel: Show all did not restore the hidden column');
const sharesOpt = [...document.querySelectorAll('.bo-toolpanel .bo-tp-opt')].find(
  (o) => o.querySelector('span')?.textContent?.trim() === 'Shares',
);
if (!sharesOpt) fail('tool panel: Shares row not found');
sharesOpt.querySelector('input[type=checkbox]').click(); // .click() toggles + fires change
await wait(30);
if (headLabels().includes('Shares')) fail('tool panel: unchecking a box did not hide the column');
// Autosize (v0.7): the column menu's Autosize sets a content-fit width override.
const avgHead = () =>
  [...document.querySelectorAll('.bo-grid .head .h')].find(
    (h) => h.querySelector('.label')?.textContent?.trim() === 'Avg Cost',
  );
const avgStyleBefore = avgHead()?.getAttribute('style') || '';
avgHead().querySelector('.hmenu').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
[...document.querySelectorAll('.rowmenu .rowmenu-item')]
  .find((b) => b.textContent.trim() === 'Autosize')
  ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
const avgStyleAfter = avgHead()?.getAttribute('style') || '';
if (avgStyleAfter === avgStyleBefore || !/width:\s*\d+px/.test(avgStyleAfter))
  fail('autosize did not set a content-fit width on the column');
// Column menu via keyboard (Alt+ArrowDown) at the focused column.
document
  .querySelector('.bo-grid .row .c')
  .dispatchEvent(new window.MouseEvent('pointerdown', { button: 0, bubbles: true }));
window.dispatchEvent(new window.Event('pointerup'));
await wait(20);
document
  .querySelector('.bo-grid .gridmain')
  .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
await wait(20);
if (!document.querySelector('.rowmenu')) fail('Alt+ArrowDown did not open the column menu');
document
  .querySelector('.bo-grid .gridmain')
  .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(20);

await solo('sheet', '.bo-grid .row', 'Spreadsheet example rendered no rows');
const sheetRows = document.querySelectorAll('.bo-grid .row').length;
if (sheetRows === 0) fail('Spreadsheet example rendered no rows');
// Quick filter (built-in search box): an impossible query empties the grid;
// clearing it restores the rows (deterministic, no data knowledge needed).
const quickBox = document.querySelector('.bo-grid .bo-quickfilter');
if (!quickBox) fail('quick filter: search box did not render');
quickBox.value = 'zzzqqqnomatch';
quickBox.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(30);
if (document.querySelectorAll('.bo-grid .row').length !== 0)
  fail('quick filter: an impossible query did not empty the grid');
quickBox.value = '';
quickBox.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(30);
if (document.querySelectorAll('.bo-grid .row').length !== sheetRows)
  fail('quick filter: clearing the query did not restore the rows');

// Grid handle (`onReady`): a layout snapshot round-trips, and scrollToRow moves
// the viewport. Compact hides two columns and sorts; Restore brings them back.
{
  const demoBtn = (name) => document.querySelector(`[data-demo="${name}"]`);
  const headCount = () => document.querySelectorAll('.bo-grid .head .h').length;
  const before = headCount();
  demoBtn('save-layout').click();
  await wait(20);
  demoBtn('compact').click();
  await wait(40);
  if (headCount() !== before - 2) fail(`handle: applyState hid ${before - headCount()} columns, expected 2`);
  demoBtn('restore-layout').click();
  await wait(40);
  if (headCount() !== before) fail('handle: Restore layout did not bring the columns back');
  const vp = document.querySelector('.bo-grid .viewport');
  const topBefore = vp.scrollTop;
  demoBtn('jump').click();
  await wait(40);
  if (!(vp.scrollTop > topBefore)) fail('handle: scrollToRow did not scroll the viewport');
}

// Fill handle (v0.5): select an editable cell, drag its corner down two rows, and
// assert the source value copied into the rows below.
const FILL_COL = 4; // Bonus — editable number, no custom format
const cAt = (rEl, c) => rEl.querySelectorAll('.c')[c];
const sheetRowEls = () => document.querySelectorAll('.bo-grid .row');
cAt(sheetRowEls()[0], FILL_COL).dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
window.dispatchEvent(new window.Event('pointerup'));
await wait(20);
const fillSrc = cAt(sheetRowEls()[0], FILL_COL).textContent.trim();
const fillRow2Before = cAt(sheetRowEls()[2], FILL_COL).textContent.trim();
const fillHandleEl = cAt(sheetRowEls()[0], FILL_COL).querySelector('.fill-handle');
if (!fillHandleEl) fail('fill handle did not render on the selected cell');
fillHandleEl.dispatchEvent(new window.MouseEvent('pointerdown', { button: 0, bubbles: true }));
cAt(sheetRowEls()[2], FILL_COL).dispatchEvent(new window.MouseEvent('pointerenter', { bubbles: true }));
window.dispatchEvent(new window.Event('pointerup'));
await wait(30);
const fillDst = cAt(sheetRowEls()[2], FILL_COL).textContent.trim();
if (fillDst !== fillSrc) fail(`fill handle did not copy down (src "${fillSrc}", row 2 "${fillDst}")`);
// Undo/redo (v0.5): one Ctrl+Z reverts the whole fill (grouped); Ctrl+Y re-applies.
const sheetGrid = document.querySelector('.bo-grid .gridmain');
sheetGrid.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
await wait(30);
if (cAt(sheetRowEls()[2], FILL_COL).textContent.trim() !== fillRow2Before)
  fail('undo (Ctrl+Z) did not revert the fill');
sheetGrid.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
await wait(30);
if (cAt(sheetRowEls()[2], FILL_COL).textContent.trim() !== fillSrc)
  fail('redo (Ctrl+Y) did not re-apply the fill');

// Select editor: the Role column edits via a <select> of options. Double-click a
// role cell and assert a select (not a text input) appears, then commit a change.
const roleCell = document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[1];
roleCell.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
await wait(40);
const sel = document.querySelectorAll('.bo-grid .row')[0].querySelector('select.bo-edit');
if (!sel) fail('select editor did not appear for an options column');
sel.value = 'Designer';
sel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(40);
const roleAfter = document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[1].textContent.trim();
if (roleAfter !== 'Designer') fail(`select edit did not commit (cell shows "${roleAfter}")`);

// Typed inline editors (v0.5): numeric columns use a number input; date columns a
// date picker. Double-click Bonus (col 4) → number input; Start date (col 6) → date.
document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[4].dispatchEvent(
  new window.MouseEvent('dblclick', { bubbles: true }),
);
await wait(40);
if (!document.querySelector('.bo-grid input.bo-edit[type="number"]'))
  fail('numeric column did not use a number input editor');
document
  .querySelector('.bo-grid input.bo-edit')
  .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await wait(20);
const dateBefore = document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[6].textContent.trim();
document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[6].dispatchEvent(
  new window.MouseEvent('dblclick', { bubbles: true }),
);
await wait(40);
const dateInput = document.querySelector('.bo-grid input.bo-edit[type="date"]');
if (!dateInput) fail('date column did not use a date input editor');
dateInput.value = '2030-06-15';
dateInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await wait(40);
const dateAfter = document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[6].textContent.trim();
if (dateAfter === dateBefore) fail(`date edit did not commit (cell still "${dateAfter}")`);

// Cell tooltip: the Name column opts into the styled floating tooltip, exposed
// as a `data-bo-tip` attribute carrying the full value (the grid renders the
// bubble from it on hover).
const nameCell = document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[0];
if (!nameCell.getAttribute('data-bo-tip')) fail('tooltip column did not set data-bo-tip');

// Custom formatter: the Salary column renders via format() ($-prefixed).
const salaryCell = document.querySelectorAll('.bo-grid .row')[0].querySelectorAll('.c')[3];
if (!/^\$/.test(salaryCell.textContent.trim())) {
  fail(`column format() not applied (cell shows "${salaryCell.textContent.trim()}")`);
}

// Per-column class hooks: cellClass + headerClass apply to the Team column.
if (!document.querySelector('.bo-grid .c.team-cell')) fail('column cellClass not applied');
if (!document.querySelector('.bo-grid .h.team-head')) fail('column headerClass not applied');

// Master-detail: click a row's expand toggle and assert the detail panel opens.
const expandToggle = document.querySelector('.bo-grid .expand-toggle');
if (!expandToggle) fail('master-detail expand toggle did not render');
expandToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
const detailEl = document.querySelector('.bo-grid .row-detail');
if (!detailEl || !/Salary/.test(detailEl.textContent || '')) fail('detail panel did not open with content');
expandToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
if (document.querySelector('.bo-grid .row-detail')) fail('detail panel did not collapse');

// Row selection: tick one row, then select-all via the header checkbox.
const firstCheck = document.querySelector('.bo-grid .row .rowcheck');
if (!firstCheck) fail('row-selection checkbox did not render');
firstCheck.click();
await wait(20);
if (!document.querySelector('.bo-grid .row.rowsel')) fail('ticking a row did not select it');
const selAll = document.querySelector('.bo-grid .selhead .rowcheck');
if (!selAll) fail('select-all header checkbox did not render');
selAll.click();
await wait(20);
const selectedRows = document.querySelectorAll('.bo-grid .row.rowsel').length;
if (selectedRows < 2) fail(`select-all did not select the visible rows (${selectedRows})`);
// Keyboard row-selection: focus a cell, then Space toggles that row's checkbox.
const kbRow = document.querySelector('.bo-grid .row');
const wasSel = kbRow.classList.contains('rowsel');
kbRow.querySelector('.c').dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
window.dispatchEvent(new window.Event('pointerup'));
await wait(20);
document.querySelector('.bo-grid .gridmain').dispatchEvent(
  new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }),
);
await wait(20);
if (document.querySelector('.bo-grid .row').classList.contains('rowsel') === wasSel)
  fail('Space did not toggle row selection of the focused row');

// onCellClick: clicking a cell reports its column + value to the toolbar.
click(document.querySelector('.bo-grid .row .c'));
await wait(20);
if (!document.querySelector('.lastcell')) fail('onCellClick did not report the clicked cell');

// Column show/hide: open the picker and hide a column, assert a header drops.
const colsBefore = document.querySelectorAll('.bo-grid .head .h').length;
const colBtn = [...document.querySelectorAll('.colbtn')].find((b) => b.textContent.includes('Columns'));
if (!colBtn) fail('column-picker button not found');
colBtn.click();
await wait(20);
const colItem = document.querySelector('.colmenu .menu .item input');
if (!colItem) fail('column-picker menu did not open');
colItem.click(); // hide the first column
await wait(20);
const colsAfter = document.querySelectorAll('.bo-grid .head .h').length;
if (colsAfter !== colsBefore - 1) fail(`hiding a column should drop one header (${colsBefore} → ${colsAfter})`);

// Per-column filter row: typing in a column's input narrows the rows.
const roleFilter = document.querySelector('.bo-grid .filter-row [aria-label="Filter Role"]');
if (!roleFilter) fail('per-column filter input did not render');
const frBefore = document.querySelectorAll('.bo-grid .row').length;
roleFilter.value = 'Engineer';
roleFilter.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(30);
const frAfter = document.querySelectorAll('.bo-grid .row').length;
if (!(frAfter < frBefore)) fail(`column filter did not narrow rows (${frBefore} → ${frAfter})`);
// emptyMessage: filter to nothing and assert the custom empty state shows.
roleFilter.value = 'zzzzzz';
roleFilter.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(30);
const emptyEl = document.querySelector('.bo-grid .empty');
if (!emptyEl || !/no people match/i.test(emptyEl.textContent || '')) {
  fail(`custom emptyMessage did not show (got "${emptyEl?.textContent}")`);
}
roleFilter.value = ''; // clear so later state is clean
roleFilter.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(20);

// Pagination: toggle paged mode and step through pages via the pager.
const pageToggle = [...document.querySelectorAll('.colbtn')].find((b) => /Scroll|Paged/.test(b.textContent || ''));
if (!pageToggle) fail('pagination toggle not found');
pageToggle.click();
await wait(30);
const pager = document.querySelector('.bo-grid .pager');
if (!pager || !/Page 1 of/.test(pager.textContent || '')) fail(`pager did not render (got "${pager?.textContent}")`);
const nextBtn = [...pager.querySelectorAll('.pg')].find((b) => /Next/.test(b.textContent || ''));
nextBtn.click();
await wait(30);
if (!/Page 2 of/.test(document.querySelector('.bo-grid .pager')?.textContent || '')) {
  fail('pager Next did not advance the page');
}
// Page-size dropdown (pageSizeOptions): switch 12 → 48 and expect fewer pages.
const sizeSel = document.querySelector('.bo-grid .pager .pgsize select');
if (!sizeSel) fail('pageSizeOptions dropdown did not render in the pager');
const pagesOf = () => Number((document.querySelector('.bo-grid .pager')?.textContent.match(/of (\d+)/) || [])[1]);
const pagesBefore = pagesOf();
sizeSel.value = '48';
sizeSel.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(30);
if (!(pagesOf() < pagesBefore)) fail(`page-size change did not reduce page count (${pagesBefore} → ${pagesOf()})`);

// Controlled active-row highlight (selectedRowId): clicking a row marks it active.
document.querySelectorAll('.bo-grid .row')[1]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
if (!document.querySelector('.bo-grid .row.rowactive')) fail('selectedRowId highlight not applied after row click');

// Order book: per-row colour classes (ask/bid) via rowClass + custom depth cell.
await solo('orderbook', '.bo-grid .row.ask', 'Order book did not apply ask rowClass');
const obAsk = document.querySelectorAll('.bo-grid .row.ask').length;
const obBid = document.querySelectorAll('.bo-grid .row.bid').length;
const obDepth = document.querySelectorAll('.bo-grid .row .depth .fill').length;
if (obBid === 0) fail('Order book did not apply bid rowClass');
if (obDepth === 0) fail('Order book custom depth-bar cell did not render');

// Derived per-cell flash (`flash: 'auto'`): the grid works out the direction
// itself from the previous value — the demo bumps no flashSeq. A cell must be
// quiet on first paint and flash only once a value actually moves.
if (document.querySelector('.bo-grid .row .c .flash')) {
  fail('Derived flash fired on first paint — cells must start quiet');
}
const liveBtn = [...document.querySelectorAll('button.live')].find((b) => b.offsetParent !== null)
  ?? document.querySelector('button.live');
if (!liveBtn) fail('Order book live toggle not found');
liveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
let flashed = 0;
for (let i = 0; i < 40 && flashed === 0; i++) {
  await wait(100);
  flashed = document.querySelectorAll('.bo-grid .row .c .flash').length;
}
liveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
if (flashed === 0) fail('Derived flash never fired after live size updates');
const obDirected = document.querySelectorAll(
  '.bo-grid .row .c .flash.up, .bo-grid .row .c .flash.down',
).length;
if (obDirected === 0) fail('Derived flash fired without an up/down direction');

// bo-grid/realtime's createOrderBook behind it: grouping merges levels into
// whole-number buckets, and the side-by-side layout pairs bids with asks.
const obPrices = () => [...document.querySelectorAll('.bo-grid .row [aria-colindex="1"]')].map((c) => c.textContent?.trim() ?? '');
const groupSel = document.querySelector('select.group');
if (!groupSel) fail('Order book group control not found');
groupSel.value = '1';
groupSel.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(50);
const grouped = obPrices();
if (grouped.length === 0 || !grouped.every((t) => /^\d+$/.test(t))) fail(`Order book group 1 did not show whole-number buckets (${grouped.slice(0, 4).join(', ')})`);
groupSel.value = '0.05';
groupSel.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(50);
const sideBtn = [...document.querySelectorAll('button.layout')].find((b) => b.textContent?.trim() === 'Side by side');
if (!sideBtn) fail('Order book layout control not found');
sideBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-grid .c.bid', 'Order book side-by-side layout did not render');
const obPairs = document.querySelectorAll('.bo-grid .row').length;
const obPairBars = document.querySelectorAll('.bo-grid .row .depth .fill.bid').length + document.querySelectorAll('.bo-grid .row .depth .fill.ask').length;
if (obPairBars < obPairs) fail(`Order book side by side shows depth bars on too few rows (${obPairBars} for ${obPairs} rows)`);

// VN board: bo-grid/trading — price-limit tone (ceiling/floor/reference/up/down),
// tick-aware VND formatting, and the live session badge, composed with the
// bo-grid/realtime tick pipeline for price motion.
await solo('vnboard', '.bo-grid .row', 'VN board example rendered no rows');
const vnSession = document.querySelector('.session');
if (!vnSession) fail('VN board session badge did not render');
if (!/^(Pre-open|ATO|Continuous|Break|ATC|Closed)$/.test(vnSession.textContent?.trim() ?? '')) {
  fail(`VN board session badge showed an unrecognized label: "${vnSession.textContent}"`);
}
// Ceiling/floor cells are coloured distinctly per bo-grid/trading's convention —
// confirm at least the ceiling/floor legend swatches (always rendered) carry
// two DIFFERENT colours, proving toneColor() actually varies by tone.
const vnSwatches = [...document.querySelectorAll('.legend i')].map((i) => i.getAttribute('style'));
if (new Set(vnSwatches).size < 5) fail('VN board legend did not render 5 distinct tone colours');
const vnLiveBtn = document.querySelector('button.live');
if (!vnLiveBtn) fail('VN board live toggle not found');
vnLiveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(500);
vnLiveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const vnRows = document.querySelectorAll('.bo-grid .row').length;

// Price ladder: bo-grid/ladder's DepthLadder — 21 prices around the mid. The
// feed is paused first so the market cannot move the window mid-check. The
// wheel pages away and stops following; the follow button brings it back; a
// click on a bid asks to buy at that row's price.
await solo('ladder', '.bo-ladder .row', 'Price ladder example rendered no rows');
const ladderLive = document.querySelector('button.live');
if (!ladderLive) fail('Price ladder live toggle not found');
ladderLive.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
const ladderRowsInitial = document.querySelectorAll('.bo-ladder .spacer > .row').length;
if (ladderRowsInitial !== 21) fail(`Price ladder did not render exactly 21 rows (got ${ladderRowsInitial})`);
const followBtn = document.querySelector('button.follow');
if (!followBtn) fail('Price ladder follow control not found');
if (!followBtn.disabled) fail('Price ladder should start following the market (follow button disabled)');
const ladderTop = () => {
  const rows = [...document.querySelectorAll('.bo-ladder .spacer > .row')].sort((x, y) => Number(x.getAttribute('aria-rowindex')) - Number(y.getAttribute('aria-rowindex')));
  return rows[0]?.querySelector('[aria-colindex="4"]')?.textContent?.trim();
};
const topBefore = ladderTop();
document.querySelector('.bo-ladder').dispatchEvent(new window.WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
await wait(30);
if (followBtn.disabled) fail('Price ladder kept following after the wheel paged it');
if (ladderTop() === topBefore) fail(`Price ladder wheel did not move the window (still "${topBefore}")`);
followBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
if (!followBtn.disabled) fail('Price ladder did not follow again after the follow button');
if (ladderTop() !== topBefore) fail(`Price ladder did not return to the mid (expected "${topBefore}", got "${ladderTop()}")`);
const bidCell = [...document.querySelectorAll('.bo-ladder .spacer > .row')].find((r) => r.querySelector('[aria-colindex="3"]')?.textContent?.trim())?.querySelector('[aria-colindex="3"]');
if (!bidCell) fail('Price ladder shows no bid size');
bidCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
const ladderNote = document.querySelector('.note')?.textContent ?? '';
if (!/^Buy 100 at /.test(ladderNote)) fail(`Price ladder click on a bid did not ask to buy (note: "${ladderNote}")`);
const ladderRowsAfter = document.querySelectorAll('.bo-ladder .spacer > .row').length;
if (ladderRowsAfter !== 21) fail(`Price ladder lost rows after paging and following (got ${ladderRowsAfter})`);

// Orders & positions: status chips on the working orders, and a positions
// grid with a footer (live P&L totals) fed by the fills.
await solo('orders', '.bo-grid .row', 'Orders & positions example rendered no rows');
const ordersBadges = document.querySelectorAll('.bo-grid .row .badge, .bo-grid .row [class*="badge"]').length;
if (ordersBadges === 0) fail('Orders & positions shows no status chips');
await wait(1200);
const ordersFooter = document.querySelectorAll('.bo-grid .footer').length;
if (ordersFooter === 0) fail('Orders & positions has no positions footer');
// Hotkeys: C on the focused order cancels that order.
document.querySelector('button.live')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
const openRow = [...document.querySelectorAll('.bo-grid .row')].find((r) => /Working|Partial/.test(r.textContent ?? ''));
if (!openRow) fail('Orders & positions has no working order to cancel');
const openId = openRow.querySelector('[aria-colindex="1"]')?.textContent?.trim();
openRow.querySelector('.c').dispatchEvent(new window.MouseEvent('pointerdown', { button: 0, bubbles: true }));
window.dispatchEvent(new window.Event('pointerup'));
document.querySelector('.bo-grid .gridmain').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
await wait(30);
const cancelled = [...document.querySelectorAll('.bo-grid .row')].find((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim() === openId);
if (!/Cancelled/.test(cancelled?.textContent ?? '')) fail(`Orders hotkey C did not cancel the focused order #${openId}`);

// FX & crypto: bo-grid/trading's dealing-screen quotes (big figure, pips,
// pipette) on six pairs, and a crypto watchlist whose market never closes.
await solo('fxcrypto', '.bo-grid .row', 'FX & crypto example rendered no rows');
const fxPips = document.querySelectorAll('.bo-grid .row .bo-fx-pips').length;
if (fxPips !== 12) fail(`FX & crypto did not show 12 dealing-screen quotes (got ${fxPips})`);
const fxStat = document.querySelector('.stat')?.textContent ?? '';
if (!/crypto Continuous/.test(fxStat)) fail(`FX & crypto did not read the crypto market as continuous ("${fxStat}")`);

// Time & sales: bo-grid/realtime's TradeTape — capped, newest trade first.
// Starts with zero trades (an empty grid, no `.row` yet), so solo() waits on
// the grid container rather than a row.
await solo('timesales', '.bo-grid', 'Time & sales example did not mount');
const tsLiveBtn = document.querySelector('button.live');
if (!tsLiveBtn) fail('Time & sales live toggle not found');
tsLiveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-grid .row', 'Time & sales did not render any trade rows once live');
await wait(600);
tsLiveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const tsRows = document.querySelectorAll('.bo-grid .row').length;
if (tsRows === 0) fail('Time & sales rendered no trade rows after going live');
// A ~600ms run at 180ms/trade never gets near the 200-trade cap — the cap
// itself is exhaustively unit-tested (src/lib/realtime/tape.test.ts). This is
// just a sanity bound proving the demo is wired to TradeTape's output at all
// (a broken wiring that free-grew an unrelated array would still likely stay
// under 200 this briefly, so treat this as a smoke check, not a cap proof).
if (tsRows > 200) fail(`Time & sales exceeded its 200-trade cap (got ${tsRows} rows)`);

// Correlation: an N×N heatmap matrix with a pinned label column.
await solo('correlation', '.bo-grid .row', 'Correlation example rendered no rows');
const heatCells = [...document.querySelectorAll('.bo-grid .row .c')].filter((c) =>
  /background:\s*(rgb|#|hsl|oklch)/i.test(c.getAttribute('style') || ''),
).length;
const corrPinned = [...document.querySelectorAll('.bo-grid .row .c')].filter((c) =>
  /position:\s*sticky/.test(c.getAttribute('style') || ''),
).length;
if (heatCells === 0) fail('Correlation matrix rendered no heatmap-coloured cells');
if (corrPinned === 0) fail('Correlation matrix label column did not pin');

// Leaderboard: custom rank/progress cells + podium row highlighting.
// Blotter: merged cells. spanRows draws one tall cell per run (aria-rowspan)
// with transparent covers below it; colSpan note rows cover Qty/Price.
// Price board: plain rows fed through api.patchRows. A patch to an on-screen
// symbol repaints its cell (and flashes it); the board renders all 24 columns.
await solo('priceboard', '.bo-grid .row', 'Price board example rendered no rows');
{
  const pb = globalThis.__priceBoard ?? window.__priceBoard;
  if (!pb?.api?.()) fail('Price board: grid handle (onReady) not exposed');
  // onViewportChange + createViewportSubscriptions: a screenful streams, not the board.
  const watching = pb.watching?.() ?? 0;
  if (!(watching > 0 && watching < pb.rows().length)) {
    fail(`Price board: viewport subscriptions stream ${watching} of ${pb.rows().length} symbols (expected one screenful)`);
  }
  const head = [...document.querySelectorAll('.bo-grid .head [role=columnheader]')].find((h) => h.textContent.trim() === 'Giá');
  const ci = head?.getAttribute('aria-colindex');
  const row0 = document.querySelector('.bo-grid .viewport .row');
  const sym = row0?.querySelector('[aria-colindex="1"]')?.textContent.trim();
  const q = pb.rows().find((r) => r.symbol === sym);
  if (!q) fail('Price board: first rendered row not found in its data');
  const before = row0.querySelector(`[aria-colindex="${ci}"]`).textContent.trim();
  const changed = pb.api().patchRows([[q.id, { mp: q.mp + 500 }]]);
  await wait(30);
  const after = document.querySelector('.bo-grid .viewport .row').querySelector(`[aria-colindex="${ci}"]`);
  if (changed !== 1) fail(`Price board: patchRows reported ${changed} changed rows, expected 1`);
  if (after.textContent.trim() === before) fail('Price board: patchRows did not repaint the on-screen cell');
  if (!after.querySelector('.flash')) fail('Price board: patched cell did not flash');
  // showChange: the +500 tick shows its size, in the column's own format (÷1000).
  const delta = after.querySelector('.bo-chg')?.textContent.trim();
  if (delta !== '▲0.50') fail(`Price board: showChange delta was "${delta}", expected "▲0.50"`);
  // flashMotion 'hold' (the board's default): a static tint the grid's clock drops.
  const priceCell = () => document.querySelector('.bo-grid .viewport .row').querySelector(`[aria-colindex="${ci}"]`);
  if (!after.querySelector('.flash.held')) fail('Price board: hold flash is missing its held class');
  await wait(450);
  if (priceCell().querySelector('.flash')) fail('Price board: held flash did not drop after its window');
  pb.setFlashMotion('fade');
  pb.api().patchRows([[q.id, { mp: q.mp + 1000 }]]);
  await wait(30);
  const faded = priceCell().querySelector('.flash');
  if (!faded || faded.classList.contains('held')) fail('Price board: fade flash did not play as a fade');
  pb.setFlashMotion('hold');
  if (document.querySelectorAll('.bo-grid .head [role=columnheader]').length !== 24)
    fail('Price board: expected 24 columns');
  // api.flashCells: flashes the named cells of an on-screen row (the symbol is
  // a text cell with no flash of its own), and skips rows that are off screen.
  const symCell = () => document.querySelector('.bo-grid .viewport .row [aria-colindex="1"]');
  const flashedRows = pb.api().flashCells({ rows: [q.id], columns: ['symbol'], dir: 'up' });
  await wait(30);
  if (flashedRows !== 1) fail(`Price board: flashCells reported ${flashedRows} rows, expected 1`);
  if (!symCell()?.querySelector('strong.flash.up')) fail('Price board: flashCells did not flash the symbol cell');
  const offScreen = pb.rows()[pb.rows().length - 1].id;
  if (pb.api().flashCells({ rows: [offScreen] }) !== 0) fail('Price board: flashCells flashed a row that is off screen');
  // rowPinning: pin a row far down the board; it shows above the scroll and
  // repaints under patchRows; unpinning removes it.
  if (!pb.api().pinRow(offScreen)) fail('Price board: pinRow refused a known row');
  await wait(30);
  const pinnedRow = () => document.querySelector('.bo-grid .pinned-top .row');
  if (!pinnedRow()) fail('Price board: pinned row did not appear above the scroll');
  const lastQ = pb.rows()[pb.rows().length - 1];
  pb.api().patchRows([[offScreen, { mp: lastQ.mp + 700 }]]);
  await wait(30);
  const pinnedPrice = pinnedRow()?.querySelector(`[aria-colindex="${ci}"]`)?.textContent.trim() ?? '';
  if (!pinnedPrice.includes(((lastQ.mp) / 1000).toFixed(2))) fail(`Price board: pinned row did not repaint under patchRows ("${pinnedPrice}")`);
  pb.api().pinRow(offScreen, false);
  await wait(30);
  if (pinnedRow()) fail('Price board: unpinned row is still above the scroll');
  // Top movers: sorted by change, values move in place, api.refresh() re-sorts.
  pb.setMovers(true);
  await wait(30);
  const last = pb.rows()[pb.rows().length - 1];
  pb.api().patchRows([[last.id, { chg: 999_999 }]]);
  pb.api().refresh();
  await wait(30);
  const topSym = document.querySelector('.bo-grid .viewport .row [aria-colindex="1"]')?.textContent.trim();
  if (topSym !== last.symbol) fail(`Price board: refresh() did not re-sort (top is ${topSym}, expected ${last.symbol})`);
  pb.setMovers(false);
}

await solo('blotter', '.bo-grid .row', 'Blotter example rendered no rows');
const blotRuns = [...document.querySelectorAll('.bo-grid [aria-rowspan]')];
const blotCovers = document.querySelectorAll('.bo-grid .spancover').length;
const blotColSpans = document.querySelectorAll('.bo-grid [aria-colspan="3"]').length;
if (blotRuns.length === 0) fail('Blotter: spanRows drew no merged cells');
if (blotCovers === 0) fail('Blotter: covered cells under a run did not render as covers');
if (blotColSpans === 0) fail('Blotter: colSpan note rows did not span 3 columns');
if (!blotRuns.every((c) => Number(c.getAttribute('aria-rowspan')) > 1 && parseFloat(c.style.height) > 0))
  fail('Blotter: a merged cell is missing its run height');
// The account column runs hierarchically above the order column: the first
// account run must be at least as tall as the first order run inside it.
const blotAcct = blotRuns.find((c) => c.getAttribute('aria-colindex') === '1');
const blotOrder = blotRuns.find((c) => c.getAttribute('aria-colindex') === '2');
if (!blotAcct || !blotOrder || parseFloat(blotAcct.style.height) < parseFloat(blotOrder.style.height))
  fail('Blotter: account run is not hierarchical over the order run');

await solo('leaderboard', '.bo-grid .row', 'Leaderboard example rendered no rows');
const lbBars = document.querySelectorAll('.bo-grid .row .bar .fill').length;
const lbPodium = document.querySelectorAll('.bo-grid .row.podium-row').length;
const lbPinned = document.querySelectorAll('.bo-grid .pinned-top .pinrow').length;
if (lbBars === 0) fail('Leaderboard score bars (custom cell) did not render');
if (lbPodium === 0) fail('Leaderboard podium rowClass did not apply');
if (lbPinned === 0) fail('Leaderboard pinned "You" row did not render');

// Team: rich built-in cell types (avatar, badge, progress, rating, tags, boolean).
await solo('team', '.bo-grid .row', 'Team example rendered no rows');
for (const [sel, label] of [
  ['.bo-grid .bo-avatar', 'avatar'],
  ['.bo-grid .bo-badge', 'badge'],
  ['.bo-grid .bo-progress .bo-progress-fill', 'progress'],
  ['.bo-grid .bo-rating', 'rating'],
  ['.bo-grid .bo-tag', 'tags'],
  ['.bo-grid .bo-bool', 'boolean'],
  ['.bo-grid .bo-link', 'link'],
]) {
  if (document.querySelectorAll(sel).length === 0) fail(`Team: ${label} cell type did not render`);
}
// Registered cell type: `cellType: 'country'` resolves through <Grid cellTypes>
// and draws with its Svelte component (region dot + country name).
const teamCountry = document.querySelectorAll('.bo-grid .country-cell');
if (teamCountry.length === 0) fail('Team: registered cellType component did not render');
if (!teamCountry[0].querySelector('.dot') || !/[A-Za-z]{3,}/.test(teamCountry[0].textContent))
  fail(`Team: country cell content looks wrong ("${teamCountry[0].textContent.trim()}")`);
// Registered filter type: the Workload column's `filter: 'band'` opens the
// standard menu frame around the demo's own editor; picking "Over 80%" and
// applying keeps only rows whose progress fill is above 80%, Clear restores.
const teamRowsBefore = document.querySelectorAll('.bo-grid .row').length;
const workloadFunnel = () =>
  [...document.querySelectorAll('.bo-grid .head .h')]
    .find((h) => h.querySelector('.label')?.textContent?.trim() === 'Workload')
    ?.querySelector('.funnel');
if (!workloadFunnel()) fail('Team: funnel did not render on the Workload header');
workloadFunnel().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-filtermenu .band-filter', 'Team: registered filter editor did not render in the menu');
[...document.querySelectorAll('.bo-filtermenu .band')]
  .find((b) => b.textContent.trim() === 'Over 80%')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
document.querySelector('.bo-filtermenu .bo-fm-apply').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
const bandFills = [...document.querySelectorAll('.bo-grid .row .bo-progress-fill')].map((f) => parseFloat(f.style.width));
if (bandFills.length === 0 || bandFills.length >= teamRowsBefore)
  fail(`Team: band filter did not narrow the rows (${bandFills.length} of ${teamRowsBefore})`);
if (!bandFills.every((w) => w > 80)) fail(`Team: band filter kept a row outside the band (${bandFills.join(', ')})`);
workloadFunnel().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await waitFor('.bo-filtermenu .band.on', 'Team: reopened band filter lost its selection');
[...document.querySelectorAll('.bo-filtermenu .bo-fm-btn')]
  .find((b) => b.textContent.trim() === 'Clear')
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
if (document.querySelectorAll('.bo-grid .row').length !== teamRowsBefore) fail('Team: clearing the band filter did not restore the rows');
// Custom cell editor: double-clicking a rating cell opens the demo's star
// editor (a display-only type made editable); clicking a star commits it.
const ratingCell = () =>
  [...document.querySelectorAll('.bo-grid .row')][0]?.querySelector('.bo-rating')?.closest('.c');
ratingCell().dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
await waitFor('.bo-grid .rating-editor', 'Team: custom rating editor did not open');
[...document.querySelectorAll('.bo-grid .rating-editor .star')][4].dispatchEvent(
  new window.MouseEvent('click', { bubbles: true }),
);
await wait(40);
if (document.querySelector('.bo-grid .rating-editor')) fail('Team: rating editor did not close after commit');
if (ratingCell()?.querySelector('.bo-rating')?.getAttribute('aria-label') !== '5 out of 5')
  fail('Team: rating editor commit did not update the cell');
// link safety: the email column produces mailto: anchors (safeHref passed it).
const teamLink = document.querySelector('.bo-grid .bo-link');
if (!/^mailto:/.test(teamLink?.getAttribute('href') || '')) fail('Team: link href not applied (safeHref)');
// relative-time + currency render as formatted text (v0.13).
const teamText = document.querySelector('.bo-grid')?.textContent || '';
if (!/ ago|just now|^in |\bin \d/.test(teamText)) fail('Team: relative-time column did not render');
if (!/\$\d/.test(teamText)) fail('Team: currency column did not render');
// Header tooltips: columns opt into a styled header tooltip (data-bo-tip on the
// columnheader) + an ⓘ info-icon cue.
const teamHeadTip = document.querySelector('.bo-grid .head .h[data-bo-tip]');
if (!teamHeadTip) fail('Team: header tooltip did not set data-bo-tip on a columnheader');
if (!document.querySelector('.bo-grid .head .h .hinfo')) fail('Team: headerInfo icon not rendered');

// Wide grid (v0.16): 60+ columns in fixed-width horizontal-scroll mode with a
// pinned label column. (Column windowing needs real layout + ResizeObserver,
// which jsdom lacks, so it renders all columns here — windowing is unit-tested
// in colvirt.test.ts. This asserts the wide layout mounts and pins correctly.)
await solo('wide');
// Poll until the Wide grid's own columns render (the lazy chunk loads after the
// previous example tears down — avoid matching a transitional grid).
let wideHeaders = 0;
for (let i = 0; i < 80; i++) {
  wideHeaders = document.querySelectorAll('.bo-grid .head .h').length;
  if (wideHeaders >= 60) break;
  await wait(25);
}
if (wideHeaders < 60) fail(`wide grid: expected 60+ columns in the header (got ${wideHeaders})`);
const widePinned = [...document.querySelectorAll('.bo-grid .head .h')].filter((h) =>
  /position:\s*sticky/.test(h.getAttribute('style') || ''),
).length;
if (widePinned === 0) fail('wide grid: pinned Account column not sticky in horizontal-scroll mode');

// Themes (v0.18): the same grid re-themed by passing a preset object to `theme`.
await solo('themes', '.theme-picker', 'Themes example did not mount');
const themeGridStyle = () => document.querySelector('.bo-grid.grid')?.getAttribute('style') || '';
// Default preset is midnight (#0f172a) — poll until the Themes grid is live.
let themesOk = false;
for (let i = 0; i < 40; i++) {
  if (/--bo-grid-bg:\s*#0f172a/i.test(themeGridStyle())) {
    themesOk = true;
    break;
  }
  await wait(25);
}
if (!themesOk) fail('Themes: default midnight preset not applied to the grid');
// Switch to the terminal preset (#0a0f0a) and assert the grid re-themes.
[...document.querySelectorAll('.theme-picker .tp-btn')]
  .find((b) => b.textContent.trim() === 'terminal')
  ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
if (!/--bo-grid-bg:\s*#0a0f0a/i.test(themeGridStyle()))
  fail('Themes: switching to the terminal preset did not re-theme the grid');

// CSV import (v0.22): parseCSV renders the sample; editing + Load updates the grid.
await solo('csv', '.csv-text', 'CSV example did not mount');
let csvRows = 0;
for (let i = 0; i < 40; i++) {
  csvRows = document.querySelectorAll('.bo-grid .row').length;
  if (csvRows >= 4) break;
  await wait(25);
}
if (csvRows < 4) fail(`CSV: parsed sample did not render 4 rows (got ${csvRows})`);
// Load a 1-row CSV and assert the grid updates through parseCSV.
const csvTa = document.querySelector('.csv-text');
csvTa.value = 'Name,Role,Salary,Rating\nSolo Dev,Engineer,100000,5';
csvTa.dispatchEvent(new window.Event('input', { bubbles: true }));
document.querySelector('.csv-load').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
const csvAfter = document.querySelectorAll('.bo-grid .row').length;
if (csvAfter !== 1) fail(`CSV: loading a 1-row CSV did not update the grid (got ${csvAfter})`);
// Switch to JSON format → loads the 3-row JSON sample (parseJSON, v0.23).
const csvFmt = document.querySelector('.csv-format');
csvFmt.value = 'json';
csvFmt.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(20);
document.querySelector('.csv-load').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
const csvJson = document.querySelectorAll('.bo-grid .row').length;
if (csvJson !== 3) fail(`CSV: JSON import did not load 3 rows (got ${csvJson})`);
// Auto-detect (v0.25): keep the JSON text, switch to Auto → parseRows detects it.
csvFmt.value = 'auto';
csvFmt.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(20);
document.querySelector('.csv-load').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(40);
const csvAuto = document.querySelectorAll('.bo-grid .row').length;
if (csvAuto !== 3) fail(`CSV: auto-detect (parseRows) did not load the JSON (got ${csvAuto})`);

// Print view (v0.24): toHTMLTable renders ALL rows, unlike the virtualized grid.
await solo('print', '.print-preview-btn', 'Print example did not mount');
const printGridRows = document.querySelectorAll('.bo-grid .row').length; // virtualized subset
document.querySelector('.print-preview-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
const printPreviewRows = document.querySelectorAll('.preview table tbody tr').length;
if (printPreviewRows !== 50) fail(`print: printable table should render all 50 rows (got ${printPreviewRows})`);
if (!(printGridRows < 50)) fail(`print: grid should virtualize (rendered ${printGridRows}/50)`);

// Tree data: roots render collapsed; expanding a folder reveals children.
await solo('tree', '.bo-grid .row', 'Tree example rendered no rows');
const treeRootsCount = document.querySelectorAll('.bo-grid .row').length;
const treeToggle = document.querySelector('.bo-grid .tree-toggle');
if (!treeToggle) fail('tree expand toggle did not render');
treeToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(30);
const treeAfter = document.querySelectorAll('.bo-grid .row').length;
if (!(treeAfter > treeRootsCount)) fail(`expanding a tree node did not reveal children (${treeRootsCount} → ${treeAfter})`);
// Treegrid a11y: the expanded node carries aria-expanded; ArrowLeft collapses it.
if (document.querySelector('.bo-grid .row[aria-expanded="true"]') == null) fail('expanded tree row missing aria-expanded');
const treeGridK = document.querySelector('.bo-grid .gridmain');
document.querySelectorAll('.bo-grid .row')[0].querySelector('.c').dispatchEvent(
  new window.MouseEvent('pointerdown', { button: 0, bubbles: true }),
);
window.dispatchEvent(new window.Event('pointerup'));
treeGridK.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
await wait(30);
if (document.querySelectorAll('.bo-grid .row').length !== treeRootsCount) {
  fail('ArrowLeft did not collapse the focused tree node');
}

// Lazy tree (v0.17): children load async on expand — a loading row appears, then
// children replace it. (hasChildren shows the chevron without loading.)
await solo('lazytree', '.lazy-note', 'Lazy tree example did not mount');
await waitFor('.bo-grid .tree-toggle', 'Lazy tree did not render expandable roots');
const lazyRootsCount = document.querySelectorAll('.bo-grid .row').length;
document.querySelector('.bo-grid .tree-toggle').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
if (!document.querySelector('.bo-grid .row.treeloading')) fail('lazy tree: loading row did not appear on expand');
// Children arrive after the simulated latency; the loading row is replaced.
let lazyAfter = lazyRootsCount;
for (let i = 0; i < 60; i++) {
  lazyAfter = document.querySelectorAll('.bo-grid .row').length;
  if (lazyAfter > lazyRootsCount && !document.querySelector('.bo-grid .row.treeloading')) break;
  await wait(25);
}
if (!(lazyAfter > lazyRootsCount)) fail(`lazy tree: children did not load (${lazyRootsCount} → ${lazyAfter})`);
if (document.querySelector('.bo-grid .row.treeloading')) fail('lazy tree: loading row did not clear after load');

// Server groups (v0.20): group summaries (count + total) up front; a group's rows
// load async on expand.
await solo('servergroups', '.sg-note', 'Server groups example did not mount');
await waitFor('.bo-grid .group', 'Server groups did not render group headers');
const sgGroups = document.querySelectorAll('.bo-grid .group').length;
if (sgGroups < 4) fail(`server groups: expected 4 group headers (got ${sgGroups})`);
// Server aggregate shows in a group header (preformatted "$x.xM").
if (!/\$\d/.test(document.querySelector('.bo-grid .group')?.textContent || ''))
  fail('server groups: server aggregate did not show in the group header');
const sgRowsBefore = document.querySelectorAll('.bo-grid .row:not(.treeloading)').length;
document.querySelector('.bo-grid .group .toggle').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(20);
if (!document.querySelector('.bo-grid .row.treeloading')) fail('server groups: loading row did not appear on expand');
let sgRowsAfter = sgRowsBefore;
for (let i = 0; i < 60; i++) {
  sgRowsAfter = document.querySelectorAll('.bo-grid .row:not(.treeloading)').length;
  if (sgRowsAfter > sgRowsBefore && !document.querySelector('.bo-grid .row.treeloading')) break;
  await wait(25);
}
if (!(sgRowsAfter > sgRowsBefore)) fail(`server groups: rows did not load on expand (${sgRowsBefore} → ${sgRowsAfter})`);

// Row reorder: drag the first row's handle and drop it onto a later row.
await solo('tasks', '.bo-grid .row .drag-handle', 'Tasks drag handle did not render');
const taskFirstBefore = document.querySelector('.bo-grid .row .c').textContent.trim();
const taskRows = document.querySelectorAll('.bo-grid .row');
taskRows[0].querySelector('.drag-handle').dispatchEvent(new window.Event('dragstart', { bubbles: true }));
await wait(10);
taskRows[2].dispatchEvent(new window.Event('dragover', { bubbles: true, cancelable: true }));
taskRows[2].dispatchEvent(new window.Event('drop', { bubbles: true }));
await wait(30);
const taskFirstAfter = document.querySelector('.bo-grid .row .c').textContent.trim();
if (taskFirstAfter === taskFirstBefore) fail(`row reorder did not change the order (still "${taskFirstAfter}")`);

// Big data: a 1,000,000-row windowed source. Assert real (non-skeleton) rows
// load after the simulated latency and the scrollbar reflects the full total.
await solo('bigdata'); // detaches the previous example, then mounts the 1M-row grid
// Poll until the windowed source has resolved its total (spacer height grows to
// cover all 1,000,000 rows) — total lands a tick after the first window.
const bigHeightOf = () => parseInt(document.querySelector('.bo-grid .spacer')?.style.height || '0', 10);
let bigHeight = 0;
for (let i = 0; i < 80; i++) {
  bigHeight = bigHeightOf();
  if (bigHeight > 1_000_000) break;
  await wait(25);
}
const bigRows = document.querySelectorAll('.bo-grid .row:not(.skeleton)').length;
// 1,000,000 rows × 36px ≈ 36,000,000px of virtual scroll height.
if (bigHeight < 1_000_000) fail(`1M-rows scroll height too small for the dataset (${bigHeight}px)`);
if (bigRows === 0) fail('1M-rows example loaded no windowed rows');

// Code view: an example's switch shows its own source (lazy-loaded) and keeps
// the preview mounted, hidden, so it comes back as it was.
{
  const section = document.querySelector('#ex-bigdata');
  const [previewBtn, codeBtn] = section.querySelectorAll('.lp-ex-switch button');
  codeBtn.click();
  let code = '';
  for (let i = 0; i < 80 && !code; i++) {
    await wait(25);
    code = section.querySelector('.lp-ex-code pre')?.textContent ?? '';
  }
  if (!code.includes('<Grid')) fail('Code view did not show the example source');
  if (!section.querySelector('.lp-ex-body').hidden) fail('Code view left the preview showing');
  previewBtn.click();
  await wait(20);
  if (section.querySelector('.lp-ex-body').hidden || section.querySelector('.lp-ex-code')) fail('Preview did not come back from the code view');
  if (!section.querySelector('.bo-grid .row')) fail('The preview grid did not survive the code view');
}

console.log(
  `✓ smoke: grid mounted — ${rowCount} rows, ${canvases} sparklines; ` +
    `multi-sort 2 keys; selection ${selCount} cells + agg bar; grouping ${groupHeaders} headers, ` +
    `edit committed + validate; variable heights ${rowHeights.join('/')}; ` +
    `paste + resize committed (+onColumnResize); collapse ${heightBefore}→${heightAfter}px; server loaded ${dataRows} rows; ` +
    `${stickyHeaders} pinned columns (+right); pivot ${pivotHeaders.length} cols; ` +
    `gallery: portfolio ${portfolioRows} rows/${portfolioGroups} groups + header-groups + ctx-menu + ${cfBars} data-bars/${cfIcons} icons/${cfScale} scale + computed-col, sheet ${sheetRows} rows (light) + select-edit + row-select + col-hide + col-filter + empty-msg + master-detail + cell-class + pagination, ` +
    `orderbook ${obAsk}↑/${obBid}↓ + ${obDepth} depth bars + ${obDirected} derived flashes + group/side-by-side ${obPairs} pairs (createOrderBook), vnboard ${vnRows} rows + ${vnSession.textContent?.trim()} session (bo-grid/trading), ladder ${ladderRowsInitial} prices + wheel/follow/click-to-buy ok, orders ${ordersBadges} chips + positions footer + C cancels the focused order, fxcrypto ${fxPips} pip quotes + continuous crypto, timesales ${tsRows} trades (capped, newest-first), correlation ${heatCells} heat cells/${corrPinned} pinned, blotter ${blotRuns.length} runs/${blotCovers} covers/${blotColSpans} col-spans, leaderboard ${lbBars} bars/${lbPodium} podium/${lbPinned} pinned, wide ${wideHeaders} cols/${widePinned} pinned (col-virt), themes 8 presets (midnight→terminal), csv ${csvRows}→${csvAfter} rows + json ${csvJson} + auto ${csvAuto} (csv/tsv/json/auto import), print ${printGridRows} virt/${printPreviewRows} all-rows, tree ${treeRootsCount}→${treeAfter} on expand +kbd-collapse, lazytree ${lazyRootsCount}→${lazyAfter} async-load, servergroups ${sgGroups} groups→${sgRowsAfter} rows on expand, tasks row-reorder ok, bigdata ${bigRows} windowed rows over ${bigHeight.toLocaleString()}px; ` +
    `keyboard Home/End/Ctrl+Home ok; loading overlay ok; a11y rowcount/activedescendant ok; code view ok`,
);
process.exit(0);
