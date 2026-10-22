"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeIndianRupee, Boxes, BriefcaseBusiness, Check, ChevronRight, CirclePause,
  Edit3, IndianRupee, Layers3, PackageCheck, Plus, Search, Store, Tags, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createPriceListRequest, createSellerOfferRequest, listPriceListsRequest,
  listSellerOffersRequest, sellerOfferOptionsRequest, updatePriceListRequest,
  updateSellerOfferRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const statusTone = { ACTIVE: "positive", DRAFT: "neutral", INACTIVE: "warning" };
const titleCase = (value) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const optionalNumber = (value) => value === "" || value === null || value === undefined ? null : Number(value);

function useDialog(open, onClose, dialogRef, disabled = false) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = (event) => {
      if (event.key === "Escape" && !disabled) onClose();
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])") || [])];
      if (!focusable.length) return; const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [disabled, onClose, open, dialogRef]);
}

function SellerPricingSkeleton() {
  return <div className="seller-pricing-skeleton" aria-label="Loading seller pricing" role="status">
    <div>{[1, 2, 3, 4].map((item) => <i key={item} />)}</div><section><span />{[1, 2, 3, 4, 5].map((item) => <b key={item} />)}</section>
  </div>;
}

function offerForm(offer, options) {
  const merchantId = offer?.merchantId || options.merchants?.[0]?.id || "";
  const merchant = options.merchants?.find((item) => item.id === merchantId);
  const storeId = offer?.storeId || merchant?.stores?.[0]?.id || "";
  const allowedLists = (options.priceLists || []).filter((list) => !list.storeId || list.storeId === storeId);
  return { merchantId, storeId, variantId: offer?.variantId || options.variants?.[0]?.id || "",
    priceListId: offer?.priceListId || allowedLists[0]?.id || "", sellerSku: offer?.sellerSku || "",
    status: offer?.status || "DRAFT", fulfillmentType: offer?.fulfillmentType || "MERCHANT",
    handlingTimeHours: offer?.handlingTimeHours ?? 24, minimumOrderQuantity: offer?.minimumOrderQuantity ?? "",
    maximumOrderQuantity: offer?.maximumOrderQuantity ?? "", listPrice: offer?.listPrice ?? "",
    salePrice: offer?.salePrice ?? "", costPrice: offer?.costPrice ?? "" };
}

function OfferEditor({ accessToken, offer, onClose, onSaved, options, tenantId }) {
  const [form, setForm] = useState(() => offerForm(offer, options)); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState({}); const dialogRef = useRef(null);
  useDialog(true, onClose, dialogRef, saving);
  const merchantOptions = offer && !options.merchants.some((item) => item.id === offer.merchantId)
    ? [{ id: offer.merchantId, code: offer.merchantCode, name: offer.merchantName, type: offer.merchantType,
      status: offer.merchantStatus, stores: [{ id: offer.storeId, code: "Current", name: offer.storeName }] }, ...options.merchants]
    : options.merchants;
  const merchant = merchantOptions.find((item) => item.id === form.merchantId);
  const stores = merchant?.stores || [];
  const priceLists = options.priceLists.filter((list) => !list.storeId || list.storeId === form.storeId);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  function selectMerchant(value) {
    const next = options.merchants.find((item) => item.id === value); const storeId = next?.stores?.[0]?.id || "";
    const list = options.priceLists.find((item) => !item.storeId || item.storeId === storeId);
    setForm((current) => ({ ...current, merchantId: value, storeId, priceListId: list?.id || "" }));
  }
  function selectStore(value) {
    const list = options.priceLists.find((item) => !item.storeId || item.storeId === value);
    setForm((current) => ({ ...current, storeId: value, priceListId: list?.id || "" }));
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setFieldErrors({});
    const payload = { ...form, handlingTimeHours: Number(form.handlingTimeHours || 0),
      minimumOrderQuantity: optionalNumber(form.minimumOrderQuantity), maximumOrderQuantity: optionalNumber(form.maximumOrderQuantity),
      listPrice: Number(form.listPrice), salePrice: Number(form.salePrice), costPrice: optionalNumber(form.costPrice) };
    if (offer) { delete payload.merchantId; delete payload.storeId; delete payload.variantId; delete payload.sellerSku; }
    try {
      const saved = offer ? await updateSellerOfferRequest(offer.id, payload, accessToken, tenantId)
        : await createSellerOfferRequest(payload, accessToken, tenantId);
      onSaved(saved);
    } catch (requestError) {
      setError(requestError.message || "The seller offer could not be saved.");
      setFieldErrors(Object.fromEntries((requestError.details || []).map((item) => [item.field, item.message])));
    } finally { setSaving(false); }
  }
  return <div className="dialog-backdrop seller-pricing-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }} role="presentation">
    <section aria-labelledby="seller-offer-editor-title" aria-modal="true" className="seller-pricing-dialog" ref={dialogRef} role="dialog">
      <header className="seller-pricing-dialog-head"><span><PackageCheck aria-hidden="true" size={21} /></span><div><p className="eyebrow">Seller commercial terms</p><h2 id="seller-offer-editor-title">{offer ? "Edit seller offer" : "Create seller offer"}</h2><small>Connect one merchant, store, catalog variant, and active INR price.</small></div><button aria-label="Close seller offer editor" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header>
      <form className="seller-pricing-form" id="seller-offer-form" onSubmit={save}>
        <section><header><span>1</span><div><h3>Listing identity</h3><p>Choose who sells the variant and where it is offered.</p></div></header><div className="seller-pricing-form-grid">
          <label className="form-field"><span>Merchant <em>*</em></span><select autoFocus disabled={Boolean(offer)} value={form.merchantId} onChange={(event) => selectMerchant(event.target.value)}>{merchantOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {titleCase(item.type)}{item.status !== "ACTIVE" ? " · Suspended" : ""}</option>)}</select>{fieldErrors.merchantId ? <small className="field-error">{fieldErrors.merchantId}</small> : null}</label>
          <label className="form-field"><span>Store <em>*</em></span><select disabled={Boolean(offer)} value={form.storeId} onChange={(event) => selectStore(event.target.value)}>{stores.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
          <label className="form-field seller-pricing-span-2"><span>Catalog variant <em>*</em></span><select disabled={Boolean(offer)} value={form.variantId} onChange={(event) => set("variantId", event.target.value)}>{options.variants.map((item) => <option key={item.id} value={item.id}>{item.productName} · {item.variantName} · {item.sku}</option>)}</select>{fieldErrors.variantId ? <small className="field-error">{fieldErrors.variantId}</small> : null}</label>
          <label className="form-field"><span>Seller SKU <em>*</em></span><input disabled={Boolean(offer)} maxLength={100} placeholder="SELLER-SKU-001" required value={form.sellerSku} onChange={(event) => set("sellerSku", event.target.value.toUpperCase())} /></label>
          <label className="form-field"><span>Lifecycle</span><select value={form.status} onChange={(event) => set("status", event.target.value)}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option>{offer ? <option value="INACTIVE">Inactive</option> : null}</select></label>
        </div></section>
        <section><header><span>2</span><div><h3>Price and availability rules</h3><p>MRP and selling price are stored as a versioned price period.</p></div></header><div className="seller-pricing-form-grid">
          <label className="form-field seller-pricing-span-2"><span>Price list <em>*</em></span><select required value={form.priceListId} onChange={(event) => set("priceListId", event.target.value)}>{priceLists.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code} · INR</option>)}</select>{!priceLists.length ? <small className="field-error">Create an active price list for this store first.</small> : null}</label>
          <label className="form-field"><span>MRP (₹) <em>*</em></span><input min="0.01" required step="0.01" type="number" value={form.listPrice} onChange={(event) => set("listPrice", event.target.value)} />{fieldErrors.listPrice ? <small className="field-error">{fieldErrors.listPrice}</small> : null}</label>
          <label className="form-field"><span>Selling price (₹) <em>*</em></span><input min="0.01" required step="0.01" type="number" value={form.salePrice} onChange={(event) => set("salePrice", event.target.value)} />{fieldErrors.salePrice ? <small className="field-error">{fieldErrors.salePrice}</small> : null}</label>
          <label className="form-field"><span>Cost price (₹)</span><input min="0" step="0.01" type="number" value={form.costPrice} onChange={(event) => set("costPrice", event.target.value)} /></label>
          <label className="form-field"><span>Fulfillment</span><select value={form.fulfillmentType} onChange={(event) => set("fulfillmentType", event.target.value)}><option value="MERCHANT">Merchant fulfilled</option><option value="PLATFORM">Platform fulfilled</option></select></label>
          <label className="form-field"><span>Handling time (hours)</span><input max="720" min="0" type="number" value={form.handlingTimeHours} onChange={(event) => set("handlingTimeHours", event.target.value)} /></label>
          <label className="form-field"><span>Minimum order quantity</span><input min="0.000001" step="0.000001" type="number" value={form.minimumOrderQuantity} onChange={(event) => set("minimumOrderQuantity", event.target.value)} /></label>
          <label className="form-field"><span>Maximum order quantity</span><input min="0.000001" step="0.000001" type="number" value={form.maximumOrderQuantity} onChange={(event) => set("maximumOrderQuantity", event.target.value)} />{fieldErrors.maximumOrderQuantity ? <small className="field-error">{fieldErrors.maximumOrderQuantity}</small> : null}</label>
        </div></section>{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
      </form>
      <footer className="seller-pricing-dialog-actions"><span>Price edits preserve the previous price period for audit.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving || !priceLists.length} form="seller-offer-form" type="submit">{saving ? "Saving…" : offer ? "Save changes" : "Create offer"}</button></div></footer>
    </section></div>;
}

function priceListForm(item) {
  return { code: item?.code || "", name: item?.name || "", storeId: item?.storeId || "", includesTax: item?.includesTax ?? true,
    priority: item?.priority ?? 0, startsAt: item?.startsAt ? item.startsAt.slice(0, 16) : "",
    endsAt: item?.endsAt ? item.endsAt.slice(0, 16) : "", status: item?.status || "ACTIVE" };
}

function PriceListEditor({ accessToken, item, onClose, onSaved, stores, tenantId }) {
  const [form, setForm] = useState(() => priceListForm(item)); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const dialogRef = useRef(null); useDialog(true, onClose, dialogRef, saving);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = { ...form, storeId: form.storeId || null, priority: Number(form.priority || 0),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null };
    try { const result = item ? await updatePriceListRequest(item.id, payload, accessToken, tenantId)
      : await createPriceListRequest(payload, accessToken, tenantId); onSaved(result); }
    catch (requestError) { setError(requestError.message || "The price list could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="dialog-backdrop seller-pricing-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }} role="presentation"><section aria-labelledby="price-list-editor-title" aria-modal="true" className="seller-pricing-dialog seller-price-list-dialog" ref={dialogRef} role="dialog">
    <header className="seller-pricing-dialog-head"><span><Layers3 aria-hidden="true" size={21} /></span><div><p className="eyebrow">Pricing scope</p><h2 id="price-list-editor-title">{item ? "Edit price list" : "Create price list"}</h2><small>Define a reusable INR price context for all stores or one store.</small></div><button aria-label="Close price list editor" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header>
    <form className="seller-pricing-form" id="price-list-form" onSubmit={save}><section><header><span>₹</span><div><h3>Price list details</h3><p>Higher priority lists take precedence when multiple scopes apply.</p></div></header><div className="seller-pricing-form-grid">
      <label className="form-field"><span>Name <em>*</em></span><input autoFocus required value={form.name} onChange={(event) => set("name", event.target.value)} /></label><label className="form-field"><span>Code <em>*</em></span><input maxLength={50} required value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} /></label>
      <label className="form-field seller-pricing-span-2"><span>Store scope</span><select value={form.storeId} onChange={(event) => set("storeId", event.target.value)}><option value="">All stores</option>{stores.map((storeItem) => <option key={storeItem.id} value={storeItem.id}>{storeItem.name} · {storeItem.code}</option>)}</select></label>
      <label className="form-field"><span>Priority</span><input min="0" max="9999" type="number" value={form.priority} onChange={(event) => set("priority", event.target.value)} /></label><label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => set("status", event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      <label className="form-field"><span>Starts at</span><input type="datetime-local" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} /></label><label className="form-field"><span>Ends at</span><input type="datetime-local" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} /></label>
      <label className="seller-tax-switch seller-pricing-span-2"><input checked={form.includesTax} type="checkbox" onChange={(event) => set("includesTax", event.target.checked)} /><span><Check aria-hidden="true" size={14} /></span><div><strong>Prices include GST</strong><small>Displayed INR prices are tax-inclusive for the first release.</small></div></label>
    </div></section>{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}</form>
    <footer className="seller-pricing-dialog-actions"><span>Price-list changes are recorded in the audit trail.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} form="price-list-form" type="submit">{saving ? "Saving…" : item ? "Save changes" : "Create price list"}</button></div></footer>
  </section></div>;
}

export default function SellerOffersPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "catalog.offer.manage", tenantId);
  const [tab, setTab] = useState("offers"); const [filters, setFilters] = useState({ search: "", status: "ALL", merchantType: "ALL", storeId: "", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState(""); const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ merchants: [], variants: [], priceLists: [] }); const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [editor, setEditor] = useState(null);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return; setLoading(true); setError("");
    try { const [offers, available, lists] = await Promise.all([listSellerOffersRequest(filters, accessToken, tenantId),
      sellerOfferOptionsRequest("", accessToken, tenantId), listPriceListsRequest(accessToken, tenantId)]);
      setResult(offers); setOptions(available); setPriceLists(lists); }
    catch (requestError) { setError(requestError.message || "Seller pricing could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const stores = useMemo(() => [...new Map(options.merchants.flatMap((merchant) => merchant.stores).map((storeItem) => [storeItem.id, storeItem])).values()], [options.merchants]);
  const summary = result?.summary || { total: 0, active: 0, draft: 0, merchants: 0, availableUnits: 0 };
  const offers = result?.items || []; const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  async function transition(offer) {
    setError(""); try { await updateSellerOfferRequest(offer.id, { status: offer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }, accessToken, tenantId); await load(); }
    catch (requestError) { setError(requestError.message || "Offer status could not be changed."); }
  }
  const action = canManage ? <button className="button button-primary" onClick={() => setEditor(tab === "offers" ? { kind: "offer" } : { kind: "priceList" })} type="button"><Plus aria-hidden="true" size={17} />{tab === "offers" ? "New seller offer" : "New price list"}</button> : null;
  return <AppShell action={action} area="admin" currentPath="/admin/offers" eyebrow="Marketplace commerce" title="Seller pricing" description="Control merchant listings, INR prices, fulfillment terms, and availability from one workspace.">
    {loading && !result ? <SellerPricingSkeleton /> : <><section className="seller-pricing-signals" aria-label="Seller pricing summary"><article><span><PackageCheck aria-hidden="true" size={18} /></span><div><small>Seller offers</small><strong>{summary.total.toLocaleString("en-IN")}</strong><em>{summary.active} active</em></div></article><article><span><BriefcaseBusiness aria-hidden="true" size={18} /></span><div><small>Selling merchants</small><strong>{summary.merchants.toLocaleString("en-IN")}</strong><em>First-party + vendors</em></div></article><article><span><Boxes aria-hidden="true" size={18} /></span><div><small>Available units</small><strong>{summary.availableUnits.toLocaleString("en-IN")}</strong><em>Across active inventory</em></div></article><article><span><Layers3 aria-hidden="true" size={18} /></span><div><small>Price lists</small><strong>{priceLists.length.toLocaleString("en-IN")}</strong><em>INR · tax-aware</em></div></article></section>
      <section className="tenant-directory seller-pricing-directory" aria-labelledby="seller-pricing-title"><div className="seller-pricing-toolbar"><div><p className="eyebrow">Commercial directory</p><h2 id="seller-pricing-title">Offers and price lists</h2></div><div className="seller-pricing-tabs" role="tablist"><button aria-selected={tab === "offers"} onClick={() => setTab("offers")} role="tab" type="button">Seller offers <span>{summary.total}</span></button><button aria-selected={tab === "priceLists"} onClick={() => setTab("priceLists")} role="tab" type="button">Price lists <span>{priceLists.length}</span></button></div></div>
      {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
      {tab === "offers" ? <><form className="directory-filters seller-pricing-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search seller offers</span><Search aria-hidden="true" size={16} /><input placeholder="Product, seller SKU or merchant" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Offer status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="INACTIVE">Inactive</option></select><select aria-label="Merchant type" value={filters.merchantType} onChange={(event) => updateFilter("merchantType", event.target.value)}><option value="ALL">All merchants</option><option value="FIRST_PARTY">First-party</option><option value="VENDOR">Vendors</option></select><select aria-label="Store" value={filters.storeId} onChange={(event) => updateFilter("storeId", event.target.value)}><option value="">All stores</option>{stores.map((storeItem) => <option key={storeItem.id} value={storeItem.id}>{storeItem.name}</option>)}</select><button className="button button-secondary" type="submit">Search</button></form>
        {loading ? <div className="seller-pricing-refresh" role="status">Refreshing seller prices…</div> : offers.length ? <><div className="table-wrap seller-offer-table-wrap"><table className="tenant-table seller-offer-table"><thead><tr><th>Product listing</th><th>Merchant</th><th>Store</th><th>Price</th><th>Stock</th><th>Fulfillment</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}><td data-label="Product listing"><span className="seller-offer-product"><i><Tags aria-hidden="true" size={16} /></i><span><strong>{offer.productName}</strong><small>{offer.variantName} · {offer.sellerSku}</small><em>{offer.catalogSku}</em></span></span></td><td data-label="Merchant"><strong>{offer.merchantName}</strong><small className="seller-offer-sub">{titleCase(offer.merchantType)} · {offer.merchantCode}</small></td><td data-label="Store"><span className="seller-offer-store"><Store aria-hidden="true" size={14} />{offer.storeName}</span></td><td data-label="Price"><strong>{money.format(offer.salePrice || 0)}</strong>{offer.listPrice > offer.salePrice ? <small className="seller-offer-mrp">MRP {money.format(offer.listPrice)}</small> : null}<small className="seller-offer-sub">{offer.priceListCode}</small></td><td data-label="Stock"><strong className={offer.availableQuantity <= 0 ? "seller-stock-empty" : ""}>{offer.availableQuantity.toLocaleString("en-IN")}</strong><small className="seller-offer-sub">available</small></td><td data-label="Fulfillment"><strong>{titleCase(offer.fulfillmentType)}</strong><small className="seller-offer-sub">{offer.handlingTimeHours}h handling</small></td><td data-label="Status"><Status tone={statusTone[offer.status]}>{titleCase(offer.status)}</Status></td><td><div className="seller-offer-actions">{canManage ? <><button aria-label={`Edit ${offer.productName}`} className="row-action" onClick={() => setEditor({ kind: "offer", item: offer })} type="button"><Edit3 aria-hidden="true" size={14} />Edit</button><button aria-label={`${offer.status === "ACTIVE" ? "Deactivate" : "Activate"} ${offer.productName}`} className={offer.status === "ACTIVE" ? "seller-offer-pause" : "seller-offer-activate"} onClick={() => transition(offer)} type="button">{offer.status === "ACTIVE" ? <CirclePause aria-hidden="true" size={14} /> : <Check aria-hidden="true" size={14} />}{offer.status === "ACTIVE" ? "Pause" : "Activate"}</button></> : null}</div></td></tr>)}</tbody></table></div><TablePagination itemLabel="seller offers" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></> : <div className="empty-workspace"><PackageCheck aria-hidden="true" size={29} /><h3>No seller offers match this view</h3><p>Create an offer or change the directory filters.</p>{canManage ? <button className="button button-primary" onClick={() => setEditor({ kind: "offer" })} type="button"><Plus aria-hidden="true" size={16} />Create seller offer</button> : null}</div>}</>
        : <div className="seller-price-list-grid">{priceLists.map((item) => <article key={item.id}><header><span><IndianRupee aria-hidden="true" size={18} /></span><Status tone={statusTone[item.status]}>{titleCase(item.status)}</Status></header><div><p className="eyebrow">{item.code}</p><h3>{item.name}</h3><span><Store aria-hidden="true" size={14} />{item.storeName}</span></div><dl><div><dt>Currency</dt><dd>INR</dd></div><div><dt>Tax</dt><dd>{item.includesTax ? "Included" : "Excluded"}</dd></div><div><dt>Priority</dt><dd>{item.priority}</dd></div><div><dt>Offers</dt><dd>{item.offerCount}</dd></div></dl>{canManage ? <button className="row-action" onClick={() => setEditor({ kind: "priceList", item })} type="button"><Edit3 aria-hidden="true" size={14} />Edit price list<ChevronRight aria-hidden="true" size={14} /></button> : null}</article>)}{!priceLists.length ? <div className="empty-workspace"><BadgeIndianRupee aria-hidden="true" size={29} /><h3>No price lists configured</h3><p>Create an INR price list before publishing seller offers.</p></div> : null}</div>}
      </section></>}
    {editor?.kind === "offer" ? <OfferEditor accessToken={accessToken} offer={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); }} options={options} tenantId={tenantId} /> : null}
    {editor?.kind === "priceList" ? <PriceListEditor accessToken={accessToken} item={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load(); }} stores={stores} tenantId={tenantId} /> : null}
  </AppShell>;
}
