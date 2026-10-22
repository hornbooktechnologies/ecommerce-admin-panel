"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeIndianRupee, Building2, CalendarDays, ChevronRight, ContactRound, Eye,
  Mail, MapPin, PackageCheck, Pencil, Phone, RotateCcw, Search, ShieldCheck,
  ShoppingBag, UserRound, UsersRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { customerDetailsRequest, listCustomersRequest, updateCustomerRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const tone = { ACTIVE: "positive", INACTIVE: "neutral", BLOCKED: "danger", COMPLETED: "positive",
  CANCELLED: "danger", REQUESTED: "warning", APPROVED: "positive", RECEIVED: "warning",
  INSPECTED: "warning", OPEN: "warning", CLOSED: "neutral", EXPIRED: "neutral" };
const label = (value) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const formatDate = (value, withTime = true) => value ? (withTime ? dateTime : dateOnly).format(new Date(value)) : "—";
const initials = (customer) => `${customer?.firstName?.[0] || ""}${customer?.lastName?.[0] || ""}`.toUpperCase() || "CU";

function CustomerSkeleton() {
  return <div aria-label="Loading customers" className="customer-skeleton" role="status">
    <div className="customer-skeleton-signals">{[1, 2, 3, 4].map((item) => <i key={item} />)}</div>
    <div className="customer-skeleton-directory"><i />{[1, 2, 3, 4, 5].map((item) => <span key={item} />)}</div>
  </div>;
}

function AddressCard({ address }) {
  return <article className="customer-address-card"><span><MapPin aria-hidden="true" size={17} /></span><div>
    <small>{address.label || label(address.type)}{address.isDefault ? " · Default" : ""}</small>
    <strong>{address.contactName || address.companyName || "Delivery address"}</strong>
    <p>{[address.line1, address.line2, address.landmark, address.city,
      address.stateName, address.postalCode].filter(Boolean).join(", ")}</p>
    <em>{address.source === "ORDER" ? `Used for ${address.orderNumber}` : address.phone || "Saved address"}</em>
  </div></article>;
}

function emptyForm(customer) {
  return { firstName: customer.firstName || "", lastName: customer.lastName || "",
    email: customer.email || "", phone: customer.phone || "", type: customer.type || "INDIVIDUAL",
    companyName: customer.companyName || "", gstin: customer.gstin || "",
    status: customer.status || "ACTIVE", notes: customer.notes || "" };
}

function CustomerProfileDialog({ accessToken, canManage, customerId, onClose, onUpdated, tenantId }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDetails(await customerDetailsRequest(customerId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Customer profile could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, customerId, tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { closeButtonRef.current?.focus(); }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event) => {
      if (event.key === "Escape" && !saving) {
        if (editing) { setEditing(false); setError(""); }
        else onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]"
      ) || [])];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [editing, onClose, saving]);

  const customer = details?.customer;
  const startEditing = () => { setForm(emptyForm(customer)); setFieldErrors({}); setError(""); setEditing(true); };
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setFieldErrors({});
    try {
      const updated = await updateCustomerRequest(customerId, form, accessToken, tenantId);
      setDetails(updated); setEditing(false); onUpdated();
    } catch (requestError) {
      setError(requestError.message || "Customer profile could not be updated.");
      setFieldErrors(Object.fromEntries((requestError.details || []).map((item) => [item.field, item.message])));
    } finally { setSaving(false); }
  }

  return <div className="dialog-backdrop customer-dialog-backdrop" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !saving && !editing) onClose();
  }} role="presentation"><section aria-labelledby="customer-profile-title" aria-modal="true" className="customer-dialog" ref={dialogRef} role="dialog">
    <header className="customer-dialog-head"><span className="customer-dialog-avatar">{initials(customer)}</span><div>
      <p className="eyebrow">Customer profile</p><h2 id="customer-profile-title">{customer?.name || "Loading customer"}</h2>
      {customer ? <span>{customer.number} · Customer since {formatDate(customer.createdAt, false)}</span> : null}
    </div>{customer ? <Status tone={tone[customer.status]}>{label(customer.status)}</Status> : null}
      <button aria-label={editing ? "Cancel profile editing" : "Close customer profile"} className="icon-button" disabled={saving} onClick={() => { if (editing) { setEditing(false); setError(""); } else onClose(); }} ref={closeButtonRef} type="button"><X aria-hidden="true" size={18} /></button>
    </header>
    {loading ? <div className="customer-profile-skeleton" aria-label="Loading customer profile" role="status"><i /><i /><i /></div>
      : error && !details ? <div className="customer-dialog-error" role="alert"><strong>Customer profile is unavailable</strong><span>{error}</span><button className="button button-secondary" onClick={load} type="button"><RotateCcw aria-hidden="true" size={15} />Try again</button></div>
      : details ? <>{editing ? <form className="customer-edit-form" id="customer-edit-form" onSubmit={save}>
        <div className="customer-edit-grid">
          <label className="form-field"><span>First name <em>*</em></span><input autoFocus value={form.firstName} onChange={(event) => set("firstName", event.target.value)} />{fieldErrors.firstName ? <small>{fieldErrors.firstName}</small> : null}</label>
          <label className="form-field"><span>Last name</span><input value={form.lastName} onChange={(event) => set("lastName", event.target.value)} /></label>
          <label className="form-field"><span>Email</span><input autoComplete="email" type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />{fieldErrors.email ? <small>{fieldErrors.email}</small> : null}</label>
          <label className="form-field"><span>Phone</span><input autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} />{fieldErrors.phone ? <small>{fieldErrors.phone}</small> : null}</label>
          <label className="form-field"><span>Customer type</span><select value={form.type} onChange={(event) => set("type", event.target.value)}><option value="INDIVIDUAL">Individual</option><option value="BUSINESS">Business</option></select></label>
          <label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => set("status", event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="BLOCKED">Blocked</option></select></label>
          {form.type === "BUSINESS" ? <><label className="form-field"><span>Company name <em>*</em></span><input value={form.companyName} onChange={(event) => set("companyName", event.target.value)} />{fieldErrors.companyName ? <small>{fieldErrors.companyName}</small> : null}</label><label className="form-field"><span>GSTIN</span><input maxLength={15} value={form.gstin} onChange={(event) => set("gstin", event.target.value.toUpperCase())} />{fieldErrors.gstin ? <small>{fieldErrors.gstin}</small> : null}</label></> : null}
          <label className="form-field customer-edit-notes"><span>Internal notes</span><textarea maxLength={2000} rows={5} value={form.notes} onChange={(event) => set("notes", event.target.value)} /></label>
        </div>{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
      </form> : <div className="customer-dialog-scroll">
        <section className="customer-profile-stats" aria-label="Customer activity"><article><small>Completed orders</small><strong>{customer.completedOrderCount.toLocaleString("en-IN")}</strong></article><article><small>Lifetime value</small><strong>{money.format(customer.totalSpent)}</strong></article><article><small>Returns</small><strong>{customer.returnCount.toLocaleString("en-IN")}</strong></article><article><small>Warranties</small><strong>{customer.warrantyCount.toLocaleString("en-IN")}</strong></article></section>
        <div className="customer-profile-grid"><section className="customer-profile-section"><header><div><p className="eyebrow">Identity</p><h3>Contact and account</h3></div></header><div className="customer-contact-list"><span><Mail aria-hidden="true" size={16} /><small>Email</small><strong>{customer.email || "Not provided"}</strong></span><span><Phone aria-hidden="true" size={16} /><small>Phone</small><strong>{customer.phone || "Not provided"}</strong></span><span><UserRound aria-hidden="true" size={16} /><small>Type</small><strong>{label(customer.type)}</strong></span>{customer.companyName ? <span><Building2 aria-hidden="true" size={16} /><small>Company</small><strong>{customer.companyName}</strong></span> : null}{customer.gstin ? <span><BadgeIndianRupee aria-hidden="true" size={16} /><small>GSTIN</small><strong>{customer.gstin}</strong></span> : null}</div>{customer.notes ? <p className="customer-notes"><strong>Internal note</strong>{customer.notes}</p> : null}</section>
          <section className="customer-profile-section"><header><div><p className="eyebrow">Addresses</p><h3>Delivery locations</h3></div><span>{details.addresses.length}</span></header>{details.addresses.length ? <div className="customer-address-list">{details.addresses.map((address, index) => <AddressCard address={address} key={address.id || `${address.line1}-${address.postalCode}-${index}`} />)}</div> : <div className="customer-mini-empty"><MapPin aria-hidden="true" size={20} /><span>No address history available.</span></div>}</section></div>
        <section className="customer-profile-section customer-history-section"><header><div><p className="eyebrow">Commerce history</p><h3>Recent orders</h3></div><span>{customer.orderCount} total</span></header>{details.orders.length ? <div className="customer-history-list">{details.orders.map((order) => <article key={order.id}><span className="customer-history-icon"><ShoppingBag aria-hidden="true" size={16} /></span><span><strong>{order.number}</strong><small>{order.storeName} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}</small></span><Status tone={tone[order.status] || "warning"}>{label(order.status)}</Status><span className="customer-history-money"><strong>{money.format(order.total)}</strong><small>{formatDate(order.placedAt || order.createdAt)}</small></span></article>)}</div> : <div className="customer-mini-empty"><ShoppingBag aria-hidden="true" size={20} /><span>No order history available.</span></div>}</section>
        <div className="customer-profile-grid customer-aftercare-grid"><section className="customer-profile-section"><header><div><p className="eyebrow">After-sales</p><h3>Returns</h3></div><span>{details.returns.length}</span></header>{details.returns.length ? <div className="customer-compact-history">{details.returns.map((item) => <article key={item.id}><span><strong>{item.number}</strong><small>{item.orderNumber} · {label(item.type)}</small></span><span><Status tone={tone[item.status] || "warning"}>{label(item.status)}</Status><small>{money.format(item.refundAmount)}</small></span></article>)}</div> : <div className="customer-mini-empty"><PackageCheck aria-hidden="true" size={20} /><span>No returns recorded.</span></div>}</section>
          <section className="customer-profile-section"><header><div><p className="eyebrow">Coverage</p><h3>Warranties</h3></div><span>{details.warranties.length}</span></header>{details.warranties.length ? <div className="customer-compact-history">{details.warranties.map((item) => <article key={item.id}><span><strong>{item.productName}</strong><small>{item.serialNumber || item.sku} · {item.orderNumber}</small></span><span><Status tone={tone[item.status] || "neutral"}>{label(item.status)}</Status><small>{item.claimCount} claim{item.claimCount === 1 ? "" : "s"}</small></span></article>)}</div> : <div className="customer-mini-empty"><ShieldCheck aria-hidden="true" size={20} /><span>No warranties registered.</span></div>}</section></div>
      </div>}
        <footer className="customer-dialog-actions">{editing ? <><span>Profile changes are written to the audit trail.</span><div><button className="button button-secondary" disabled={saving} onClick={() => { setEditing(false); setError(""); }} type="button">Cancel</button><button className="button button-primary" disabled={saving} form="customer-edit-form" type="submit">{saving ? "Saving…" : "Save changes"}</button></div></> : <><span>Last activity {formatDate(customer.lastOrderAt || customer.updatedAt)}</span><div>{canManage ? <button className="button button-secondary" onClick={startEditing} type="button"><Pencil aria-hidden="true" size={15} />Edit profile</button> : null}<button className="button button-primary" onClick={onClose} type="button">Close</button></div></>}</footer>
      </> : null}
  </section></div>;
}

export default function CustomersPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "customer.manage", tenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", type: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true); setError("");
    try { setResult(await listCustomersRequest(filters, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Customers could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const summary = useMemo(() => result?.summary || { total: 0, active: 0, new30d: 0, returning: 0, lifetimeRevenue: 0 }, [result]);
  const customers = result?.items || [];
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));

  return <AppShell area="admin" currentPath="/admin/customers" eyebrow="Customer operations" title="Customers" description="Understand every customer relationship across orders, returns, addresses, and product coverage.">
    {loading && !result ? <CustomerSkeleton /> : <>
      <section className="customer-signal-grid" aria-label="Customer summary"><article><span data-tone="teal"><UsersRound aria-hidden="true" size={18} /></span><div><small>All customers</small><strong>{summary.total.toLocaleString("en-IN")}</strong><em>{summary.active.toLocaleString("en-IN")} active</em></div></article><article><span data-tone="warm"><CalendarDays aria-hidden="true" size={18} /></span><div><small>New · 30 days</small><strong>{summary.new30d.toLocaleString("en-IN")}</strong><em>Recently acquired</em></div></article><article><span data-tone="plum"><RotateCcw aria-hidden="true" size={18} /></span><div><small>Returning</small><strong>{summary.returning.toLocaleString("en-IN")}</strong><em>More than one order</em></div></article><article><span data-tone="olive"><BadgeIndianRupee aria-hidden="true" size={18} /></span><div><small>Completed revenue</small><strong>{money.format(summary.lifetimeRevenue)}</strong><em>All customer history</em></div></article></section>
      <section className="tenant-directory customer-directory" aria-labelledby="customer-directory-title"><div className="section-heading tenant-directory-heading customer-directory-heading"><div><p className="eyebrow">Customer directory</p><h2 id="customer-directory-title">Profiles and activity</h2></div><form className="directory-filters customer-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search customers</span><Search aria-hidden="true" size={16} /><input placeholder="Name, email, phone or GSTIN" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Customer status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="BLOCKED">Blocked</option></select><select aria-label="Customer type" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}><option value="ALL">All customer types</option><option value="INDIVIDUAL">Individuals</option><option value="BUSINESS">Businesses</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
        {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
        {loading ? <div className="customer-directory-loading" aria-label="Refreshing customers" role="status">Refreshing customer activity…</div> : customers.length ? <><div className="table-wrap customer-table-wrap"><table className="tenant-table customer-table"><thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Lifetime value</th><th>After-sales</th><th>Last order</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td data-label="Customer"><button className="customer-identity" onClick={() => setSelectedCustomerId(customer.id)} type="button"><span>{initials(customer)}</span><span><strong>{customer.name}</strong><small>{customer.number} · {label(customer.type)}</small></span></button></td><td data-label="Contact"><span className="customer-contact"><strong>{customer.email || customer.phone}</strong><small>{customer.email && customer.phone ? customer.phone : customer.companyName || "Primary contact"}</small></span></td><td data-label="Orders"><span className="customer-number-stat"><strong>{customer.orderCount.toLocaleString("en-IN")}</strong><small>{customer.completedOrderCount} completed</small></span></td><td data-label="Lifetime value"><strong className="customer-money">{money.format(customer.totalSpent)}</strong></td><td data-label="After-sales"><span className="customer-number-stat"><strong>{customer.returnCount} returns</strong><small>{customer.warrantyCount} warranties</small></span></td><td data-label="Last order"><span className="customer-date"><strong>{formatDate(customer.lastOrderAt)}</strong><small>Joined {formatDate(customer.createdAt, false)}</small></span></td><td data-label="Status"><Status tone={tone[customer.status]}>{label(customer.status)}</Status></td><td><button aria-label={`View ${customer.name}`} className="row-action customer-view-action table-view-action" onClick={() => setSelectedCustomerId(customer.id)} type="button"><Eye aria-hidden="true" size={15} />View<ChevronRight aria-hidden="true" size={14} /></button></td></tr>)}</tbody></table></div><TablePagination itemLabel="customers" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></> : <div className="empty-workspace"><ContactRound aria-hidden="true" size={28} /><h3>No customers match this view</h3><p>Change the filters or create an order for a new customer.</p></div>}
      </section></>}
    {selectedCustomerId ? <CustomerProfileDialog accessToken={accessToken} canManage={canManage} customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} onUpdated={load} tenantId={tenantId} /> : null}
  </AppShell>;
}
