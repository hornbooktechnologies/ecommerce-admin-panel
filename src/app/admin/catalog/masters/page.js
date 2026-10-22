"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderTree, Palette, Pencil, Plus, Ruler, Search, Tag, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CatalogTabs } from "@/components/catalog-tabs";
import { GlobalLoader } from "@/components/global-loader";
import { Status } from "@/components/dashboard-primitives";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { catalogLookupsRequest, createCatalogMasterRequest, listCatalogMastersRequest, updateCatalogMasterRequest } from "@/lib/api-client";

const masters = {
  categories: { label: "Categories", singular: "category", icon: FolderTree, description: "Hierarchical product classification" },
  brands: { label: "Brands", singular: "brand", icon: Tag, description: "Reusable manufacturer and label names" },
  colors: { label: "Colors", singular: "color", icon: Palette, description: "Filterable color options and swatches" },
  sizes: { label: "Sizes", singular: "size", icon: Ruler, description: "Reusable apparel and pack sizes" }
};

function MasterDialog({ masterType, item, categories, onClose, onSaved }) {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const meta = masters[masterType];
  const Icon = meta.icon;
  const [form, setForm] = useState({ name: item?.name || "", parentId: "", status: item?.status || "ACTIVE", swatchValue: item?.swatchValue || "#1f6d52" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const input = item
        ? { name: form.name, status: form.status, ...(masterType === "colors" ? { swatchValue: form.swatchValue } : {}) }
        : { name: form.name, parentId: masterType === "categories" ? form.parentId || null : null,
          swatchValue: masterType === "colors" ? form.swatchValue : "" };
      if (item) await updateCatalogMasterRequest(masterType, item.id, input, accessToken, tenantId);
      else await createCatalogMasterRequest(masterType, input, accessToken, tenantId);
      onSaved();
    } catch (requestError) {
      setError(requestError.message || `The ${meta.singular} could not be saved.`);
    } finally { setSaving(false); }
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section aria-labelledby="master-dialog-title" aria-modal="true" className="access-dialog master-dialog" role="dialog"><header className="access-dialog-head"><div className="dialog-icon" data-tone="positive"><Icon aria-hidden="true" size={19} /></div><div><p className="eyebrow">Catalog master</p><h2 id="master-dialog-title">{item ? "Edit" : "Add"} {meta.singular}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header><form onSubmit={submit}><div className="master-dialog-fields"><label className="form-field"><span>Name <em>*</em></span><input autoFocus maxLength={190} required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>{masterType === "categories" && !item ? <label className="form-field"><span>Parent category</span><select value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}><option value="">Top-level category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}{masterType === "colors" ? <label className="form-field"><span>Color swatch</span><span className="color-field"><input aria-label="Choose color" type="color" value={form.swatchValue} onChange={(event) => setForm((current) => ({ ...current, swatchValue: event.target.value }))} /><code>{form.swatchValue}</code></span></label> : null}{item ? <label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label> : null}</div>{error ? <div className="form-error" role="alert">{error}</div> : null}<footer className="dialog-actions"><button className="button button-secondary" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : item ? "Save changes" : `Add ${meta.singular}`}</button></footer></form></section></div>;
}

export default function CatalogMastersPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const [masterType, setMasterType] = useState("categories");
  const [filters, setFilters] = useState({ search: "", status: "ALL" });
  const [draftSearch, setDraftSearch] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const canCreate = canUser(user, "admin", "catalog.product.create", tenantId);
  const canUpdate = canUser(user, "admin", "catalog.product.update", tenantId);
  const meta = masters[masterType];
  const EmptyIcon = meta.icon;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try {
      const [data, lookups] = await Promise.all([
        listCatalogMastersRequest(masterType, filters, accessToken, tenantId),
        catalogLookupsRequest(accessToken, tenantId)
      ]);
      setItems(data.items || []); setCategories(lookups.categories || []);
    } catch (requestError) { setError(requestError.message || "Catalog masters could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, masterType, tenantId]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({ active: items.filter((item) => item.status === "ACTIVE").length,
    inactive: items.filter((item) => item.status === "INACTIVE").length }), [items]);

  async function toggleStatus(item) {
    setError("");
    try {
      await updateCatalogMasterRequest(masterType, item.id,
        { status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }, accessToken, tenantId);
      await load();
    } catch (requestError) { setError(requestError.message || "The status could not be changed."); }
  }

  return <AppShell area="admin" currentPath="/admin/catalog/masters" eyebrow="Catalog governance" title="Catalog masters" description="Manage reusable values used by every product and variant." action={canCreate ? <button className="button button-primary" onClick={() => setDialog({ mode: "create" })} type="button"><Plus aria-hidden="true" size={16} />Add {meta.singular}</button> : null}>
    <CatalogTabs currentPath="/admin/catalog/masters" />
    <section className="master-workspace">
      <aside className="master-types" aria-label="Master data types">{Object.entries(masters).map(([key, value]) => { const Icon = value.icon; return <button aria-pressed={masterType === key} data-active={masterType === key || undefined} key={key} onClick={() => { setMasterType(key); setFilters({ search: "", status: "ALL" }); setDraftSearch(""); }} type="button"><Icon aria-hidden="true" size={17} /><span><strong>{value.label}</strong><small>{value.description}</small></span></button>; })}</aside>
      <section className="master-directory" aria-labelledby="master-directory-title"><div className="section-heading master-directory-head"><div><p className="eyebrow">{meta.label}</p><h2 id="master-directory-title">{items.length} values · {counts.active} active</h2></div><form className="directory-filters" onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, search: draftSearch.trim() })); }} role="search"><label className="compact-search"><span className="sr-only">Search {meta.label}</span><Search aria-hidden="true" size={16} /><input placeholder={`Search ${meta.label.toLowerCase()}`} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Master status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
        {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
        {loading ? <GlobalLoader inline label={`Loading ${meta.label.toLowerCase()}`} /> : items.length === 0 ? <div className="empty-workspace"><EmptyIcon aria-hidden="true" size={28} /><h3>No {meta.label.toLowerCase()} found</h3><p>Add a reusable value or adjust the current filters.</p></div> : <div className="master-list" role="list">{items.map((item) => <article key={item.id} role="listitem"><div className="master-value">{masterType === "colors" ? <span className="color-swatch" style={{ background: item.swatchValue || "transparent" }} /> : <span className="master-monogram">{item.name.slice(0, 2).toUpperCase()}</span>}<span className="master-value-copy" style={masterType === "categories" ? { paddingLeft: `${Math.min(item.depth || 0, 3) * 16}px` } : undefined}><strong>{item.name}</strong><small>{masterType === "categories" ? item.parentName ? `Under ${item.parentName}` : "Top-level category" : masterType === "brands" ? item.slug : item.value}</small></span></div><span className="master-usage">{item.usageCount} {item.usageCount === 1 ? "use" : "uses"}</span><Status tone={item.status === "ACTIVE" ? "positive" : "neutral"}>{item.status.toLowerCase()}</Status>{canUpdate ? <div className="master-actions"><button className="row-text-action" onClick={() => setDialog({ mode: "edit", item })} type="button"><Pencil aria-hidden="true" size={14} />Edit</button><button className="row-text-action" onClick={() => toggleStatus(item)} type="button">{item.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></div> : null}</article>)}</div>}
      </section>
    </section>
    {dialog ? <MasterDialog categories={categories} item={dialog.item || null} masterType={masterType} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} /> : null}
  </AppShell>;
}
