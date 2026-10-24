import type { CustomFilter, FilterTypeDef } from 'bo-grid';
import MoveEditor from './custom-filters-editor.svelte';

export type Move = 'down' | 'flat' | 'up';

/** A registered filter: a plain object with a `kind`, so it saves and restores like any other. */
export interface MoveFilter extends CustomFilter {
  kind: 'move';
  moves: Move[];
}

export const MOVES: { id: Move; label: string }[] = [
  { id: 'down', label: 'Down more than 0.5%' },
  { id: 'flat', label: 'Within ±0.5%' },
  { id: 'up', label: 'Up more than 0.5%' },
];

const moveOf = (pct: number): Move => (pct < -0.5 ? 'down' : pct > 0.5 ? 'up' : 'flat');

export const move: FilterTypeDef<MoveFilter> = {
  component: MoveEditor,
  isActive: (f) => f.moves.length > 0,
  test: (value, f) => f.moves.includes(moveOf(Number(value))),
};
