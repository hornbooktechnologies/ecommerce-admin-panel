"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, ChevronRight, Eye, EyeOff, Flag, MessageSquareText, Search, ShieldCheck,
  Star, StarHalf, ThumbsUp, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Status } from "@/components/dashboard-primitives";
import { TablePagination } from "@/components/table-pagination";
import { canUser, tenantIdForUser } from "@/lib/auth-routing";
import { listProductRatingsRequest, moderateProductRatingRequest,
  productRatingDetailsRequest, productRatingOptionsRequest } from "@/lib/api-client";

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const statusTone = { PUBLISHED: "positive", PENDING: "warning", FLAGGED: "danger", HIDDEN: "neutral" };
const statusLabel = (value) => value ? value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
function formatDate(value, fallback = "Not available") {
  if (!value) return fallback; const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : dateTime.format(parsed);
}

function Stars({ value, compact = false }) {
  const score = Math.max(0, Math.min(5, Number(value || 0)));
  return <span aria-label={`${score} out of 5 stars`} className="rating-stars" data-compact={compact || undefined}>
    {[1, 2, 3, 4, 5].map((star) => <Star aria-hidden="true" fill={star <= Math.round(score) ? "currentColor" : "none"} key={star} size={compact ? 13 : 16} />)}
  </span>;
}

function RatingSkeleton() {
  return <div aria-label="Loading product ratings" className="rating-skeleton" role="status">
    <section><i /><i /><i /><i /></section><div><span />{[1, 2, 3, 4, 5].map((row) => <b key={row} />)}</div>
  </div>;
}

function RatingDetails({ accessToken, canModerate, onClose, onUpdated, ratingId, tenantId }) {
  const [rating, setRating] = useState(null); const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [error, setError] = useState(""); const dialogRef = useRef(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await productRatingDetailsRequest(ratingId, accessToken, tenantId);
      setRating(result); setNotes(result.moderationNotes || ""); }
    catch (requestError) { setError(requestError.message || "The rating could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, ratingId, tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keydown = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", keydown); dialogRef.current?.focus();
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [busy, onClose]);
  async function moderate(status) {
    if (["HIDDEN", "FLAGGED"].includes(status) && notes.trim().length < 3) {
      setError("Add a short moderation note before hiding or flagging this rating."); return;
    }
    setBusy(status); setError("");
    try { const result = await moderateProductRatingRequest(ratingId, { status, notes: notes.trim() }, accessToken, tenantId);
      setRating(result); setNotes(result.moderationNotes || ""); await onUpdated(); }
    catch (requestError) { setError(requestError.message || "The moderation decision could not be saved."); }
    finally { setBusy(""); }
  }
  return createPortal(<div className="dialog-backdrop rating-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section aria-label="Product rating details" aria-modal="true" className="rating-dialog" ref={dialogRef} role="dialog" tabIndex={-1}>
      <header className="rating-dialog-header"><span><MessageSquareText aria-hidden="true" size={20} /></span><div><p className="eyebrow">Review moderation</p><h2>{rating?.productName || "Product rating"}</h2></div><button aria-label="Close rating details" className="icon-button" disabled={Boolean(busy)} onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button></header>
      <div className="rating-dialog-scroll">
        {loading ? <div className="rating-detail-loading"><i /><i /><i /><i /></div> : error && !rating ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : rating ? <>
          <section className="rating-review-hero"><div className="rating-product-image">{rating.imageUrl ? <img alt="" src={rating.imageUrl} /> : <Star aria-hidden="true" size={27} />}</div><div><span className="rating-hero-score"><strong>{rating.rating}</strong><Stars value={rating.rating} /></span><h3>{rating.title || "Rating without a title"}</h3><p>{rating.review || "No written review was provided."}</p></div><Status tone={statusTone[rating.status]}>{statusLabel(rating.status)}</Status></section>
          <section className="rating-detail-facts" aria-label="Rating context"><div><UserRound aria-hidden="true" size={17} /><span><small>Customer</small><strong>{rating.customerName}</strong><em>{rating.customerEmail || "Email unavailable"}</em></span></div><div><BadgeCheck aria-hidden="true" size={17} /><span><small>Purchase</small><strong>{rating.verifiedPurchase ? "Verified purchase" : "Not verified"}</strong><em>{rating.orderNumber || "No linked order"}</em></span></div><div><ThumbsUp aria-hidden="true" size={17} /><span><small>Helpful votes</small><strong>{rating.helpfulCount.toLocaleString("en-IN")}</strong><em>Submitted {formatDate(rating.submittedAt)}</em></span></div></section>
          {rating.moderatedAt ? <div className="rating-audit-note"><ShieldCheck aria-hidden="true" size={17} /><span><strong>Last moderated by {rating.moderatedByName || "workspace user"}</strong><small>{formatDate(rating.moderatedAt)}{rating.moderationNotes ? ` · ${rating.moderationNotes}` : ""}</small></span></div> : null}
          {canModerate ? <section className="rating-moderation-panel"><div><p className="eyebrow">Decision notes</p><h3>Moderate this rating</h3><p>Notes are required when a rating is hidden or flagged.</p></div><label className="form-field"><span>Internal moderation note</span><textarea maxLength={1000} onChange={(event) => setNotes(event.target.value)} placeholder="Explain the policy decision for the audit trail" rows={3} value={notes} /></label>{error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={() => setError("")} type="button">Dismiss</button></div> : null}<div className="rating-moderation-actions"><button className="button button-success" disabled={Boolean(busy) || rating.status === "PUBLISHED"} onClick={() => moderate("PUBLISHED")} type="button"><Eye aria-hidden="true" size={16} />{busy === "PUBLISHED" ? "Publishing..." : "Publish"}</button><button className="button button-warning" disabled={Boolean(busy) || rating.status === "FLAGGED"} onClick={() => moderate("FLAGGED")} type="button"><Flag aria-hidden="true" size={16} />{busy === "FLAGGED" ? "Flagging..." : "Flag"}</button><button className="button button-danger" disabled={Boolean(busy) || rating.status === "HIDDEN"} onClick={() => moderate("HIDDEN")} type="button"><EyeOff aria-hidden="true" size={16} />{busy === "HIDDEN" ? "Hiding..." : "Hide"}</button></div></section> : null}
        </> : null}
      </div>
      <footer className="rating-dialog-footer"><span>Ratings remain tenant-scoped and every decision is audited.</span><button className="button button-secondary" disabled={Boolean(busy)} onClick={onClose} type="button">Close</button></footer>
    </section>
  </div>, document.body);
}

export default function ProductRatingsPage() {
  const { accessToken, activeTenantId, user } = useAuth(); const tenantId = tenantIdForUser(user, "admin", activeTenantId);
  const canModerate = canUser(user, "admin", "rating.moderate", tenantId);
  const [filters, setFilters] = useState({ search: "", status: "ALL", rating: 0, productId: "", page: 1, pageSize: 10 });
  const [draftSearch, setDraftSearch] = useState(""); const [result, setResult] = useState(null);
  const [options, setOptions] = useState({ products: [] }); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [selectedId, setSelectedId] = useState(null);
  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return; setLoading(true); setError("");
    try { const [list, available] = await Promise.all([listProductRatingsRequest(filters, accessToken, tenantId),
      productRatingOptionsRequest(accessToken, tenantId)]); setResult(list); setOptions(available); }
    catch (requestError) { setError(requestError.message || "Product ratings could not be loaded."); }
    finally { setLoading(false); }
  }, [accessToken, filters, tenantId]);
  useEffect(() => { load(); }, [load]);
  const ratings = result?.items || [];
  const summary = useMemo(() => result?.summary || { total: 0, published: 0, pending: 0, flagged: 0,
    hidden: 0, averageRating: 0, verifiedPublished: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }, [result]);
  const publishedTotal = Object.values(summary.distribution || {}).reduce((total, count) => total + Number(count || 0), 0);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  return <AppShell area="admin" currentPath="/admin/ratings" eyebrow="Catalog trust" title="Product ratings" description="Review customer feedback, verify purchase context, and control what is published across the catalog.">
    {loading && !result ? <RatingSkeleton /> : <>
      <section className="rating-overview" aria-label="Rating health"><div className="rating-metric-strip"><article><StarHalf aria-hidden="true" size={19} /><span><small>Published average</small><strong>{summary.averageRating.toFixed(1)} <em>/ 5</em></strong></span></article><article><Eye aria-hidden="true" size={19} /><span><small>Published</small><strong>{summary.published.toLocaleString("en-IN")}</strong><em>{summary.verifiedPublished} verified</em></span></article><article><MessageSquareText aria-hidden="true" size={19} /><span><small>Awaiting review</small><strong>{summary.pending.toLocaleString("en-IN")}</strong><em>Needs decision</em></span></article><article><Flag aria-hidden="true" size={19} /><span><small>Flagged / hidden</small><strong>{(summary.flagged + summary.hidden).toLocaleString("en-IN")}</strong><em>{summary.flagged} flagged</em></span></article></div>
        <aside className="rating-distribution"><header><div><p className="eyebrow">Published ratings</p><h2>Score distribution</h2></div><Stars compact value={summary.averageRating} /></header>{[5, 4, 3, 2, 1].map((score) => { const count = Number(summary.distribution?.[score] || 0); const width = publishedTotal ? (count / publishedTotal) * 100 : 0; return <div className="rating-distribution-row" key={score}><span>{score}<Star aria-hidden="true" fill="currentColor" size={11} /></span><i><b style={{ width: `${width}%` }} /></i><strong>{count.toLocaleString("en-IN")}</strong></div>; })}</aside>
      </section>
      <section className="tenant-directory rating-directory" aria-labelledby="rating-directory-title"><div className="section-heading tenant-directory-heading rating-directory-heading"><div><p className="eyebrow">Moderation queue</p><h2 id="rating-directory-title">Customer product feedback</h2></div><form className="directory-filters rating-filters" onSubmit={(event) => { event.preventDefault(); updateFilter("search", draftSearch.trim()); }} role="search"><label className="compact-search"><span className="sr-only">Search product ratings</span><Search aria-hidden="true" size={16} /><input onChange={(event) => setDraftSearch(event.target.value)} placeholder="Product, customer or review" value={draftSearch} /></label><select aria-label="Rating status" onChange={(event) => updateFilter("status", event.target.value)} value={filters.status}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="PUBLISHED">Published</option><option value="FLAGGED">Flagged</option><option value="HIDDEN">Hidden</option></select><select aria-label="Star rating" onChange={(event) => updateFilter("rating", Number(event.target.value))} value={filters.rating}><option value="0">All star ratings</option>{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} star{score === 1 ? "" : "s"}</option>)}</select><select aria-label="Product" onChange={(event) => updateFilter("productId", event.target.value)} value={filters.productId}><option value="">All products</option>{options.products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.ratingCount})</option>)}</select><button className="button button-secondary" type="submit">Search</button></form></div>
        {error ? <div className="inline-state inline-state-error" role="alert"><span>{error}</span><button onClick={load} type="button">Try again</button></div> : null}
        {loading ? <div className="rating-directory-loading" role="status">Refreshing product ratings…</div> : ratings.length ? <><div className="table-wrap rating-table-wrap"><table className="tenant-table rating-table"><thead><tr><th>Rating</th><th>Product</th><th>Customer</th><th>Purchase</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{ratings.map((rating) => <tr key={rating.id}><td data-label="Rating"><button className="rating-review-cell" onClick={() => setSelectedId(rating.id)} type="button"><Stars compact value={rating.rating} /><strong>{rating.title || "No review title"}</strong><small>{rating.review || "Rating only"}</small></button></td><td data-label="Product"><span className="rating-product-cell"><span>{rating.imageUrl ? <img alt="" src={rating.imageUrl} /> : <Star aria-hidden="true" size={16} />}</span><span><strong>{rating.productName}</strong><small>{rating.productCode} · {rating.sku}</small></span></span></td><td data-label="Customer"><strong>{rating.customerName}</strong><small className="rating-table-sub">{rating.customerEmail || "Email unavailable"}</small></td><td data-label="Purchase">{rating.verifiedPurchase ? <span className="rating-verified"><BadgeCheck aria-hidden="true" size={14} />Verified</span> : <span className="rating-unverified">Unverified</span>}<small className="rating-table-sub">{rating.orderNumber || "No linked order"}</small></td><td data-label="Submitted"><strong>{formatDate(rating.submittedAt)}</strong><small className="rating-table-sub">{rating.helpfulCount} helpful</small></td><td data-label="Status"><Status tone={statusTone[rating.status]}>{statusLabel(rating.status)}</Status></td><td><button aria-label={`View rating for ${rating.productName}`} className="row-action table-view-action" onClick={() => setSelectedId(rating.id)} type="button"><Eye aria-hidden="true" size={15} />View<ChevronRight aria-hidden="true" size={14} /></button></td></tr>)}</tbody></table></div><TablePagination itemLabel="ratings" onPageChange={(page) => setFilters((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, page: 1, pageSize }))} page={result.page} pageSize={result.pageSize} total={result.total} totalPages={result.totalPages} /></> : <div className="empty-workspace rating-empty"><MessageSquareText aria-hidden="true" size={30} /><h3>No product ratings match this view</h3><p>Ratings submitted by customers will appear here for review and publication.</p></div>}
      </section>
    </>}
    {selectedId ? <RatingDetails accessToken={accessToken} canModerate={canModerate} onClose={() => setSelectedId(null)} onUpdated={load} ratingId={selectedId} tenantId={tenantId} /> : null}
  </AppShell>;
}
