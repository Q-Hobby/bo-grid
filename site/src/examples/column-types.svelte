<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';
  import { team } from './team-data';

  // Rich types draw the value as a widget; each still sorts, filters,
  // copies and exports by the plain value.
  const columns: ColumnDef[] = [
    { type: 'avatar', key: 'name', header: 'Member', sub: 'role', width: 150 },
    { type: 'badge', key: 'status', header: 'Status', width: 88, tones: { Active: 'up', Away: 'amber', Offline: 'neutral' } },
    { type: 'progress', key: 'workload', header: 'Workload', min: 0, max: 100, width: 90 },
    { type: 'rating', key: 'rating', header: 'Rating', max: 5, width: 90 },
    { type: 'tags', key: 'skills', header: 'Skills', width: 140 },
    { type: 'link', key: 'email', header: 'Email', href: (r) => `mailto:${r.email}`, flex: 1 },
  ];

  let rows = $state(team());
</script>

<Grid {rows} {columns} height={256} />
