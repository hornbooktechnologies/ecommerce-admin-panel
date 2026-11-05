// Ephemeral metadata only. Nothing is added to API JSON or browser storage.
const sources = new WeakMap();
const at = (value, path) => path.reduce((current, key) => current?.[key], value);
const collections = ['items', 'rows', 'entries'];
export const EXPORT_ROW_LIMIT = 10000;

export function rememberListingSource(data, fetchPage) {
  if (!data || typeof data !== 'object') return;
  function visit(value, path = [], parent = null) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      sources.set(value, { fetchPage, path, paginationPath: path.slice(0, -1),
        paginated: Number.isInteger(parent?.page) && Number.isInteger(parent?.pageSize) && Number.isFinite(parent?.total) });
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key], value);
    const key = collections.find(key => Array.isArray(value[key]));
    if (key) sources.set(value, sources.get(value[key]));
  }
  visit(data);
}

export function listingRows(data) {
  if (Array.isArray(data)) return data;
  const key = collections.find(key => Array.isArray(data?.[key]));
  return key ? data[key] : [];
}

export function listingCanFetchAll(data) { return Boolean(sources.get(data)?.paginated); }

export async function collectListingRows(data, { all = true, signal, onProgress = () => {} } = {}) {
  signal?.throwIfAborted();
  const source = sources.get(data);
  if (!all || !source?.paginated) {
    const rows = listingRows(data);
    if (rows.length > EXPORT_ROW_LIMIT) throw new Error('Use filters to export no more than 10,000 rows at a time.');
    onProgress(rows.length);
    return rows;
  }
  const rows = [], seen = new Set();
  let expectedTotal = null;
  // Keep the original page size: endpoint-specific validation is not bypassed.
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const payload = await source.fetchPage(page, signal);
    signal?.throwIfAborted();
    const pagination = at(payload, source.paginationPath);
    const batch = at(payload, source.path);
    if (!Array.isArray(batch) || pagination?.page !== page || !Number.isInteger(pagination?.total)) {
      throw new Error('This listing could not be exported completely. Refresh and try again.');
    }
    if (expectedTotal === null) expectedTotal = pagination.total;
    if (expectedTotal > EXPORT_ROW_LIMIT) throw new Error('More than 10,000 rows match. Narrow the filters before exporting.');
    if (pagination.total !== expectedTotal) throw new Error('The listing changed during export. Refresh and try again.');
    for (const row of batch) {
      if (row.id) {
        if (seen.has(row.id)) throw new Error('The listing changed during export. Refresh and try again.');
        seen.add(row.id);
      }
      rows.push(row);
    }
    if (rows.length > expectedTotal || rows.length > EXPORT_ROW_LIMIT) throw new Error('The listing changed during export. Refresh and try again.');
    onProgress(rows.length, expectedTotal);
    if (rows.length === expectedTotal) return rows;
    if (!batch.length || page >= (pagination.totalPages || Math.ceil(expectedTotal / pagination.pageSize))) {
      throw new Error('Some rows could not be retrieved. No partial file was downloaded.');
    }
  }
}
