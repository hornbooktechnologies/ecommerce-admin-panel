"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeIndianRupee, CheckCircle2, CircleX, Clock3, Eye, MapPin,
  PackageCheck, Search, ShoppingBag, Truck, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { TablePagination } from "@/components/table-pagination";
import { VendorFulfillmentWorkspace } from "@/components/vendor-fulfillment-workspace";
import { canUser, merchantIdForUser, tenantIdForUser } from "@/lib/auth-routing";
import { decideVendorOrderRequest, listVendorOrdersRequest, vendorOrderDetailsRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const tones = { PENDING: "warning", PLACED: "warning", CONFIRMED: "positive",
  PROCESSING: "warning", COMPLETED: "positive", CANCELLED: "danger", UNFULFILLED: "neutral",
  PARTIALLY_FULFILLED: "warning", FULFILLED: "positive", PAID: "positive", UNPAID: "warning",
  REFUNDED: "neutral" };
const label = (value) => value ? value.toLowerCase().replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const formatDate = (value) => value ? dateTime.format(new Date(value)) : "Not available";

function Address({ address }) {
  const parts = [address?.line1, address?.line2, address?.landmark, address?.city,
    address?.stateName || address?.state, address?.postalCode].filter(Boolean);
  return parts.length ? parts.join(", ") : "Address not captured";
}

function VendorOrderDialog({ accessToken, canFulfill, canManage, merchantId, onClose, onUpdated,
  sellerOrderId, tenantId }) {
  const [details, setDetails] = useState(null); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false); const [notes, setNotes] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDetails(await vendorOrderDetailsRequest(sellerOrderId, accessToken, tenantId, merchantId)); }
    catch (requestError) { setError(requestError.message || "Seller order could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, merchantId, sellerOrderId, tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const close = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [onClose, saving]);

  async function decide(action) {
    setSaving(true); setError("");
    try { const result = await decideVendorOrderRequest(sellerOrderId, {
      action, reasonCode: action === "REJECT" ? "VENDOR_REJECTED" : "VENDOR_ACCEPTED",
      notes: notes.trim() }, accessToken, tenantId, merchantId);
      setDetails(result); setRejecting(false); setNotes(""); onUpdated();
    } catch (requestError) { setError(requestError.message || "Seller order could not be updated."); }
    finally { setSaving(false); }
  }

  const order = details?.order; const canDecide = canManage && order
    && ["PENDING", "PLACED"].includes(order.status);
  return <div className="dialog-backdrop order-dialog-backdrop" role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section aria-labelledby="vendor-order-dialog-title" aria-modal="true"
      className="order-dialog vendor-order-dialog" role="dialog">
      <header className="order-dialog-header"><div className="order-dialog-title"><span className="dialog-icon" data-tone="positive"><ShoppingBag size={19} aria-hidden="true" /></span><div><p className="eyebrow">Seller order</p><h2 id="vendor-order-dialog-title">{order?.number || "Loading order"}</h2>{order ? <span>{order.orderNumber} · {formatDate(order.placedAt || order.createdAt)}</span> : null}</div></div><button aria-label="Close seller order details" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header>
      {loading ? <GlobalLoader inline label="Loading seller order" /> : error && !details
        ? <div className="order-dialog-load-error inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div>
        : details ? <><div className="order-dialog-scroll">
          <section className="order-status-strip" aria-label="Seller order status"><div><small>Order</small><Status tone={tones[order.status]}>{label(order.status)}</Status></div><div><small>Payment</small><Status tone={tones[order.paymentStatus]}>{label(order.paymentStatus)}</Status></div><div><small>Fulfilment</small><Status tone={tones[order.fulfillmentStatus]}>{label(order.fulfillmentStatus)}</Status></div><div className="order-total"><small>Merchant payable</small><strong>{money.format(order.merchantPayableTotal)}</strong></div></section>
          <div className="order-detail-grid"><div className="order-detail-main">
            <section className="order-panel"><header><div><p className="eyebrow">Your allocation</p><h3>{details.items.length} product line{details.items.length === 1 ? "" : "s"}</h3></div><span>{order.totalQuantity.toLocaleString("en-IN")} units</span></header><div className="order-line-items">{details.items.map((item) => <article key={item.id}><div className="order-item-image"><PackageCheck size={19} aria-hidden="true" /></div><div className="order-item-copy"><strong>{item.productName}</strong><span>{item.variantName || "Standard"} · {item.sku}</span><small>{item.substitutionPreference ? `Substitution: ${label(item.substitutionPreference)}` : label(item.status)}</small></div><div className="order-item-quantity"><small>Qty</small><strong>{item.actualWeight || item.quantity}</strong></div><div className="order-item-price"><small>{money.format(item.unitPrice)} each</small><strong>{money.format(item.lineTotal)}</strong></div></article>)}</div><footer className="order-totals"><span><small>Subtotal</small><strong>{money.format(order.subtotal)}</strong></span><span><small>Discount</small><strong>−{money.format(order.discountTotal)}</strong></span><span><small>Shipping</small><strong>{money.format(order.shippingTotal)}</strong></span><span className="order-grand-total"><small>Your total</small><strong>{money.format(order.grandTotal)}</strong></span></footer></section>
            <VendorFulfillmentWorkspace accessToken={accessToken} canManage={canFulfill}
              details={details} merchantId={merchantId} onChanged={async () => { await load(); onUpdated(); }}
              sellerOrderId={sellerOrderId} tenantId={tenantId} />
          </div><aside className="order-detail-side">
            <section className="order-info-card"><span className="order-info-icon" data-tone="teal"><UserRound size={17} aria-hidden="true" /></span><div><small>Customer</small><strong>{order.customerName}</strong><p>{order.customerEmail || "No email"}<br />{order.customerPhone || "No phone"}</p></div></section>
            <section className="order-info-card"><span className="order-info-icon" data-tone="warm"><MapPin size={17} aria-hidden="true" /></span><div><small>Ship to</small><p><Address address={order.shippingAddress} /></p></div></section>
            {order.customerNotes ? <section className="order-note-card"><small>Customer note</small><p>{order.customerNotes}</p></section> : null}
            <section className="order-panel order-history"><header><div><p className="eyebrow">Seller audit</p><h3>Decision history</h3></div></header>{details.history.length ? <ol>{details.history.map((entry) => <li key={entry.id}><span aria-hidden="true" /><div><strong>{label(entry.newStatus)}</strong><small>{entry.changedBy} · {formatDate(entry.changedAt)}</small>{entry.notes ? <p>{entry.notes}</p> : null}</div></li>)}</ol> : <div className="vendor-order-history-empty">No vendor actions recorded yet.</div>}</section>
          </aside></div>{error ? <div className="inline-state inline-state-error order-action-error" role="alert">{error}</div> : null}
        </div>{canDecide ? <footer className="order-dialog-actions vendor-order-decision">{rejecting ? <div className="order-cancel-confirm"><label className="form-field"><span>Rejection reason <em>*</em></span><input autoFocus minLength={3} placeholder="Explain why this allocation cannot be fulfilled" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div><button className="button button-secondary" disabled={saving} onClick={() => { setRejecting(false); setNotes(""); }} type="button">Keep order</button><button className="button button-danger" disabled={saving || notes.trim().length < 3} onClick={() => decide("REJECT")} type="button">{saving ? "Rejecting..." : "Confirm rejection"}</button></div></div> : <><span>Accept only when this allocation can be fulfilled.</span><div><button className="button button-danger-outline" disabled={saving} onClick={() => setRejecting(true)} type="button"><CircleX size={16} aria-hidden="true" />Reject allocation</button><button className="button button-success" disabled={saving} onClick={() => decide("ACCEPT")} type="button"><CheckCircle2 size={16} aria-hidden="true" />{saving ? "Accepting..." : "Accept order"}</button></div></>}</footer> : null}</> : null}
    </section></div>;
}

export default function VendorOrdersPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "vendor", activeTenantId);
  const merchantId = merchantIdForUser(user, tenantId);
  const canManage = canUser(user, "vendor", "vendor.order.manage", tenantId);
  const canFulfill = canUser(user, "vendor", "vendor.fulfillment.manage", tenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL",
    fulfillmentStatus: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState(""); const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !merchantId) return;
    setLoading(true); setError("");
    try { setResult(await listVendorOrdersRequest(filters, accessToken, tenantId, merchantId)); }
    catch (requestError) { setError(requestError.message || "Seller orders could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, merchantId, tenantId]);
  useEffect(() => { load(); }, [load]);
  const summary = useMemo(() => result?.summary || { total: 0, awaitingAction: 0,
    readyToFulfill: 0, processing: 0, payable30d: 0 }, [result]);
  const orders = result?.items || [];
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  return <AppShell area="vendor" currentPath="/vendor/orders" eyebrow="Seller operations" title="Orders" description="Review your marketplace allocations, customer delivery details, and fulfilment progress.">
    <section className="order-signal-grid vendor-order-signals" aria-label="Seller order summary"><article><span className="signal-icon" data-tone="warm"><Clock3 size={18} aria-hidden="true" /></span><span><small>Awaiting action</small><strong>{summary.awaitingAction.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="teal"><CheckCircle2 size={18} aria-hidden="true" /></span><span><small>Ready to fulfil</small><strong>{summary.readyToFulfill.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="plum"><Truck size={18} aria-hidden="true" /></span><span><small>In progress</small><strong>{summary.processing.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="olive"><BadgeIndianRupee size={18} aria-hidden="true" /></span><span><small>Payable · 30 days</small><strong>{money.format(summary.payable30d)}</strong></span></article></section>
    <section className="tenant-directory order-directory vendor-order-directory" aria-labelledby="vendor-order-directory-title"><div className="section-heading tenant-directory-heading order-directory-heading"><div><p className="eyebrow">Order queue</p><h2 id="vendor-order-directory-title">Seller allocations</h2></div><form className="directory-filters order-filters vendor-order-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search seller orders</span><Search size={16} aria-hidden="true" /><input placeholder="Seller order, customer or SKU" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Seller order status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">All order statuses</option><option value="PENDING">Pending</option><option value="PLACED">Placed</option><option value="CONFIRMED">Confirmed</option><option value="PROCESSING">Processing</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select><select aria-label="Fulfilment status" value={filters.fulfillmentStatus} onChange={(event) => updateFilter("fulfillmentStatus", event.target.value)}><option value="ALL">All fulfilment</option><option value="UNFULFILLED">Unfulfilled</option><option value="PROCESSING">Processing</option><option value="PARTIALLY_FULFILLED">Partially fulfilled</option><option value="FULFILLED">Fulfilled</option><option value="CANCELLED">Cancelled</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading seller orders" /> : !orders.length ? <div className="empty-workspace"><ShoppingBag size={28} aria-hidden="true" /><h3>No seller orders match this view</h3><p>New allocations will appear after customers order one of your active offers.</p></div> : <><div className="table-wrap order-table-wrap"><table className="tenant-table order-table vendor-order-table"><thead><tr><th>Seller order</th><th>Customer</th><th>Items</th><th>Your total</th><th>Payment</th><th>Fulfilment</th><th>Status</th><th>Placed</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><button className="order-number-link" onClick={() => setSelected(order.id)} type="button"><strong>{order.number}</strong><small>{order.orderNumber} · {order.storeName}</small></button></td><td><span className="order-customer"><strong>{order.customerName}</strong><small>{order.customerEmail || order.customerPhone || "Guest customer"}</small></span></td><td><span className="order-items-summary"><strong>{order.itemCount}</strong><small>{order.primaryItemName}{order.itemCount > 1 ? ` +${order.itemCount - 1}` : ""}</small></span></td><td><strong className="order-money">{money.format(order.grandTotal)}</strong></td><td><Status tone={tones[order.paymentStatus]}>{label(order.paymentStatus)}</Status></td><td><Status tone={tones[order.fulfillmentStatus]}>{label(order.fulfillmentStatus)}</Status></td><td><Status tone={tones[order.status]}>{label(order.status)}</Status></td><td><span className="order-date"><strong>{formatDate(order.placedAt || order.createdAt)}</strong><small>Updated {formatDate(order.updatedAt)}</small></span></td><td><button aria-label={`View seller order ${order.number}`} className="row-action order-view-action table-view-action" onClick={() => setSelected(order.id)} type="button"><Eye size={15} aria-hidden="true" />View</button></td></tr>)}</tbody></table></div><TablePagination itemLabel="seller orders" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}
    </section>{selected ? <VendorOrderDialog accessToken={accessToken} canFulfill={canFulfill}
      canManage={canManage} merchantId={merchantId} onClose={() => setSelected(null)}
      onUpdated={load} sellerOrderId={selected} tenantId={tenantId} /> : null}
  </AppShell>;
}
