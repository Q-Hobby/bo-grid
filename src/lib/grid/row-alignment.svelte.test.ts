// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

// Every row kind lines its cells up under the column headers: group rows and
// header groups take the same widths as the header cells, in every layout.
let grid: MountedGrid | null = null;
afterEach(() => {
  grid?.destroy();
  grid = null;
});

const rows: GridRow[] = [
  { id: 1, sym: 'AAA', sector: 'Bank', px: 10 },
  { id: 2, sym: 'BBB', sector: 'Tech', px: 20 },
];
const widthOf = (style: string | null) => /flex:\s*([^;]+);/.exec(style ?? '')?.[1]?.trim();

describe('group rows', () => {
  it('size their cells as the headers do when the layout sets the widths (pinned columns)', () => {
    const columns: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym', width: 80, pinned: true },
      { type: 'number', key: 'px', header: 'Px', flex: 1, groupAgg: 'sum' },
      { type: 'text', key: 'sector', header: 'Sector', width: 90 },
    ];
    grid = mountGrid({ rows, columns, groupBy: ['sector'] });
    const heads = [...grid.target.querySelectorAll('[role=columnheader]')].map((h) => widthOf(h.getAttribute('style')));
    const group = grid.target.querySelector('.grouprow .group')!;
    const cells = [group.querySelector('.gcell'), ...group.querySelectorAll('.agg')].map((c) => widthOf(c!.getAttribute('style')));
    expect(cells).toEqual(heads);
    // The pinned column's group cell stays put with it.
    expect(group.querySelector('.gcell')!.getAttribute('style')).toMatch(/position:\s*sticky/);
  });
});

describe('header groups', () => {
  it('span their columns in the default layout too, flex columns included', () => {
    const columns: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym', width: 100, group: 'Holding' },
      { type: 'text', key: 'sector', header: 'Sector', flex: 1, group: 'Holding' },
      { type: 'number', key: 'px', header: 'Px', width: 80 },
    ];
    grid = mountGrid({ rows, columns });
    const bands = [...grid.target.querySelectorAll('.head-groups .hg')].map((b) => widthOf(b.getAttribute('style')));
    // One band over Sym + Sector grows with the flex column; Px stays 80px.
    expect(bands).toEqual(['1 1 100px', '0 0 80px']);
  });
});
