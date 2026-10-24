<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  let tasks = $state([
    { id: 1, title: 'Wire up the login flow', owner: 'Ava', priority: 'High' },
    { id: 2, title: 'Design the empty states', owner: 'Mia', priority: 'Medium' },
    { id: 3, title: 'Fix the pager off-by-one', owner: 'Noah', priority: 'High' },
    { id: 4, title: 'Write the API docs', owner: 'Zoe', priority: 'Low' },
    { id: 5, title: 'Profile the slow query', owner: 'Ravi', priority: 'High' },
    { id: 6, title: 'Ship the release notes', owner: 'Lena', priority: 'Low' },
  ]);

  // Sorting would fight the hand-made order, so the columns don't sort.
  const columns: ColumnDef[] = [
    { type: 'text', key: 'title', header: 'Task', flex: 1, sortable: false },
    { type: 'text', key: 'owner', header: 'Owner', width: 110, sortable: false },
    { type: 'text', key: 'priority', header: 'Priority', width: 100, sortable: false },
  ];

  // The grid reports where a row moved; the app moves it in its own array.
  function reorder(from: number, to: number): void {
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    tasks = next;
  }
</script>

<Grid rows={tasks} {columns} onRowReorder={reorder} height={250} />
