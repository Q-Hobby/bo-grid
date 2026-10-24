<script lang="ts">
  import { Grid, type CellTypeDef, type ColumnDef, type GridRow } from '../../lib';
  import CountryCell from './cells/CountryCell.svelte';
  import RatingEditor from './cells/RatingEditor.svelte';
  import { bandFilter } from './filters/workloadBand';
  import { ui } from '../theme.svelte';

  // A people/CRM board — shows bo-grid is a general business grid, not just
  // fintech: avatar, link, relative time, currency, status badge, progress,
  // rating, tags and a boolean.
  interface Member extends GridRow {
    name: string;
    email: string;
    role: string;
    status: string;
    lastActive: number;
    rate: number;
    workload: number;
    rating: number;
    skills: string[];
    remote: boolean;
    country: string;
    note: string;
  }

  const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ravi', 'Yuki', 'Omar', 'Lena', 'Theo', 'Ines', 'Kai'];
  const LAST = ['Chen', 'Patel', 'Kim', 'Garcia', 'Nguyen', 'Haddad', 'Rossi', 'Silva', 'Okafor', 'Novak'];
  const ROLES = ['Engineer', 'Designer', 'PM', 'Analyst', 'Researcher', 'Writer'];
  const STATUS = ['Active', 'Away', 'Offline'];
  const COUNTRIES = ['VN', 'SG', 'JP', 'DE', 'US', 'IN', 'BR'];
  const SKILLS = ['TypeScript', 'Svelte', 'Design', 'SQL', 'Rust', 'Figma', 'Python', 'Go', 'CSS', 'Data viz'];
  // Deliberately long so the Notes column truncates with an ellipsis and reveals
  // the full text in the styled floating tooltip on hover.
  const NOTES = [
    'Leading the Q3 platform migration; pairing with the data team on the new ingestion pipeline.',
    'On rotation for on-call this week — slower to respond on non-urgent threads.',
    'Owns the design system refresh; gathering feedback before the component freeze.',
    'Back from leave Monday; ramping on the billing rewrite and the new pricing model.',
    'Driving the accessibility audit; tracking 40+ open issues across the dashboard surfaces.',
  ];

  function build(n: number): Member[] {
    const now = Date.now();
    return Array.from({ length: n }, (_, id) => {
      const skills = [...new Set([SKILLS[(id * 3) % SKILLS.length], SKILLS[(id * 7) % SKILLS.length]])];
      const first = FIRST[(id * 7) % FIRST.length];
      const last = LAST[(id * 13) % LAST.length];
      return {
        id,
        flashSeq: 0,
        flashDir: 'up' as const,
        name: `${first} ${last}`,
        email: `${first}.${last}@acme.io`.toLowerCase(),
        role: ROLES[(id * 5) % ROLES.length],
        status: STATUS[(id * 2) % STATUS.length],
        // Spread from a few minutes to ~3 days ago (deterministic).
        lastActive: now - (((id * 37) % 4320) + 3) * 60_000,
        rate: 60 + ((id * 11) % 120), // hourly rate
        workload: 18 + ((id * 17) % 80),
        rating: 1 + ((id * 3) % 5),
        skills,
        remote: id % 3 !== 0,
        country: COUNTRIES[(id * 5) % COUNTRIES.length],
        note: NOTES[id % NOTES.length],
      };
    });
  }

  const rows = $state<Member[]>(build(40));
  const gridRows = $derived(rows as unknown as GridRow[]);

  // Toggle the blue range-selection highlight on/off (display vs. spreadsheet feel).
  let cellSelection = $state(true);

  // A registered column type: any column can say `cellType: 'country'` and get
  // the flag renderer, a set filter and a fixed width — defined once.
  const cellTypes: Record<string, CellTypeDef> = {
    country: { extends: 'text', component: CountryCell, filter: 'set', width: 140 },
  };
  // A registered filter kind: the Workload column filters by capacity band
  // with its own editor inside the standard filter menu.
  const filterTypes = { band: bandFilter };

  const columns: ColumnDef[] = [
    // Pinned so the wide board scrolls horizontally with the person in view.
    // `tooltip: true` reveals the full name + role if the cell ever truncates.
    { type: 'avatar', key: 'name', sub: 'role', header: 'Member', width: 200, pinned: true, tooltip: true },
    { type: 'link', key: 'email', header: 'Email', width: 196, href: (row) => `mailto:${row.email}` },
    {
      type: 'badge',
      key: 'status',
      header: 'Status',
      width: 104,
      tones: { Active: 'up', Away: 'amber', Offline: 'neutral' },
      // Function tooltip: custom text built from other fields on the row.
      tooltip: (value, row) => `${value} · ${row.role} · ${row.remote ? 'Remote' : 'Office'}`,
    },
    { cellType: 'country', key: 'country', header: 'Country' },
    { type: 'relative', key: 'lastActive', header: 'Last active', width: 124 },
    {
      type: 'currency',
      key: 'rate',
      header: 'Rate/hr',
      width: 96,
      currency: 'USD',
      decimals: 0,
      headerTooltip: 'Billable rate in USD, excluding taxes and platform fees.',
      headerInfo: true,
    },
    {
      type: 'progress',
      key: 'workload',
      header: 'Workload',
      width: 140,
      filter: 'band',
      min: 0,
      max: 100,
      headerTooltip: 'Share of capacity allocated this sprint (0–100%).',
      headerInfo: true,
    },
    // A custom editor makes the display-only rating widget editable.
    { type: 'rating', key: 'rating', header: 'Rating', width: 110, max: 5, editable: true, editor: RatingEditor },
    // Long free text in a narrow column: truncates with an ellipsis, full text
    // on hover via the styled floating tooltip.
    { type: 'text', key: 'note', header: 'Notes', width: 220, tooltip: true },
    { type: 'tags', key: 'skills', header: 'Skills', flex: 1, minWidth: 160 },
    { type: 'boolean', key: 'remote', header: 'Remote', width: 104, trueLabel: 'Remote', falseLabel: 'Office' },
  ];
</script>

<div class="gridwrap">
  <label class="opt">
    <input type="checkbox" bind:checked={cellSelection} />
    Cell selection ({cellSelection ? 'on' : 'off'})
  </label>
  <Grid
    fitColumns
    rows={gridRows}
    {columns}
    {cellTypes}
    {filterTypes}
    onCellEdit={(e) => ((e.row as Record<string, unknown>)[e.column.key] = e.value)}
    {cellSelection}
    theme={ui.grid}
    filterMenu
    columnMenu
    height={560}
    ariaLabel="Team directory"
  />
</div>

<style>
  .gridwrap {
    max-width: 920px;
  }
  .opt {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--text-dim, #8a8a8a);
    cursor: pointer;
  }
</style>
