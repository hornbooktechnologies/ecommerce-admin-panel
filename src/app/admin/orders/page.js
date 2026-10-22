"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleX, Clock3, Eye, MapPin, PackageCheck, ReceiptIndianRupee,
  Plus, Search, ShoppingBag, Store, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { FulfillmentWorkspace } from "@/components/fulfillment-workspace";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { listOrdersRequest, orderDetailsRequest, transitionOrderRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const statusTone = {
  DRAFT: "neutral", PLACED: "warning", CONFIRMED: "positive", PROCESSING: "warning",
  COMPLETED: "positive", CANCELLED: "danger", UNPAID: "warning", PENDING: "warning",
  PAID: "positive", PARTIALLY_REFUNDED: "warning", REFUNDED: "neutral", FAILED: "danger",
  UNFULFILLED: "neutral", PARTIALLY_FULFILLED: "warning", FULFILLED: "positive"
};
const statusLabel = (value) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const formatDate = (value) => value ? dateTime.format(new Date(value)) : "Not placed";
const nextStep = {
  DRAFT: { status: "PLACED", label: "Place order" },
  PLACED: { status: "CONFIRMED", label: "Confirm order" },
  CONFIRMED: { status: "PROCESSING", label: "Start processing" },
  PROCESSING: { status: "COMPLETED", label: "Complete order" }
};

function Address({ address }) {
  const parts = [address?.line1, address?.line2, address?.city,
    address?.stateName || address?.state, address?.postalCode].filter(Boolean);
  return parts.length ? <>{parts.join(", ")}<small>India</small></> : <>Address not captured</>;
}

function OrderDialog({ accessToken, canManage, onClose, onUpdated, orderId, tenantId }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [cancelMode, setCancelMode] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDetails(await orderDetailsRequest(orderId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Order details could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, orderId, tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  async function changeStatus(status) {
    setSaving(true); setError("");
    try {
      const updated = await transitionOrderRequest(orderId, {
        status, reasonCode: status === "CANCELLED" ? "OPERATOR_CANCELLED" : "",
        notes: notes.trim()
      }, accessToken, tenantId);
      setDetails(updated); setNotes(""); setCancelMode(false); onUpdated();
    } catch (requestError) { setError(requestError.message || "Order status could not be changed."); }
    finally { setSaving(false); }
  }

  const order = details?.order;
  const next = order ? nextStep[order.status] : null;
  const canCancel = canManage && order && !["COMPLETED", "CANCELLED"].includes(order.status);
  return <div className="dialog-backdrop order-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section aria-labelledby="order-dialog-title" aria-modal="true" className="order-dialog" role="dialog">
      <header className="order-dialog-header"><div className="order-dialog-title"><span className="dialog-icon" data-tone="positive"><ShoppingBag size={19} aria-hidden="true" /></span><div><p className="eyebrow">Order workspace</p><h2 id="order-dialog-title">{order?.orderNumber || "Loading order"}</h2>{order ? <span>{formatDate(order.placedAt || order.createdAt)} · {order.storeName}</span> : null}</div></div><button aria-label="Close order details" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header>
      {loading ? <GlobalLoader inline label="Loading order details" /> : error && !details ? <div className="order-dialog-load-error inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : details ? <>
        <div className="order-dialog-scroll">
          <section className="order-status-strip" aria-label="Order statuses"><div><small>Order</small><Status tone={statusTone[order.status]}>{statusLabel(order.status)}</Status></div><div><small>Payment</small><Status tone={statusTone[order.paymentStatus]}>{statusLabel(order.paymentStatus)}</Status></div><div><small>Fulfilment</small><Status tone={statusTone[order.fulfillmentStatus]}>{statusLabel(order.fulfillmentStatus)}</Status></div><div className="order-total"><small>Order total</small><strong>{money.format(order.grandTotal)}</strong></div></section>
          <div className="order-detail-grid">
            <div className="order-detail-main">
              <section className="order-panel"><header><div><p className="eyebrow">Line items</p><h3>{details.items.length} product line{details.items.length === 1 ? "" : "s"}</h3></div><span>{order.totalQuantity.toLocaleString("en-IN")} units</span></header><div className="order-line-items">{details.items.map((item) => <article key={item.id}><div className="order-item-image">{item.product?.imageUrl || item.product?.imageUrls?.[0] ? <img alt="" src={item.product.imageUrl || item.product.imageUrls[0]} /> : <PackageCheck size={19} aria-hidden="true" />}</div><div className="order-item-copy"><strong>{item.productName}</strong><span>{item.variantName || "Standard"} · {item.sku}</span><small>Sold by {item.merchantName}{item.substitutionPreference ? ` · ${statusLabel(item.substitutionPreference)}` : ""}</small></div><div className="order-item-quantity"><small>Qty</small><strong>{item.actualWeight || item.quantity}</strong></div><div className="order-item-price"><small>{money.format(item.unitPrice)} each</small><strong>{money.format(item.lineTotal)}</strong></div></article>)}</div><footer className="order-totals"><span><small>Subtotal</small><strong>{money.format(order.subtotal)}</strong></span><span><small>Discount</small><strong>−{money.format(order.discountTotal)}</strong></span><span><small>Tax</small><strong>{money.format(order.taxTotal)}</strong></span><span className="order-grand-total"><small>Total</small><strong>{money.format(order.grandTotal)}</strong></span></footer></section>
              <section className="order-panel"><header><div><p className="eyebrow">Marketplace split</p><h3>Seller orders</h3></div><span>{details.sellerOrders.length} allocation{details.sellerOrders.length === 1 ? "" : "s"}</span></header><div className="seller-order-list">{details.sellerOrders.map((seller) => <article key={seller.id}><span className="seller-order-icon"><Store size={17} aria-hidden="true" /></span><span><strong>{seller.merchantName}</strong><small>{seller.number}</small></span><Status tone={statusTone[seller.status]}>{statusLabel(seller.status)}</Status><strong>{money.format(seller.grandTotal)}</strong></article>)}</div></section>
              <FulfillmentWorkspace accessToken={accessToken} canManage={canManage} details={details} onChanged={async () => { await load(); onUpdated(); }} orderId={orderId} tenantId={tenantId} />
            </div>
            <aside className="order-detail-side">
              <section className="order-info-card"><span className="order-info-icon" data-tone="teal"><UserRound size={17} aria-hidden="true" /></span><div><small>Customer</small><strong>{order.customerName}</strong><p>{order.customerEmail || "No email"}<br />{order.customerPhone || "No phone"}</p></div></section>
              <section className="order-info-card"><span className="order-info-icon" data-tone="warm"><MapPin size={17} aria-hidden="true" /></span><div><small>Shipping address</small><p><Address address={order.shippingAddress} /></p></div></section>
              {order.customerNotes || order.internalNotes ? <section className="order-note-card"><small>Order notes</small>{order.customerNotes ? <p>{order.customerNotes}</p> : null}{order.internalNotes ? <p><strong>Internal:</strong> {order.internalNotes}</p> : null}</section> : null}
              <section className="order-panel order-history"><header><div><p className="eyebrow">Audit trail</p><h3>Status history</h3></div></header><ol>{details.history.map((entry) => <li key={entry.id}><span aria-hidden="true" /><div><strong>{statusLabel(entry.newStatus)}</strong><small>{entry.changedBy} · {formatDate(entry.changedAt)}</small>{entry.notes ? <p>{entry.notes}</p> : null}</div></li>)}</ol></section>
            </aside>
          </div>
          {error ? <div className="inline-state inline-state-error order-action-error" role="alert">{error}</div> : null}
        </div>
        {canManage && (next || canCancel) ? <footer className="order-dialog-actions">
          {cancelMode ? <div className="order-cancel-confirm"><label className="form-field"><span>Cancellation reason <em>*</em></span><input autoFocus minLength={3} placeholder="Explain why this order is being cancelled" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div><button className="button button-secondary" disabled={saving} onClick={() => { setCancelMode(false); setNotes(""); }} type="button">Keep order</button><button className="button button-danger" disabled={saving || notes.trim().length < 3} onClick={() => changeStatus("CANCELLED")} type="button">{saving ? "Cancelling…" : "Confirm cancellation"}</button></div></div> : <><span>Lifecycle changes are written to the permanent audit trail.</span><div>{canCancel ? <button className="button button-danger-outline" disabled={saving} onClick={() => setCancelMode(true)} type="button"><CircleX size={16} aria-hidden="true" />Cancel order</button> : null}{next ? <button className={next.status === "COMPLETED" ? "button button-success" : "button button-primary"} disabled={saving} onClick={() => changeStatus(next.status)} type="button">{saving ? "Updating…" : next.label}<ArrowRight size={16} aria-hidden="true" /></button> : null}</div></>}
        </footer> : null}
      </> : null}
    </section>
  </div>;
}

export default function OrdersPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "order.manage", tenantId);
  const canCreate = canUser(user, "admin", "order.create", tenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", paymentStatus: "ALL", fulfillmentStatus: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try { setResult(await listOrdersRequest(filters, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Orders could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const summary = useMemo(() => result?.summary || { total: 0, newToday: 0, inProgress: 0, cancelled: 0, revenue30d: 0 }, [result]);
  const orders = result?.items || [];
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));

  return <AppShell area="admin" currentPath="/admin/orders" eyebrow="Order operations" title="Orders" description="Track customer demand, marketplace splits, payments, and fulfilment from one operating view." action={canCreate ? <button className="button button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus size={16} aria-hidden="true" />New order</button> : null}>
    <section className="order-signal-grid" aria-label="Order summary"><article><span className="signal-icon" data-tone="teal"><ShoppingBag size={18} aria-hidden="true" /></span><span><small>All orders</small><strong>{summary.total.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="warm"><Clock3 size={18} aria-hidden="true" /></span><span><small>New today</small><strong>{summary.newToday.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="plum"><PackageCheck size={18} aria-hidden="true" /></span><span><small>In progress</small><strong>{summary.inProgress.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="olive"><ReceiptIndianRupee size={18} aria-hidden="true" /></span><span><small>Completed · 30 days</small><strong>{money.format(summary.revenue30d)}</strong></span></article></section>
    <section className="tenant-directory order-directory" aria-labelledby="order-directory-title"><div className="section-heading tenant-directory-heading order-directory-heading"><div><p className="eyebrow">Order directory</p><h2 id="order-directory-title">Customer orders</h2></div><form className="directory-filters order-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search orders</span><Search size={16} aria-hidden="true" /><input placeholder="Order, customer or email" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Order status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">All order statuses</option><option value="DRAFT">Draft</option><option value="PLACED">Placed</option><option value="CONFIRMED">Confirmed</option><option value="PROCESSING">Processing</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select><select aria-label="Payment status" value={filters.paymentStatus} onChange={(event) => updateFilter("paymentStatus", event.target.value)}><option value="ALL">All payments</option><option value="UNPAID">Unpaid</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="REFUNDED">Refunded</option><option value="FAILED">Failed</option></select><select aria-label="Fulfilment status" value={filters.fulfillmentStatus} onChange={(event) => updateFilter("fulfillmentStatus", event.target.value)}><option value="ALL">All fulfilment</option><option value="UNFULFILLED">Unfulfilled</option><option value="PROCESSING">Processing</option><option value="PARTIALLY_FULFILLED">Partially fulfilled</option><option value="FULFILLED">Fulfilled</option><option value="CANCELLED">Cancelled</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading customer orders" /> : orders.length === 0 ? <div className="empty-workspace"><ShoppingBag size={28} aria-hidden="true" /><h3>No orders match this view</h3><p>Change the filters or create an assisted customer order.</p>{canCreate ? <button className="button button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus size={16} aria-hidden="true" />Create order</button> : null}</div> : <><div className="table-wrap order-table-wrap"><table className="tenant-table order-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Fulfilment</th><th>Status</th><th>Placed</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><button className="order-number-link" onClick={() => setSelectedOrderId(order.id)} type="button"><strong>{order.orderNumber}</strong><small>{order.source} · {order.storeName}</small></button></td><td><span className="order-customer"><strong>{order.customerName}</strong><small>{order.customerEmail || order.customerPhone || "Guest checkout"}</small></span></td><td><span className="order-items-summary"><strong>{order.itemCount}</strong><small>{order.primaryItemName}{order.itemCount > 1 ? ` +${order.itemCount - 1}` : ""}</small></span></td><td><strong className="order-money">{money.format(order.grandTotal)}</strong></td><td><Status tone={statusTone[order.paymentStatus]}>{statusLabel(order.paymentStatus)}</Status></td><td><Status tone={statusTone[order.fulfillmentStatus]}>{statusLabel(order.fulfillmentStatus)}</Status></td><td><Status tone={statusTone[order.status]}>{statusLabel(order.status)}</Status></td><td><span className="order-date"><strong>{formatDate(order.placedAt || order.createdAt)}</strong><small>Updated {formatDate(order.updatedAt)}</small></span></td><td><button aria-label={`View order ${order.orderNumber}`} className="row-action order-view-action table-view-action" onClick={() => setSelectedOrderId(order.id)} type="button"><Eye size={15} aria-hidden="true" />View</button></td></tr>)}</tbody></table></div><TablePagination itemLabel="orders" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}
    </section>
    {selectedOrderId ? <OrderDialog accessToken={accessToken} canManage={canManage} onClose={() => setSelectedOrderId(null)} onUpdated={load} orderId={selectedOrderId} tenantId={tenantId} /> : null}
    {createOpen ? <NewOrderDialog accessToken={accessToken} onClose={() => setCreateOpen(false)} onCreated={(orderId) => { setCreateOpen(false); load(); setSelectedOrderId(orderId); }} tenantId={tenantId} /> : null}
  </AppShell>;
}
