"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, ArrowRight, Check, ClipboardCheck, PackageCheck, Plus,
  RefreshCcw, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NotificationTarget } from "@/components/notification-target";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { availableExchangeOffers } from "@/lib/return-exchange";
import { completeExchangeRequest, createExchangeRequest, createReturnRequest,
  listReturnsRequest, returnDetailsRequest, returnOptionsRequest,
  transitionReturnRequest } from "@/lib/api-client";

const statusLabel = { REQUESTED: "Requested", APPROVED: "Approved", RECEIVED: "Received",
  INSPECTED: "Inspected", COMPLETED: "Completed", REJECTED: "Rejected" };
const statusTone = { REQUESTED: "warning", APPROVED: "info", RECEIVED: "info",
  INSPECTED: "positive", COMPLETED: "positive", REJECTED: "danger" };
const reasonLabel = { DAMAGED: "Arrived damaged", DEFECTIVE: "Defective", WRONG_ITEM: "Wrong item",
  SIZE_FIT: "Size or fit", CHANGED_MIND: "Changed mind", QUALITY: "Quality concern", OTHER: "Other" };
const steps = ["REQUESTED", "APPROVED", "RECEIVED", "INSPECTED", "COMPLETED"];

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
    maximumFractionDigits: 2 }).format(Number(value || 0));
}

function shortDate(value) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(value)) : "—";
}

function DialogHeader({ eyebrow, icon: Icon, onClose, title }) {
  return <header className="access-dialog-head return-dialog-head"><span className="dialog-icon" data-tone="positive"><Icon size={19} aria-hidden="true" /></span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header>;
}

function CreateReturnDialog({ accessToken, onClose, onSaved, options, tenantId }) {
  const first = options.items[0];
  const [form, setForm] = useState({ orderItemId: first?.id || "", returnType: "RETURN",
    quantity: "1", reasonCode: "DAMAGED", customerComments: "", serialIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = options.items.find((candidate) => candidate.id === form.orderItemId);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  function selectItem(orderItemId) {
    const selected = options.items.find((candidate) => candidate.id === orderItemId);
    setForm((current) => ({ ...current, orderItemId, returnType: "RETURN",
      quantity: selected?.serialTracking ? "1" : String(Math.min(1, selected?.remainingQuantity || 1)), serialIds: [] }));
  }

  function toggleSerial(serialId) {
    setForm((current) => {
      const serialIds = current.serialIds.includes(serialId)
        ? current.serialIds.filter((id) => id !== serialId) : [...current.serialIds, serialId];
      return { ...current, serialIds,
        quantity: String(serialIds.length / (item?.bundleSerialUnits || 1)) };
    });
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await createReturnRequest({ ...form, quantity: Number(form.quantity) }, accessToken, tenantId);
      onSaved(result.request.id);
    } catch (requestError) { setError(requestError.message || "Return request could not be created."); }
    finally { setSaving(false); }
  }

  const serialSelectionIncomplete = item?.serialTracking && (!form.serialIds.length
    || form.serialIds.length % (item.bundleSerialUnits || 1) !== 0
    || Number(form.quantity) > item.remainingQuantity);
  return <div className="dialog-backdrop return-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="return-dialog return-create-dialog" role="dialog"><DialogHeader eyebrow="Reverse logistics" icon={RotateCcw} onClose={onClose} title="Create return" /><form onSubmit={submit}><div className="return-dialog-scroll"><div className="return-guidance"><ArchiveRestore size={18} aria-hidden="true" /><span><strong>Start from a delivered line item</strong><small>Eligibility, remaining quantity, serial ownership, and return window are validated by the API.</small></span></div><div className="form-grid return-form-grid"><label className="form-field return-span-2"><span>Delivered item <em>*</em></span><select autoFocus required value={form.orderItemId} onChange={(event) => selectItem(event.target.value)}>{options.items.map((option) => <option key={option.id} value={option.id}>{option.orderNumber} · {option.productName} · {option.variantName || option.sku}</option>)}</select></label><label className="form-field"><span>Resolution <em>*</em></span><select value={form.returnType} onChange={(event) => update("returnType", event.target.value)}><option value="RETURN">Return and refund</option>{item?.vertical === "CLOTHING" && item.replacementOffers.length ? <option value="EXCHANGE">Size / colour exchange</option> : null}</select></label><label className="form-field"><span>Reason <em>*</em></span><select value={form.reasonCode} onChange={(event) => update("reasonCode", event.target.value)}>{Object.entries(reasonLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{item?.serialTracking ? <fieldset className="return-serial-picker return-span-2"><legend>Select returned serial numbers{item.bundleSerialUnits ? ` · ${item.bundleSerialUnits} per bundle` : ""}</legend><div>{item.serials.map((serial) => <label className={form.serialIds.includes(serial.id) ? "is-selected" : ""} key={serial.id}><input checked={form.serialIds.includes(serial.id)} onChange={() => toggleSerial(serial.id)} type="checkbox" /><Check size={14} aria-hidden="true" /><span>{serial.number}</span></label>)}</div></fieldset> : <label className="form-field"><span>Quantity <em>*</em></span><input max={item?.remainingQuantity || 1} min="0.001" required step="0.001" type="number" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /><small>{item?.remainingQuantity || 0} eligible</small></label>}<label className={`form-field ${item?.serialTracking ? "return-span-2" : ""}`}><span>Customer comments</span><textarea maxLength={1000} rows={3} value={form.customerComments} onChange={(event) => update("customerComments", event.target.value)} /></label></div>{item ? <div className="return-item-preview"><span><small>Customer order</small><strong>{item.orderNumber}</strong></span><span><small>Seller</small><strong>{item.merchantName}</strong></span><span><small>Original line value</small><strong>{money(item.lineTotal)}</strong></span></div> : null}{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div> : null}</div><footer className="dialog-actions return-dialog-actions"><span>Submitting does not move stock or issue money.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !item || serialSelectionIncomplete} type="submit">{saving ? "Creating…" : "Create return"}</button></div></footer></form></section></div>;
}

function ReturnProgress({ status }) {
  const current = status === "REJECTED" ? -1 : steps.indexOf(status);
  return <ol aria-label="Return progress" className="return-progress">{steps.map((step, index) => <li className={index <= current ? "is-complete" : ""} data-current={step === status || undefined} key={step}><span>{index < current ? <Check size={12} aria-hidden="true" /> : index + 1}</span><small>{statusLabel[step]}</small></li>)}</ol>;
}

function ReturnCaseDialog({ accessToken, canManage, onClose, onSaved, options, returnId, tenantId }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ notes: "", warehouseId: options.warehouses[0]?.id || "",
    itemCondition: "NEW", disposition: "RESTOCK", refundReference: "", replacementOfferId: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDetails(await returnDetailsRequest(returnId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Return details could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, returnId, tenantId]);
  useEffect(() => { load(); }, [load]);
  const request = details?.request;
  const replacementOffers = useMemo(() => availableExchangeOffers(details), [details]);
  const pendingExchange = details?.exchanges.find((exchange) => exchange.status === "PENDING");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!replacementOffers.some((offer) => offer.id === form.replacementOfferId)) {
      setForm((current) => ({ ...current, replacementOfferId: replacementOffers[0]?.id || "" }));
    }
  }, [form.replacementOfferId, replacementOffers]);

  async function run(action, body) {
    setSaving(true); setError("");
    try {
      let result;
      if (action === "create-exchange") result = await createExchangeRequest(returnId, body, accessToken, tenantId);
      else if (action === "complete-exchange") result = await completeExchangeRequest(pendingExchange.id, body, accessToken, tenantId);
      else result = await transitionReturnRequest(returnId, action, body, accessToken, tenantId);
      setDetails(result); setForm((current) => ({ ...current, notes: "" })); onSaved();
    } catch (requestError) { setError(requestError.message || "The return could not be updated."); }
    finally { setSaving(false); }
  }

  const action = request?.status === "REQUESTED" ? "decision" : request?.status === "APPROVED" ? "receive"
    : request?.status === "RECEIVED" ? "inspect" : request?.status === "INSPECTED" && request.returnType === "RETURN" ? "refund"
      : request?.status === "INSPECTED" && !pendingExchange ? "exchange" : request?.status === "INSPECTED" && pendingExchange ? "complete-exchange" : null;

  return <div className="dialog-backdrop return-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="return-dialog return-case-dialog" role="dialog"><DialogHeader eyebrow="Return case" icon={ClipboardCheck} onClose={onClose} title={request?.returnNumber || "Loading return"} />{loading ? <GlobalLoader inline label="Loading return case" /> : <><div className="return-dialog-scroll">{request ? <><div className="return-case-band"><div><span><Status tone={statusTone[request.status]}>{statusLabel[request.status]}</Status><small>{request.returnType === "EXCHANGE" ? "Clothing exchange" : "Return and refund"}</small></span><h3>{request.orderNumber} · {request.customerName}</h3><p>{reasonLabel[request.reasonCode] || request.reasonCode} · requested {shortDate(request.requestedAt)}</p></div><strong>{money(request.refundAmount)}</strong></div><ReturnProgress status={request.status} /><div className="return-line-list">{details.items.map((item) => <article key={item.id}><span className="return-line-icon"><ArchiveRestore size={17} aria-hidden="true" /></span><div><strong>{item.productName}</strong><span>{item.variantName || item.sku}{item.serialNumber ? ` · ${item.serialNumber}` : ""}</span></div><span><small>Requested</small><strong>{item.requestedQuantity}</strong></span><span><small>Disposition</small><strong>{item.disposition ? item.disposition.toLowerCase() : "Pending"}</strong></span></article>)}</div>{details.exchanges.length ? <section className="return-resolution"><PackageCheck size={18} aria-hidden="true" /><div><small>Replacement reserved</small><strong>{details.exchanges[0].replacementVariant} · {details.exchanges[0].replacementSku}</strong><span>{money(details.exchanges[0].priceDifference)} price difference · {details.exchanges[0].status.toLowerCase()}</span></div></section> : details.refunds.length ? <section className="return-resolution"><RefreshCcw size={18} aria-hidden="true" /><div><small>Manual refund</small><strong>{details.refunds[0].refundNumber} · {money(details.refunds[0].refundedAmount)}</strong><span>{details.refunds[0].providerReference || "No external reference"}</span></div></section> : null}{canManage && action ? <section className="return-action-panel"><header><span><ShieldCheck size={17} aria-hidden="true" /></span><div><strong>{action === "decision" ? "Review request" : action === "receive" ? "Receive goods" : action === "inspect" ? "Record inspection" : action === "refund" ? "Complete refund" : action === "exchange" ? "Reserve replacement" : "Complete exchange"}</strong><small>Each change is recorded in the audit trail.</small></div></header>{action === "receive" ? <label className="form-field"><span>Receiving warehouse <em>*</em></span><select value={form.warehouseId} onChange={(event) => update("warehouseId", event.target.value)}>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</option>)}</select></label> : null}{action === "inspect" ? <div className="form-grid return-form-grid"><label className="form-field"><span>Condition <em>*</em></span><select value={form.itemCondition} onChange={(event) => update("itemCondition", event.target.value)}><option value="NEW">New / sealed</option><option value="OPEN_BOX">Open box</option><option value="USED">Used</option><option value="DAMAGED">Damaged</option><option value="DEFECTIVE">Defective</option></select></label><label className="form-field"><span>Disposition <em>*</em></span><select value={form.disposition} onChange={(event) => update("disposition", event.target.value)}><option value="RESTOCK">Return to saleable stock</option><option value="QUARANTINE">Move to quarantine</option><option value="SCRAP">Scrap / no stock</option></select></label></div> : null}{action === "refund" ? <label className="form-field"><span>Manual refund reference</span><input maxLength={190} placeholder="UTR, cash voucher or internal reference" value={form.refundReference} onChange={(event) => update("refundReference", event.target.value)} /></label> : null}{action === "exchange" ? <label className="form-field"><span>Replacement size / colour <em>*</em></span><select value={form.replacementOfferId} onChange={(event) => update("replacementOfferId", event.target.value)}>{!replacementOffers.length ? <option value="">No replacement stock available</option> : null}{replacementOffers.map((offer) => <option key={offer.id} value={offer.id}>{offer.variantName} · {offer.sku} · {money(offer.price)} · {offer.availableQuantity} available</option>)}</select>{!replacementOffers.length ? <small role="status">Receive enough stock for an alternative size or colour, then close and reopen this case to refresh availability.</small> : null}</label> : null}<label className="form-field"><span>{action === "decision" ? "Decision notes" : "Operational notes"}</span><textarea maxLength={1000} rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label><div className="return-action-buttons">{action === "decision" ? <><button className="button button-danger" disabled={saving || form.notes.trim().length < 3} onClick={() => run("reject", { notes: form.notes })} type="button">Reject</button><button className="button button-success" disabled={saving} onClick={() => run("approve", { notes: form.notes })} type="button">Approve return</button></> : <button className={action === "inspect" ? "button button-warning" : "button button-success"} disabled={saving || (action === "exchange" && !form.replacementOfferId)} onClick={() => action === "receive" ? run("receive", { warehouseId: form.warehouseId, notes: form.notes }) : action === "inspect" ? run("inspect", { itemCondition: form.itemCondition, disposition: form.disposition, notes: form.notes }) : action === "refund" ? run("complete", { refundReference: form.refundReference, notes: form.notes }) : action === "exchange" ? run("create-exchange", { replacementOfferId: form.replacementOfferId }) : run("complete-exchange", { notes: form.notes })} type="button">{saving ? "Saving…" : action === "receive" ? "Mark received" : action === "inspect" ? "Post inspection" : action === "refund" ? "Record refund and complete" : action === "exchange" ? "Reserve replacement" : "Issue replacement"}<ArrowRight size={15} aria-hidden="true" /></button>}</div></section> : null}</> : null}{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}</div><footer className="dialog-actions return-dialog-actions"><span>{request?.warehouseName ? `Received at ${request.warehouseName}` : "Stock changes occur only after inspection."}</span><button className="button button-secondary" onClick={onClose} type="button">Close</button></footer></>}</section></div>;
}

export default function ReturnsPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "return.manage", tenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", type: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ items: [], warehouses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try {
      const [returns, nextOptions] = await Promise.all([
        listReturnsRequest(filters, accessToken, tenantId),
        canManage ? returnOptionsRequest(accessToken, tenantId) : Promise.resolve({ items: [], warehouses: [] })
      ]);
      setResult(returns); setOptions(nextOptions);
    } catch (requestError) { setError(requestError.message || "Returns could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, canManage, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const summary = useMemo(() => result?.summary || { total: 0, requested: 0, inProgress: 0, completed: 0, exchanges: 0 }, [result]);
  const items = result?.items || [];
  function refresh() { load(); }

  return <AppShell area="admin" currentPath="/admin/returns" eyebrow="Reverse logistics" title="Returns & exchanges" description="Review eligibility, receive goods, inspect condition, and close refunds or clothing replacements." action={canManage ? <button className="button button-primary" disabled={!options.items.length} onClick={() => setDialog({ type: "create" })} title={options.items.length ? "Create return" : "No delivered items are currently eligible"} type="button"><Plus size={16} aria-hidden="true" />New return</button> : null}>
    <section aria-label="Returns summary" className="return-signal-grid"><article><span data-tone="warm"><ArchiveRestore size={18} aria-hidden="true" /></span><div><small>Total cases</small><strong>{summary.total}</strong></div></article><article><span data-tone="warning"><ShieldCheck size={18} aria-hidden="true" /></span><div><small>Awaiting review</small><strong>{summary.requested}</strong></div></article><article><span data-tone="teal"><ClipboardCheck size={18} aria-hidden="true" /></span><div><small>In progress</small><strong>{summary.inProgress}</strong></div></article><article><span data-tone="plum"><RefreshCcw size={18} aria-hidden="true" /></span><div><small>Clothing exchanges</small><strong>{summary.exchanges}</strong></div></article></section>
    <section aria-labelledby="returns-directory-title" className="tenant-directory return-directory"><div className="section-heading tenant-directory-heading"><div><p className="eyebrow">Case queue</p><h2 id="returns-directory-title">Return requests</h2></div><form className="directory-filters return-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search returns</span><Search size={16} aria-hidden="true" /><input placeholder="Return, order or product" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Return type" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value, page: 1 }))}><option value="ALL">All resolutions</option><option value="RETURN">Returns</option><option value="EXCHANGE">Exchanges</option></select><select aria-label="Return status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="ALL">All statuses</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="button button-secondary" type="submit">Search</button></form></div>{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}{loading ? <GlobalLoader inline label="Loading returns" /> : !items.length ? <div className="empty-workspace"><ArchiveRestore size={28} aria-hidden="true" /><h3>No return cases found</h3><p>Delivered items that remain inside their return window can be opened as a return or clothing exchange.</p>{canManage ? <button className="button button-primary" disabled={!options.items.length} onClick={() => setDialog({ type: "create" })} type="button"><Plus size={16} aria-hidden="true" />Create first return</button> : null}</div> : <><div className="return-case-list">{items.map((item) => <button className="return-case-row" key={item.id} onClick={() => setDialog({ type: "case", id: item.id })} type="button"><span className="return-case-identity"><i data-type={item.returnType}><ArchiveRestore size={17} aria-hidden="true" /></i><span><strong>{item.returnNumber}</strong><small>{item.orderNumber} · {item.customerName}</small></span></span><span><small>Resolution</small><strong>{item.returnType === "EXCHANGE" ? "Size / colour exchange" : "Return and refund"}</strong></span><span><small>Items</small><strong>{item.requestedQuantity.toLocaleString("en-IN")}</strong></span><span><small>Refund value</small><strong>{money(item.refundAmount)}</strong></span><span><Status tone={statusTone[item.status]}>{statusLabel[item.status]}</Status><small>{shortDate(item.requestedAt)}</small></span><ArrowRight size={17} aria-hidden="true" /></button>)}</div><TablePagination itemLabel="return cases" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}</section>
    {dialog?.type === "create" ? <CreateReturnDialog accessToken={accessToken} onClose={() => setDialog(null)} onSaved={(id) => { refresh(); setDialog({ type: "case", id }); }} options={options} tenantId={tenantId} /> : null}
    {dialog?.type === "case" ? <ReturnCaseDialog accessToken={accessToken} canManage={canManage} onClose={() => setDialog(null)} onSaved={refresh} options={options} returnId={dialog.id} tenantId={tenantId} /> : null}
    <NotificationTarget tenantId={tenantId} onOpen={id => setDialog({ type: "case", id })} />
  </AppShell>;
}
