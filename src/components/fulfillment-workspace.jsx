"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Boxes, Check, ChevronRight, CircleAlert, PackageCheck,
  ScanLine, ShieldCheck, Truck, Warehouse, X
} from "lucide-react";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import {
  allocateFulfillmentRequest, fulfillmentOptionsRequest, transitionFulfillmentRequest
} from "@/lib/api-client";

const statusTone = { PENDING: "warning", PICKING: "warning", PACKED: "positive",
  DISPATCHED: "positive", COMPLETED: "positive", CANCELLED: "danger" };
const statusLabel = (value) => value?.toLowerCase().replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Pending";
const nextAction = {
  PENDING: { status: "PICKING", label: "Start picking", icon: ScanLine },
  PICKING: { status: "PACKED", label: "Mark packed", icon: PackageCheck },
  PACKED: { status: "DISPATCHED", label: "Dispatch shipment", icon: Truck },
  DISPATCHED: { status: "COMPLETED", label: "Confirm delivery", icon: Check }
};

function AllocationDialog({ accessToken, onClose, onCreated, orderId, tenantId }) {
  const [options, setOptions] = useState(null);
  const [sellerOrderId, setSellerOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [serials, setSerials] = useState({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fulfillmentOptionsRequest(orderId, accessToken, tenantId).then((result) => {
      if (!active) return;
      const first = result.sellerOrders.find((seller) => !seller.hasFulfillment
        && seller.fulfillmentStatus !== "FULFILLED");
      setOptions(result); setSellerOrderId(first?.id || "");
    }).catch((requestError) => {
      if (active) setError(requestError.message || "Fulfilment options could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, orderId, tenantId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) { event.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, saving]);

  const seller = options?.sellerOrders.find((entry) => entry.id === sellerOrderId);
  const warehouses = useMemo(() => (options?.warehouses || []).filter((warehouse) =>
    warehouse.merchantId === seller?.merchantId), [options, seller]);

  useEffect(() => {
    setWarehouseId((current) => warehouses.some((warehouse) => warehouse.id === current)
      ? current : warehouses[0]?.id || "");
    setSerials({});
  }, [sellerOrderId, warehouses]);

  const itemReadiness = (seller?.items || []).map((item) => {
    const inventory = options?.inventory.find((entry) => entry.allocationId === item.id
      && entry.warehouseId === warehouseId);
    const selected = serials[item.id] || [];
    const ready = inventory?.availableQuantity >= item.quantity
      && (!item.serialTracking || selected.length === item.quantity);
    return { item, inventory, selected, ready };
  });
  const canAllocate = Boolean(seller && warehouseId && itemReadiness.length
    && itemReadiness.every((item) => item.ready));

  function toggleSerial(itemId, serialId, limit) {
    setSerials((current) => {
      const selected = current[itemId] || [];
      const next = selected.includes(serialId) ? selected.filter((id) => id !== serialId)
        : selected.length < limit ? [...selected, serialId] : selected;
      return { ...current, [itemId]: next };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!canAllocate) return;
    setSaving(true); setError("");
    try {
      await allocateFulfillmentRequest(orderId, { sellerOrderId, warehouseId, notes,
        serialAssignments: itemReadiness.filter(({ item }) => item.serialTracking)
          .map(({ item, selected }) => ({ orderItemId: item.orderItemId || item.id,
            bundleComponentId: item.bundleComponentId || null, serialIds: selected }))
      }, accessToken, tenantId);
      onCreated();
    } catch (requestError) {
      setError(requestError.details?.[0]?.message || requestError.message || "Stock could not be allocated.");
    } finally { setSaving(false); }
  }

  return createPortal(<div className="dialog-backdrop fulfillment-dialog-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !saving) onClose();
  }}><section aria-labelledby="allocation-title" aria-modal="true" className="fulfillment-dialog" role="dialog">
    <header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><Warehouse size={19} aria-hidden="true" /></span><div><p className="eyebrow">Warehouse allocation</p><h2 id="allocation-title">Reserve fulfilment stock</h2></div><button aria-label="Close stock allocation" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={18} aria-hidden="true" /></button></header>
    {loading ? <GlobalLoader inline label="Loading warehouse stock" /> : !options ? <div className="inline-state inline-state-error" role="alert">{error}</div> : <form onSubmit={submit}>
      <div className="fulfillment-dialog-scroll">
        <div className="fulfillment-allocation-grid"><label className="form-field"><span>Seller order <em>*</em></span><select value={sellerOrderId} onChange={(event) => setSellerOrderId(event.target.value)}>{options.sellerOrders.filter((entry) => !entry.hasFulfillment && entry.fulfillmentStatus !== "FULFILLED").map((entry) => <option key={entry.id} value={entry.id}>{entry.number} · {entry.merchantName}</option>)}</select></label><label className="form-field"><span>Warehouse <em>*</em></span><select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setSerials({}); }}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.city}</option>)}</select></label></div>
        {!seller ? <div className="fulfillment-empty"><Boxes size={25} aria-hidden="true" /><strong>Nothing left to allocate</strong><span>Every seller order already has a fulfilment record.</span></div> : <div className="allocation-item-list">{itemReadiness.map(({ item, inventory, selected, ready }) => <article className={ready ? "is-ready" : ""} key={item.id}><header><span className="manual-offer-icon"><Boxes size={17} aria-hidden="true" /></span><div><strong>{item.productName}</strong>{item.bundleProductName ? <small>Component of {item.bundleProductName}</small> : null}<span>{item.variantName || item.sku} · {item.quantity} required</span></div>{ready ? <span className="allocation-ready"><Check aria-hidden="true" size={14} />Ready</span> : <span className="allocation-short"><CircleAlert aria-hidden="true" size={14} />Action needed</span>}</header><div className="allocation-stock-row"><span><small>Available</small><strong>{inventory?.availableQuantity || 0}</strong></span><span><small>Reserved</small><strong>{inventory?.reservedQuantity || 0}</strong></span>{item.lotTracking ? <span><small>FEFO batches</small><strong>{inventory?.lots.length || 0}</strong></span> : null}{item.warrantyMonths ? <span><small>Warranty</small><strong>{item.warrantyMonths} months</strong></span> : null}</div>{item.serialTracking ? <fieldset className="serial-picker"><legend><ShieldCheck size={14} aria-hidden="true" />Select {item.quantity} serial number{item.quantity === 1 ? "" : "s"} · {selected.length} selected</legend><div>{(inventory?.serials || []).map((serial) => <label className={selected.includes(serial.id) ? "is-selected" : ""} key={serial.id}><input checked={selected.includes(serial.id)} onChange={() => toggleSerial(item.id, serial.id, item.quantity)} type="checkbox" /><span>{serial.number}</span><Check size={13} aria-hidden="true" /></label>)}</div>{!inventory?.serials.length ? <p>No available serial numbers in this warehouse.</p> : null}</fieldset> : null}</article>)}</div>}
        <label className="form-field fulfillment-notes"><span>Allocation notes</span><textarea maxLength={1000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
      </div>
      <footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !canAllocate} type="submit"><Warehouse size={16} aria-hidden="true" />{saving ? "Reserving stock…" : "Allocate and reserve"}</button></footer>
    </form>}
  </section></div>, document.body);
}

function DispatchDialog({ accessToken, fulfillment, onClose, onSaved, orderId, tenantId }) {
  const [form, setForm] = useState({ providerCode: "", serviceCode: "", trackingNumber: "",
    packageCount: "1", packageWeight: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) { event.stopImmediatePropagation(); onClose(); }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, saving]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await transitionFulfillmentRequest(orderId, fulfillment.id, { status: "DISPATCHED",
        ...form, packageCount: Number(form.packageCount),
        packageWeight: form.packageWeight ? Number(form.packageWeight) : null
      }, accessToken, tenantId);
      onSaved();
    } catch (requestError) {
      setError(requestError.details?.[0]?.message || requestError.message || "Shipment could not be dispatched.");
    } finally { setSaving(false); }
  }
  return <div className="dialog-backdrop fulfillment-dialog-backdrop" role="presentation"><section aria-labelledby="dispatch-title" aria-modal="true" className="fulfillment-dialog dispatch-dialog" role="dialog"><header className="access-dialog-head"><span className="dialog-icon" data-tone="positive"><Truck size={19} aria-hidden="true" /></span><div><p className="eyebrow">Manual shipment</p><h2 id="dispatch-title">Dispatch {fulfillment.number}</h2></div><button aria-label="Close dispatch form" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header><form onSubmit={submit}><div className="fulfillment-dialog-scroll"><div className="form-grid"><label className="form-field"><span>Carrier <em>*</em></span><input autoFocus maxLength={50} placeholder="e.g. Delhivery" required value={form.providerCode} onChange={(event) => update("providerCode", event.target.value)} /></label><label className="form-field"><span>Service</span><input maxLength={80} placeholder="Surface / Express" value={form.serviceCode} onChange={(event) => update("serviceCode", event.target.value)} /></label><label className="form-field fulfillment-span-2"><span>Tracking number <em>*</em></span><input maxLength={190} required value={form.trackingNumber} onChange={(event) => update("trackingNumber", event.target.value)} /></label><label className="form-field"><span>Packages <em>*</em></span><input min="1" max="999" required type="number" value={form.packageCount} onChange={(event) => update("packageCount", event.target.value)} /></label><label className="form-field"><span>Total weight (kg)</span><input min="0.001" step="0.001" type="number" value={form.packageWeight} onChange={(event) => update("packageWeight", event.target.value)} /></label><label className="form-field"><span>Dispatch location</span><input maxLength={190} value={form.location} onChange={(event) => update("location", event.target.value)} /></label><label className="form-field"><span>Notes</span><input maxLength={1000} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div><p className="dispatch-warning"><CircleAlert size={15} aria-hidden="true" />Dispatch permanently deducts reserved stock and activates serialized-product warranties.</p>{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions"><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving} type="submit"><Truck size={16} aria-hidden="true" />{saving ? "Dispatching…" : "Confirm dispatch"}</button></footer></form></section></div>;
}

export function FulfillmentWorkspace({ accessToken, canManage, details, onChanged, orderId, tenantId }) {
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [dispatching, setDispatching] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const fulfillments = details.fulfillments || [];
  const unallocated = details.sellerOrders.filter((seller) => seller.fulfillmentStatus !== "FULFILLED"
    && !fulfillments.some((fulfillment) => fulfillment.sellerOrderId === seller.id));
  const canAllocate = canManage && ["CONFIRMED", "PROCESSING"].includes(details.order.status)
    && unallocated.length > 0;

  async function advance(fulfillment, status) {
    if (status === "DISPATCHED") return setDispatching(fulfillment);
    setBusyId(fulfillment.id); setError("");
    try {
      await transitionFulfillmentRequest(orderId, fulfillment.id, { status,
        notes: status === "COMPLETED" ? "Delivery confirmed manually." : ""
      }, accessToken, tenantId);
      await onChanged();
    } catch (requestError) {
      setError(requestError.message || "Fulfilment status could not be changed.");
    } finally { setBusyId(""); }
  }

  return <section className="order-panel fulfillment-panel"><header><div><p className="eyebrow">Warehouse fulfilment</p><h3>Pick, pack and dispatch</h3></div>{canAllocate ? <button className="button button-secondary fulfillment-allocate" onClick={() => setAllocateOpen(true)} type="button"><Warehouse size={15} aria-hidden="true" />Allocate stock</button> : <span>{fulfillments.length} fulfilment{fulfillments.length === 1 ? "" : "s"}</span>}</header>
    {fulfillments.length ? <div className="fulfillment-list">{fulfillments.map((fulfillment) => {
      const action = nextAction[fulfillment.status];
      const Icon = action?.icon || Check;
      return <article key={fulfillment.id}><div className="fulfillment-card-head"><span className="fulfillment-warehouse-icon"><Warehouse size={18} aria-hidden="true" /></span><div><strong>{fulfillment.number}</strong><span>{fulfillment.warehouseName} · {fulfillment.merchantName}</span></div><Status tone={statusTone[fulfillment.status]}>{statusLabel(fulfillment.status)}</Status></div><div className="fulfillment-progress" data-status={fulfillment.status}>{["Allocated", "Picking", "Packed", "Dispatched", "Delivered"].map((label, index) => { const statusIndex = ["PENDING", "PICKING", "PACKED", "DISPATCHED", "COMPLETED"].indexOf(fulfillment.status); return <span className={index <= statusIndex ? "is-active" : ""} key={label}><i>{index < statusIndex || fulfillment.status === "COMPLETED" ? <Check size={11} /> : index + 1}</i><small>{label}</small></span>; })}</div>{fulfillment.shipment ? <div className="shipment-summary"><Truck size={15} aria-hidden="true" /><span><small>{fulfillment.shipment.providerCode}</small><strong>{fulfillment.shipment.trackingNumber}</strong></span><Status tone={fulfillment.shipment.status === "DELIVERED" ? "positive" : "warning"}>{statusLabel(fulfillment.shipment.status)}</Status></div> : null}{canManage && action ? <footer><span>{fulfillment.itemCount} reserved stock line{fulfillment.itemCount === 1 ? "" : "s"}</span><button className={action.status === "COMPLETED" ? "button button-success" : "button button-primary"} disabled={busyId === fulfillment.id} onClick={() => advance(fulfillment, action.status)} type="button"><Icon size={15} aria-hidden="true" />{busyId === fulfillment.id ? "Updating…" : action.label}<ChevronRight size={14} aria-hidden="true" /></button></footer> : null}</article>;
    })}</div> : <div className="fulfillment-empty"><Boxes size={25} aria-hidden="true" /><strong>{details.order.status === "PLACED" ? "Confirm this order first" : "No stock allocated yet"}</strong><span>{details.order.status === "PLACED" ? "Confirmation makes the order available to warehouse operations." : canAllocate ? "Choose a seller order and reserve stock from a compatible warehouse." : "There are no seller orders awaiting allocation."}</span>{canAllocate ? <button className="button button-primary" onClick={() => setAllocateOpen(true)} type="button"><Warehouse size={15} aria-hidden="true" />Allocate stock</button> : null}</div>}
    {error ? <div className="inline-state inline-state-error fulfillment-error" role="alert">{error}</div> : null}
    {allocateOpen ? <AllocationDialog accessToken={accessToken} onClose={() => setAllocateOpen(false)} onCreated={async () => { setAllocateOpen(false); await onChanged(); }} orderId={orderId} tenantId={tenantId} /> : null}
    {dispatching ? createPortal(<DispatchDialog accessToken={accessToken} fulfillment={dispatching} onClose={() => setDispatching(null)} onSaved={async () => { setDispatching(null); await onChanged(); }} orderId={orderId} tenantId={tenantId} />, document.body) : null}
  </section>;
}
