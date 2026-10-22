"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BadgeIndianRupee, Check, Edit3, PackageSearch, Plus, Search, Shuffle, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CatalogTabs } from "@/components/catalog-tabs";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createCatalogSubstitutionRequest, deleteCatalogSubstitutionRequest, listCatalogSubstitutionsRequest,
  listSubstitutionVariantsRequest, updateCatalogSubstitutionRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
function Portal({ children }) { return typeof document === "undefined" ? null : createPortal(children, document.body); }
function useModal(onClose, ref, blocked = false) {
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const listener = (event) => { if (event.key === "Escape" && !blocked) onClose(); };
    window.addEventListener("keydown", listener); requestAnimationFrame(() => ref.current?.querySelector("input, button, select")?.focus());
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", listener); };
  }, [blocked, onClose, ref]);
}

function VariantPicker({ accessToken, label, onChange, sourceOnly, tenantId, value, excludeId }) {
  const [query, setQuery] = useState(value ? `${value.productName} · ${value.sku}` : "");
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(false); const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined; let current = true; const timer = setTimeout(async () => {
      setLoading(true);
      try { const result = await listSubstitutionVariantsRequest({ search: query, sourceOnly, page: 1, pageSize: 20 }, accessToken, tenantId);
        if (current) setItems(result.items.filter((item) => item.id !== excludeId)); }
      finally { if (current) setLoading(false); }
    }, 180);
    return () => { current = false; clearTimeout(timer); };
  }, [accessToken, excludeId, open, query, sourceOnly, tenantId]);
  function choose(item) { onChange(item); setQuery(`${item.productName} · ${item.sku}`); setOpen(false); }
  return <div className="variant-picker"><label><span>{label} <em>*</em></span><div className="variant-picker-input"><Search aria-hidden="true" size={16} /><input autoComplete="off" placeholder="Search product name, code or SKU" required value={query}
    onChange={(event) => { setQuery(event.target.value); onChange(null); setOpen(true); }} onFocus={() => setOpen(true)} /></div></label>
    {open ? <div className="variant-picker-results" role="listbox" aria-label={`${label} results`}>{loading ? <span className="variant-picker-loading">Searching…</span> : items.length ? items.map((item) => <button aria-selected={value?.id === item.id} key={item.id} onClick={() => choose(item)} role="option" type="button"><span>{item.primaryImageUrl ? <i style={{ backgroundImage: `url("${item.primaryImageUrl.replaceAll('"', '%22')}")` }} /> : <i><PackageSearch size={17} /></i>}</span><span><strong>{item.productName}</strong><small>{item.variantName} · {item.sku}{item.salePrice !== null ? ` · ${money.format(item.salePrice)}` : ""}</small></span>{value?.id === item.id ? <Check size={17} /> : null}</button>) : <span className="variant-picker-loading">No matching grocery SKUs</span>}</div> : null}
    {value ? <small className="variant-picked"><Check size={13} />Selected: {value.sku}</small> : <small>{sourceOnly ? "Only products with substitutions enabled are shown." : "Choose another active grocery SKU."}</small>}
  </div>;
}

function RuleDialog({ accessToken, item, onClose, onSaved, tenantId }) {
  const [source, setSource] = useState(item?.source || null); const [target, setTarget] = useState(item?.substitute || null);
  const [form, setForm] = useState({ priority: item?.priority || 1,
    maximumPriceDifferencePercent: item?.maximumPriceDifferencePercent ?? "", status: item?.status || "ACTIVE" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const ref = useRef(null); useModal(onClose, ref, saving);
  async function submit(event) {
    event.preventDefault(); if (!item && (!source || !target)) { setError("Select both a source SKU and a substitute SKU."); return; }
    setSaving(true); setError(""); const input = { priority: Number(form.priority),
      maximumPriceDifferencePercent: form.maximumPriceDifferencePercent === "" ? null : Number(form.maximumPriceDifferencePercent), status: form.status };
    try { if (item) await updateCatalogSubstitutionRequest(item.id, input, accessToken, tenantId);
      else await createCatalogSubstitutionRequest({ sourceVariantId: source.id, substituteVariantId: target.id, ...input }, accessToken, tenantId);
      onSaved(); } catch (requestError) { setError(requestError.message || "The substitution rule could not be saved."); }
    finally { setSaving(false); }
  }
  return <Portal><div className="procurement-dialog-backdrop"><form aria-labelledby="substitution-dialog-title" aria-modal="true" className="procurement-dialog substitution-dialog" onSubmit={submit} ref={ref} role="dialog">
    <header><div><p className="eyebrow">Grocery catalog</p><h2 id="substitution-dialog-title">{item ? "Edit substitution rule" : "Add approved substitute"}</h2><p>Set the preferred replacement order and acceptable price difference.</p></div><button aria-label="Close" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={20} /></button></header>
    <div className="procurement-dialog-body">{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
      {!item ? <div className="substitution-pair"><VariantPicker accessToken={accessToken} label="Unavailable source SKU" onChange={setSource} sourceOnly tenantId={tenantId} value={source} /><ArrowRight aria-hidden="true" size={22} /><VariantPicker accessToken={accessToken} excludeId={source?.id} label="Approved substitute SKU" onChange={setTarget} tenantId={tenantId} value={target} /></div> : <div className="substitution-edit-pair"><span><small>Source</small><strong>{item.source.productName}</strong><em>{item.source.sku}</em></span><ArrowRight aria-hidden="true" size={20} /><span><small>Substitute</small><strong>{item.substitute.productName}</strong><em>{item.substitute.sku}</em></span></div>}
      <div className="form-grid substitution-rule-fields"><label className="form-field"><span>Priority <em>*</em></span><input min="1" max="999" required type="number" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} /><small>1 is tried before 2, then 3.</small></label>
        <label className="form-field"><span>Maximum price difference</span><div className="input-suffix"><input min="0" max="1000" step="0.01" type="number" value={form.maximumPriceDifferencePercent} onChange={(event) => setForm((current) => ({ ...current, maximumPriceDifferencePercent: event.target.value }))} /><span>%</span></div><small>Leave blank when no rule-specific cap applies.</small></label>
        <label className="form-field catalog-span-2"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
    </div><footer><span>Changes are written to the permanent audit trail.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-success" disabled={saving} type="submit"><Check size={16} />{saving ? "Saving…" : item ? "Save rule" : "Add substitute"}</button></div></footer>
  </form></div></Portal>;
}

function DeleteDialog({ item, onClose, onConfirm, saving }) {
  const ref = useRef(null); useModal(onClose, ref, saving);
  return <Portal><div className="procurement-dialog-backdrop"><section aria-labelledby="delete-rule-title" aria-modal="true" className="procurement-dialog procurement-dialog-compact" ref={ref} role="alertdialog"><header><div><p className="eyebrow">Remove rule</p><h2 id="delete-rule-title">Remove this approved substitute?</h2><p>{item.substitute.productName} will no longer be proposed for {item.source.productName}.</p></div><button aria-label="Close" className="icon-button" disabled={saving} onClick={onClose} type="button"><X size={20} /></button></header><footer><span>This does not delete either product.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Keep rule</button><button className="button button-danger" disabled={saving} onClick={onConfirm} type="button"><Trash2 size={16} />{saving ? "Removing…" : "Remove rule"}</button></div></footer></section></div></Portal>;
}

export default function CatalogSubstitutionsPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "catalog.product.update", tenantId); const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "ALL", page: 1, pageSize: 10 }); const [draftSearch, setDraftSearch] = useState("");
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [dialog, setDialog] = useState(null); const [deleting, setDeleting] = useState(null); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { if (!tenantId) return; setLoading(true); setError(""); try { setData(await listCatalogSubstitutionsRequest(filters, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Substitution rules could not be loaded."); } finally { setLoading(false); } }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  function applySearch(event) { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch, page: 1 })); }
  async function remove() { setSaving(true); setError(""); try { await deleteCatalogSubstitutionRequest(deleting.id, accessToken, tenantId); setDeleting(null); await load(); }
    catch (requestError) { setError(requestError.message || "The rule could not be removed."); } finally { setSaving(false); } }
  const summary = data?.summary || { total: 0, active: 0, coveredSources: 0 };
  return <AppShell area="admin" currentPath="/admin/catalog/substitutions" eyebrow="Grocery operations" title="Product substitutions" description="Define the approved replacement sequence used when a grocery SKU is unavailable."
    action={canManage ? <button className="button button-primary" onClick={() => setDialog({})} type="button"><Plus aria-hidden="true" size={17} />Add substitute</button> : null}>
    <CatalogTabs currentPath="/admin/catalog/substitutions" />
    {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={() => setError("")} type="button">Dismiss</button></div> : null}
    <section className="substitution-summary" aria-label="Substitution coverage"><span><Shuffle aria-hidden="true" /><small>Approved rules</small><strong>{summary.total}</strong></span><span><Check aria-hidden="true" /><small>Active rules</small><strong>{summary.active}</strong></span><span><PackageSearch aria-hidden="true" /><small>Covered source SKUs</small><strong>{summary.coveredSources}</strong></span></section>
    <section className="substitution-directory"><header><div><p className="eyebrow">Replacement priority</p><h2>Approved substitutes</h2><p>Lower priority numbers are considered first.</p></div><form className="substitution-filters" onSubmit={applySearch}><label className="compact-search"><Search aria-hidden="true" size={16} /><span className="sr-only">Search substitution rules</span><input placeholder="Product or SKU" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><label><span className="sr-only">Filter by status</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label><button className="button button-secondary" type="submit">Search</button></form></header>
      {loading ? <div className="substitution-loading"><GlobalLoader inline label="Loading substitution rules" /></div> : !data?.items.length ? <div className="empty-workspace substitution-empty"><Shuffle size={30} /><h3>No substitution rules found</h3><p>{filters.search || filters.status !== "ALL" ? "Change the filters to see other rules." : "Add an approved replacement for a grocery product that allows substitutions."}</p>{canManage && !filters.search && filters.status === "ALL" ? <button className="button button-primary" onClick={() => setDialog({})} type="button"><Plus size={16} />Add first substitute</button> : null}</div> : <div className="substitution-table-wrap"><table className="substitution-table"><thead><tr><th>Unavailable SKU</th><th aria-label="Replaced by" /><th>Approved substitute</th><th>Priority</th><th>Price guard</th><th>Status</th>{canManage ? <th><span className="sr-only">Actions</span></th> : null}</tr></thead><tbody>{data.items.map((item) => <tr key={item.id}><td data-label="Unavailable SKU"><strong>{item.source.productName}</strong><small>{item.source.variantName} · {item.source.sku}{item.source.salePrice !== null ? ` · ${money.format(item.source.salePrice)}` : ""}</small></td><td className="substitution-arrow"><ArrowRight aria-hidden="true" size={18} /></td><td data-label="Approved substitute"><strong>{item.substitute.productName}</strong><small>{item.substitute.variantName} · {item.substitute.sku}{item.substitute.salePrice !== null ? ` · ${money.format(item.substitute.salePrice)}` : ""}</small></td><td data-label="Priority"><span className="priority-badge">{item.priority}</span></td><td data-label="Price guard"><span className="price-guard"><BadgeIndianRupee aria-hidden="true" size={14} />{item.maximumPriceDifferencePercent === null ? "No cap" : `Within ${item.maximumPriceDifferencePercent}%`}</span></td><td data-label="Status"><Status tone={item.status === "ACTIVE" ? "positive" : "neutral"}>{item.status.toLowerCase()}</Status></td>{canManage ? <td className="substitution-actions"><button aria-label={`Edit substitute for ${item.source.productName}`} className="icon-button" onClick={() => setDialog(item)} type="button"><Edit3 size={16} /></button><button aria-label={`Remove substitute for ${item.source.productName}`} className="icon-button substitution-delete" onClick={() => setDeleting(item)} type="button"><Trash2 size={16} /></button></td> : null}</tr>)}</tbody></table></div>}
      {data && data.total > 0 ? <footer className="substitution-pagination"><span>Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total} rules</span><div><button className="button button-secondary" disabled={data.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} type="button">Previous</button><span>Page {data.page} of {data.totalPages}</span><button className="button button-secondary" disabled={data.page >= data.totalPages || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} type="button">Next</button></div></footer> : null}
    </section>
    {dialog ? <RuleDialog accessToken={accessToken} item={dialog.id ? dialog : null} onClose={() => setDialog(null)} onSaved={async () => { setDialog(null); await load(); }} tenantId={tenantId} /> : null}
    {deleting ? <DeleteDialog item={deleting} onClose={() => setDeleting(null)} onConfirm={remove} saving={saving} /> : null}
  </AppShell>;
}
