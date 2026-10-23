import type { GridRow } from './column';

export interface GroupNode {
  /** Unique path, e.g. "Tech" or "Tech/NYSE" for nested groups. */
  path: string;
  /** Nesting level, 0 = outermost. */
  depth: number;
  /** The group key value (stringified). */
  value: string;
  /** All leaf data rows under this group (across nested sub-groups). */
  rows: GridRow[];
  count: number;
  collapsed: boolean;
  /** Server-provided aggregate display strings, keyed by column key (lazy groups).
      When present, the group header shows these instead of computing from `rows`. */
  aggText?: Record<string, string>;
}

/** A server-side group summary (lazy grouping): the header data without the leaf
    rows, which load on expand via `loadGroup`. */
export interface LazyGroup {
  key: string;
  /** Header label (defaults to `key`). */
  label?: string;
  count?: number;
  /** Preformatted aggregate strings keyed by column key, shown in the header. */
  agg?: Record<string, string>;
}

export type VisualRow =
  | { kind: 'data'; row: GridRow; depth?: number; hasChildren?: boolean }
  | { kind: 'group'; group: GroupNode }
  // A placeholder under an expanded tree node whose children are loading (async).
  | { kind: 'treeloading'; depth: number };

/**
 * Flatten data rows into the visual row list the grid renders: a stream of
 * group-header rows interleaved with their data rows, honoring collapse state.
 * Collapsed groups omit their children entirely. Reads only the group-key
 * fields (which are static), so a realtime tick never rebuilds this list.
 *
 * Group headers are the same height as data rows, so the uniform-height virtual
 * scroller works unchanged — it just windows over a longer mixed list.
 */
export function buildFlatRows(
  rows: GridRow[],
  groupBy: string[],
  collapsed: ReadonlySet<string>,
): VisualRow[] {
  if (groupBy.length === 0) return rows.map((row) => ({ kind: 'data', row }) as VisualRow);

  const out: VisualRow[] = [];

  const recurse = (subset: GridRow[], depth: number, parentPath: string): void => {
    const key = groupBy[depth];
    const buckets = new Map<string, GridRow[]>();
    for (const row of subset) {
      const gv = String(row[key] ?? '');
      const arr = buckets.get(gv);
      if (arr) arr.push(row);
      else buckets.set(gv, [row]);
    }

    for (const gv of [...buckets.keys()].sort()) {
      const groupRows = buckets.get(gv)!;
      const path = parentPath ? `${parentPath}/${gv}` : gv;
      const isCollapsed = collapsed.has(path);
      out.push({
        kind: 'group',
        group: { path, depth, value: gv, rows: groupRows, count: groupRows.length, collapsed: isCollapsed },
      });
      if (isCollapsed) continue;
      if (depth + 1 < groupBy.length) recurse(groupRows, depth + 1, path);
      else for (const row of groupRows) out.push({ kind: 'data', row });
    }
  };

  recurse(rows, 0, '');
  return out;
}

/**
 * The chain of group nodes (outermost → innermost) that the row at `idx` belongs
 * to. Used to render sticky group headers: scan backward from idx, taking the
 * nearest preceding header at each depth until the depth-0 group is found.
 */
export function activeGroupsAt(flat: VisualRow[], idx: number): GroupNode[] {
  const found = new Map<number, GroupNode>();
  for (let i = Math.min(idx, flat.length - 1); i >= 0; i--) {
    const item = flat[i];
    if (item.kind !== 'group') continue;
    if (!found.has(item.group.depth)) found.set(item.group.depth, item.group);
    if (item.group.depth === 0) break;
  }
  return [...found.values()].sort((a, b) => a.depth - b.depth);
}

/** How lazy grouping reads expand/loading state and the rows loaded per group. */
export interface LazyGroupAccess {
  isExpanded: (key: string) => boolean;
  /** Loaded leaf rows for a group, or undefined when not yet loaded. */
  rowsOf: (key: string) => readonly GridRow[] | undefined;
  isLoading: (key: string) => boolean;
}

/**
 * Flatten server-side group summaries into visual rows: a group header per group,
 * then — when expanded — its loaded leaf rows, or a single `treeloading`
 * placeholder while they load. Aggregates come from the summary (not computed).
 * Pure; unit-tested.
 */
export function buildLazyGroupRows(groups: readonly LazyGroup[], access: LazyGroupAccess): VisualRow[] {
  const out: VisualRow[] = [];
  for (const g of groups) {
    const expanded = access.isExpanded(g.key);
    out.push({
      kind: 'group',
      group: {
        path: g.key,
        depth: 0,
        value: g.label ?? g.key,
        rows: [],
        count: g.count ?? 0,
        collapsed: !expanded,
        aggText: g.agg,
      },
    });
    if (!expanded) continue;
    const loaded = access.rowsOf(g.key);
    if (loaded) for (const row of loaded) out.push({ kind: 'data', row });
    else if (access.isLoading(g.key)) out.push({ kind: 'treeloading', depth: 1 });
  }
  return out;
}
