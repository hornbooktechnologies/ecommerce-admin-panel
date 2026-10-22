"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, ClipboardCheck, Hash, PackageSearch,
  RotateCcw, Search, ShieldAlert, X } from "lucide-react";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { listInventoryLotsRequest, listInventorySerialsRequest,
  reconcileInventorySerialRequest } from "@/lib/api-client";

const lotTones = { HEALTHY: "positive", EXPIRING: "warning", EXPIRED: "danger",
  QUARANTINED: "warning", DEPLETED: "neutral" };
const serialTones = { AVAILABLE: "positive", RESERVED: "warning", SOLD: "neutral",
  QUARANTINED: "warning", SCRAPPED: "danger" };
const label = (value) => value ? value.charAt(0) + value.slice(1).toLowerCase() : "—";
const date = (value) => value
  ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
  : "Not set";

function TraceabilitySummary({ mode, summary }) {
  const cards = mode === "lots" ? [
    { label: "Tracked batches", value: summary.total || 0, icon: PackageSearch, tone: "teal" },
    { label: "Expiring in 30 days", value: summary.expiring || 0, icon: CalendarClock, tone: "warning" },
    { label: "Expired", value: summary.expired || 0, icon: AlertTriangle, tone: "danger" },
    { label: "Fully quarantined", value: summary.quarantined || 0, icon: ShieldAlert, tone: "plum" }
  ] : [
    { label: "Tracked serials", value: summary.total || 0, icon: Hash, tone: "teal" },
    { label: "Available", value: summary.available || 0, icon: Check, tone: "positive" },
    { label: "Reserved", value: summary.reserved || 0, icon: ClipboardCheck, tone: "warning" },
    { label: "Exceptions", value: (summary.quarantined || 0) + (summary.scrapped || 0), icon: ShieldAlert, tone: "danger" }
  ];
  return <div className="traceability-summary" aria-label={`${mode} traceability summary`}>
    {cards.map(({ label: cardLabel, value, icon: Icon, tone }) => <article key={cardLabel}>
      <span className="traceability-summary-icon" data-tone={tone}><Icon size={17} aria-hidden="true" /></span>
      <span><small>{cardLabel}</small><strong>{Number(value).toLocaleString("en-IN")}</strong></span>
    </article>)}
  </div>;
}

function ReconcileSerialDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [form, setForm] = useState({
    status: item.status === "QUARANTINED" ? "AVAILABLE" : "QUARANTINED",
    reasonCode: item.status === "QUARANTINED" ? "QUALITY_RELEASE" : "QUALITY_HOLD",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const targetOptions = item.status === "QUARANTINED"
    ? [{ value: "AVAILABLE", label: "Return to available" }, { value: "SCRAPPED", label: "Scrap unit" }]
    : [{ value: "QUARANTINED", label: "Move to quarantine" }, { value: "SCRAPPED", label: "Scrap unit" }];
  const reasons = form.status === "AVAILABLE"
    ? [{ value: "QUALITY_RELEASE", label: "Quality check passed" }, { value: "FOUND", label: "Unit found" }, { value: "DATA_CORRECTION", label: "Data correction" }]
    : form.status === "QUARANTINED"
      ? [{ value: "QUALITY_HOLD", label: "Quality inspection" }, { value: "DAMAGE", label: "Damage suspected" }, { value: "DATA_CORRECTION", label: "Data correction" }]
      : [{ value: "DAMAGE", label: "Damaged beyond sale" }, { value: "DATA_CORRECTION", label: "Data correction" }];
  function setStatus(status) {
    const defaultReason = status === "AVAILABLE" ? "QUALITY_RELEASE" : status === "QUARANTINED" ? "QUALITY_HOLD" : "DAMAGE";
    setForm((current) => ({ ...current, status, reasonCode: defaultReason }));
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await reconcileInventorySerialRequest(item.id, form, accessToken, tenantId);
      onSaved();
    } catch (requestError) {
      setError(requestError.message || "The serial could not be reconciled.");
    } finally { setSaving(false); }
  }
  return <div className="dialog-backdrop traceability-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !saving) onClose();
  }}>
    <section aria-labelledby="reconcile-serial-title" aria-modal="true" className="catalog-dialog inventory-operation-dialog traceability-dialog" role="dialog">
      <header className="access-dialog-head catalog-dialog-head">
        <div className="dialog-icon" data-tone="warning"><ShieldAlert size={19} aria-hidden="true" /></div>
        <div><p className="eyebrow">Serial reconciliation</p><h2 id="reconcile-serial-title">Review physical unit</h2></div>
        <button aria-label="Close dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} /></button>
      </header>
      <form onSubmit={submit}>
        <div className="catalog-form-scroll">
          <div className="traceability-serial-focus">
            <span><small>Serial number</small><strong>{item.serialNumber}</strong><em>{item.productName} · {item.sku}</em></span>
            <span><small>Current state</small><Status tone={serialTones[item.status]}>{label(item.status)}</Status><em>{item.warehouseName}</em></span>
          </div>
          <div className="form-grid inventory-form-grid">
            <label className="form-field"><span>New status <em>*</em></span><select value={form.status} onChange={(event) => setStatus(event.target.value)}>{targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="form-field"><span>Reason <em>*</em></span><select value={form.reasonCode} onChange={(event) => setForm((current) => ({ ...current, reasonCode: event.target.value }))}>{reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
            <label className="form-field catalog-span-2"><span>Audit note <em>*</em></span><textarea autoFocus maxLength={1000} minLength={3} placeholder="What was physically verified?" required rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          </div>
          {form.status === "SCRAPPED" ? <div className="traceability-destructive-note" role="note"><AlertTriangle size={17} aria-hidden="true" /><span><strong>This removes one unit from on-hand stock.</strong><small>Scrapped serials are terminal and cannot be restored from this workflow.</small></span></div> : null}
          {error ? <div className="inline-state inline-state-error catalog-error" role="alert">{error}</div> : null}
        </div>
        <footer className="dialog-actions catalog-dialog-actions"><span>The change is written to the stock ledger and audit trail.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className={form.status === "SCRAPPED" ? "button button-danger" : "button button-warning"} disabled={saving} type="submit">{saving ? "Saving…" : "Confirm reconciliation"}</button></div></footer>
      </form>
    </section>
  </div>;
}

function LotsTable({ items }) {
  return <><div className="table-wrap traceability-table-wrap"><table className="tenant-table traceability-table"><thead><tr><th>Product / batch</th><th>Warehouse</th><th>Expiry</th><th>Available</th><th>Committed</th><th>Health</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="inventory-product"><strong>{item.productName}</strong><small>{item.sku} · Batch {item.lotNumber}</small></span></td><td><span className="inventory-product"><strong>{item.warehouseName}</strong><small>{item.merchantName}</small></span></td><td><span className="traceability-date"><strong>{date(item.expiresAt)}</strong><small>Made {date(item.manufacturedAt)}</small></span></td><td><strong className="stock-number">{item.availableQuantity.toLocaleString("en-IN")}</strong><small className="quantity-detail">of {item.onHandQuantity.toLocaleString("en-IN")} on hand</small></td><td><span className="traceability-cell"><small>{item.reservedQuantity.toLocaleString("en-IN")} reserved</small><small>{item.quarantineQuantity.toLocaleString("en-IN")} quarantined</small></span></td><td><Status tone={lotTones[item.health]}>{label(item.health)}</Status></td></tr>)}</tbody></table></div><div className="traceability-mobile-list">{items.map((item) => <article key={item.id}><header><span><strong>{item.productName}</strong><small>{item.sku}</small></span><Status tone={lotTones[item.health]}>{label(item.health)}</Status></header><dl><div><dt>Batch</dt><dd>{item.lotNumber}</dd></div><div><dt>Expires</dt><dd>{date(item.expiresAt)}</dd></div><div><dt>Available</dt><dd>{item.availableQuantity.toLocaleString("en-IN")}</dd></div><div><dt>Warehouse</dt><dd>{item.warehouseName}</dd></div></dl></article>)}</div></>;
}

function SerialsTable({ canManage, items, onReconcile }) {
  return <><div className="table-wrap traceability-table-wrap"><table className="tenant-table traceability-table serial-traceability-table"><thead><tr><th>Serial / product</th><th>Warehouse</th><th>Received</th><th>Batch</th><th>Status</th>{canManage ? <th>Action</th> : null}</tr></thead><tbody>{items.map((item) => { const actionable = ["AVAILABLE", "QUARANTINED"].includes(item.status); return <tr key={item.id}><td><span className="inventory-product"><strong>{item.serialNumber}</strong><small>{item.productName} · {item.sku}</small></span></td><td><span className="inventory-product"><strong>{item.warehouseName}</strong><small>{item.merchantName}</small></span></td><td>{date(item.receivedAt)}</td><td>{item.lotNumber || "—"}</td><td><Status tone={serialTones[item.status]}>{label(item.status)}</Status></td>{canManage ? <td>{actionable ? <button className="row-action traceability-reconcile-action" onClick={() => onReconcile(item)} type="button"><RotateCcw size={14} aria-hidden="true" />Reconcile</button> : <span className="traceability-locked">Lifecycle locked</span>}</td> : null}</tr>; })}</tbody></table></div><div className="traceability-mobile-list">{items.map((item) => { const actionable = ["AVAILABLE", "QUARANTINED"].includes(item.status); return <article key={item.id}><header><span><strong>{item.serialNumber}</strong><small>{item.productName} · {item.sku}</small></span><Status tone={serialTones[item.status]}>{label(item.status)}</Status></header><dl><div><dt>Warehouse</dt><dd>{item.warehouseName}</dd></div><div><dt>Received</dt><dd>{date(item.receivedAt)}</dd></div></dl>{canManage && actionable ? <button className="button button-warning" onClick={() => onReconcile(item)} type="button"><RotateCcw size={15} aria-hidden="true" />Reconcile serial</button> : null}</article>; })}</div></>;
}

export function InventoryTraceability({ accessToken, canManage, tenantId, warehouses }) {
  const [mode, setMode] = useState("lots");
  const [filters, setFilters] = useState({ search: "", warehouseId: "", health: "ALL", status: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSerial, setSelectedSerial] = useState(null);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try {
      const response = mode === "lots"
        ? await listInventoryLotsRequest(filters, accessToken, tenantId)
        : await listInventorySerialsRequest(filters, accessToken, tenantId);
      setResult(response);
    } catch (requestError) { setError(requestError.message || "Traceability records could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, mode, tenantId]);
  useEffect(() => { load(); }, [load]);
  const items = result?.items || [];
  const statusValue = mode === "lots" ? filters.health : filters.status;
  const summary = useMemo(() => result?.summary || {}, [result]);
  function switchMode(nextMode) {
    setMode(nextMode); setResult(null);
    setFilters((current) => ({ ...current, page: 1 }));
  }
  function refresh() { setSelectedSerial(null); load(); }
  return <section className="tenant-directory traceability-workspace" aria-labelledby="traceability-title">
    <div className="traceability-heading"><div><p className="eyebrow">Chain of custody</p><h2 id="traceability-title">Batch and serial traceability</h2><span>Inspect expiry exposure and reconcile each serialized physical unit.</span></div><div className="traceability-seal" aria-hidden="true"><ShieldAlert size={18} /><span>Ledger controlled</span></div></div>
    <div className="traceability-tabs" role="tablist" aria-label="Traceability record type"><button aria-selected={mode === "lots"} className={mode === "lots" ? "is-active" : ""} onClick={() => switchMode("lots")} role="tab" type="button"><CalendarClock size={16} aria-hidden="true" />Batches & expiry</button><button aria-selected={mode === "serials"} className={mode === "serials" ? "is-active" : ""} onClick={() => switchMode("serials")} role="tab" type="button"><Hash size={16} aria-hidden="true" />Serial numbers</button></div>
    <TraceabilitySummary mode={mode} summary={summary} />
    <form className="directory-filters traceability-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search traceability records</span><Search size={16} /><input placeholder={mode === "lots" ? "Product, SKU, batch or warehouse" : "Serial, product, SKU or warehouse"} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Warehouse" value={filters.warehouseId} onChange={(event) => setFilters((current) => ({ ...current, warehouseId: event.target.value, page: 1 }))}><option value="">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><select aria-label={mode === "lots" ? "Batch health" : "Serial status"} value={statusValue} onChange={(event) => setFilters((current) => ({ ...current, [mode === "lots" ? "health" : "status"]: event.target.value, page: 1 }))}>{mode === "lots" ? <><option value="ALL">All batch health</option><option value="HEALTHY">Healthy</option><option value="EXPIRING">Expiring soon</option><option value="EXPIRED">Expired</option><option value="QUARANTINED">Quarantined</option><option value="DEPLETED">Depleted</option></> : <><option value="ALL">All serial status</option><option value="AVAILABLE">Available</option><option value="RESERVED">Reserved</option><option value="SOLD">Sold</option><option value="QUARANTINED">Quarantined</option><option value="SCRAPPED">Scrapped</option></>}</select><button className="button button-secondary" type="submit">Search</button></form>
    {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
    {loading ? <GlobalLoader inline label={`Loading ${mode === "lots" ? "batches" : "serial numbers"}`} /> : items.length === 0 ? <div className="empty-workspace traceability-empty"><PackageSearch size={28} aria-hidden="true" /><h3>No {mode === "lots" ? "tracked batches" : "serial numbers"} found</h3><p>{mode === "lots" ? "Batch-tracked receipts will appear here with expiry health." : "Serialized product receipts will appear here for unit-level control."}</p></div> : <>{mode === "lots" ? <LotsTable items={items} /> : <SerialsTable canManage={canManage} items={items} onReconcile={setSelectedSerial} />}<TablePagination itemLabel={mode === "lots" ? "batches" : "serial numbers"} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}
    {selectedSerial ? <ReconcileSerialDialog accessToken={accessToken} item={selectedSerial} onClose={() => setSelectedSerial(null)} onSaved={refresh} tenantId={tenantId} /> : null}
  </section>;
}
