"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, Download, FileCheck2, FileSpreadsheet,
  PackageCheck, RefreshCcw, Rocket, Send, UploadCloud, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { bulkErrorReportRequest, bulkExportRequest, bulkProductPublishRequest, bulkProductStatusRequest,
  bulkTemplateRequest, bulkImportJobRequest, commitBulkImportRequest, listBulkImportJobsRequest, listCatalogProductsRequest,
  validateBulkImportRequest } from "@/lib/api-client";

const types = {
  PRODUCT: { label: "Products", permission: "catalog.product.create", hint: "Create new products and their first priced variant." },
  PRICING: { label: "Pricing", permission: "catalog.offer.manage", hint: "Update offer MRP, selling price, cost, and status." },
  INVENTORY: { label: "Inventory", permission: "inventory.stock.manage", hint: "Receive stock with batch, expiry, and serial traceability." }
};
const statusTone = { READY: "positive", COMPLETED: "positive", VALIDATED_WITH_ERRORS: "danger",
  COMPLETED_WITH_ERRORS: "warning", VALIDATING: "warning", COMMITTING: "warning" };
const title = (value) => String(value || "").toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function saveFile(file) {
  const url = URL.createObjectURL(file.blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = file.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
}

function Summary({ job }) {
  return <div className="bulk-validation-summary" aria-label="Import validation summary">
    <span><FileSpreadsheet aria-hidden="true" size={18} /><small>Rows</small><strong>{job.totalRows}</strong></span>
    <span data-tone="positive"><CheckCircle2 aria-hidden="true" size={18} /><small>Valid</small><strong>{job.validRows}</strong></span>
    <span data-tone={job.invalidRows ? "danger" : "neutral"}><XCircle aria-hidden="true" size={18} /><small>Errors</small><strong>{job.invalidRows}</strong></span>
    <span><PackageCheck aria-hidden="true" size={18} /><small>Committed</small><strong>{job.committedRows || 0}</strong></span>
  </div>;
}

export default function BulkOperationsPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const allowedTypes = useMemo(() => Object.entries(types).filter(([, item]) => canUser(user, "admin", item.permission, tenantId)), [tenantId, user]);
  const [type, setType] = useState(allowedTypes[0]?.[0] || "PRODUCT"); const [file, setFile] = useState(null);
  const [job, setJob] = useState(null); const [jobs, setJobs] = useState(null); const [busy, setBusy] = useState("");
  const [error, setError] = useState(""); const [jobFilters, setJobFilters] = useState({ page: 1, pageSize: 10 });
  const [mode, setMode] = useState("import"); const [products, setProducts] = useState(null); const [selected, setSelected] = useState([]);
  const [productPage, setProductPage] = useState(1); const [productPageSize, setProductPageSize] = useState(10); const fileInput = useRef(null);
  const [resumeConfirmed, setResumeConfirmed] = useState(false);
  const reviewPanel = useRef(null);
  const canReadJobs = canUser(user, "admin", "bulk.read", tenantId);
  const canUpdateProducts = canUser(user, "admin", "catalog.product.update", tenantId);
  const canPublishProducts = canUser(user, "admin", "catalog.product.approve", tenantId);
  const canImportCurrent = allowedTypes.some(([key]) => key === type);

  const loadJobs = useCallback(async () => {
    if (!tenantId || !canReadJobs) return;
    try { setJobs(await listBulkImportJobsRequest(jobFilters, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Import history could not be loaded."); }
  }, [accessToken, canReadJobs, jobFilters, tenantId]);
  const loadProducts = useCallback(async () => {
    if (!tenantId || mode !== "status") return;
    try { setProducts(await listCatalogProductsRequest({ search: "", status: "ALL", vertical: "ALL", page: productPage, pageSize: productPageSize }, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Products could not be loaded."); }
  }, [accessToken, mode, productPage, productPageSize, tenantId]);
  useEffect(() => { loadJobs(); }, [loadJobs]); useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (allowedTypes.length && !allowedTypes.some(([key]) => key === type)) setType(allowedTypes[0][0]);
  }, [allowedTypes, type]);
  useEffect(() => { setJob(null); setFile(null); setResumeConfirmed(false); }, [tenantId]);

  async function download(kind) {
    setBusy(kind); setError("");
    try { saveFile(kind === "template" ? await bulkTemplateRequest(type, accessToken, tenantId)
      : await bulkExportRequest(type, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "The CSV could not be downloaded."); }
    finally { setBusy(""); }
  }
  async function validate() {
    if (!file) { setError("Choose a CSV file first."); return; }
    setBusy("validate"); setError("");
    try { const csv = await file.text(); const next = await validateBulkImportRequest(type, { fileName: file.name, csv }, accessToken, tenantId);
      setJob(next); await loadJobs(); }
    catch (requestError) { setError(requestError.message || "The CSV could not be validated."); }
    finally { setBusy(""); }
  }
  async function commit() {
    if (!job || (job.canResume && !resumeConfirmed)) return;
    setBusy("commit"); setError("");
    try { const next = await commitBulkImportRequest(job.type, job.id, accessToken, tenantId); setJob(next); setResumeConfirmed(false); await loadJobs(); }
    catch (requestError) {
      setError(requestError.message || "The request stopped. Refresh this job before retrying; do not upload the file again.");
      try { setJob(await bulkImportJobRequest(job.id, accessToken, tenantId)); } catch { /* Keep the last snapshot and original failure. */ }
      await loadJobs();
    }
    finally { setBusy(""); }
  }
  async function review(jobId) {
    setBusy("review"); setError(""); setResumeConfirmed(false);
    try {
      const next = await bulkImportJobRequest(jobId, accessToken, tenantId); setJob(next); setFile(null);
      requestAnimationFrame(() => {
        reviewPanel.current?.focus({ preventScroll: true });
        reviewPanel.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      });
    }
    catch (requestError) { setError(requestError.message || "The import could not be loaded."); }
    finally { setBusy(""); }
  }
  async function report(jobId) {
    setBusy(`report-${jobId}`); setError("");
    try { saveFile(await bulkErrorReportRequest(jobId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "The error report could not be downloaded."); }
    finally { setBusy(""); }
  }
  async function applyStatus(action) {
    setBusy(action); setError("");
    try {
      const result = action === "publish" ? await bulkProductPublishRequest(selected, accessToken, tenantId)
        : await bulkProductStatusRequest(selected, action, accessToken, tenantId);
      setSelected([]); await loadProducts();
      if (result.failed) setError(`${result.completed} updated; ${result.failed} could not be updated. Review each product's current lifecycle state.`);
    } catch (requestError) { setError(requestError.message || "Products could not be updated."); }
    finally { setBusy(""); }
  }

  const currentMeta = types[type]; const rows = products?.items || [];
  return <AppShell area="admin" currentPath="/admin/bulk-operations" eyebrow="Data operations" title="Bulk operations"
    description="Validate first, review every exception, then commit catalog, pricing, and stock changes.">
    <div className="bulk-mode-tabs" role="tablist" aria-label="Bulk operation mode">
      <button aria-selected={mode === "import"} data-active={mode === "import" || undefined} onClick={() => setMode("import")} role="tab" type="button"><UploadCloud size={17} />CSV import & export</button>
      {(canUpdateProducts || canPublishProducts) ? <button aria-selected={mode === "status"} data-active={mode === "status" || undefined} onClick={() => setMode("status")} role="tab" type="button"><Rocket size={17} />Product lifecycle</button> : null}
    </div>
    {error ? <div className="inline-state inline-state-error" role="alert"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError("")} type="button">Dismiss</button></div> : null}
    {mode === "import" ? <>
      <section className="bulk-console" aria-labelledby="bulk-console-title">
        <div className="bulk-console-head"><div><p className="eyebrow">Staged CSV workflow</p><h2 id="bulk-console-title">Prepare and validate import</h2><p>{currentMeta.hint}</p></div><div className="bulk-download-actions"><button className="button button-secondary" disabled={Boolean(busy) || !canImportCurrent} onClick={() => download("template")} type="button"><Download size={16} />Template</button><button className="button button-secondary" disabled={Boolean(busy) || !canImportCurrent} onClick={() => download("export")} type="button"><Download size={16} />Current export</button></div></div>
        <div className="bulk-type-tabs" role="tablist" aria-label="Import data type">{allowedTypes.map(([key, item]) => <button aria-selected={type === key} data-active={type === key || undefined} key={key} onClick={() => { setType(key); setFile(null); setJob(null); setError(""); }} role="tab" type="button">{item.label}</button>)}</div>
        {!canImportCurrent ? <div className="inline-state"><span>Your role can review import history but cannot create or commit imports.</span></div> : null}
        <div aria-disabled={!canImportCurrent} className="bulk-dropzone" data-has-file={file || undefined}>
          <input accept=".csv,text/csv" disabled={!canImportCurrent} onChange={(event) => { setFile(event.target.files?.[0] || null); setJob(null); }} ref={fileInput} type="file" />
          <span className="bulk-dropzone-icon"><UploadCloud size={25} /></span><div><strong>{file?.name || `Choose ${currentMeta.label.toLowerCase()} CSV`}</strong><small>{file ? `${(file.size / 1024).toFixed(1)} KB · ready for staged validation` : "CSV only · up to 5 MB and 5,000 rows"}</small></div>
          <button className="button button-primary" onClick={(event) => { event.stopPropagation(); if (file) validate(); else fileInput.current?.click(); }} disabled={busy === "validate" || !canImportCurrent} type="button">{busy === "validate" ? "Validating…" : file ? "Validate file" : "Browse file"}</button>
        </div>
        {job ? <div className="bulk-review" ref={reviewPanel} tabIndex={-1} style={{ scrollMarginTop: 100 }} aria-label="Import review" aria-busy={busy === "commit"}><div className="bulk-review-title"><div><p className="eyebrow">Import result · {title(job.type)}</p><h3>{job.fileName}</h3><small style={{ overflowWrap: "anywhere" }}>Ref: {job.id}</small></div><Status tone={statusTone[job.status] || "neutral"}>{title(job.status)}</Status></div><Summary job={job} />
          {job.reused ? <p role="status">This inventory file already has an import job. Its existing result is shown below; no second job was created. Use the original job to continue instead of uploading it again.</p> : null}
          {job.status === "COMMITTING" ? <div className="inline-state" role="status"><span>{job.needsManualReview
            ? "This older interrupted import needs manual reconciliation. Some changes may already have applied. Automatic resume is blocked; do not upload the same stock again."
            : job.canResume ? "This import is ready to resume. Only unfinished rows will run; committed and failed rows will not be replayed."
              : "Processing is active or its five-minute recovery window has not expired. Refresh this job to see progress. Do not upload the file again."}</span></div> : null}
          {job.rows?.some((row) => row.errors?.length) ? <div className="table-wrap"><table className="tenant-table bulk-error-table"><thead><tr><th>Row</th><th>Field</th><th>Issue</th></tr></thead><tbody>{job.rows.flatMap((row) => row.errors.map((item, index) => <tr key={`${row.id}-${item.field}-${index}`}><td>{row.rowNumber}</td><td><code>{item.field}</code></td><td>{item.message}</td></tr>))}</tbody></table></div> : <div className="bulk-ready-state"><FileCheck2 size={20} aria-hidden="true" /><span><strong>{job.status === "READY" ? "Every row passed validation." : job.status === "COMPLETED" ? "Import completed." : "Review the import result."}</strong><small>{job.status === "READY" ? "The import is ready to commit using current catalog and inventory rules." : `${job.committedRows} rows reported committed; ${job.failedRows} reported failed. Check the error report and current records before any retry.`}</small></span></div>}
          {job.canResume && allowedTypes.some(([key]) => key === job.type) ? <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBlock: 16, lineHeight: 1.5 }}><input type="checkbox" checked={resumeConfirmed} disabled={Boolean(busy)} onChange={(event) => setResumeConfirmed(event.target.checked)} /><span>Resume this original job using unfinished rows only. Failed rows stay in the error report.</span></label> : null}
          <div className="bulk-review-actions" style={{ flexWrap: "wrap", gap: 12 }}>
            {canReadJobs ? <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => review(job.id)} type="button"><RefreshCcw size={16} aria-hidden="true" />Refresh status</button> : null}
            {job.invalidRows || job.failedRows ? <button className="button button-warning" disabled={Boolean(busy)} onClick={() => report(job.id)} type="button"><Download size={16} />Download error report</button> : null}
            {allowedTypes.some(([key]) => key === job.type) && (job.status === "READY" || job.canResume) ? <button className="button button-success" disabled={Boolean(busy) || (job.canResume && !resumeConfirmed)} onClick={commit} type="button"><CheckCircle2 size={16} />{busy === "commit" ? "Processing…" : job.canResume ? "Resume unfinished rows" : `Commit ${job.validRows} rows`}</button> : null}
          </div>
        </div> : null}
      </section>
      {canReadJobs ? <section className="tenant-directory bulk-history" aria-labelledby="bulk-history-title"><div className="section-heading"><div><p className="eyebrow">Audit trail</p><h2 id="bulk-history-title">Recent import jobs</h2></div><button className="icon-button" aria-label="Refresh import jobs" onClick={loadJobs} type="button"><RefreshCcw size={17} /></button></div>
        {!jobs ? <GlobalLoader inline label="Loading import history" /> : !jobs.items.length ? <div className="empty-workspace"><FileSpreadsheet size={26} /><h3>No imports yet</h3><p>Validated CSV jobs will appear here with their result and error report.</p></div> : <>
          <div className="table-wrap"><table className="tenant-table"><thead><tr><th>File</th><th>Type</th><th>Result</th><th>Rows</th><th>Created</th><th>Actions</th></tr></thead><tbody>
            {jobs.items.map((item) => <tr key={item.id}>
              <td data-label="File"><strong>{item.fileName}</strong><small>{item.createdByName}</small><small style={{ overflowWrap: "anywhere" }}>Ref: {item.id}</small></td>
              <td data-label="Type">{title(item.type)}</td>
              <td data-label="Result"><Status tone={statusTone[item.status] || "neutral"}>{item.needsManualReview ? "Needs manual review" : item.canResume ? "Ready to resume" : title(item.status)}</Status></td>
              <td data-label="Rows">{item.status === "READY" || item.status === "VALIDATED_WITH_ERRORS" ? `${item.validRows} valid / ${item.totalRows}` : `${item.committedRows} committed · ${item.failedRows} failed / ${item.totalRows}`}</td>
              <td data-label="Created">{new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td data-label="Actions"><div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => review(item.id)} type="button" aria-label={`Review import ${item.fileName}`}>Review</button>
                {item.invalidRows || item.failedRows ? <button className="button button-warning" disabled={Boolean(busy)} onClick={() => report(item.id)} type="button"><Download size={15} aria-hidden="true" />Errors</button> : null}
              </div></td>
            </tr>)}
          </tbody></table></div>
          <TablePagination itemLabel="jobs" onPageChange={(page) => setJobFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setJobFilters({ page: 1, pageSize })} page={jobs.page} pageSize={jobs.pageSize} total={jobs.total} totalPages={jobs.totalPages} />
        </>}
      </section> : null}</> : <section className="tenant-directory bulk-status-workspace" aria-labelledby="bulk-status-title"><div className="section-heading"><div><p className="eyebrow">Catalog lifecycle</p><h2 id="bulk-status-title">Update selected products</h2><p>Actions still enforce each product's current approval and publication rules.</p></div><span className="bulk-selection-count">{selected.length} selected</span></div>
      <div className="bulk-status-actions">{canUpdateProducts ? <><button className="button button-secondary" disabled={!selected.length || Boolean(busy)} onClick={() => applyStatus("submit")} type="button"><Send size={16} />Submit</button><button className="button button-danger" disabled={!selected.length || Boolean(busy)} onClick={() => applyStatus("archive")} type="button"><Archive size={16} />Archive</button><button className="button button-secondary" disabled={!selected.length || Boolean(busy)} onClick={() => applyStatus("restore")} type="button"><RefreshCcw size={16} />Restore</button></> : null}{canPublishProducts ? <button className="button button-success" disabled={!selected.length || Boolean(busy)} onClick={() => applyStatus("publish")} type="button"><Rocket size={16} />Publish approved</button> : null}</div>
      {!products ? <GlobalLoader inline label="Loading products" /> : <><div className="table-wrap"><table className="tenant-table"><thead><tr><th><input aria-label="Select all products on page" checked={rows.length > 0 && rows.every((item) => selected.includes(item.id))} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, ...rows.map((item) => item.id)])] : current.filter((id) => !rows.some((item) => item.id === id)))} type="checkbox" /></th><th>Product</th><th>Type</th><th>Approval</th><th>Publication</th></tr></thead><tbody>{rows.map((product) => <tr key={product.id}><td><input aria-label={`Select ${product.name}`} checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} type="checkbox" /></td><td data-label="Product"><strong>{product.name}</strong><small>{product.productCode}</small></td><td data-label="Type">{title(product.vertical)}</td><td data-label="Approval"><Status tone={product.approvalStatus === "APPROVED" ? "positive" : product.approvalStatus === "REJECTED" ? "danger" : "neutral"}>{title(product.approvalStatus)}</Status></td><td data-label="Publication"><Status tone={product.publicationStatus === "PUBLISHED" ? "positive" : product.publicationStatus === "ARCHIVED" ? "danger" : "neutral"}>{title(product.publicationStatus)}</Status></td></tr>)}</tbody></table></div><TablePagination itemLabel="products" onPageChange={setProductPage} onPageSizeChange={(pageSize) => { setProductPage(1); setProductPageSize(pageSize); }} page={products.page} pageSize={products.pageSize} total={products.total} totalPages={products.totalPages} /></>}
    </section>}
  </AppShell>;
}
