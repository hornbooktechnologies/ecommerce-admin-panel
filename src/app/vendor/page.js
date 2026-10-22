"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeIndianRupee, Boxes, Building2, Clock3, Mail, MapPin,
  PackageCheck, PauseCircle, Pencil, Phone, RefreshCcw, Save, ShieldCheck, Store, Tags, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { GlobalLoader } from "@/components/global-loader";
import { canUser, merchantIdForUser, tenantIdForUser } from "@/lib/auth-routing";
import { updateOwnVendorOfferRequest, updateOwnVendorProfileRequest, vendorWorkspaceRequest } from "@/lib/api-client";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
  maximumFractionDigits: 2 }).format(Number(value || 0));

function OfferEditor({ offer, onCancel, onSave, saving }) {
  const [draft, setDraft] = useState({ status: offer.status, handlingTimeHours: offer.handlingTimeHours,
    listPrice: offer.listPrice, salePrice: offer.salePrice, costPrice: offer.costPrice ?? "" });
  return <form className="vendor-portal-offer-editor" onSubmit={(event) => { event.preventDefault(); onSave({
    ...draft, handlingTimeHours: Number(draft.handlingTimeHours), listPrice: Number(draft.listPrice),
    salePrice: Number(draft.salePrice), costPrice: draft.costPrice === "" ? null : Number(draft.costPrice) }); }}>
    <header><div><p className="eyebrow">Offer controls</p><h3>{offer.productName}</h3><small>{offer.sellerSku} · {offer.storeName}</small></div><button aria-label="Close offer editor" className="icon-button" onClick={onCancel} type="button"><X size={16} /></button></header>
    <div className="vendor-portal-form-grid"><label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Paused</option></select></label><label><span>Handling time</span><input min="0" max="720" type="number" value={draft.handlingTimeHours} onChange={(event) => setDraft({ ...draft, handlingTimeHours: event.target.value })} /></label><label><span>MRP (₹)</span><input min="0.01" step="0.01" type="number" value={draft.listPrice} onChange={(event) => setDraft({ ...draft, listPrice: event.target.value })} /></label><label><span>Selling price (₹)</span><input min="0.01" step="0.01" type="number" value={draft.salePrice} onChange={(event) => setDraft({ ...draft, salePrice: event.target.value })} /></label><label><span>Cost (₹)</span><input min="0" step="0.01" type="number" value={draft.costPrice} onChange={(event) => setDraft({ ...draft, costPrice: event.target.value })} /></label></div>
    <footer><button className="button button-secondary" onClick={onCancel} type="button">Cancel</button><button className="button button-success" disabled={saving} type="submit"><Save size={15} />{saving ? "Saving..." : "Save offer"}</button></footer>
  </form>;
}

export default function VendorDashboard() {
  const { user, accessToken, activeTenantId } = useAuth();
  const tenantId = tenantIdForUser(user, "vendor", activeTenantId);
  const merchantId = merchantIdForUser(user, tenantId);
  const canEditProfile = canUser(user, "vendor", "vendor.profile.update", tenantId);
  const canEditOffer = canUser(user, "vendor", "vendor.offer.update", tenantId);
  const [workspace, setWorkspace] = useState(null); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false); const [editingOffer, setEditingOffer] = useState(null);
  const [profile, setProfile] = useState({ supportEmail: "", supportPhone: "", contactPerson: "", notes: "" });

  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !merchantId) return;
    setLoading(true); setError("");
    try { const data = await vendorWorkspaceRequest(accessToken, tenantId, merchantId); setWorkspace(data);
      setProfile({ supportEmail: data.vendor.supportEmail || "", supportPhone: data.vendor.supportPhone || "",
        contactPerson: data.vendor.contactPerson || "", notes: data.vendor.notes || "" });
    } catch (requestError) { setError(requestError.message || "Vendor workspace could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, merchantId, tenantId]);
  useEffect(() => { load(); }, [load]);

  async function saveProfile(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { const data = await updateOwnVendorProfileRequest(profile, accessToken, tenantId, merchantId);
      setWorkspace(data); setEditingProfile(false); }
    catch (requestError) { setError(requestError.message || "Profile could not be saved."); }
    finally { setSaving(false); }
  }
  async function saveOffer(input) {
    setSaving(true); setError("");
    try { const data = await updateOwnVendorOfferRequest(editingOffer.id, input, accessToken, tenantId, merchantId);
      setWorkspace(data); setEditingOffer(null); }
    catch (requestError) { setError(requestError.message || "Offer could not be saved."); }
    finally { setSaving(false); }
  }

  const vendor = workspace?.vendor; const offers = workspace?.offers || []; const activeOffers = offers.filter((entry) => entry.status === "ACTIVE");
  return <AppShell area="vendor" currentPath="/vendor" eyebrow="Merchant workspace" title={vendor?.displayName || "Vendor operations"} description="Manage your approved seller profile, store assortment, pricing, and offer availability.">
    {loading ? <GlobalLoader inline label="Loading vendor workspace" /> : error && !workspace ? <div className="inline-state inline-state-error"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : vendor ? <>
      <section className="vendor-portal-hero"><div className="vendor-portal-identity"><span className="vendor-avatar">{vendor.displayName.slice(0, 2).toUpperCase()}</span><div><div><Status tone={vendor.status === "ACTIVE" ? "positive" : "danger"}>{vendor.status}</Status><small>{vendor.merchantCode}</small></div><h2>{vendor.legalName}</h2><p><MapPin size={14} />{vendor.address?.city}, {vendor.address?.stateName} · {vendor.address?.postalCode}</p></div></div><div className="vendor-portal-trust"><ShieldCheck size={19} /><span><strong>Marketplace verified</strong><small>GSTIN {vendor.gstin}</small></span></div></section>
      <section className="vendor-portal-metrics"><article><span data-tone="teal"><PackageCheck size={18} /></span><div><small>Active offers</small><strong>{activeOffers.length}</strong><p>of {offers.length} catalog offers</p></div></article><article><span data-tone="blue"><Boxes size={18} /></span><div><small>Sellable stock</small><strong>{vendor.availableUnits.toLocaleString("en-IN")}</strong><p>across assigned stores</p></div></article><article><span data-tone="orange"><Store size={18} /></span><div><small>Assigned stores</small><strong>{workspace.stores.filter((entry) => entry.status === "ACTIVE").length}</strong><p>active sales locations</p></div></article><article><span data-tone="green"><BadgeIndianRupee size={18} /></span><div><small>Gross sales</small><strong>{money(vendor.grossSales)}</strong><p>{vendor.orderCount} seller orders</p></div></article></section>
      {error ? <div className="inline-state inline-state-error"><span>{error}</span></div> : null}
      <div className="vendor-portal-grid"><section className="vendor-portal-panel"><header><div><p className="eyebrow">Business profile</p><h2>Operating details</h2></div>{canEditProfile && vendor.status === "ACTIVE" ? <button className="button button-secondary" onClick={() => setEditingProfile((value) => !value)} type="button"><Pencil size={15} />{editingProfile ? "Cancel" : "Edit profile"}</button> : null}</header>{editingProfile ? <form className="vendor-portal-profile-form" onSubmit={saveProfile}><div className="vendor-portal-form-grid"><label><span>Contact person</span><input required value={profile.contactPerson} onChange={(event) => setProfile({ ...profile, contactPerson: event.target.value })} /></label><label><span>Support email</span><input required type="email" value={profile.supportEmail} onChange={(event) => setProfile({ ...profile, supportEmail: event.target.value })} /></label><label><span>Support phone</span><input required type="tel" value={profile.supportPhone} onChange={(event) => setProfile({ ...profile, supportPhone: event.target.value })} /></label><label className="vendor-portal-span"><span>Internal notes</span><textarea rows="3" value={profile.notes} onChange={(event) => setProfile({ ...profile, notes: event.target.value })} /></label></div><button className="button button-success" disabled={saving} type="submit"><Save size={15} />{saving ? "Saving..." : "Save profile"}</button></form> : <div className="vendor-portal-facts"><article><span><Mail size={16} /></span><div><small>Support email</small><strong>{vendor.supportEmail}</strong></div></article><article><span><Phone size={16} /></span><div><small>Support phone</small><strong>{vendor.supportPhone}</strong></div></article><article><span><Building2 size={16} /></span><div><small>Primary contact</small><strong>{vendor.contactPerson}</strong></div></article><article><span><Clock3 size={16} /></span><div><small>Settlement cycle</small><strong>{vendor.settlementCycleDays} days · manual</strong></div></article></div>}<div className="vendor-portal-store-list"><small>Store scope</small><div>{workspace.stores.map((store) => <span key={store.id}><Store size={13} />{store.name}<i>{store.code}</i></span>)}</div></div></section>
        <section className="vendor-portal-panel vendor-portal-catalog"><header><div><p className="eyebrow">Seller catalog</p><h2>Offers and pricing</h2></div><span className="vendor-portal-count"><Tags size={14} />{offers.length} offers</span></header>{editingOffer ? <OfferEditor offer={editingOffer} onCancel={() => setEditingOffer(null)} onSave={saveOffer} saving={saving} /> : null}{offers.length ? <div className="vendor-portal-offers">{offers.map((offer) => <article key={offer.id}><span className="vendor-offer-icon"><PackageCheck size={17} /></span><div className="vendor-portal-offer-name"><strong>{offer.productName}</strong><small>{offer.variantName || offer.catalogSku} · {offer.sellerSku}</small></div><div><small>Store</small><strong>{offer.storeName}</strong></div><div><small>Selling price</small><strong>{money(offer.salePrice)}</strong><del>{offer.listPrice > offer.salePrice ? money(offer.listPrice) : ""}</del></div><div><small>Stock</small><strong>{offer.availableQuantity}</strong></div><Status tone={offer.status === "ACTIVE" ? "positive" : "warning"}>{offer.status === "ACTIVE" ? "Active" : "Paused"}</Status>{canEditOffer && vendor.status === "ACTIVE" ? <button aria-label={`Edit ${offer.productName}`} className="icon-button" onClick={() => setEditingOffer(offer)} type="button"><Pencil size={15} /></button> : null}</article>)}</div> : <div className="empty-workspace"><PauseCircle size={26} /><h3>No offers assigned</h3><p>Your marketplace administrator must assign catalog products before you can manage prices.</p></div>}</section>
      </div>
    </> : <div className="empty-workspace"><RefreshCcw size={26} /><h3>Vendor scope is unavailable</h3><p>Ask the marketplace administrator to assign this account to an active vendor.</p></div>}
  </AppShell>;
}
