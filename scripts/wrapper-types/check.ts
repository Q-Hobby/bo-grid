// Type check of the published wrapper declarations (dist/*.d.ts), run by
// `pnpm smoke:wc` after a build. The @ts-expect-error lines fail the check if
// a type ever turns into `any`.
import { createElement, createRef } from 'react';
import { BoGrid as ReactGrid } from 'bo-grid/react';
import { BoGrid as VueGrid } from 'bo-grid/vue';
import type { GridApi } from 'bo-grid';

const api = createRef<GridApi>();
createElement(ReactGrid, { ref: api, rows: [], columns: [], height: 300, className: 'x', style: { height: 300 }, onCellEdit: (e) => e.value });
// @ts-expect-error not a grid prop
createElement(ReactGrid, { rows: [], columns: [], nope: true });
// @ts-expect-error rows is an array
createElement(ReactGrid, { rows: 5, columns: [] });

declare const vue: InstanceType<typeof VueGrid>;
vue.api?.patchRows([[1, { px: 2 }]]);
// @ts-expect-error not a GridApi method
vue.api?.nope();
