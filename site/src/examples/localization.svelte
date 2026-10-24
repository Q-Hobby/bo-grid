<script lang="ts">
  import { Grid, type ColumnDef, type GridLabels } from 'bo-grid';
  import { quotes } from './data';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Mã', width: 90 },
    { type: 'text', key: 'name', header: 'Công ty', width: 160 },
    { type: 'price', key: 'price', header: 'Giá' },
    { type: 'percent', key: 'change', header: '+/- %' },
    { type: 'volume', key: 'volume', header: 'Khối lượng', flex: 1 },
  ];
  let rows = $state(quotes());

  // Only the strings that change; the rest stay English. Interpolated
  // entries are functions, so a translation can reorder the parts.
  const labels: Partial<GridLabels> = {
    apply: 'Áp dụng',
    clear: 'Xóa',
    rowsPerPage: 'Số dòng mỗi trang',
    previous: '‹ Trước',
    next: 'Sau ›',
    firstPage: 'Trang đầu',
    lastPage: 'Trang cuối',
    noRows: 'Không có dòng nào khớp',
    filterFor: (h) => `Lọc cột ${h}`,
    pageOf: (p, n, total, locale) => `Trang ${p} / ${n} · ${total.toLocaleString(locale)} dòng`,
  };
</script>

<Grid {rows} {columns} height={180} locale="vi-VN" {labels} filterMenu pageSize={5} />
