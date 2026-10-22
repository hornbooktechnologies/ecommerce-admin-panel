"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, CalendarClock, Check, ChevronRight, CircleX, ClipboardCheck,
  Edit3, IndianRupee, PackageOpen, PackagePlus, Plus, Search, Truck, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createPurchaseOrderRequest, createSupplierRequest, listPurchaseOrdersRequest,
  listSuppliersRequest, procurementOptionsRequest, purchaseOrderDetailsRequest,
  receiveInventoryRequest, transitionPurchaseOrderRequest, updateSupplierRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const titleCase = (value) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const statusTone = { DRAFT: "neutral", APPROVED: "warning", PARTIALLY_RECEIVED: "warning",
  RECEIVED: "positive", CANCELLED: "negative", ACTIVE: "positive", INACTIVE: "neutral" };

function useDialog(open, onClose, ref, disabled = false) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = (event) => {
      if (event.key === "Escape" && !disabled) onClose();
      if (event.key !== "Tab") return;
      const items = [...(ref.current?.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])") || [])];
      if (!items.length) return; const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keydown);
    requestAnimationFrame(() => ref.current?.querySelector("input, select, button")?.focus());
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [disabled, onClose, open, ref]);
}

function Dialog({ children }) { return typeof document === "undefined" ? null : createPortal(children, document.body); }
function ErrorState({ children }) { return children ? <div className="inline-state inline-state-error" role="alert">{children}</div> : null; }

function SupplierDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [form, setForm] = useState({ code: item?.code || "", legalName: item?.legalName || "",
    displayName: item?.displayName || "", gstin: item?.gstin || "", pan: item?.pan || "",
    contactName: item?.contactName || "", email: item?.email || "", phone: item?.phone || "",
    status: item?.status || "ACTIVE", paymentTermsDays: item?.paymentTermsDays ?? "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const ref = useRef(null);
  useDialog(true, onClose, ref, saving); const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { const input = { ...form, paymentTermsDays: form.paymentTermsDays === "" ? null : Number(form.paymentTermsDays) };
      if (item) await updateSupplierRequest(item.id, input, accessToken, tenantId);
      else await createSupplierRequest(input, accessToken, tenantId); onSaved(); }
    catch (requestError) { setError(requestError.message || "Supplier could not be saved."); }
    finally { setSaving(false); }
  }
  return <Dialog><div className="procurement-dialog-backdrop" role="presentation"><form aria-labelledby="supplier-dialog-title" className="procurement-dialog procurement-dialog-compact" onSubmit={submit} ref={ref} role="dialog" aria-modal="true">
    <header><div><p className="eyebrow">Supplier directory</p><h2 id="supplier-dialog-title">{item ? "Edit supplier" : "Add supplier"}</h2><p>Maintain the commercial contact used on purchase orders.</p></div><button aria-label="Close supplier dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button></header>
    <div className="procurement-dialog-body"><ErrorState>{error}</ErrorState><div className="form-grid">
      <label className="form-field"><span>Supplier code <em>*</em></span><input required value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} /></label>
      <label className="form-field"><span>Display name <em>*</em></span><input required value={form.displayName} onChange={(event) => set("displayName", event.target.value)} /></label>
      <label className="form-field catalog-span-2"><span>Legal name <em>*</em></span><input required value={form.legalName} onChange={(event) => set("legalName", event.target.value)} /></label>
      <label className="form-field"><span>GSTIN</span><input maxLength={15} value={form.gstin} onChange={(event) => set("gstin", event.target.value.toUpperCase())} /></label>
      <label className="form-field"><span>PAN</span><input maxLength={10} value={form.pan} onChange={(event) => set("pan", event.target.value.toUpperCase())} /></label>
      <label className="form-field"><span>Contact name</span><input value={form.contactName} onChange={(event) => set("contactName", event.target.value)} /></label>
      <label className="form-field"><span>Phone</span><input inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
      <label className="form-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
      <label className="form-field"><span>Payment terms (days)</span><input min="0" max="365" type="number" value={form.paymentTermsDays} onChange={(event) => set("paymentTermsDays", event.target.value)} /></label>
      <label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => set("status", event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
    </div></div><footer><span>India · INR procurement</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save supplier"}</button></div></footer>
  </form></div></Dialog>;
}

function PurchaseOrderDialog({ accessToken, onClose, onSaved, options, tenantId }) {
  const [form, setForm] = useState({ supplierId: options.suppliers[0]?.id || "",
    warehouseId: options.warehouses[0]?.id || "", expectedAt: "", notes: "", items: [] });
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const ref = useRef(null);
  useDialog(true, onClose, ref, saving);
  const warehouse = options.warehouses.find((item) => item.id === form.warehouseId);
  const offers = options.offers.filter((item) => item.merchantId === warehouse?.merchantId);
  const total = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0) * (1 + Number(item.taxRate || 0) / 100), 0);
  function addLine() { const used = new Set(form.items.map((item) => item.offerId)); const offer = offers.find((item) => !used.has(item.id));
    if (!offer) return; setForm((current) => ({ ...current, items: [...current.items,
      { offerId: offer.id, quantity: 1, unitCost: offer.unitCost || 0, taxRate: 0 }] })); }
  function setLine(index, field, value) { setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => {
    if (itemIndex !== index) return item; if (field === "offerId") { const offer = offers.find((option) => option.id === value);
      return { ...item, offerId: value, unitCost: offer?.unitCost || 0 }; } return { ...item, [field]: value }; }) })); }
  async function submit(event) { event.preventDefault(); setError(""); if (!form.items.length) { setError("Add at least one product line."); return; }
    setSaving(true); try { await createPurchaseOrderRequest({ ...form, expectedAt: form.expectedAt || null,
      items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity), unitCost: Number(item.unitCost), taxRate: Number(item.taxRate) })) }, accessToken, tenantId); onSaved(); }
    catch (requestError) { setError(requestError.message || "Purchase order could not be created."); } finally { setSaving(false); } }
  return <Dialog><div className="procurement-dialog-backdrop" role="presentation"><form aria-labelledby="po-dialog-title" className="procurement-dialog procurement-dialog-wide" onSubmit={submit} ref={ref} role="dialog" aria-modal="true">
    <header><div><p className="eyebrow">Purchase order</p><h2 id="po-dialog-title">Create purchase order</h2><p>Build a draft, review its landed value, then approve it for receiving.</p></div><button aria-label="Close purchase order dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button></header>
    <div className="procurement-dialog-body"><ErrorState>{error}</ErrorState><div className="form-grid procurement-order-basics">
      <label className="form-field"><span>Supplier <em>*</em></span><select required value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}><option value="">Select supplier</option>{options.suppliers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
      <label className="form-field"><span>Receiving warehouse <em>*</em></span><select required value={form.warehouseId} onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value, items: [] }))}><option value="">Select warehouse</option>{options.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
      <label className="form-field"><span>Expected date</span><input type="date" value={form.expectedAt} onChange={(event) => setForm((current) => ({ ...current, expectedAt: event.target.value }))} /></label>
      <label className="form-field"><span>Notes</span><input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
    </div><section className="procurement-lines"><div><span><p className="eyebrow">Order lines</p><h3>Products and cost</h3></span><button className="button button-secondary" disabled={!offers.some((offer) => !form.items.some((line) => line.offerId === offer.id))} onClick={addLine} type="button"><Plus aria-hidden="true" size={16} />Add line</button></div>
      {form.items.map((line, index) => <div className="procurement-line" key={`${line.offerId}-${index}`}><label className="form-field"><span>Product</span><select value={line.offerId} onChange={(event) => setLine(index, "offerId", event.target.value)}>{offers.filter((offer) => offer.id === line.offerId || !form.items.some((item) => item.offerId === offer.id)).map((offer) => <option key={offer.id} value={offer.id}>{offer.productName} · {offer.variantName} · {offer.sku}</option>)}</select></label><label className="form-field"><span>Quantity</span><input min="0.001" required step="0.001" type="number" value={line.quantity} onChange={(event) => setLine(index, "quantity", event.target.value)} /></label><label className="form-field"><span>Unit cost</span><input min="0" required step="0.01" type="number" value={line.unitCost} onChange={(event) => setLine(index, "unitCost", event.target.value)} /></label><label className="form-field"><span>GST %</span><input min="0" max="100" step="0.01" type="number" value={line.taxRate} onChange={(event) => setLine(index, "taxRate", event.target.value)} /></label><strong>{money.format(Number(line.quantity || 0) * Number(line.unitCost || 0) * (1 + Number(line.taxRate || 0) / 100))}</strong><button aria-label="Remove line" className="icon-button procurement-remove-line" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} type="button"><X aria-hidden="true" size={17} /></button></div>)}
      {!form.items.length ? <div className="procurement-empty-lines"><PackagePlus aria-hidden="true" size={26} /><p>Add products supplied to the selected warehouse.</p></div> : null}
    </section></div><footer><span>{form.items.length} line{form.items.length === 1 ? "" : "s"} · <strong>{money.format(total)}</strong></span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !form.items.length} type="submit">{saving ? "Creating…" : "Create draft"}</button></div></footer>
  </form></div></Dialog>;
}

function ReceiveDialog({ accessToken, line, onClose, onSaved, order, tenantId }) {
  const [form, setForm] = useState({ quantity: line.remainingQuantity, supplierDocumentNumber: "", notes: "",
    lotNumber: "", manufacturedAt: "", expiresAt: "", serialNumbers: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const ref = useRef(null);
  useDialog(true, onClose, ref, saving); const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event) { event.preventDefault(); setSaving(true); setError("");
    try { await receiveInventoryRequest({ warehouseId: order.warehouseId, offerId: line.offerId,
      purchaseOrderId: order.id, purchaseOrderItemId: line.id, quantity: Number(form.quantity),
      unitCost: line.unitCost, supplierDocumentNumber: form.supplierDocumentNumber, notes: form.notes,
      lotNumber: form.lotNumber, manufacturedAt: form.manufacturedAt || null, expiresAt: form.expiresAt || null,
      serialNumbers: form.serialNumbers.split(/[,\n]/).map((value) => value.trim()).filter(Boolean) }, accessToken, tenantId); onSaved(); }
    catch (requestError) { setError(requestError.message || "Stock could not be received."); } finally { setSaving(false); } }
  return <Dialog><div className="procurement-dialog-backdrop procurement-dialog-backdrop-nested" role="presentation"><form aria-labelledby="receive-dialog-title" className="procurement-dialog procurement-dialog-compact" onSubmit={submit} ref={ref} role="dialog" aria-modal="true">
    <header><div><p className="eyebrow">Goods receipt · {order.number}</p><h2 id="receive-dialog-title">Receive {line.productName}</h2><p>{quantity.format(line.remainingQuantity)} remaining · {order.warehouseName}</p></div><button aria-label="Close receipt dialog" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button></header>
    <div className="procurement-dialog-body"><ErrorState>{error}</ErrorState><div className="form-grid">
      <label className="form-field"><span>Accepted quantity <em>*</em></span><input max={line.remainingQuantity} min="0.001" required step="0.001" type="number" value={form.quantity} onChange={(event) => set("quantity", event.target.value)} /></label>
      <label className="form-field"><span>Supplier document</span><input value={form.supplierDocumentNumber} onChange={(event) => set("supplierDocumentNumber", event.target.value)} /></label>
      {line.lotTrackingEnabled ? <label className="form-field"><span>Batch / lot number <em>*</em></span><input required value={form.lotNumber} onChange={(event) => set("lotNumber", event.target.value)} /></label> : null}
      {line.lotTrackingEnabled ? <label className="form-field"><span>Manufactured date</span><input type="date" value={form.manufacturedAt} onChange={(event) => set("manufacturedAt", event.target.value)} /></label> : null}
      {line.expiryTrackingEnabled ? <label className="form-field"><span>Expiry date <em>*</em></span><input required type="date" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} /></label> : null}
      {line.serialTrackingEnabled ? <label className="form-field catalog-span-2"><span>Serial numbers <em>*</em></span><textarea placeholder="One serial per line" rows="5" value={form.serialNumbers} onChange={(event) => set("serialNumbers", event.target.value)} /><small>Enter exactly one serial for each received unit.</small></label> : null}
      <label className="form-field catalog-span-2"><span>Receipt notes</span><textarea rows="3" value={form.notes} onChange={(event) => set("notes", event.target.value)} /></label>
    </div></div><footer><span>Posts directly to inventory</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving} type="submit"><PackageOpen aria-hidden="true" size={17} />{saving ? "Posting…" : "Post receipt"}</button></div></footer>
  </form></div></Dialog>;
}

function OrderDetail({ accessToken, canManage, initial, onClose, onUpdated, tenantId }) {
  const [order, setOrder] = useState(initial); const [receiving, setReceiving] = useState(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const ref = useRef(null);
  useDialog(true, onClose, ref, busy || Boolean(receiving));
  const reload = useCallback(async () => { const details = await purchaseOrderDetailsRequest(initial.id, accessToken, tenantId); setOrder(details); }, [accessToken, initial.id, tenantId]);
  useEffect(() => { reload().catch((requestError) => setError(requestError.message)); }, [reload]);
  async function transition(action) { setBusy(true); setError(""); try { const next = await transitionPurchaseOrderRequest(order.id, action, accessToken, tenantId); setOrder(next); onUpdated(); }
    catch (requestError) { setError(requestError.message || "Purchase order could not be updated."); } finally { setBusy(false); } }
  return <Dialog><div className="procurement-dialog-backdrop" role="presentation"><section aria-labelledby="order-detail-title" className="procurement-dialog procurement-dialog-wide procurement-order-detail" ref={ref} role="dialog" aria-modal="true">
    <header><div><p className="eyebrow">Purchase order workspace</p><h2 id="order-detail-title">{order.number}</h2><p>{order.supplierName} · {order.warehouseName}</p></div><button aria-label="Close purchase order" className="icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button></header>
    <div className="procurement-dialog-body"><ErrorState>{error}</ErrorState><div className="procurement-order-meta"><Status tone={statusTone[order.status]}>{titleCase(order.status)}</Status><span><CalendarClock aria-hidden="true" size={15} />Expected {order.expectedAt || "not scheduled"}</span><strong>{money.format(order.grandTotal || 0)}</strong></div>
      <div className="table-wrap"><table className="tenant-table procurement-lines-table"><thead><tr><th>Product</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Unit cost</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{(order.items || []).map((line) => <tr key={line.id}><td data-label="Product"><strong>{line.productName}</strong><small>{line.variantName} · {line.sku}</small></td><td data-label="Ordered">{quantity.format(line.orderedQuantity)}</td><td data-label="Received">{quantity.format(line.receivedQuantity)}</td><td data-label="Remaining"><strong>{quantity.format(line.remainingQuantity)}</strong></td><td data-label="Unit cost">{money.format(line.unitCost)}</td><td>{canManage && ["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status) && line.remainingQuantity > 0 ? <button className="row-action row-action-positive" onClick={() => setReceiving(line)} type="button"><PackageOpen aria-hidden="true" size={15} />Receive</button> : null}</td></tr>)}</tbody></table></div>
      {order.notes ? <div className="procurement-order-notes"><span>Order notes</span><p>{order.notes}</p></div> : null}
    </div><footer><span>Created {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span><div>{canManage && order.status === "DRAFT" ? <><button className="button button-danger" disabled={busy} onClick={() => transition("cancel")} type="button"><CircleX aria-hidden="true" size={17} />Cancel order</button><button className="button button-success" disabled={busy} onClick={() => transition("approve")} type="button"><Check aria-hidden="true" size={17} />Approve order</button></> : null}{canManage && order.status === "APPROVED" ? <button className="button button-danger" disabled={busy} onClick={() => transition("cancel")} type="button"><CircleX aria-hidden="true" size={17} />Cancel order</button> : null}<button className="button button-secondary" onClick={onClose} type="button">Close</button></div></footer>
    {receiving ? <ReceiveDialog accessToken={accessToken} line={receiving} onClose={() => setReceiving(null)} onSaved={async () => { setReceiving(null); await reload(); onUpdated(); }} order={order} tenantId={tenantId} /> : null}
  </section></div></Dialog>;
}

function ProcurementSkeleton() { return <div className="procurement-skeleton" aria-label="Loading procurement workspace" role="status"><span /><span /><span /><section>{[1, 2, 3, 4, 5].map((item) => <i key={item} />)}</section></div>; }

export default function ProcurementPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "procurement.manage", tenantId); const [tab, setTab] = useState("orders");
  const [orderFilters, setOrderFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [supplierFilters, setSupplierFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState(""); const [orders, setOrders] = useState(null);
  const [suppliers, setSuppliers] = useState(null); const [options, setOptions] = useState({ suppliers: [], warehouses: [], offers: [] });
  const [editor, setEditor] = useState(null); const [detail, setDetail] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { if (!accessToken || !tenantId) return; setLoading(true); setError("");
    try { const [orderResult, supplierResult, available] = await Promise.all([
      listPurchaseOrdersRequest(orderFilters, accessToken, tenantId), listSuppliersRequest(supplierFilters, accessToken, tenantId),
      procurementOptionsRequest(accessToken, tenantId)]); setOrders(orderResult); setSuppliers(supplierResult); setOptions(available); }
    catch (requestError) { setError(requestError.message || "Procurement workspace could not be loaded."); }
    finally { setLoading(false); } }, [accessToken, orderFilters, supplierFilters, tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraftSearch(tab === "orders" ? orderFilters.search : supplierFilters.search); }, [orderFilters.search, supplierFilters.search, tab]);
  const summary = orders?.summary || { total: 0, draft: 0, approved: 0, partial: 0, received: 0, openValue: 0 };
  const action = canManage ? <button className="button button-primary" onClick={() => setEditor(tab === "orders" ? { kind: "order" } : { kind: "supplier" })} type="button"><Plus aria-hidden="true" size={17} />{tab === "orders" ? "New purchase order" : "Add supplier"}</button> : null;
  function search(event) { event.preventDefault(); if (tab === "orders") setOrderFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 }));
    else setSupplierFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }
  const currentFilters = tab === "orders" ? orderFilters : supplierFilters;
  return <AppShell action={action} area="admin" currentPath="/admin/procurement" eyebrow="Supply operations" title="Procurement" description="Manage suppliers, approve purchase orders, and receive ordered stock into traceable inventory.">
    {loading && !orders ? <ProcurementSkeleton /> : <><section className="procurement-signals" aria-label="Procurement summary"><article><span><ClipboardCheck aria-hidden="true" size={18} /></span><div><small>Open orders</small><strong>{(summary.approved + summary.partial).toLocaleString("en-IN")}</strong><em>{summary.partial} partially received</em></div></article><article><span><IndianRupee aria-hidden="true" size={18} /></span><div><small>Open value</small><strong>{money.format(summary.openValue)}</strong><em>Approved and receiving</em></div></article><article><span><Building2 aria-hidden="true" size={18} /></span><div><small>Active suppliers</small><strong>{options.suppliers.length.toLocaleString("en-IN")}</strong><em>{suppliers?.total || 0} in directory</em></div></article><article><span><Truck aria-hidden="true" size={18} /></span><div><small>Fully received</small><strong>{summary.received.toLocaleString("en-IN")}</strong><em>{summary.draft} draft orders</em></div></article></section>
      <section className="tenant-directory procurement-directory" aria-labelledby="procurement-directory-title"><div className="procurement-toolbar"><div><p className="eyebrow">Supply network</p><h2 id="procurement-directory-title">Orders and suppliers</h2></div><div className="procurement-tabs" role="tablist"><button aria-selected={tab === "orders"} onClick={() => setTab("orders")} role="tab" type="button">Purchase orders <span>{summary.total}</span></button><button aria-selected={tab === "suppliers"} onClick={() => setTab("suppliers")} role="tab" type="button">Suppliers <span>{suppliers?.total || 0}</span></button></div></div>
      <ErrorState>{error}</ErrorState><form className="directory-filters procurement-filters" onSubmit={search} role="search"><label className="compact-search"><span className="sr-only">Search {tab}</span><Search aria-hidden="true" size={16} /><input placeholder={tab === "orders" ? "PO number, supplier or warehouse" : "Supplier name, code or GSTIN"} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label={`${tab} status`} value={currentFilters.status} onChange={(event) => tab === "orders" ? setOrderFilters((current) => ({ ...current, status: event.target.value, page: 1 })) : setSupplierFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="ALL">All statuses</option>{tab === "orders" ? <><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="PARTIALLY_RECEIVED">Partially received</option><option value="RECEIVED">Received</option><option value="CANCELLED">Cancelled</option></> : <><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></>}</select><button className="button button-secondary" type="submit">Search</button></form>
      {loading ? <div className="seller-pricing-refresh" role="status">Refreshing procurement records…</div> : null}
      {tab === "orders" ? orders?.items?.length ? <><div className="table-wrap"><table className="tenant-table procurement-table"><thead><tr><th>Purchase order</th><th>Supplier</th><th>Destination</th><th>Progress</th><th>Expected</th><th>Value</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{orders.items.map((order) => <tr key={order.id}><td data-label="Purchase order"><strong>{order.number}</strong><small>{order.itemCount} product line{order.itemCount === 1 ? "" : "s"}</small></td><td data-label="Supplier"><strong>{order.supplierName}</strong><small>{order.supplierCode}</small></td><td data-label="Destination">{order.warehouseName}</td><td data-label="Progress"><strong>{quantity.format(order.receivedQuantity)} / {quantity.format(order.orderedQuantity)}</strong><span className="procurement-progress"><i style={{ width: `${order.orderedQuantity ? Math.min(100, order.receivedQuantity / order.orderedQuantity * 100) : 0}%` }} /></span></td><td data-label="Expected">{order.expectedAt || "Not scheduled"}</td><td data-label="Value"><strong>{money.format(order.grandTotal)}</strong></td><td data-label="Status"><Status tone={statusTone[order.status]}>{titleCase(order.status)}</Status></td><td><button className="row-action" onClick={() => setDetail(order)} type="button">Open<ChevronRight aria-hidden="true" size={15} /></button></td></tr>)}</tbody></table></div><TablePagination itemLabel="purchase orders" onPageChange={(page) => setOrderFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setOrderFilters((current) => ({ ...current, page: 1, pageSize }))} page={orders.page} pageSize={orders.pageSize} total={orders.total} totalPages={orders.totalPages} /></> : <div className="empty-workspace"><PackagePlus aria-hidden="true" size={29} /><h3>No purchase orders in this view</h3><p>Create a draft order or change the filters.</p></div>
      : suppliers?.items?.length ? <><div className="table-wrap"><table className="tenant-table procurement-table"><thead><tr><th>Supplier</th><th>Tax identity</th><th>Primary contact</th><th>Terms</th><th>Open orders</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{suppliers.items.map((supplier) => <tr key={supplier.id}><td data-label="Supplier"><strong>{supplier.displayName}</strong><small>{supplier.code} · {supplier.legalName}</small></td><td data-label="Tax identity"><strong>{supplier.gstin || "GSTIN not added"}</strong><small>{supplier.pan || "PAN not added"}</small></td><td data-label="Primary contact"><strong>{supplier.contactName || "Not assigned"}</strong><small>{supplier.email || supplier.phone || "No contact details"}</small></td><td data-label="Terms">{supplier.paymentTermsDays === null ? "Not set" : `${supplier.paymentTermsDays} days`}</td><td data-label="Open orders"><strong>{supplier.openPurchaseOrders}</strong></td><td data-label="Status"><Status tone={statusTone[supplier.status]}>{titleCase(supplier.status)}</Status></td><td>{canManage ? <button className="row-action" onClick={() => setEditor({ kind: "supplier", item: supplier })} type="button"><Edit3 aria-hidden="true" size={14} />Edit</button> : null}</td></tr>)}</tbody></table></div><TablePagination itemLabel="suppliers" onPageChange={(page) => setSupplierFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setSupplierFilters((current) => ({ ...current, page: 1, pageSize }))} page={suppliers.page} pageSize={suppliers.pageSize} total={suppliers.total} totalPages={suppliers.totalPages} /></> : <div className="empty-workspace"><Building2 aria-hidden="true" size={29} /><h3>No suppliers in this view</h3><p>Add the first supplier before creating purchase orders.</p></div>}
      </section></>}
    {editor?.kind === "supplier" ? <SupplierDialog accessToken={accessToken} item={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); }} tenantId={tenantId} /> : null}
    {editor?.kind === "order" ? <PurchaseOrderDialog accessToken={accessToken} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); }} options={options} tenantId={tenantId} /> : null}
    {detail ? <OrderDetail accessToken={accessToken} canManage={canManage} initial={detail} onClose={() => setDetail(null)} onUpdated={load} tenantId={tenantId} /> : null}
  </AppShell>;
}
