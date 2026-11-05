'use client';
import {useLocalization as useUiLocalization} from '@/localization/provider';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAuth } from './auth-provider';
import { collectListingRows, listingCanFetchAll, listingRows } from '@/lib/listing-export-source';
import { listingExportColumns } from '@/lib/listing-export-columns';
import styles from './listing-excel-export.module.css';

// Listing-table toolbar only. Do not mount in detail dialogs, profile cards,
// document line items, timelines or card-only settings panels.
export function ListingExcelExport({ data, title = 'records', columns, disabled = false, currentRows }) {
 const {t: _uiText}=useUiLocalization();

  const { activeTenantId, user } = useAuth();
  const id = useId(), running = useRef(null);
  const placement = useRef(null);
  const [listingPlacement, setListingPlacement] = useState(false);
  const [scope, setScope] = useState('all'), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const paginated = listingCanFetchAll(data), rows = listingRows(data);
  // Enforce the listing-only contract even when a shared table is reused in a modal.
  // Read the actual DOM ancestry so this also covers React portals.
  useLayoutEffect(() => {
    setListingPlacement(Boolean(placement.current && !placement.current.closest(
      'dialog, [role="dialog"], [role="alertdialog"], [class*="dialog-backdrop"]'
    )));
  }, []);
  useEffect(() => {
    setNotice(''); setError('');
    return () => { running.current?.abort(); };
  }, [data, activeTenantId, user?.id]);
  async function download() {
    if (!listingPlacement || running.current || !rows.length || disabled) return;
    const controller = new AbortController(); running.current = controller;
    setBusy(true); setError(''); setNotice('Retrieving rows…');
    try {
      const records = scope === 'page' && currentRows ? currentRows : await collectListingRows(data, { all: scope === 'all', signal: controller.signal,
        onProgress: (count, total) => setNotice(`Retrieved ${count.toLocaleString('en-IN')}${total == null ? '' : ` of ${total.toLocaleString('en-IN')}`} rows…`) });
      if (!records.length) throw new Error('No records match these filters now. Refresh the listing.');
      const selectedColumns = columns || listingExportColumns(records);
      if (!selectedColumns.length) throw new Error('Export columns have not been configured for this listing.');
      setNotice('Preparing Excel file…');
      const { createListingWorkbook, downloadListingWorkbook } = await import('@/lib/excel-workbook');
      const buffer = await createListingWorkbook({ rows: records, columns: selectedColumns, title, signal: controller.signal });
      controller.signal.throwIfAborted();
      downloadListingWorkbook(buffer, title);
      setNotice(`Downloaded ${records.length.toLocaleString('en-IN')} ${title}.`);
    } catch (failure) {
      if (controller.signal.aborted) setNotice('Export cancelled. No file downloaded.');
      else { setNotice(''); setError(failure.message || 'The Excel export could not be prepared.'); }
    } finally {
      if (running.current === controller) { running.current = null; setBusy(false); }
    }
  }
  return <div ref={placement} className={styles.export} hidden={!listingPlacement}>
    {listingPlacement && <>
    <div className={styles.controls}>
      {(paginated || currentRows) && <label className={styles.scope} htmlFor={id}><span className="sr-only">Export scope for {title}</span><select id={id} disabled={busy || disabled} value={scope} onChange={event => setScope(event.target.value)}><option value="all">All filtered rows</option><option value="page">Current page</option></select></label>}
      <button className={`button ${styles.button} ${styles.exportButton}`} type="button" disabled={busy || disabled || !rows.length} aria-describedby={`${id}-status`} onClick={download} aria-label={`Export ${title} to Excel`}><FileSpreadsheet aria-hidden="true" size={17}/>{busy ? 'Exporting…' : _uiText("Export Excel")}</button>
      {busy && <button type="button" className={`button button-secondary ${styles.button}`} onClick={() => running.current?.abort()}>Cancel export</button>}
    </div>
    <span id={`${id}-status`} className={styles.status} role={error ? 'alert' : 'status'}>{error || notice}</span>
    </>}
  </div>;
}
