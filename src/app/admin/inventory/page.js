"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Boxes, CalendarClock, ClipboardCheck, MapPin, PackagePlus, Plus, Search, Settings2, Warehouse, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { GlobalLoader } from "@/components/global-loader";
import { InventoryTraceability } from "@/components/inventory-traceability";
import { ReceiveStockDialog } from "@/components/receive-stock-dialog";
import { CountStockDialog } from "@/components/count-stock-dialog";
import { TransferStockDialog } from "@/components/transfer-stock-dialog";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createWarehouseRequest, inventoryBalanceRequest,
  inventoryOptionsRequest, listInventoryRequest,
  updateInventoryPolicyRequest } from "@/lib/api-client";

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

export default function InventoryPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "inventory.stock.manage", tenantId);
  const [view, setView] = useState("balances");
  const [filters, setFilters] = useState({ search: "", health: "ALL", warehouseId: "", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ warehouses: [], offers: [] });
  const [optionsTenantId, setOptionsTenantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const requestVersion = useRef(0);
  useEffect(() => { setDialog(null); }, [tenantId]);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    const version = ++requestVersion.current;
    setLoading(true); setError("");
    try {
      const [inventory, inventoryOptions] = await Promise.all([
        listInventoryRequest(filters, accessToken, tenantId),
        inventoryOptionsRequest(accessToken, tenantId)
      ]);
      if (version !== requestVersion.current) return;
      setResult(inventory); setOptions(inventoryOptions); setOptionsTenantId(tenantId);
    } catch (requestError) { if (version === requestVersion.current) setError(requestError.message || "Inventory could not be loaded."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); return () => { requestVersion.current += 1; }; }, [load]);
  const refresh = () => { setDialog(null); load(); };
  const summary = useMemo(() => result?.summary || { total: 0, available: 0, lowStock: 0, outOfStock: 0, expiringLots: 0 }, [result]);
  const items = result?.items || [];
  const readyToReceive = !loading && !error && optionsTenantId === tenantId
    && options.warehouses.length > 0 && options.offers.length > 0;
  return <AppShell area="admin" currentPath="/admin/inventory" eyebrow="Stock control" title="Inventory" description="Receive, trace, count, and protect sellable stock across every warehouse." action={canManage ? <div className="page-actions"><button className="button button-secondary" onClick={() => setDialog({ type: "warehouse" })} type="button"><Warehouse size={16} aria-hidden="true" />New warehouse</button><button className="button button-primary" disabled={!readyToReceive} onClick={() => setDialog({ type: "receive", tenantId })} title={readyToReceive ? "Receive inventory" : "Create a warehouse and priced product first"} type="button"><Plus size={16} aria-hidden="true" />Receive stock</button></div> : null}>
    <section className="inventory-signal-grid" aria-label="Inventory summary"><article><span className="signal-icon" data-tone="teal"><Boxes aria-hidden="true" size={18} /></span><span><small>Available units</small><strong>{summary.available.toLocaleString("en-IN")}</strong></span></article><article><span className="signal-icon" data-tone="warning"><Warehouse aria-hidden="true" size={18} /></span><span><small>Low stock</small><strong>{summary.lowStock}</strong></span></article><article><span className="signal-icon" data-tone="danger"><Boxes aria-hidden="true" size={18} /></span><span><small>Out of stock</small><strong>{summary.outOfStock}</strong></span></article><article><span className="signal-icon" data-tone="plum"><CalendarClock aria-hidden="true" size={18} /></span><span><small>Lots expiring in 30 days</small><strong>{summary.expiringLots}</strong></span></article></section>
    <nav className="inventory-view-switcher" aria-label="Inventory views"><button aria-current={view === "balances" ? "page" : undefined} className={view === "balances" ? "is-active" : ""} onClick={() => setView("balances")} type="button"><Boxes size={16} aria-hidden="true" />Stock balances</button><button aria-current={view === "traceability" ? "page" : undefined} className={view === "traceability" ? "is-active" : ""} onClick={() => setView("traceability")} type="button"><ClipboardCheck size={16} aria-hidden="true" />Traceability</button></nav>
    <div className="inventory-view-panel" hidden={view !== "balances"}>
    <section className="warehouse-network" aria-labelledby="warehouse-network-title"><div className="section-heading warehouse-network-heading"><div><p className="eyebrow">Fulfilment network</p><h2 id="warehouse-network-title">Warehouses</h2></div><span className="warehouse-count">{options.warehouses.length} active</span></div>{loading && !options.warehouses.length ? <GlobalLoader inline label="Loading warehouses" /> : options.warehouses.length ? <div className="warehouse-card-grid">{options.warehouses.map((warehouse, index) => <article className="warehouse-card" key={warehouse.id}><div className="warehouse-card-top"><span className="warehouse-card-icon" data-tone={(index % 3) + 1}><Warehouse size={18} aria-hidden="true" /></span><Status tone="positive">Active</Status></div><div className="warehouse-card-copy"><small>{warehouse.code}</small><h3>{warehouse.name}</h3><span><MapPin size={14} aria-hidden="true" />{warehouse.city}, {warehouse.stateName} · {warehouse.postalCode}</span></div><footer><span>{warehouse.merchantName}</span><strong>{warehouse.stockItemCount} stocked {warehouse.stockItemCount === 1 ? "item" : "items"}</strong></footer></article>)}</div> : <div className="warehouse-network-empty"><Warehouse size={22} aria-hidden="true" /><span>No active warehouses yet.</span></div>}</section>
    <section className="tenant-directory inventory-directory" aria-labelledby="inventory-directory-title"><div className="section-heading tenant-directory-heading"><div><p className="eyebrow">Live balances</p><h2 id="inventory-directory-title">Stock by warehouse</h2></div><form className="directory-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 })); }} role="search"><label className="compact-search"><span className="sr-only">Search inventory</span><Search size={16} /><input placeholder="Product, SKU or warehouse" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Warehouse" value={filters.warehouseId} onChange={(event) => setFilters((current) => ({ ...current, warehouseId: event.target.value, page: 1 }))}><option value="">All warehouses</option>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><select aria-label="Stock health" value={filters.health} onChange={(event) => setFilters((current) => ({ ...current, health: event.target.value, page: 1 }))}><option value="ALL">All stock health</option><option value="HEALTHY">Healthy</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {loading ? <GlobalLoader inline label="Loading inventory balances" /> : items.length === 0 ? <div className="empty-workspace"><Boxes aria-hidden="true" size={28} /><h3>No inventory balances yet</h3><p>Create a warehouse, then receive stock against a priced product variant.</p>{canManage ? <button className="button button-primary" disabled={!readyToReceive} onClick={() => setDialog({ type: "receive", tenantId })} type="button"><PackagePlus size={16} aria-hidden="true" />Receive first stock</button> : null}</div> : <><div className="table-wrap inventory-table-wrap"><table className="tenant-table inventory-table"><thead><tr><th>SKU</th><th>Warehouse</th><th>Available</th><th>Committed</th><th>Reorder</th><th>Traceability</th><th>Health</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="inventory-product"><strong>{item.productName}</strong><small>{item.sku}{item.variantName ? ` · ${item.variantName}` : ""}</small></span></td><td><span className="inventory-product"><strong>{item.warehouseName}</strong><small>{item.merchantName}</small></span></td><td><strong className="stock-number">{item.availableQuantity.toLocaleString("en-IN")}</strong><small className="quantity-detail">of {item.onHandQuantity.toLocaleString("en-IN")} on hand</small></td><td>{item.reservedQuantity.toLocaleString("en-IN")}</td><td><span className="traceability-cell"><small>{item.reorderPointQuantity == null ? "Not configured" : `At ${item.reorderPointQuantity.toLocaleString("en-IN")}`}</small>{item.reorderQuantity != null ? <small>Order {item.reorderQuantity.toLocaleString("en-IN")}</small> : null}</span></td><td><span className="traceability-cell">{item.lotCount ? <small>{item.lotCount} batches · {item.expiringLotCount} expiring</small> : null}{item.availableSerialCount ? <small>{item.availableSerialCount} serials available</small> : null}{!item.lotCount && !item.availableSerialCount ? <small>Quantity tracked</small> : null}</span></td><td><Status tone={healthTone[item.health]}>{healthLabel[item.health]}</Status></td>{canManage ? <td><div className="inventory-row-actions"><button aria-label={`Count ${item.productName} stock`} className="row-action inventory-adjust-action" onClick={() => setDialog({ type: "adjust", item, tenantId })} type="button"><ClipboardCheck size={14} aria-hidden="true" />Count</button><button aria-label={`Edit ${item.productName} reorder policy`} className="row-action inventory-policy-action" onClick={() => setDialog({ type: "policy", item })} type="button"><Settings2 size={14} aria-hidden="true" />Policy</button><button aria-label={`Transfer ${item.productName} stock`} className="row-action inventory-transfer-action" disabled={item.availableQuantity <= 0} onClick={() => setDialog({ type: "transfer", item, tenantId })} title={item.availableQuantity <= 0 ? "No available stock to transfer" : undefined} type="button"><ArrowRightLeft size={14} aria-hidden="true" />Transfer</button></div></td> : null}</tr>)}</tbody></table></div><TablePagination itemLabel="inventory records" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></>}
    </section>
    </div>
    {view === "traceability" ? <InventoryTraceability accessToken={accessToken} canManage={canManage} tenantId={tenantId} warehouses={options.warehouses} /> : null}
    {dialog?.type === "warehouse" ? <WarehouseDialog accessToken={accessToken} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
    {dialog?.type === "receive" && dialog.tenantId === tenantId ? <ReceiveStockDialog key={tenantId} accessToken={accessToken} onClose={() => setDialog(null)} onSaved={refresh} options={options} tenantId={tenantId} /> : null}
    {dialog?.type === "adjust" && dialog.tenantId === tenantId ? <CountStockDialog key={`${tenantId}:${dialog.item.id}`} accessToken={accessToken} item={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
    {dialog?.type === "policy" ? <PolicyDialog accessToken={accessToken} item={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
    {dialog?.type === "transfer" && dialog.tenantId === tenantId ? <TransferStockDialog key={`${tenantId}:${dialog.item.id}`} accessToken={accessToken} item={dialog.item} onClose={() => setDialog(null)} onSaved={refresh} tenantId={tenantId} /> : null}
  </AppShell>;
}
