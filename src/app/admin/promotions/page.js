"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeIndianRupee, CalendarClock, Check, ChevronRight, CirclePause, Copy, Eye,
  Gift, Percent, Plus, Search, Sparkles, Store, Tag, TicketPercent, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { createCouponRequest, createPromotionRequest, listPromotionsRequest, previewPromotionRequest,
  promotionDetailsRequest, promotionOptionsRequest, transitionPromotionRequest, updateCouponRequest,
  updatePromotionRequest } from "@/lib/api-client";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const tone = { ACTIVE: "positive", SCHEDULED: "warning", DRAFT: "neutral", PAUSED: "warning", EXPIRED: "danger", INACTIVE: "neutral" };
const titleCase = (value) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const formatDate = (value) => value ? dateTime.format(new Date(value)) : "No end date";
const nowInput = () => { const date = new Date(Date.now() + 60 * 60 * 1000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const inputDate = (value) => { if (!value) return ""; const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const isoDate = (value) => value ? new Date(value).toISOString() : null;

function offerValue(promotion) {
  if (promotion.type === "PERCENTAGE") return `${promotion.discountValue}% off`;
  if (promotion.type === "FIXED_AMOUNT") return `${money.format(promotion.discountValue)} off`;
  return "Free shipping";
}

function emptyPromotion(promotion) {
  return { name: promotion?.name || "", type: promotion?.type || "PERCENTAGE", storeId: promotion?.storeId || "",
    priority: promotion?.priority ?? 0, stackable: promotion?.stackable || false,
    startsAt: inputDate(promotion?.startsAt) || nowInput(), endsAt: inputDate(promotion?.endsAt),
    usageLimitTotal: promotion?.usageLimitTotal ?? "", usageLimitPerCustomer: promotion?.usageLimitPerCustomer ?? "",
    minimumOrderAmount: promotion?.minimumOrderAmount ?? 0, discountValue: promotion?.discountValue ?? 10,
    maxDiscountAmount: promotion?.maxDiscountAmount ?? "", couponRequired: promotion?.couponRequired ?? true };
}

function promotionPayload(form) {
  return { ...form, storeId: form.storeId || null, priority: Number(form.priority || 0), startsAt: isoDate(form.startsAt),
    endsAt: isoDate(form.endsAt), usageLimitTotal: form.usageLimitTotal === "" ? null : Number(form.usageLimitTotal),
    usageLimitPerCustomer: form.usageLimitPerCustomer === "" ? null : Number(form.usageLimitPerCustomer),
    minimumOrderAmount: Number(form.minimumOrderAmount || 0), discountValue: form.type === "FREE_SHIPPING" ? 0 : Number(form.discountValue || 0),
    maxDiscountAmount: form.maxDiscountAmount === "" || form.type !== "PERCENTAGE" ? null : Number(form.maxDiscountAmount) };
}

function PromotionSkeleton() {
  return <div aria-label="Loading offers and coupons" className="promotion-skeleton" role="status">
    <div>{[1, 2, 3, 4].map((item) => <i key={item} />)}</div><section><span />{[1, 2, 3, 4, 5].map((item) => <b key={item} />)}</section>
  </div>;
}

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

function PromotionEditor({ accessToken, options, promotion, tenantId, onClose, onSaved }) {
  const [form, setForm] = useState(() => emptyPromotion(promotion)); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [fieldErrors, setFieldErrors] = useState({}); const dialogRef = useRef(null);
  useDialog(true, onClose, dialogRef, saving); const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setFieldErrors({});
    try {
      const result = promotion ? await updatePromotionRequest(promotion.id, promotionPayload(form), accessToken, tenantId)
        : await createPromotionRequest(promotionPayload(form), accessToken, tenantId);
      onSaved(result.promotion.id);
    } catch (requestError) {
      setError(requestError.message || "The offer could not be saved.");
      setFieldErrors(Object.fromEntries((requestError.details || []).map((item) => [item.field, item.message])));
    } finally { setSaving(false); }
  }
  return <div className="dialog-backdrop promotion-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }} role="presentation">
    <section aria-labelledby="promotion-editor-title" aria-modal="true" className="promotion-dialog promotion-editor" ref={dialogRef} role="dialog">
      <header className="promotion-dialog-head"><span><Sparkles aria-hidden="true" size={20} /></span><div><p className="eyebrow">Campaign builder</p><h2 id="promotion-editor-title">{promotion ? "Edit offer" : "Create offer"}</h2><small>Configure eligibility, value, dates, and usage safeguards.</small></div><button aria-label="Close offer editor" className="icon-button" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header>
      <form className="promotion-editor-form" id="promotion-editor-form" onSubmit={save}>
        <section><header><span>1</span><div><h3>Offer identity</h3><p>Name the campaign and choose where it applies.</p></div></header><div className="promotion-form-grid">
          <label className="form-field promotion-span-2"><span>Offer name <em>*</em></span><input autoFocus maxLength={190} value={form.name} onChange={(event) => set("name", event.target.value)} />{fieldErrors.name ? <small>{fieldErrors.name}</small> : null}</label>
          <label className="form-field"><span>Discount type <em>*</em></span><select value={form.type} onChange={(event) => set("type", event.target.value)}><option value="PERCENTAGE">Percentage discount</option><option value="FIXED_AMOUNT">Fixed amount</option><option value="FREE_SHIPPING">Free shipping</option></select></label>
          <label className="form-field"><span>Store scope</span><select value={form.storeId} onChange={(event) => set("storeId", event.target.value)}><option value="">All active stores</option>{options.stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}</select></label>
        </div></section>
        <section><header><span>2</span><div><h3>Value and eligibility</h3><p>Set the customer benefit and order threshold.</p></div></header><div className="promotion-form-grid">
          {form.type !== "FREE_SHIPPING" ? <label className="form-field"><span>{form.type === "PERCENTAGE" ? "Discount percentage" : "Discount amount (₹)"} <em>*</em></span><input inputMode="decimal" min="0" step="0.01" type="number" value={form.discountValue} onChange={(event) => set("discountValue", event.target.value)} />{fieldErrors.discountValue ? <small>{fieldErrors.discountValue}</small> : null}</label> : <div className="promotion-value-note"><Gift aria-hidden="true" size={19} /><span><strong>Shipping becomes free</strong><small>The shipping charge is used as the discount.</small></span></div>}
          {form.type === "PERCENTAGE" ? <label className="form-field"><span>Maximum discount (₹)</span><input inputMode="decimal" min="0" placeholder="No cap" step="0.01" type="number" value={form.maxDiscountAmount} onChange={(event) => set("maxDiscountAmount", event.target.value)} /></label> : null}
          <label className="form-field"><span>Minimum order (₹)</span><input inputMode="decimal" min="0" step="0.01" type="number" value={form.minimumOrderAmount} onChange={(event) => set("minimumOrderAmount", event.target.value)} /></label>
          <label className="form-field"><span>Priority</span><input inputMode="numeric" min="0" max="9999" type="number" value={form.priority} onChange={(event) => set("priority", event.target.value)} /></label>
          <label className="promotion-toggle"><input checked={form.couponRequired} onChange={(event) => set("couponRequired", event.target.checked)} type="checkbox" /><span><strong>Coupon required</strong><small>Customer must enter an active code.</small></span></label>
          <label className="promotion-toggle"><input checked={form.stackable} onChange={(event) => set("stackable", event.target.checked)} type="checkbox" /><span><strong>Allow stacking</strong><small>Can combine with another eligible offer.</small></span></label>
        </div></section>
        <section><header><span>3</span><div><h3>Schedule and limits</h3><p>Control availability and protect campaign budgets.</p></div></header><div className="promotion-form-grid">
          <label className="form-field"><span>Starts at <em>*</em></span><input type="datetime-local" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} />{fieldErrors.startsAt ? <small>{fieldErrors.startsAt}</small> : null}</label>
          <label className="form-field"><span>Ends at</span><input min={form.startsAt} type="datetime-local" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} />{fieldErrors.endsAt ? <small>{fieldErrors.endsAt}</small> : null}</label>
          <label className="form-field"><span>Total usage limit</span><input inputMode="numeric" min="1" placeholder="Unlimited" type="number" value={form.usageLimitTotal} onChange={(event) => set("usageLimitTotal", event.target.value)} /></label>
          <label className="form-field"><span>Limit per customer</span><input inputMode="numeric" min="1" placeholder="Unlimited" type="number" value={form.usageLimitPerCustomer} onChange={(event) => set("usageLimitPerCustomer", event.target.value)} /></label>
        </div></section>{error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
      </form>
      <footer className="promotion-dialog-actions"><span>New offers are saved as drafts before activation.</span><div><button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} form="promotion-editor-form" type="submit">{saving ? "Saving…" : promotion ? "Save changes" : "Create draft"}</button></div></footer>
    </section></div>;
}

function CouponForm({ saving, onCancel, onSubmit }) {
  const [form, setForm] = useState({ code: "", usageLimit: "", startsAt: "", endsAt: "", status: "ACTIVE" });
  return <form className="coupon-create-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form,
    usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit), startsAt: isoDate(form.startsAt), endsAt: isoDate(form.endsAt) }); }}>
    <label className="form-field"><span>Coupon code <em>*</em></span><input autoFocus maxLength={40} placeholder="FESTIVE10" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} /></label>
    <label className="form-field"><span>Usage limit</span><input min="1" placeholder="Unlimited" type="number" value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} /></label>
    <label className="form-field"><span>Starts at</span><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
    <label className="form-field"><span>Ends at</span><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label>
    <div><button className="button button-secondary" disabled={saving} onClick={onCancel} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Adding…" : "Add coupon"}</button></div>
  </form>;
}

function PromotionDetails({ accessToken, canManage, promotionId, tenantId, onClose, onEdit, onUpdated }) {
  const [details, setDetails] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [showCoupon, setShowCoupon] = useState(false);
  const [preview, setPreview] = useState({ subtotal: "1499", shippingAmount: "49", couponCode: "" }); const [previewResult, setPreviewResult] = useState(null);
  const dialogRef = useRef(null); useDialog(true, onClose, dialogRef, busy);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setDetails(await promotionDetailsRequest(promotionId, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Offer details could not be loaded."); } finally { setLoading(false); } }, [accessToken, promotionId, tenantId]);
  useEffect(() => { load(); }, [load]); const promotion = details?.promotion;
  async function transition(action) { setBusy(true); setError(""); try { const result = await transitionPromotionRequest(promotionId, action, accessToken, tenantId); setDetails(result); onUpdated(); }
    catch (requestError) { setError(requestError.message || "Offer status could not be changed."); } finally { setBusy(false); } }
  async function addCoupon(input) { setBusy(true); setError(""); try { const result = await createCouponRequest(promotionId, input, accessToken, tenantId); setDetails(result); setShowCoupon(false); onUpdated(); }
    catch (requestError) { setError(requestError.message || "Coupon could not be added."); } finally { setBusy(false); } }
  async function toggleCoupon(coupon) { setBusy(true); setError(""); try { const result = await updateCouponRequest(promotionId, coupon.id,
    { code: coupon.code, status: coupon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", usageLimit: coupon.usageLimit,
      startsAt: coupon.startsAt, endsAt: coupon.endsAt }, accessToken, tenantId); setDetails(result); onUpdated(); }
    catch (requestError) { setError(requestError.message || "Coupon status could not be changed."); } finally { setBusy(false); } }
  async function runPreview(event) { event.preventDefault(); setBusy(true); setError(""); try { setPreviewResult(await previewPromotionRequest(promotionId,
    { subtotal: Number(preview.subtotal || 0), shippingAmount: Number(preview.shippingAmount || 0), couponCode: preview.couponCode }, accessToken, tenantId)); }
    catch (requestError) { setError(requestError.message || "Preview could not be calculated."); } finally { setBusy(false); } }
  return <div className="dialog-backdrop promotion-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }} role="presentation">
    <section aria-labelledby="promotion-detail-title" aria-modal="true" className="promotion-dialog promotion-detail" ref={dialogRef} role="dialog">
      <header className="promotion-dialog-head"><span><TicketPercent aria-hidden="true" size={20} /></span><div><p className="eyebrow">Offer workspace</p><h2 id="promotion-detail-title">{promotion?.name || "Loading offer"}</h2><small>{promotion ? `${offerValue(promotion)} · ${promotion.storeName}` : "Rules, coupons, and performance"}</small></div>{promotion ? <Status tone={tone[promotion.status]}>{titleCase(promotion.status)}</Status> : null}<button aria-label="Close offer details" className="icon-button" disabled={busy} onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header>
      {loading ? <div className="promotion-detail-loading" role="status"><i /><i /><i /></div> : details ? <div className="promotion-detail-scroll">
        <section className="promotion-detail-metrics"><article><small>Redemptions</small><strong>{promotion.redemptionCount.toLocaleString("en-IN")}</strong></article><article><small>Discount given</small><strong>{money.format(promotion.discountTotal)}</strong></article><article><small>Coupon codes</small><strong>{promotion.couponCount}</strong></article><article><small>Priority</small><strong>{promotion.priority}</strong></article></section>
        {error ? <div className="inline-state inline-state-error" role="alert">{error}</div> : null}
        <div className="promotion-detail-grid"><section className="promotion-rule-panel"><header><div><p className="eyebrow">Campaign rules</p><h3>Eligibility and value</h3></div>{canManage ? <button className="text-action" onClick={() => onEdit(promotion)} type="button">Edit rules</button> : null}</header><dl><div><dt>Benefit</dt><dd>{offerValue(promotion)}</dd></div><div><dt>Minimum order</dt><dd>{money.format(promotion.minimumOrderAmount)}</dd></div><div><dt>Schedule</dt><dd>{formatDate(promotion.startsAt)}<small>to {formatDate(promotion.endsAt)}</small></dd></div><div><dt>Coupon</dt><dd>{promotion.couponRequired ? "Required" : "Not required"}</dd></div><div><dt>Total limit</dt><dd>{promotion.usageLimitTotal?.toLocaleString("en-IN") || "Unlimited"}</dd></div><div><dt>Per customer</dt><dd>{promotion.usageLimitPerCustomer?.toLocaleString("en-IN") || "Unlimited"}</dd></div></dl></section>
          <section className="promotion-preview-panel"><header><div><p className="eyebrow">Safe preview</p><h3>Test an order</h3></div></header><form onSubmit={runPreview}><label className="form-field"><span>Subtotal (₹)</span><input min="0" step="0.01" type="number" value={preview.subtotal} onChange={(event) => setPreview((current) => ({ ...current, subtotal: event.target.value }))} /></label><label className="form-field"><span>Shipping (₹)</span><input min="0" step="0.01" type="number" value={preview.shippingAmount} onChange={(event) => setPreview((current) => ({ ...current, shippingAmount: event.target.value }))} /></label>{promotion.couponRequired ? <label className="form-field promotion-preview-code"><span>Coupon code</span><input value={preview.couponCode} onChange={(event) => setPreview((current) => ({ ...current, couponCode: event.target.value.toUpperCase() }))} /></label> : null}<button className="button button-secondary" disabled={busy} type="submit">Calculate</button></form>{previewResult ? <div className="promotion-preview-result" data-eligible={previewResult.eligible}><span><strong>{previewResult.eligible ? money.format(previewResult.discountAmount) : "Not eligible"}</strong><small>{previewResult.reason}</small></span>{previewResult.eligible ? <span><small>Payable</small><strong>{money.format(previewResult.payableAmount)}</strong></span> : null}</div> : null}</section></div>
        <section className="promotion-coupon-panel"><header><div><p className="eyebrow">Coupon inventory</p><h3>Codes and usage</h3></div>{canManage && !showCoupon ? <button className="button button-secondary" onClick={() => setShowCoupon(true)} type="button"><Plus aria-hidden="true" size={16} />Add coupon</button> : null}</header>{showCoupon ? <CouponForm onCancel={() => setShowCoupon(false)} onSubmit={addCoupon} saving={busy} /> : null}{details.coupons.length ? <div className="promotion-coupon-list">{details.coupons.map((coupon) => <article key={coupon.id}><span className="promotion-code-icon"><Tag aria-hidden="true" size={16} /></span><span><strong>{coupon.code}</strong><small>{coupon.usageCount.toLocaleString("en-IN")}{coupon.usageLimit ? ` of ${coupon.usageLimit.toLocaleString("en-IN")}` : " uses"} · {formatDate(coupon.endsAt)}</small></span><Status tone={tone[coupon.status]}>{titleCase(coupon.status)}</Status>{canManage ? <button aria-label={`${coupon.status === "ACTIVE" ? "Deactivate" : "Activate"} ${coupon.code}`} className="promotion-coupon-toggle" disabled={busy} onClick={() => toggleCoupon(coupon)} type="button">{coupon.status === "ACTIVE" ? "Deactivate" : "Activate"}</button> : null}</article>)}</div> : !showCoupon ? <div className="promotion-empty-mini"><TicketPercent aria-hidden="true" size={21} /><span>No coupon codes created for this offer.</span></div> : null}</section>
        <section className="promotion-redemption-panel"><header><div><p className="eyebrow">Recent performance</p><h3>Redemptions</h3></div><span>{promotion.redemptionCount} total</span></header>{details.redemptions.length ? <div>{details.redemptions.map((item) => <article key={item.id}><span><strong>{item.orderNumber}</strong><small>{item.customerName} · {item.couponCode}</small></span><span><strong>{money.format(item.discountAmount)}</strong><small>{formatDate(item.redeemedAt)}</small></span></article>)}</div> : <div className="promotion-empty-mini"><TrendingUp aria-hidden="true" size={21} /><span>Redemptions will appear after orders use this offer.</span></div>}</section>
      </div> : <div className="promotion-dialog-error" role="alert"><strong>Offer details are unavailable</strong><span>{error}</span><button className="button button-secondary" onClick={load} type="button">Try again</button></div>}
      {details ? <footer className="promotion-dialog-actions"><span>Status changes are written to the audit trail.</span><div>{canManage ? promotion.storedStatus === "ACTIVE" ? <button className="button promotion-pause-button" disabled={busy} onClick={() => transition("pause")} type="button"><CirclePause aria-hidden="true" size={16} />Pause offer</button> : <button className="button button-primary" disabled={busy || promotion.status === "EXPIRED"} onClick={() => transition("activate")} type="button"><Check aria-hidden="true" size={16} />Activate offer</button> : null}<button className="button button-secondary" onClick={onClose} type="button">Close</button></div></footer> : null}
    </section></div>;
}

export default function PromotionsPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canManage = canUser(user, "admin", "promotion.manage", tenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", type: "ALL", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState(""); const [result, setResult] = useState(null); const [options, setOptions] = useState({ stores: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selectedId, setSelectedId] = useState(null); const [editor, setEditor] = useState(null);
  const load = useCallback(async () => { if (!accessToken || !tenantId) return; setLoading(true); setError(""); try { const [list, available] = await Promise.all([
    listPromotionsRequest(filters, accessToken, tenantId), promotionOptionsRequest(accessToken, tenantId)]); setResult(list); setOptions(available); }
    catch (requestError) { setError(requestError.message || "Offers and coupons could not be loaded."); } finally { setLoading(false); } }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]); const promotions = result?.items || [];
  const summary = useMemo(() => result?.summary || { total: 0, active: 0, scheduled: 0, draft: 0, redemptions: 0, discountTotal: 0 }, [result]);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  const action = canManage ? <button className="button button-primary" onClick={() => setEditor({ mode: "create" })} type="button"><Plus aria-hidden="true" size={17} />New offer</button> : null;
  return <AppShell action={action} area="admin" currentPath="/admin/promotions" eyebrow="Growth operations" title="Offers & coupons" description="Create controlled discounts, issue coupon codes, and monitor campaign usage across every store.">
    {loading && !result ? <PromotionSkeleton /> : <><section className="promotion-signal-grid" aria-label="Promotion summary"><article><span><Sparkles aria-hidden="true" size={18} /></span><div><small>All offers</small><strong>{summary.total.toLocaleString("en-IN")}</strong><em>{summary.active} active</em></div></article><article><span><CalendarClock aria-hidden="true" size={18} /></span><div><small>Scheduled</small><strong>{summary.scheduled.toLocaleString("en-IN")}</strong><em>{summary.draft} drafts</em></div></article><article><span><Copy aria-hidden="true" size={18} /></span><div><small>Redemptions</small><strong>{summary.redemptions.toLocaleString("en-IN")}</strong><em>Successful uses</em></div></article><article><span><BadgeIndianRupee aria-hidden="true" size={18} /></span><div><small>Discount given</small><strong>{money.format(summary.discountTotal)}</strong><em>Net of reversals</em></div></article></section>
      <section className="tenant-directory promotion-directory" aria-labelledby="promotion-directory-title"><div className="section-heading tenant-directory-heading promotion-directory-heading"><div><p className="eyebrow">Campaign directory</p><h2 id="promotion-directory-title">Offers and coupon rules</h2></div><form className="directory-filters promotion-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search offers or coupons</span><Search aria-hidden="true" size={16} /><input placeholder="Offer name or coupon code" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} /></label><select aria-label="Offer status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="SCHEDULED">Scheduled</option><option value="DRAFT">Draft</option><option value="PAUSED">Paused</option><option value="EXPIRED">Expired</option></select><select aria-label="Discount type" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}><option value="ALL">All discount types</option><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option><option value="FREE_SHIPPING">Free shipping</option></select><button className="button button-secondary" type="submit">Search</button></form></div>
        {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
        {loading ? <div className="promotion-directory-loading" role="status">Refreshing campaign performance…</div> : promotions.length ? <><div className="table-wrap promotion-table-wrap"><table className="tenant-table promotion-table"><thead><tr><th>Offer</th><th>Value</th><th>Scope</th><th>Schedule</th><th>Usage</th><th>Discount given</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{promotions.map((promotion) => <tr key={promotion.id}><td data-label="Offer"><button className="promotion-identity" onClick={() => setSelectedId(promotion.id)} type="button"><span><Percent aria-hidden="true" size={17} /></span><span><strong>{promotion.name}</strong><small>{titleCase(promotion.type)} · Priority {promotion.priority}</small></span></button></td><td data-label="Value"><strong>{offerValue(promotion)}</strong><small className="promotion-table-sub">Min. {money.format(promotion.minimumOrderAmount)}</small></td><td data-label="Scope"><span className="promotion-scope"><Store aria-hidden="true" size={14} /><strong>{promotion.storeName}</strong><small>{promotion.couponRequired ? `${promotion.couponCount} coupon codes` : "Automatic offer"}</small></span></td><td data-label="Schedule"><span className="promotion-schedule"><strong>{formatDate(promotion.startsAt)}</strong><small>to {formatDate(promotion.endsAt)}</small></span></td><td data-label="Usage"><strong>{promotion.redemptionCount.toLocaleString("en-IN")}{promotion.usageLimitTotal ? ` / ${promotion.usageLimitTotal.toLocaleString("en-IN")}` : ""}</strong></td><td data-label="Discount given"><strong>{money.format(promotion.discountTotal)}</strong></td><td data-label="Status"><Status tone={tone[promotion.status]}>{titleCase(promotion.status)}</Status></td><td><button aria-label={`View ${promotion.name}`} className="row-action promotion-view-action table-view-action" onClick={() => setSelectedId(promotion.id)} type="button"><Eye aria-hidden="true" size={15} />View<ChevronRight aria-hidden="true" size={14} /></button></td></tr>)}</tbody></table></div><TablePagination itemLabel="offers" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></> : <div className="empty-workspace"><TicketPercent aria-hidden="true" size={29} /><h3>No offers match this view</h3><p>Create a draft offer or change the campaign filters.</p>{canManage ? <button className="button button-primary" onClick={() => setEditor({ mode: "create" })} type="button"><Plus aria-hidden="true" size={16} />Create offer</button> : null}</div>}
      </section></>}
    {selectedId ? <PromotionDetails accessToken={accessToken} canManage={canManage} onClose={() => setSelectedId(null)} onEdit={(promotion) => { setSelectedId(null); setEditor({ mode: "edit", promotion }); }} onUpdated={load} promotionId={selectedId} tenantId={tenantId} /> : null}
    {editor ? <PromotionEditor accessToken={accessToken} onClose={() => setEditor(null)} onSaved={(id) => { setEditor(null); load(); setSelectedId(id); }} options={options} promotion={editor.promotion} tenantId={tenantId} /> : null}
  </AppShell>;
}
