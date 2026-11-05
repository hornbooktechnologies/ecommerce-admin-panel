const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const valueAt = (row, path) => path.split('.').reduce((current, key) => current?.[key], row);
function plainText(value) {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join(' ');
  // Dashboard cells can contain React text elements, never arbitrary JSON.
  if (value && typeof value === 'object' && value.props && value.$$typeof) return plainText(value.props.children);
  return '';
}
function cellValue(value, column) {
  if (value == null || value === '') return null;
  if (column.type === 'number') {
    if ((typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) && Math.abs(Number(value)) < 1e15) return Number(value);
    return String(value).slice(0, 32767);
  }
  if (column.type === 'date') {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
    return String(value).slice(0, 32767);
  }
  if (typeof value === 'boolean') return value;
  // Always a string, never a formula/hyperlink object (including leading =,+,-,@).
  return plainText(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 32767);
}

export async function createListingWorkbook({ rows, columns, title, signal, onProgress = () => {} }) {
  signal?.throwIfAborted();
  // Browser-only bundle is lazy-loaded. No Node filesystem code in the page bundle.
  const module = await import('write-excel-file/browser');
  signal?.throwIfAborted();
  const writeExcelFile = module.default;
  const widths = columns.map(column => ({ width: Math.max(14, Math.min(44, column.label.length + 4)) }));
  const sheetData = [columns.map(column => ({ value: column.label, type: String,
    fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#1F6D52', wrap: true, height: 30 }))];
  for (let index = 0; index < rows.length; index++) {
    signal?.throwIfAborted();
    const values = columns.map(column => cellValue(column.value ? column.value(rows[index]) : valueAt(rows[index], column.key), column));
    sheetData.push(values.map((value, columnIndex) => ({ value,
      type: value instanceof Date ? Date : typeof value === 'number' ? Number : typeof value === 'boolean' ? Boolean : String,
      // Nullable dates and invalid/oversized numeric fallbacks are text cells.
      // The workbook format must follow the actual value type, not only metadata.
      format: value instanceof Date ? columns[columnIndex].format || 'dd mmm yyyy hh:mm'
        : typeof value === 'number' ? columns[columnIndex].format || '#,##0.##'
        : typeof value === 'boolean' ? undefined : '@',
      wrap: true, alignVertical: 'top' })));
    values.forEach((value, columnIndex) => {
      const length = value instanceof Date ? 20 : String(value ?? '').length;
      widths[columnIndex].width = Math.max(widths[columnIndex].width, Math.min(44, length + 2));
    });
    if (index % 200 === 0) { onProgress(index + 1, rows.length); await pause(); }
  }
  signal?.throwIfAborted();
  const blob = await writeExcelFile(sheetData, {
    sheet: String(title || 'Records').replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || 'Records',
    columns: widths, stickyRowsCount: 1, dateFormat: 'dd mmm yyyy hh:mm'
  }, { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
  signal?.throwIfAborted();
  return blob;
}

export function downloadListingWorkbook(buffer, title) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  const filename = String(title || 'records').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'records';
  link.href = url; link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
