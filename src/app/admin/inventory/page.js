"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Boxes, CalendarClock, Check, ClipboardCheck, Hash, MapPin, PackagePlus, Plus, Search, Settings2, Warehouse, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GlobalLoader } from "@/components/global-loader";
import { InventoryTraceability } from "@/components/inventory-traceability";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { adjustInventoryRequest, createWarehouseRequest, inventoryBalanceRequest,
  inventoryOptionsRequest, listInventoryRequest, receiveInventoryRequest,
  transferInventoryRequest, updateInventoryPolicyRequest } from "@/lib/api-client";

const healthTone = { HEALTHY: "positive", LOW: "warning", OUT: "danger" };
const healthLabel = { HEALTHY: "Healthy", LOW: "Low stock", OUT: "Out of stock" };
const emptyWarehouse = { code: "", name: "", line1: "", line2: "", city: "", stateCode: "", stateName: "", postalCode: "" };

function DialogHeader({ eyebrow, icon: Icon, onClose, title }) {
  return <header className="access-dialog-head catalog-dialog-head"><div className="dialog-icon" data-tone="positive"><Icon size={19} aria-hidden="true" /></div><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X size={18} /></button></header>;
}

function WarehouseDialog({ accessToken, onClose, onSaved, tenantId }) {
  const [form, setForm] = useState(emptyWarehouse);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await createWarehouseRequest(form, accessToken, tenantId); onSaved(); }
    catch (requestError) { setError(requestError.message || "Warehouse could not be created."); }
    finally { setSaving(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="catalog-dialog inventory-operation-dialog" role="dialog"><DialogHeader eyebrow="Fulfilment setup" icon={Warehouse} onClose={onClose} title="New warehouse" /><form onSubmit={submit}><div className="catalog-form-scroll"><div className="inventory-dialog-intro"><strong>Where stock is physically held</strong><span>This address is stored in India and linked to your first-party retail operation.</span></div><div className="form-grid inventory-form-grid"><label className="form-field"><span>Warehouse code <em>*</em></span><input autoFocus maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9_-]+" placeholder="BLR-01" required value={form.code} onChange={(event) => update("code", event.target.value.toUpperCase())} /></label><label className="form-field"><span>Warehouse name <em>*</em></span><input maxLength={190} placeholder="Bengaluru central" required value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label className="form-field catalog-span-2"><span>Address line 1 <em>*</em></span><input maxLength={255} required value={form.line1} onChange={(event) => update("line1", event.target.value)} /></label><label className="form-field catalog-span-2"><span>Address line 2</span><input maxLength={255} value={form.line2} onChange={(event) => update("line2", event.target.value)} /></label><label className="form-field"><span>City <em>*</em></span><input maxLength={120} required value={form.city} onChange={(event) => update("city", event.target.value)} /></label><label className="form-field"><span>PIN code <em>*</em></span><input inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required value={form.postalCode} onChange={(event) => update("postalCode", event.target.value.replace(/\D/g, ""))} /></label><label className="form-field"><span>State code <em>*</em></span><input maxLength={2} placeholder="KA" required value={form.stateCode} onChange={(event) => update("stateCode", event.target.value.toUpperCase())} /></label><label className="form-field"><span>State name <em>*</em></span><input maxLength={120} placeholder="Karnataka" required value={form.stateName} onChange={(event) => update("stateName", event.target.value)} /></label></div>{error ? <div className="inline-state inline-state-error catalog-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions catalog-dialog-actions"><span>Country is fixed to India for the first release.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Creating…" : "Create warehouse"}</button></div></footer></form></section></div>;
}

function ReceiveDialog({ accessToken, onClose, onSaved, options, tenantId }) {
  const firstWarehouse = options.warehouses[0];
  const initialOffers = options.offers.filter((offer) => !firstWarehouse || offer.merchantId === firstWarehouse.merchantId);
  const [form, setForm] = useState({ warehouseId: firstWarehouse?.id || "", offerId: initialOffers[0]?.id || "", quantity: "", unitCost: "", supplierDocumentNumber: "", notes: "", lotNumber: "", manufacturedAt: "", expiresAt: "", serialText: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const warehouse = options.warehouses.find((item) => item.id === form.warehouseId);
  const offers = options.offers.filter((offer) => !warehouse || offer.merchantId === warehouse.merchantId);
  const offer = offers.find((item) => item.id === form.offerId);
  const serialNumbers = form.serialText.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  function changeWarehouse(warehouseId) {
    const nextWarehouse = options.warehouses.find((item) => item.id === warehouseId);
    const nextOffers = options.offers.filter((item) => item.merchantId === nextWarehouse?.merchantId);
    setForm((current) => ({ ...current, warehouseId, offerId: nextOffers[0]?.id || "" }));
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await receiveInventoryRequest({ ...form, quantity: Number(form.quantity),
        unitCost: form.unitCost === "" ? null : Number(form.unitCost), serialNumbers }, accessToken, tenantId);
      onSaved();
    } catch (requestError) { setError(requestError.message || "Stock could not be received."); }
    finally { setSaving(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="catalog-dialog inventory-operation-dialog" role="dialog"><DialogHeader eyebrow="Goods receipt" icon={PackagePlus} onClose={onClose} title="Receive stock" /><form onSubmit={submit}><div className="catalog-form-scroll"><div className="inventory-dialog-intro"><strong>Post physical stock into a warehouse</strong><span>The receipt updates the live balance and creates a permanent stock-ledger entry.</span></div><div className="form-grid inventory-form-grid"><label className="form-field"><span>Warehouse <em>*</em></span><select required value={form.warehouseId} onChange={(event) => changeWarehouse(event.target.value)}>{options.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label><label className="form-field"><span>Product variant <em>*</em></span><select required value={form.offerId} onChange={(event) => update("offerId", event.target.value)}>{offers.map((item) => <option key={item.id} value={item.id}>{item.productName} · {item.sku}</option>)}</select></label><label className="form-field"><span>Received quantity {offer?.uomCode ? `(${offer.uomCode})` : ""} <em>*</em></span><input min="0.000001" required step={offer?.serialTrackingEnabled ? "1" : "0.001"} type="number" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></label><label className="form-field"><span>Unit cost (₹)</span><input min="0" step="0.01" type="number" value={form.unitCost} onChange={(event) => update("unitCost", event.target.value)} /></label><label className="form-field catalog-span-2"><span>Supplier document number</span><input maxLength={100} placeholder="Invoice or delivery challan" value={form.supplierDocumentNumber} onChange={(event) => update("supplierDocumentNumber", event.target.value)} /></label></div>{offer?.lotTrackingEnabled ? <fieldset className="catalog-fieldset inventory-traceability-fieldset"><legend>Batch traceability</legend><div className="form-grid inventory-form-grid"><label className="form-field"><span>Batch / lot number <em>*</em></span><input maxLength={100} required value={form.lotNumber} onChange={(event) => update("lotNumber", event.target.value)} /></label><label className="form-field"><span>Manufactured on</span><input type="date" value={form.manufacturedAt} onChange={(event) => update("manufacturedAt", event.target.value)} /></label><label className="form-field"><span>Expires on {offer.expiryTrackingEnabled ? <em>*</em> : null}</span><input required={offer.expiryTrackingEnabled} type="date" value={form.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} /></label></div></fieldset> : null}{offer?.serialTrackingEnabled ? <fieldset className="catalog-fieldset inventory-traceability-fieldset"><legend>Serial control</legend><label className="form-field"><span>Serial numbers <em>*</em></span><textarea rows={5} placeholder="One serial number per line" required value={form.serialText} onChange={(event) => update("serialText", event.target.value)} /></label><p className="fieldset-help"><ClipboardCheck size={15} aria-hidden="true" />{serialNumbers.length} serials entered · must match the received quantity.</p></fieldset> : null}<label className="form-field inventory-notes"><span>Receiving notes</span><textarea maxLength={1000} rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>{error ? <div className="inline-state inline-state-error catalog-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions catalog-dialog-actions"><span>{offer ? `${offer.vertical.toLowerCase()} tracking rules are active.` : "Select a variant to continue."}</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving || !offer} type="submit">{saving ? "Posting…" : "Post receipt"}</button></div></footer></form></section></div>;
}

function AdjustmentDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({ lotId: "", countedQuantity: "", reasonCode: "CYCLE_COUNT", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    inventoryBalanceRequest(item.id, accessToken, tenantId).then((data) => {
      if (!active) return;
      setDetails(data);
      const firstLot = data.lots[0];
      setForm((current) => ({ ...current, lotId: firstLot?.id || "",
        countedQuantity: String(firstLot?.onHandQuantity ?? data.balance.onHandQuantity) }));
    }).catch((requestError) => active && setError(requestError.message || "Stock details could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken, item.id, tenantId]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  function changeLot(lotId) {
    const lot = details.lots.find((candidate) => candidate.id === lotId);
    setForm((current) => ({ ...current, lotId, countedQuantity: String(lot?.onHandQuantity ?? "") }));
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { await adjustInventoryRequest({ balanceId: item.id, lotId: form.lotId || null,
      countedQuantity: Number(form.countedQuantity), reasonCode: form.reasonCode,
      notes: form.notes }, accessToken, tenantId); onSaved(); }
    catch (requestError) { setError(requestError.message || "Stock could not be adjusted."); }
    finally { setSaving(false); }
  }
  const serialized = details?.balance.serialTrackingEnabled;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="catalog-dialog inventory-operation-dialog inventory-adjust-dialog" role="dialog"><DialogHeader eyebrow="Controlled correction" icon={ClipboardCheck} onClose={onClose} title="Adjust counted stock" />{loading ? <GlobalLoader inline label="Loading stock details" /> : <form onSubmit={submit}><div className="catalog-form-scroll"><div className="inventory-selected-stock"><span><small>Product</small><strong>{item.productName}</strong><em>{item.sku}</em></span><span><small>Warehouse</small><strong>{item.warehouseName}</strong><em>{item.onHandQuantity.toLocaleString("en-IN")} on hand</em></span></div>{serialized ? <div className="inventory-guardrail" role="status"><ClipboardCheck size={18} aria-hidden="true" /><span><strong>Serial-level count required</strong><small>Quantity-only adjustments are blocked so individual histories stay accurate. Open the Traceability view to reconcile each physical serial.</small></span></div> : <div className="form-grid inventory-form-grid">{details?.balance.lotTrackingEnabled ? <label className="form-field catalog-span-2"><span>Batch / lot <em>*</em></span><select required value={form.lotId} onChange={(event) => changeLot(event.target.value)}>{details.lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · {lot.onHandQuantity} on hand{lot.expiresAt ? ` · expires ${lot.expiresAt}` : ""}</option>)}</select></label> : null}<label className="form-field"><span>Counted quantity <em>*</em></span><input min="0" required step="0.001" type="number" value={form.countedQuantity} onChange={(event) => update("countedQuantity", event.target.value)} /></label><label className="form-field"><span>Reason <em>*</em></span><select value={form.reasonCode} onChange={(event) => update("reasonCode", event.target.value)}><option value="CYCLE_COUNT">Cycle count</option><option value="DAMAGE">Damage</option><option value="LOSS">Loss</option><option value="FOUND">Found stock</option><option value="DATA_CORRECTION">Data correction</option></select></label><label className="form-field catalog-span-2"><span>Adjustment notes <em>*</em></span><textarea minLength={3} required rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div>}{error ? <div className="inline-state inline-state-error catalog-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions catalog-dialog-actions"><span>Every correction is audited and posted to the stock ledger.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>{!serialized ? <button className="button button-warning" disabled={saving} type="submit">{saving ? "Posting…" : "Post adjustment"}</button> : null}</div></footer></form>}</section></div>;
}

function PolicyDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [form, setForm] = useState({ safetyStockQuantity: "0", reorderPointQuantity: "", reorderQuantity: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    inventoryBalanceRequest(item.id, accessToken, tenantId).then(({ balance }) => {
      if (!active) return;
      setForm({ safetyStockQuantity: String(balance.safetyStockQuantity || 0),
        reorderPointQuantity: balance.reorderPointQuantity == null ? "" : String(balance.reorderPointQuantity),
        reorderQuantity: balance.reorderQuantity == null ? "" : String(balance.reorderQuantity) });
    }).catch((requestError) => active && setError(requestError.message || "Stock policy could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken, item.id, tenantId]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await updateInventoryPolicyRequest(item.id, {
        safetyStockQuantity: Number(form.safetyStockQuantity),
        reorderPointQuantity: form.reorderPointQuantity === "" ? null : Number(form.reorderPointQuantity),
        reorderQuantity: form.reorderQuantity === "" ? null : Number(form.reorderQuantity)
      }, accessToken, tenantId);
      onSaved();
    } catch (requestError) { setError(requestError.message || "Stock policy could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="catalog-dialog inventory-operation-dialog inventory-adjust-dialog" role="dialog"><DialogHeader eyebrow="Availability rules" icon={Settings2} onClose={onClose} title="Reorder policy" />{loading ? <GlobalLoader inline label="Loading stock policy" /> : <form onSubmit={submit}><div className="catalog-form-scroll"><div className="inventory-selected-stock"><span><small>Product</small><strong>{item.productName}</strong><em>{item.sku}</em></span><span><small>Warehouse</small><strong>{item.warehouseName}</strong><em>{item.availableQuantity.toLocaleString("en-IN")} available</em></span></div><div className="form-grid inventory-form-grid"><label className="form-field"><span>Safety stock <em>*</em></span><input min="0" required step="0.001" type="number" value={form.safetyStockQuantity} onChange={(event) => update("safetyStockQuantity", event.target.value)} /><small>Buffer quantity protected for demand uncertainty.</small></label><label className="form-field"><span>Low-stock threshold</span><input min="0" step="0.001" type="number" value={form.reorderPointQuantity} onChange={(event) => update("reorderPointQuantity", event.target.value)} /><small>The balance becomes “Low stock” at this level.</small></label><label className="form-field catalog-span-2"><span>Suggested reorder quantity</span><input min="0.001" step="0.001" type="number" value={form.reorderQuantity} onChange={(event) => update("reorderQuantity", event.target.value)} /><small>Used as the suggested purchase or replenishment amount.</small></label></div>{error ? <div className="inline-state inline-state-error catalog-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions catalog-dialog-actions"><span>Leave optional fields blank to disable automatic attention thresholds.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save policy"}</button></div></footer></form>}</section></div>;
}

function TransferDialog({ accessToken, item, onClose, onSaved, options, tenantId }) {
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({ destinationWarehouseId: "", sourceLotId: "", quantity: "", serialIds: [], notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    inventoryBalanceRequest(item.id, accessToken, tenantId).then((data) => {
      if (!active) return;
      const destinations = options.warehouses.filter((warehouse) => warehouse.id !== data.balance.warehouseId
        && warehouse.merchantId === data.balance.merchantId);
      setDetails(data);
      setForm((current) => ({ ...current, destinationWarehouseId: destinations[0]?.id || "",
        sourceLotId: data.lots[0]?.id || "" }));
    }).catch((requestError) => active && setError(requestError.message || "Transfer details could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [accessToken, item.id, options.warehouses, tenantId]);
  const destinations = details ? options.warehouses.filter((warehouse) => warehouse.id !== details.balance.warehouseId
    && warehouse.merchantId === details.balance.merchantId) : [];
  const serialized = Boolean(details?.balance.serialTrackingEnabled);
  const serials = details?.serials || [];
  const selectedLot = details?.lots.find((lot) => lot.id === form.sourceLotId);
  const available = serialized ? serials.length : selectedLot
    ? selectedLot.onHandQuantity - selectedLot.reservedQuantity - selectedLot.quarantineQuantity
    : item.availableQuantity;
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleSerial = (serialId) => setForm((current) => ({ ...current,
    serialIds: current.serialIds.includes(serialId)
      ? current.serialIds.filter((id) => id !== serialId)
      : [...current.serialIds, serialId]
  }));
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await transferInventoryRequest({ sourceBalanceId: item.id,
        destinationWarehouseId: form.destinationWarehouseId,
        sourceLotId: serialized ? null : form.sourceLotId || null,
        quantity: serialized ? form.serialIds.length : Number(form.quantity),
        serialIds: serialized ? form.serialIds : [], notes: form.notes }, accessToken, tenantId);
      onSaved();
    } catch (requestError) { setError(requestError.message || "Stock could not be transferred."); }
    finally { setSaving(false); }
  }
  const canSubmit = destinations.length > 0 && (serialized
    ? form.serialIds.length > 0
    : Number(form.quantity) > 0 && Number(form.quantity) <= Number(available));
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section aria-modal="true" className="catalog-dialog inventory-operation-dialog inventory-transfer-dialog" role="dialog"><DialogHeader eyebrow="Warehouse movement" icon={ArrowRightLeft} onClose={onClose} title="Transfer stock" />{loading ? <GlobalLoader inline label="Loading transfer details" /> : <form onSubmit={submit}><div className="catalog-form-scroll"><div className="inventory-selected-stock"><span><small>From</small><strong>{item.warehouseName}</strong><em>{item.productName}</em></span><span><small>{serialized ? "Available serials" : "Available"}</small><strong>{Number(available).toLocaleString("en-IN")}</strong><em>{item.sku}</em></span></div>{!destinations.length ? <div className="inventory-guardrail" role="status"><Warehouse size={18} aria-hidden="true" /><span><strong>No eligible destination</strong><small>Add another active warehouse for this merchant before transferring stock.</small></span></div> : <div className="form-grid inventory-form-grid"><label className="form-field catalog-span-2"><span>Destination warehouse <em>*</em></span><select required value={form.destinationWarehouseId} onChange={(event) => update("destinationWarehouseId", event.target.value)}>{destinations.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</option>)}</select></label>{serialized ? <fieldset className="catalog-fieldset serial-transfer-picker catalog-span-2"><legend>Serial selection</legend><div className="serial-transfer-head"><span><strong>Select physical units</strong><small aria-live="polite">{form.serialIds.length} of {serials.length} selected</small></span>{serials.length ? <button className="serial-select-all" onClick={() => update("serialIds", form.serialIds.length === serials.length ? [] : serials.map((serial) => serial.id))} type="button">{form.serialIds.length === serials.length ? "Clear" : "Select all"}</button> : null}</div>{serials.length ? <div className="serial-transfer-grid">{serials.map((serial) => { const selected = form.serialIds.includes(serial.id); return <button aria-pressed={selected} className={selected ? "is-selected" : ""} key={serial.id} onClick={() => toggleSerial(serial.id)} type="button"><span className="serial-check" aria-hidden="true">{selected ? <Check size={14} /> : <Hash size={14} />}</span><span><strong>{serial.serialNumber}</strong><small>{serial.lotNumber ? `Batch ${serial.lotNumber}` : "Unit tracked"}</small></span></button>; })}</div> : <div className="serial-transfer-empty"><ClipboardCheck size={20} aria-hidden="true" /><span><strong>No transferable serials</strong><small>Reserved, sold, quarantined, and scrapped units are excluded.</small></span></div>}</fieldset> : <>{details?.balance.lotTrackingEnabled ? <label className="form-field catalog-span-2"><span>Batch / lot <em>*</em></span><select required value={form.sourceLotId} onChange={(event) => update("sourceLotId", event.target.value)}>{details.lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · {lot.onHandQuantity - lot.reservedQuantity - lot.quarantineQuantity} available{lot.expiresAt ? ` · expires ${lot.expiresAt}` : ""}</option>)}</select></label> : null}<label className="form-field"><span>Transfer quantity <em>*</em></span><input max={available} min="0.001" required step="0.001" type="number" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} /></label><label className="form-field"><span>Movement</span><input disabled value="Immediate transfer" /></label></>}<label className="form-field catalog-span-2"><span>Transfer notes <em>*</em></span><textarea minLength={3} required rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div>}{error ? <div className="inline-state inline-state-error catalog-error" role="alert">{error}</div> : null}</div><footer className="dialog-actions catalog-dialog-actions"><span>{serialized ? "Each selected serial receives paired warehouse ledger entries." : "Source and destination ledger entries are posted together."}</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>{destinations.length ? <button className="button button-success" disabled={saving || !canSubmit} type="submit">{saving ? "Transferring…" : serialized ? `Transfer ${form.serialIds.length || ""} ${form.serialIds.length === 1 ? "serial" : "serials"}` : "Transfer stock"}</button> : null}</div></footer></form>}</section></div>;
}

export default function InventoryPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "inventory.stock.manage", tenantId);
  const [view, setView] = useState("balances");
  const [filters, setFilters] = useState({ search: "", health: "ALL", warehouseId: "", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ warehouses: [], offers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try {
      const [inventory, inventoryOptions] = await Promise.all([
        listInventoryRequest(filters, accessToken, tenantId),
        inventoryOptionsRequest(accessToken, tenantId)
      ]);
      setResult(inventory); setOptions(inventoryOptions);
    } catch (requestError) { setError(requestError.message || "Inventory could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { setDialog(null); load(); };
  const summary = useMemo(() => result?.summary || { total: 0, available: 0, lowStock: 0, outOfStock: 0, expiringLots: 0 }, [result]);
  const items = result?.items || [];
  const readyToReceive = options.warehouses.length && options.offers.length;
  return <AppShell area="admin" currentPath="/admin/inventory" eyebrow="Stock control" title="Inventory" description="Receive, trace, count, and protect sellable stock across every warehouse." action={canManage ? <div className="page-actions"><button className="button button-secondary" onClick={() => setDialog({ type: "warehouse" })} type="button"><Warehouse size={16} aria-hidden="true" />New warehouse</button><button className="button button-primary" disabled={!readyToReceive} onClick={() => setDialog({ type: "receive" })} title={readyToReceive ? "Receive inventory" : "Create a warehouse and priced product first"} type="button"><Plus size={16} aria-hidden="true" />Receive stock</button></div> : null}>
    <section className="inventory-signal-grid" aria-label="Inventory summary"><article><span className="signal-icon" data-tone="teal"><Boxes aria-hidden="true" size={18} /></span><span><small>Available units</small><strong>{summary.available.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="warning"><Warehouse aria-hidden="true" size={18} /></span><span><small>Low stock</small><strong>{summary.lowStock}</strong></span></article><article><span className="signal-icon" data-tone="danger"><Boxes aria-hidden="true" size={18} /></span><span><small>Out of stock</small><strong>{summary.outOfStock}</strong></span></article><article><span className="signal-icon" data-tone="plum"><CalendarClock aria-hidden="true" size={18} /></span><span><small>Lots expiring in 30 days</small><strong>{summary.expiringLots}</strong></span></article></section>
    <nav className="inventory-view-switcher" aria-label="Inventory views"><button aria-current={view === "balances" ? "page" : undefined} className={view === "balances" ? "is-active" : ""} onClick={() => setView("balances")} type="button"><Boxes size={16} aria-hidden="true" />Stock balances</button><button aria-current={view === "traceability" ? "page" : undefined} className={view === "traceability" ? "is-active" : ""} onClick={() => setView("traceability")} type="button"><ClipboardCheck size={16} aria-hidden="true" />Traceability</button></nav>
    <div className="inventory-view-panel" hidden={view !== "balances"}>
    <section className="warehouse-network" aria-labelledby="warehouse-network-title"><div className="section-heading warehouse-network-heading"><div><p className="eyebrow">Fulfilment network</p><h2 id="warehouse-network-title">Warehouses</h2></div><span className="warehouse-count">{options.warehouses.length} active</span></div>{loading && !options.warehouses.length ? <GlobalLoader inline label="Loading warehouses" /> : options.warehouses.length ? <div className="warehouse-card-grid">{options.warehouses.map((warehouse, index) => <article className="warehouse-card" key={warehouse.id}><div className="warehouse-card-top"><span className="warehouse-card-icon" data-tone={(index % 3) + 1}><Warehouse size={18} aria-hidden="true" /></span><Status tone="positive">Active</Status></div><div className="warehouse-card-copy"><small>{warehouse.code}</small><h3>{warehouse.name}</h3><span><MapPin size={14} aria-hidden="true" />{warehouse.city}, {warehouse.stateName} · {warehouse.postalCode}</span></div><footer><span>{warehouse.merchantName}</span><strong>{warehouse.stockItemCount} stocked {warehouse.stockItemCount === 1 ? "item" : "items"}</strong></footer></article>)}</div> : <div className="warehouse-network-empty"><Warehouse size={22} aria-hidden="true" /><span>No active warehouses yet.</span></div>}</section>
    <section className="tenant-directory inventory-directory" aria-labelledby="inventory-directory-title"><div className="section-heading tenant-directory-heading"><div><p className="eyebrow">Live balances</p><h2 id="inventory-directory-title">Stock by warehouse</h2></div><form className="directory-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search inventory</span><Search size={16} /><input placeholder="Product, SKU or warehouse" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Warehouse" value={filters.warehouseId} onChange={(event) => setFilters((current) => ({ ...current, warehouseId: event.target.value, page: 1 }))}><option value="">All warehouses</option>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><select aria-label="Stock health" value={filters.health} onChange={(event) => setFilters((current) => ({ ...current, health: event.target.value, page: 1 }))}><option value="ALL">All stock health</option><option value="HEALTHY">Healthy</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading inventory balances" /> : items.length === 0 ? <div className="empty-workspace"><Boxes aria-hidden="true" size={28} /><h3>No inventory balances yet</h3><p>Create a warehouse, then receive stock against a priced product variant.</p>{canManage ? <button className="button button-primary" disabled={!readyToReceive} onClick={() => setDialog({ type: "receive" })} type="button"><PackagePlus size={16} aria-hidden="true" />Receive first stock</button> : null}</div> : <><div className="table-wrap inventory-table-wrap"><table className="tenant-table inventory-table"><thead><tr><th>SKU</th><th>Warehouse</th><th>Available</th><th>Committed</th><th>Reorder</th><th>Traceability</th><th>Health</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="inventory-product"><strong>{item.productName}</strong><small>{item.sku}{item.variantName ? ` · ${item.variantName}` : ""}</small></span></td><td><span className="inventory-product"><strong>{item.warehouseName}</strong><small>{item.merchantName}</small></span></td><td><strong className="stock-number">{item.availableQuantity.toLocaleString("en-IN")}</strong><small className="quantity-detail">of {item.onHandQuantity.toLocaleString("en-IN")} on hand</small></td><td>{item.reservedQuantity.toLocaleString("en-IN")}</td><td><span className="traceability-cell"><small>{item.reorderPointQuantity == null ? "Not configured" : `At ${item.reorderPointQuantity.toLocaleString("en-IN")}`}</small>{item.reorderQuantity != null ? <small>Order {item.reorderQuantity.toLocaleString("en-IN")}</small> : null}</span></td><td><span className="traceability-cell">{item.lotCount ? <small>{item.lotCount} batches · {item.expiringLotCount} expiring</small> : null}{item.availableSerialCount ? <small>{item.availableSerialCount} serials available</small> : null}{!item.lotCount && !item.availableSerialCount ? <small>Quantity tracked</small> : null}</span></td><td><Status tone={healthTone[item.health]}>{healthLabel[item.health]}</Status></td>{canManage ? <td><div className="inventory-row-actions"><button aria-label={`Count ${item.productName} stock`} className="row-action inventory-adjust-action" onClick={() => setDialog({ type: "adjust", item })} type="button"><ClipboardCheck size={14} aria-hidden="true" />Count</button><button aria-label={`Edit ${item.productName} reorder policy`} className="row-action inventory-policy-action" onClick={() => setDialog({ type: "policy", item })} type="button"><Settings2 size={14} aria-hidden="true" />Policy</button><button aria-label={`Transfer ${item.productName} stock`} className="row-action inventory-transfer-action" disabled={item.availableQuantity <= 0} onClick={() => setDialog({ type: "transfer", item })} title={item.availableQuantity <= 0 ? "No available stock to transfer" : undefined} type="button"><ArrowRightLeft size={14} aria-hidden="true" />Transfer</button></div></td> : null}</tr>)}</tbody></table></div><TablePagination itemLabel="inventory records" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}
    </section>
    </div>
    {view === "traceability" ? <InventoryTraceability accessToken={accessToken} canManage={canManage} tenantId={tenantId} warehouses={options.warehouses} /> : null}
    {dialog?.type === "warehouse" ? <WarehouseDialog accessToken={accessToken} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
    {dialog?.type === "receive" ? <ReceiveDialog accessToken={accessToken} onClose={() => setDialog(null)} onSaved={refresh} options={options} tenantId={tenantId} /> : null}
    {dialog?.type === "adjust" ? <AdjustmentDialog accessToken={accessToken} item={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
    {dialog?.type === "policy" ? <PolicyDialog accessToken={accessToken} item={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
    {dialog?.type === "transfer" ? <TransferDialog accessToken={accessToken} item={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} options={options} tenantId={tenantId} /> : null}
  </AppShell>;
}
