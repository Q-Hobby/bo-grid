// The <Grid> props that take a boolean (alone or with a number), so the Vue
// wrapper can read a bare attribute (`<BoGrid footer />`, which Vue passes as
// '') as true, as Vue does for a declared Boolean prop. booleans.test.ts
// checks this list against the props.
export const BOOLEAN_PROPS: ReadonlySet<string> = new Set([
  'resizable',
  'cellSelection',
  'rowSelection',
  'columnMenu',
  'columnsPanel',
  'virtualizeColumns',
  'footer',
  'filterRow',
  'filterMenu',
  'quickFilter',
  'fillHandle',
  'liveSort',
  'pauseOnHover',
  'flashNewRows',
  'columnHover',
  'rowNumbers',
  'rowPinning',
  'findBar',
  'fitColumns',
  'loading',
]);
