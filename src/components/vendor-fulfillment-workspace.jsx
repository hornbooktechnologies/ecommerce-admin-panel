"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Boxes, CalendarClock, Check, ChevronRight, CircleAlert, PackageCheck,
  ScanLine, ShieldCheck, Truck, Warehouse, X } from "lucide-react";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { allocateVendorFulfillmentRequest, transitionVendorFulfillmentRequest,
  vendorFulfillmentOptionsRequest } from "@/lib/api-client";

const statusTone = { PENDING: "warning", PICKING: "warning", PACKED: "positive",
  DISPATCHED: "positive", COMPLETED: "positive", CANCELLED: "danger" };
const statusLabel = (value) => value?.toLowerCase().replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Pending";
const shortDate = (value) => value ? new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric"
}).format(new Date(value)) : "No expiry";
const nextAction = {
  PENDING: { status: "PICKING", label: "Start picking", icon: ScanLine, className: "button-secondary" },
  PICKING: { status: "PACKED", label: "Mark packed", icon: PackageCheck, className: "button-warning" },
  PACKED: { status: "DISPATCHED", label: "Dispatch shipment", icon: Truck, className: "button-success" },
  DISPATCHED: { status: "COMPLETED", label: "Confirm delivery", icon: Check, className: "button-success" }
};

function AllocationDialog({ accessToken, merchantId, onClose, onCreated, sellerOrderId, tenantId }) {
  const [options, setOptions] = useState(null); const [warehouseId, setWarehouseId] = useState("");
  const [serials, setSerials] = useState({}); const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    vendorFulfillmentOptionsRequest(sellerOrderId, accessToken, tenantId, merchantId)
      .then((result) => { if (!active) return; setOptions(result); setWarehouseId(result.warehouses[0]?.id || ""); })
      .catch((requestError) => { if (active) setError(requestError.message || "Warehouse stock could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, merchantId, sellerOrderId, tenantId]);
  useEffect(() => {
    const close = (event) => { if (event.key === "Escape" && !saving) {
      event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [onClose, saving]);
  const seller = options?.sellerOrder;
  const readiness = useMemo(() => (seller?.items || []).map((item) => {
    const inventory = options.inventory.find((entry) => entry.allocationId === item.id
      && entry.warehouseId === warehouseId);
    const selected = serials[item.id] || [];
    return { item, inventory, selected, ready: (inventory?.availableQuantity || 0) >= item.quantity
      && (!item.serialTracking || selected.length === item.quantity) };
  }), [options, seller, serials, warehouseId]);
  const canAllocate = Boolean(warehouseId && readiness.length && readiness.every((entry) => entry.ready));
  function toggleSerial(itemId, serialId, limit) {
    setSerials((current) => { const selected = current[itemId] || [];
      const next = selected.includes(serialId) ? selected.filter((id) => id !== serialId)
        : selected.length < limit ? [...selected, serialId] : selected;
      return { ...current, [itemId]: next }; });
  }
  async function submit(event) {
    event.preventDefault(); if (!canAllocate) return; setSaving(true); setError("");
    try {
      await allocateVendorFulfillmentRequest(sellerOrderId, { warehouseId, notes,
        serialAssignments: readiness.filter(({ item }) => item.serialTracking)
          .map(({ item, selected }) => ({ orderItemId: item.orderItemId || item.id,
            bundleComponentId: item.bundleComponentId || null, serialIds: selected }))
      }, accessToken, tenantId, merchantId);
      await onCreated();
    } catch (requestError) {
      setError(requestError.details?.[0]?.message || requestError.message || "Stock could not be reserved.");
    } finally { setSaving(false); }
  }
  return <div className="dialog-backdrop fulfillment-dialog-backdrop vendor-fulfillment-dialog-backdrop"
    role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section aria-labelledby="vendor-allocation-title" aria-modal="true" className="fulfillment-dialog" role="dialog">
      <header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><Warehouse size={19} aria-hidden="true" /></span><div><p className="eyebrow">Warehouse allocation</p><h2 id="vendor-allocation-title">Reserve stock for {seller?.number || "seller order"}</h2></div><button aria-label="Close stock allocation" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header>
      {loading ? <GlobalLoader inline label="Loading warehouse stock" /> : !options
        ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div>
        : <form onSubmit={submit}><div className="fulfillment-dialog-scroll">
          <label className="form-field"><span>Fulfilment warehouse <em>*</em></span><select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setSerials({}); }}><option value="">Select warehouse</option>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.city}</option>)}</select><small>Only active warehouses owned by your vendor account are shown.</small></label>
          {!options.warehouses.length ? <div className="fulfillment-empty"><Warehouse size={24} aria-hidden="true" /><strong>No compatible warehouse</strong><span>Ask the marketplace administrator to assign an active warehouse and receive stock for this offer.</span></div> : <div className="allocation-item-list">{readiness.map(({ item, inventory, selected, ready }) => <article className={ready ? "is-ready" : ""} key={item.id}><header><span className="manual-offer-icon"><Boxes size={17} aria-hidden="true" /></span><div><strong>{item.productName}</strong>{item.bundleProductName ? <small>Component of {item.bundleProductName}</small> : null}<span>{item.variantName || item.sku} · {item.quantity} required</span></div>{ready ? <span className="allocation-ready"><Check size={14} aria-hidden="true" />Ready</span> : <span className="allocation-short"><CircleAlert size={14} aria-hidden="true" />Action needed</span>}</header><div className="allocation-stock-row"><span><small>Available</small><strong>{inventory?.availableQuantity || 0}</strong></span><span><small>Reserved</small><strong>{inventory?.reservedQuantity || 0}</strong></span>{item.lotTracking ? <span><small>Usable batches</small><strong>{inventory?.lots.length || 0}</strong></span> : null}{item.warrantyMonths ? <span><small>Warranty</small><strong>{item.warrantyMonths} months</strong></span> : null}</div>{item.lotTracking ? <div className="vendor-lot-preview"><span><CalendarClock size={15} aria-hidden="true" /><strong>FEFO batch plan</strong><small>Earliest expiry is reserved first</small></span>{(inventory?.lots || []).slice(0, 4).map((lot) => <span key={lot.id}><strong>{lot.lotNumber}</strong><small>{lot.availableQuantity} available · expires {shortDate(lot.expiresAt)}</small></span>)}{!inventory?.lots.length ? <p>No usable, unexpired batch stock is available.</p> : null}</div> : null}{item.serialTracking ? <fieldset className="serial-picker"><legend><ShieldCheck size={14} aria-hidden="true" />Select {item.quantity} serial number{item.quantity === 1 ? "" : "s"} · {selected.length} selected</legend><div>{(inventory?.serials || []).map((serial) => <label className={selected.includes(serial.id) ? "is-selected" : ""} key={serial.id}><input checked={selected.includes(serial.id)} onChange={() => toggleSerial(item.id, serial.id, item.quantity)} type="checkbox" /><span>{serial.number}</span><Check size={13} aria-hidden="true" /></label>)}</div>{!inventory?.serials.length ? <p>No available serial numbers in this warehouse.</p> : null}</fieldset> : null}</article>)}</div>}
          <label className="form-field fulfillment-notes"><span>Allocation notes</span><textarea maxLength={1000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div> : null}
        </div><footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !canAllocate} type="submit"><Warehouse size={16} aria-hidden="true" />{saving ? "Reserving stock…" : "Allocate and reserve"}</button></footer></form>}
    </section></div>;
}

function DispatchDialog({ accessToken, fulfillment, merchantId, onClose, onSaved, sellerOrderId, tenantId }) {
  const [form, setForm] = useState({ providerCode: "", serviceCode: "", trackingNumber: "",
    packageCount: "1", packageWeight: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  useEffect(() => { const close = (event) => { if (event.key === "Escape" && !saving) {
    event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", close, true); return () => window.removeEventListener("keydown", close, true);
  }, [onClose, saving]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await transitionVendorFulfillmentRequest(sellerOrderId, fulfillment.id, { status: "DISPATCHED",
        ...form, packageCount: Number(form.packageCount),
        packageWeight: form.packageWeight ? Number(form.packageWeight) : null
      }, accessToken, tenantId, merchantId); await onSaved();
    } catch (requestError) { setError(requestError.details?.[0]?.message || requestError.message
      || "Shipment could not be dispatched."); } finally { setSaving(false); }
  }
  return <div className="dialog-backdrop fulfillment-dialog-backdrop vendor-fulfillment-dialog-backdrop" role="presentation"><section aria-labelledby="vendor-dispatch-title" aria-modal="true" className="fulfillment-dialog dispatch-dialog" role="dialog"><header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><Truck size={19} aria-hidden="true" /></span><div><p className="eyebrow">Manual shipment</p><h2 id="vendor-dispatch-title">Dispatch {fulfillment.number}</h2></div><button aria-label="Close dispatch form" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header><form onSubmit={submit}><div className="fulfillment-dialog-scroll"><div className="form-grid"><label className="form-field"><span>Carrier <em>*</em></span><input autoFocus maxLength={50} placeholder="e.g. Delhivery" required value={form.providerCode} onChange={(event) => update("providerCode", event.target.value)} /></label><label className="form-field"><span>Service</span><input maxLength={80} placeholder="Surface / Express" value={form.serviceCode} onChange={(event) => update("serviceCode", event.target.value)} /></label><label className="form-field fulfillment-span-2"><span>Tracking number <em>*</em></span><input maxLength={190} required value={form.trackingNumber} onChange={(event) => update("trackingNumber", event.target.value)} /></label><label className="form-field"><span>Packages <em>*</em></span><input min="1" max="999" required type="number" value={form.packageCount} onChange={(event) => update("packageCount", event.target.value)} /></label><label className="form-field"><span>Total weight (kg)</span><input min="0.001" step="0.001" type="number" value={form.packageWeight} onChange={(event) => update("packageWeight", event.target.value)} /></label><label className="form-field"><span>Dispatch location</span><input maxLength={190} value={form.location} onChange={(event) => update("location", event.target.value)} /></label><label className="form-field"><span>Notes</span><input maxLength={1000} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div><p className="dispatch-warning"><CircleAlert size={15} aria-hidden="true" />Dispatch deducts reserved stock and starts serialized-product warranties. Carrier details remain manual until shipping integration is configured.</p>{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span></div> : null}</div><footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving} type="submit"><Truck size={16} aria-hidden="true" />{saving ? "Dispatching…" : "Confirm dispatch"}</button></footer></form></section></div>;
}

function AllocationTrace({ allocations = [] }) {
  if (!allocations.length) return null;
  return <div className="vendor-allocation-trace">{allocations.map((allocation) => <article key={allocation.id}><span><strong>{allocation.productName}</strong><small>{allocation.variantName || allocation.sku} · {allocation.requestedQuantity} reserved</small></span>{allocation.lot ? <span className="vendor-trace-chip"><CalendarClock size={13} aria-hidden="true" />Batch {allocation.lot.number} · {shortDate(allocation.lot.expiresAt)}</span> : null}{allocation.serials.map((serial) => <span className="vendor-trace-chip" key={serial.id}><ShieldCheck size={13} aria-hidden="true" />{serial.number}</span>)}</article>)}</div>;
}

export function VendorFulfillmentWorkspace({ accessToken, canManage, details, merchantId,
  onChanged, sellerOrderId, tenantId }) {
  const [allocating, setAllocating] = useState(false); const [dispatching, setDispatching] = useState(null);
  const [busyId, setBusyId] = useState(""); const [error, setError] = useState("");
  const fulfillments = details.fulfillments || [];
  const canAllocate = canManage && details.order.status === "CONFIRMED"
    && details.order.fulfillmentStatus === "UNFULFILLED" && !fulfillments.length;
  async function advance(fulfillment, status) {
    if (status === "DISPATCHED") return setDispatching(fulfillment);
    setBusyId(fulfillment.id); setError("");
    try { await transitionVendorFulfillmentRequest(sellerOrderId, fulfillment.id, { status,
      notes: status === "COMPLETED" ? "Delivery confirmed manually by vendor." : ""
    }, accessToken, tenantId, merchantId); await onChanged(); }
    catch (requestError) { setError(requestError.message || "Fulfilment status could not be changed."); }
    finally { setBusyId(""); }
  }
  return <section className="order-panel fulfillment-panel vendor-fulfillment-workspace"><header><div><p className="eyebrow">Warehouse fulfilment</p><h3>Pick, pack and dispatch</h3></div>{canAllocate ? <button className="button button-secondary fulfillment-allocate" onClick={() => setAllocating(true)} type="button"><Warehouse size={15} aria-hidden="true" />Allocate stock</button> : <span>{fulfillments.length} fulfilment{fulfillments.length === 1 ? "" : "s"}</span>}</header>
    {fulfillments.length ? <div className="fulfillment-list">{fulfillments.map((fulfillment) => { const action = nextAction[fulfillment.status]; const Icon = action?.icon || Check; return <article key={fulfillment.id}><div className="fulfillment-card-head"><span className="fulfillment-warehouse-icon"><Warehouse size={18} aria-hidden="true" /></span><div><strong>{fulfillment.number}</strong><span>{fulfillment.warehouseName}</span></div><Status tone={statusTone[fulfillment.status]}>{statusLabel(fulfillment.status)}</Status></div><div className="fulfillment-progress" data-status={fulfillment.status}>{["Allocated", "Picking", "Packed", "Dispatched", "Delivered"].map((step, index) => { const current = ["PENDING", "PICKING", "PACKED", "DISPATCHED", "COMPLETED"].indexOf(fulfillment.status); return <span className={index <= current ? "is-active" : ""} key={step}><i>{index < current || fulfillment.status === "COMPLETED" ? <Check size={11} aria-hidden="true" /> : index + 1}</i><small>{step}</small></span>; })}</div><AllocationTrace allocations={fulfillment.allocations} />{fulfillment.shipment ? <div className="shipment-summary"><Truck size={15} aria-hidden="true" /><span><small>{fulfillment.shipment.providerCode}</small><strong>{fulfillment.shipment.trackingNumber}</strong></span><Status tone={fulfillment.shipment.status === "DELIVERED" ? "positive" : "warning"}>{statusLabel(fulfillment.shipment.status)}</Status></div> : null}{canManage && action ? <footer><span>{fulfillment.allocations?.length || 0} reserved stock line{fulfillment.allocations?.length === 1 ? "" : "s"}</span><button className={`button ${action.className}`} disabled={busyId === fulfillment.id} onClick={() => advance(fulfillment, action.status)} type="button"><Icon size={15} aria-hidden="true" />{busyId === fulfillment.id ? "Updating…" : action.label}<ChevronRight size={14} aria-hidden="true" /></button></footer> : null}</article>; })}</div> : <div className="fulfillment-empty"><Boxes size={25} aria-hidden="true" /><strong>{details.order.status === "CONFIRMED" ? "No stock allocated yet" : "Accept this order first"}</strong><span>{details.order.status === "CONFIRMED" ? canAllocate ? "Reserve stock from one of your active warehouses." : "You do not have permission to allocate warehouse stock." : "Accepted orders become available for warehouse allocation."}</span>{canAllocate ? <button className="button button-primary" onClick={() => setAllocating(true)} type="button"><Warehouse size={15} aria-hidden="true" />Allocate stock</button> : null}</div>}
    {error ? <div className="inline-state inline-state-error fulfillment-error" role="alert"><span>{error}</span></div> : null}
    {allocating ? createPortal(<AllocationDialog accessToken={accessToken} merchantId={merchantId} onClose={() => setAllocating(false)} onCreated={async () => { setAllocating(false); await onChanged(); }} sellerOrderId={sellerOrderId} tenantId={tenantId} />, document.body) : null}
    {dispatching ? createPortal(<DispatchDialog accessToken={accessToken} fulfillment={dispatching} merchantId={merchantId} onClose={() => setDispatching(null)} onSaved={async () => { setDispatching(null); await onChanged(); }} sellerOrderId={sellerOrderId} tenantId={tenantId} />, document.body) : null}
  </section>;
}
